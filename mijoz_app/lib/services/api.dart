import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

/// HTTP client mirroring `src/api.ts`. Holds the client bearer token in memory
/// and persists it to Keychain/Keystore (secure — unlike SharedPreferences,
/// which stores plain text readable by any app with root/jailbreak access).
class ApiException implements Exception {
  ApiException(this.statusCode, this.message);
  final int statusCode;
  final String message;

  String get userFriendlyMessage {
    try {
      final decoded = jsonDecode(message);
      if (decoded is Map && decoded['detail'] != null) {
        final detail = decoded['detail'];
        if (detail is String) return detail;
        if (detail is List && detail.isNotEmpty) {
          final first = detail.first;
          if (first is Map && first['msg'] != null) return first['msg'].toString();
        }
        return detail.toString();
      }
    } catch (_) {}
    return message.trim().isNotEmpty ? message : 'Xatolik yuz berdi';
  }

  @override
  String toString() => '$statusCode: $message';
}

class UnauthorizedException extends ApiException {
  UnauthorizedException() : super(401, 'Unauthorized');
}

class ApiService {
  ApiService._();
  static final ApiService instance = ApiService._();

  static const _base = 'https://api.barakali-bozor.uz/api';
  static const _tokenKey = 'af_mijoz_token';
  static const _refreshTokenKey = 'af_mijoz_refresh_token';
  static const _storage = FlutterSecureStorage();

  String? _token;
  String? _refreshToken;
  bool _isRefreshing = false;

  /// Called once from main() before runApp.
  Future<void> init() async {
    try {
      _token = await _storage.read(key: _tokenKey);
      _refreshToken = await _storage.read(key: _refreshTokenKey);
    } catch (_) {
      _token = null;
      _refreshToken = null;
    }
  }

  bool get hasToken => _token != null && _token!.isNotEmpty;
  String? get token => _token;
  String? get refreshToken => _refreshToken;

  Future<void> setTokens({String? access, String? refresh}) async {
    _token = access;
    if (refresh != null) _refreshToken = refresh;

    try {
      if (access != null) {
        await _storage.write(key: _tokenKey, value: access);
      } else {
        await _storage.delete(key: _tokenKey);
      }
      if (refresh != null) {
        await _storage.write(key: _refreshTokenKey, value: refresh);
      } else if (access == null) {
        await _storage.delete(key: _refreshTokenKey);
      }
    } catch (_) {
      // Keychain/Keystore vaqtincha ishlamasa ham — xotirada saqlanadi.
    }
  }

  Future<void> setToken(String? t) => setTokens(access: t);

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (hasToken) 'Authorization': 'Bearer $_token',
      };

  /// Fired on a permanent 401 so the app can bounce back to the login screen.
  void Function()? onUnauthorized;

  /// Fondagi avtomatik Refresh Token almashinuvi
  Future<bool> _tryRefreshToken() async {
    if (_isRefreshing || _refreshToken == null || _refreshToken!.isEmpty) {
      return false;
    }
    _isRefreshing = true;
    try {
      final uri = Uri.parse('$_base/auth/refresh');
      final res = await http
          .post(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'refresh_token': _refreshToken}),
          )
          .timeout(const Duration(seconds: 10));

      if (res.statusCode == 200) {
        final data = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
        final newAccess = data['access_token'] as String?;
        final newRefresh = data['refresh_token'] as String?;
        if (newAccess != null && newAccess.isNotEmpty) {
          await setTokens(access: newAccess, refresh: newRefresh);
          return true;
        }
      }
    } catch (_) {} finally {
      _isRefreshing = false;
    }
    return false;
  }

  Future<dynamic> _request(
    String method,
    String path, {
    Object? body,
    bool isRetry = false,
  }) async {
    final uri = Uri.parse('$_base$path');
    const timeout = Duration(seconds: 15);
    late http.Response res;
    switch (method) {
      case 'POST':
        res = await http.post(uri, headers: _headers, body: jsonEncode(body)).timeout(timeout);
        break;
      case 'PATCH':
        res = await http.patch(uri, headers: _headers, body: jsonEncode(body)).timeout(timeout);
        break;
      case 'DELETE':
        res = await http.delete(uri, headers: _headers).timeout(timeout);
        break;
      default:
        res = await http.get(uri, headers: _headers).timeout(timeout);
    }

    if (res.statusCode == 401) {
      // Refresh token endpoint o'zi 401 bersa yoki allaqachon retry qilingan bo'lsa
      if (!isRetry && path != '/auth/refresh' && _refreshToken != null) {
        final refreshed = await _tryRefreshToken();
        if (refreshed) {
          // Yangi access token bilan xuddi shu so'rovni qayta yuboramiz!
          return _request(method, path, body: body, isRetry: true);
        }
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

  Future<dynamic> get(String path) => _request('GET', path);
  Future<dynamic> post(String path, Object? body) => _request('POST', path, body: body);
  Future<dynamic> patch(String path, Object? body) => _request('PATCH', path, body: body);
  Future<dynamic> delete(String path) => _request('DELETE', path);
}

final api = ApiService.instance;
