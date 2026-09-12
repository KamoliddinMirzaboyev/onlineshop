import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// HTTP client mirroring `src/api.ts`. Holds the courier bearer token in memory
/// and persists it to secure storage (Android Keystore / iOS Keychain) — not
/// plain SharedPreferences, since this token grants full courier API access.
class ApiException implements Exception {
  ApiException(this.statusCode, this.message);
  final int statusCode;
  final String message;

  /// Backend (FastAPI) errors are `{"detail": "..."}`. Falls back to the raw
  /// body / [fallback] when it isn't that shape, so the user sees the real
  /// reason (e.g. "Ba'zi buyurtmalar mos holatda emas") instead of a generic
  /// "xatolik yuz berdi" for every failure.
  String userMessage(String fallback) {
    if (statusCode <= 0) return fallback;
    try {
      final decoded = jsonDecode(message);
      if (decoded is Map && decoded['detail'] is String) {
        final d = decoded['detail'] as String;
        return d.isEmpty ? fallback : d;
      }
    } catch (_) {/* not JSON */}
    return fallback;
  }

  @override
  String toString() => '$statusCode: $message';
}

class UnauthorizedException extends ApiException {
  UnauthorizedException() : super(401, 'Unauthorized');
}

/// Thrown when a request exceeds [ApiService._timeout] — kept as an
/// [ApiException] (statusCode 0) so every call site's single `catch` still
/// works, and `userMessage` correctly falls back to the given text.
class ApiTimeoutException extends ApiException {
  ApiTimeoutException() : super(0, 'timeout');
}

class ApiService {
  ApiService._();
  static final ApiService instance = ApiService._();

  static const _base = 'https://api.barakali-bozor.uz/api';
  static const _tokenKey = 'af_courier_token';
  static const _refreshTokenKey = 'af_courier_refresh_token';
  static const _timeout = Duration(seconds: 15);
  static const _storage = FlutterSecureStorage();

  String? _token;
  String? _refreshToken;

  /// Parallel so'rovlar bitta refreshni kutadi — aks holda ular bir-birining
  /// yangi tokenini eskirtirib, kuryerni login ekraniga tashlab yuborardi.
  Future<bool>? _refreshFuture;

  /// Called once from main() before runApp.
  Future<void> init() async {
    _token = await _migrateAndRead();
    try {
      _refreshToken = await _storage.read(key: _refreshTokenKey);
    } catch (e) {
      debugPrint('Secure storage read failed: $e');
    }
  }

  /// One-time move off the old plain-text SharedPreferences token (pre
  /// secure-storage builds) so upgrading users aren't logged out.
  ///
  /// Guarded end-to-end: on some Android devices the Keystore entry can throw
  /// (OS restore, lock-screen/biometric reset invalidating the key, OEM bugs)
  /// — this must never throw out of `init()`, or `main()` fails to boot the
  /// app at all. Worst case here is just "treated as logged out".
  Future<String?> _migrateAndRead() async {
    try {
      final secure = await _storage.read(key: _tokenKey);
      if (secure != null && secure.isNotEmpty) return secure;
    } catch (e) {
      debugPrint('Secure storage read failed: $e');
    }
    try {
      final prefs = await SharedPreferences.getInstance();
      final legacy = prefs.getString(_tokenKey);
      if (legacy != null && legacy.isNotEmpty) {
        await prefs.remove(_tokenKey);
        try {
          await _storage.write(key: _tokenKey, value: legacy);
        } catch (_) {/* still usable this session from memory */}
        return legacy;
      }
    } catch (_) {/* no legacy prefs — fresh install */}
    return null;
  }

  bool get hasToken => _token != null && _token!.isNotEmpty;

  /// In-memory `_token` is the source of truth for the running session even
  /// if the persist step below fails — a broken Keystore shouldn't block
  /// login, it just won't survive an app restart.
  Future<void> setTokens({String? access, String? refresh}) async {
    _token = access;
    if (refresh != null) {
      _refreshToken = refresh;
    } else if (access == null) {
      _refreshToken = null;
    }

    try {
      if (access != null && access.isNotEmpty) {
        await _storage.write(key: _tokenKey, value: access);
      } else {
        await _storage.delete(key: _tokenKey);
      }
      if (_refreshToken != null && _refreshToken!.isNotEmpty) {
        await _storage.write(key: _refreshTokenKey, value: _refreshToken!);
      } else {
        await _storage.delete(key: _refreshTokenKey);
      }
    } catch (e) {
      debugPrint('Secure storage write failed: $e');
    }
  }

