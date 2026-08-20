import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'api.dart';
import 'notifications.dart';

/// Firebase Cloud Messaging — app yopiq / ekran o'chiq holatda ham push.
///
/// Backend `notify_*` FCM yuboradi; shu modul tokenni saqlaydi va foreground
/// xabarlarni local notification kanaliga o'tkazadi.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Background isolate — Firebase qayta init kerak.
  try {
    await Firebase.initializeApp();
  } catch (_) {
    /* already init */
  }
  // `notification` payload bo'lsa Android OS o'zi ko'rsatadi.
  // Data-only bo'lsa local show (kamdan-kam).
  final n = message.notification;
  if (n == null && (message.data['title'] != null || message.data['body'] != null)) {
    await notifications.init();
    await notifications.showOrderAlert(
      title: '${message.data['title'] ?? 'BB Kuryer'}',
      body: '${message.data['body'] ?? ''}',
    );
  }
}

class FcmService {
  FcmService._();
  static final FcmService instance = FcmService._();

  bool _ready = false;
  bool _handlersWired = false;
  bool _refreshWired = false;

  Future<bool> init() async {
    if (_ready) return true;
    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );
      _wireHandlers();
      _ready = true;
      return true;
    } catch (e) {
      debugPrint('FCM init failed (google-services.json?): $e');
      return false;
    }
  }

  void _wireHandlers() {
    if (_handlersWired) return;
    _handlersWired = true;

    // App oldinda ochiq — OS notification ko'rsatmaydi, o'zimiz local show.
    FirebaseMessaging.onMessage.listen((RemoteMessage message) async {
      final n = message.notification;
      final title = n?.title ?? message.data['title']?.toString() ?? 'BB Kuryer';
      final body = n?.body ?? message.data['body']?.toString() ?? '';
      if (body.isEmpty && (n?.title == null)) return;
      await notifications.showOrderAlert(title: title, body: body);
    });

    FirebaseMessaging.onMessageOpenedApp.listen((_) {
      // NavShell poll allaqachon yangilaydi; deep-link keyinroq.
    });
  }

  /// Login / resume: ruxsat + token → backend.
  Future<void> syncToken() async {
    if (!_ready) {
      final ok = await init();
      if (!ok) return;
    }
    if (!api.hasToken) return;
    try {
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        return;
      }
      // Android 13+ local channel permission bilan birga.
      await notifications.requestPermission();

      final token = await messaging.getToken();
      if (token == null || token.isEmpty) return;
      await api.post('/courier/push/fcm-token', {'fcm_token': token});

      if (!_refreshWired) {
        _refreshWired = true;
        messaging.onTokenRefresh.listen((t) async {
          if (!api.hasToken || t.isEmpty) return;
          try {
            await api.post('/courier/push/fcm-token', {'fcm_token': t});
          } catch (_) {
            /* offline */
          }
        });
      }
    } catch (e) {
      debugPrint('FCM syncToken failed: $e');
    }
  }

  Future<void> clearToken() async {
    if (!api.hasToken) return;
    try {
      await api.delete('/courier/push/fcm-token');
    } catch (_) {
      /* ignore */
    }
    try {
      if (_ready) await FirebaseMessaging.instance.deleteToken();
    } catch (_) {
      /* ignore */
    }
  }
}

final fcm = FcmService.instance;
