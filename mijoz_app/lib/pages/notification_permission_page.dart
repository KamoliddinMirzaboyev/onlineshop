import 'package:flutter/material.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../services/api.dart';
import '../services/push.dart';
import '../widgets/common.dart';
import 'app_shell.dart';

/// Onboarding — bildirishnoma ruxsati sahifasi.
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
      await registerFcmToken(askPermission: true);
    } finally {
      _goNext();
    }
  }

  void _goNext() {
    // "Keyinroq" bosilsa ham tokenni yozib qo'yamiz (ruxsat so'ramasdan):
    // foydalanuvchi keyin sozlamalardan bildirishnomani yoqsa, push darhol
    // ishlaydi — ilovani qayta ochish shart emas.
    registerFcmToken();
    api.markOnboarded();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const AppShell()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tr = context.tr;
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Spacer(),
              // Icon container
              Container(
                width: 104,
                height: 104,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF3B82F6), Color(0xFF1D4ED8)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF3B82F6).withValues(alpha: 0.3),
                      blurRadius: 28,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: const Icon(Icons.notifications_active_rounded, size: 52, color: Colors.white),
              ),
              const SizedBox(height: 32),
              Text(
                tr.permNotificationTitle,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  color: AppColors.slate900,
                  letterSpacing: -0.4,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                tr.permNotificationDesc,
                style: const TextStyle(fontSize: 14, color: AppColors.slate500, height: 1.45),
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              AppButton(
                label: tr.permNotificationAllow,
                expand: true,
                loading: _loading,
                onPressed: _allow,
              ),
              const SizedBox(height: 12),
              GhostButton(
                label: tr.permLocationLater,
                expand: true,
                textColor: AppColors.slate500,
                borderColor: Colors.transparent,
                backgroundColor: Colors.transparent,
                onPressed: _goNext,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