  Future<void> setToken(String? t) => setTokens(access: t);

  /// Access token qisqa muddatli (server: 1 soat). Muddati tugaganda kuryer
  /// smena o'rtasida login ekraniga tushmasligi uchun fonda yangilanadi.
  Future<bool> _tryRefreshToken() {
    if (_refreshToken == null || _refreshToken!.isEmpty) {
      return Future.value(false);
    }
    return _refreshFuture ??=
        _doRefresh().whenComplete(() => _refreshFuture = null);
  }

  Future<bool> _doRefresh() async {
    try {
      final res = await http
          .post(
            Uri.parse('$_base/auth/refresh'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'refresh_token': _refreshToken}),
          )
          .timeout(_timeout);
      if (res.statusCode != 200) return false;
      final data = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      final access = data['access_token'] as String?;
      if (access == null || access.isEmpty) return false;
      await setTokens(access: access, refresh: data['refresh_token'] as String?);
      return true;
    } catch (e) {
      debugPrint('Token refresh failed: $e');
      return false;
    }
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (hasToken) 'Authorization': 'Bearer $_token',
      };

  /// Fired on a 401 so the app can bounce back to the login screen.
  void Function()? onUnauthorized;

  Future<dynamic> _request(
    String method,
    String path, {
    Object? body,
    bool retryOnUnauthorized = true,
  }) async {
    final uri = Uri.parse('$_base$path');
    late http.Response res;
    try {
      switch (method) {
        case 'POST':
          res = await http
              .post(uri, headers: _headers, body: jsonEncode(body))
              .timeout(_timeout);
          break;
        case 'PATCH':
          res = await http
              .patch(uri, headers: _headers, body: jsonEncode(body))
              .timeout(_timeout);
          break;
        case 'DELETE':
          res = await http.delete(uri, headers: _headers).timeout(_timeout);
          break;
        default:
          res = await http.get(uri, headers: _headers).timeout(_timeout);
      }
    } on TimeoutException {
      throw ApiTimeoutException();
    }

    if (res.statusCode == 401) {
      // Muddati tugagan access tokenni bir marta yangilab ko'ramiz.
      if (retryOnUnauthorized && await _tryRefreshToken()) {
        return _request(method, path, body: body, retryOnUnauthorized: false);
      }
      await setTokens(access: null, refresh: null);
      onUnauthorized?.call();
      throw UnauthorizedException();
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(res.statusCode, res.body);
    }
    if (res.statusCode == 204 || res.body.isEmpty) return null;
    return jsonDecode(utf8.decode(res.bodyBytes));
  }

  /// Chiqishdan oldin serverga xabar: token Redis qora ro'yxatiga tushadi.
  /// Javob kutilmaydi va xato yutiladi — internet yo'q bo'lsa ham foydalanuvchi
  /// ilovadan chiqa olishi kerak (lokal tokenlar baribir o'chiriladi).
  Future<void> logout(String path) async {
    if (!hasToken) return;
    final refresh = _refreshToken;
    try {
      await _request('POST', path, body: {'refresh_token': refresh});
    } catch (_) {
      /* offline / 401 — lokal tozalash baribir bajariladi */
    }
  }

  Future<dynamic> get(String path) => _request('GET', path);
  Future<dynamic> post(String path, Object? body) => _request('POST', path, body: body);
  Future<dynamic> patch(String path, Object? body) => _request('PATCH', path, body: body);
  Future<dynamic> delete(String path) => _request('DELETE', path);
}

final api = ApiService.instance;

/// Read the real reason for a failed API call, falling back to [fallback] for
/// non-API errors (offline, timeout, parse failure) or bodies without a
/// `detail` field.
String apiErrorMessage(Object error, String fallback) =>
    error is ApiException ? error.userMessage(fallback) : fallback;
