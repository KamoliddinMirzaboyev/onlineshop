import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// HTTP client mirroring `src/api.ts`. Holds the courier bearer token in memory
/// and persists it to SharedPreferences (like localStorage on web).
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

  static const _base = 'https://allfoodapi.webportfolio.uz/api';
  static const _tokenKey = 'af_courier_token';

  String? _token;
  SharedPreferences? _prefs;

  /// Called once from main() before runApp.
  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    _token = _prefs!.getString(_tokenKey);
  }

  bool get hasToken => _token != null && _token!.isNotEmpty;

  Future<void> setToken(String? t) async {
    _token = t;
    if (t != null) {
      await _prefs?.setString(_tokenKey, t);
    } else {
      await _prefs?.remove(_tokenKey);
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
    late http.Response res;
    switch (method) {
      case 'POST':
        res = await http.post(uri, headers: _headers, body: jsonEncode(body));
        break;
      case 'PATCH':
        res = await http.patch(uri, headers: _headers, body: jsonEncode(body));
        break;
      case 'DELETE':
        res = await http.delete(uri, headers: _headers);
        break;
      default:
        res = await http.get(uri, headers: _headers);
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
