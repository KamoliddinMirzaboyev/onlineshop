import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'api.dart';

/// FCM tokenni serverga yozadi — pushning yagona kirish nuqtasi.
///
/// Avval bu kod uch joyda takrorlanardi va login'dan keyin (onboarding'dagi
/// "Bildirishnomaga ruxsat" sahifasi o'tkazib yuborilsa) token umuman
/// yozilmasdi — mijoz keyingi ilova ochilishigacha push olmasdi.
///
/// [askPermission] — faqat onboarding sahifasida `true`: OS dialogi
/// foydalanuvchiga tushuntirilgandan keyin chiqsin. Android'da ruxsatsiz ham
/// token olinadi, shuning uchun login'dan keyin darhol ro'yxatdan o'tkazamiz.
Future<void> registerFcmToken({bool askPermission = false}) async {
  if (!api.hasToken) return;
  try {
    final messaging = FirebaseMessaging.instance;
    if (askPermission) {
      await messaging.requestPermission();
    }
    final token = await messaging.getToken();
    if (token != null && token.isNotEmpty && api.hasToken) {
      await api.post('/auth/fcm-token', {'fcm_token': token});
    }
  } catch (e) {
    debugPrint('FCM token registration failed: $e');
  }
}

/// Token almashganda (Firebase uni vaqti-vaqti bilan yangilaydi) serverga yozish.
void listenFcmTokenRefresh() {
  try {
    FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
      if (!api.hasToken) return;
      api.post('/auth/fcm-token', {'fcm_token': newToken}).catchError((_) => null);
    });
  } catch (e) {
    debugPrint('FCM onTokenRefresh not set up: $e');
  }
}
