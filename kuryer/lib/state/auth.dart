import 'package:flutter/foundation.dart';

import '../services/api.dart';
import '../services/cache.dart';
import '../services/fcm.dart';
import '../services/location.dart';

/// Auth store — faqat courier rolli akkauntlar.
class AuthState extends ChangeNotifier {
  AuthState() {
    api.onUnauthorized = () {
      if (username == null && role == null) return;
      username = null;
      name = null;
      phone = null;
      role = null;
      clearCache();
      notifyListeners();
    };
  }

  String? username;
  String? name;
  String? phone;
  String? role;

  void _applyMe(Map<String, dynamic> me) {
    username = me['username'] as String?;
    name = me['name'] as String?;
    phone = me['phone'] as String?;
    role = me['role'] as String?;
  }

  Future<void> login(String username, String password) async {
    final res = await api.post('/admin/auth/login', {
      'username': username,
      'password': password,
    }) as Map<String, dynamic>;
    await api.setToken(res['access_token'] as String);
    try {
      final me = await api.get('/admin/auth/me') as Map<String, dynamic>;
      if (me['role'] != 'courier') {
        await api.setToken(null);
        throw Exception('Faqat kuryer hisobi ruxsat etilgan');
      }
      _applyMe(me);
      notifyListeners();
      // Login dan keyin FCM token backendga.
      try {
        await fcm.syncToken();
      } catch (_) {}
    } catch (e) {
      await api.setToken(null);
      this.username = null;
      name = null;
      phone = null;
      role = null;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> logout() async {
    try {
      await fcm.clearToken();
    } catch (_) {}
    // Avval sessiyani yopish — UI darhol Login'ga o'tsin.
    username = null;
    name = null;
    phone = null;
    role = null;
    clearCache();
    await api.setToken(null);
    notifyListeners();
    try {
      await locationService.stop();
    } catch (_) {}
  }

  Future<void> loadMe() async {
    final me = await api.get('/admin/auth/me') as Map<String, dynamic>;
    _applyMe(me);
    notifyListeners();
  }

  Future<void> updateProfile({String? name, String? phone}) async {
    final me = await api.patch('/admin/auth/me', {
      'name': name,
      'phone': phone,
    }) as Map<String, dynamic>;
    _applyMe(me);
    notifyListeners();
  }

  Future<void> changePassword(String oldPassword, String newPassword) async {
    await api.post('/admin/auth/change-password', {
      'old_password': oldPassword,
      'new_password': newPassword,
    });
  }
}
