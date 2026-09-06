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
  static const _storage = FlutterSecureStorage();

  String? _token;

  /// Called once from main() before runApp.
  Future<void> init() async {
    try {
      _token = await _storage.read(key: _tokenKey);
    } catch (_) {
      _token = null;
    }
  }

  bool get hasToken => _token != null && _token!.isNotEmpty;

  Future<void> setToken(String? t) async {
    _token = t;
    try {
      if (t != null) {
        await _storage.write(key: _tokenKey, value: t);
      } else {
        await _storage.delete(key: _tokenKey);
      }
    } catch (_) {
      // Keychain/Keystore vaqtincha ishlamasa ham — token xotirada saqlanadi,
      // shu sessiya davomida kirish uzilmaydi.
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
      await setToken(null);
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
