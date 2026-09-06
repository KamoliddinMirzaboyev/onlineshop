import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../services/api.dart';
import '../widgets/common.dart';
import 'app_shell.dart';

/// Onboarding — bildirishnoma ruxsati. Buyurtma holati (qabul qilindi,
/// yo'lda, yetkazildi) push orqali kelishi uchun.
class NotificationPermissionPage extends StatefulWidget {
  const NotificationPermissionPage({super.key});

  @override
  State<NotificationPermissionPage> createState() => _NotificationPermissionPageState();
}

class _NotificationPermissionPageState extends State<NotificationPermissionPage> {
  bool _loading = false;

  Future<void> _allow() async {
    setState(() => _loading = true);
    try {
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      final token = await messaging.getToken();
      if (token != null) {
        await api.post('/auth/fcm-token', {'fcm_token': token});
      }
    } catch (_) {
      // Firebase sozlanmagan bo'lishi mumkin — onboardingni to'xtatmaymiz.
    } finally {
      _goNext();
    }
  }

  // ponytail: joriy sahifaning o'z context'i orqali navigatsiya (qarang:
  // location_permission_page.dart'dagi izoh — tashqi context capture qilish
  // "deactivated widget" xatosiga olib keladi).
  void _goNext() {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const AppShell()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.slate50,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 96,
                height: 96,
                decoration: const BoxDecoration(color: AppColors.brandLight, shape: BoxShape.circle),
                child: const Icon(Icons.notifications_active_rounded, size: 48, color: Colors.white),
              ),
              const SizedBox(height: 24),
              const Text(
                'Bildirishnomalarni yoqing',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.slate900),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Text(
                'Buyurtmangiz holati (tayyorlanmoqda, yo\'lda, yetkazildi) haqida darhol xabar bering',
                style: TextStyle(fontSize: 14, color: AppColors.slate500),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              AppButton(
                label: 'Ruxsat berish',
                expand: true,
                loading: _loading,
                onPressed: _allow,
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: _goNext,
                child: const Text('Keyinroq', style: TextStyle(color: AppColors.slate400)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
