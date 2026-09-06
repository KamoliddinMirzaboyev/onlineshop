import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../core/theme.dart';
import '../widgets/common.dart';
import 'notification_permission_page.dart';

/// Onboarding — joylashuv ruxsati. Ro'yxatdan o'tgach, eng yaqin do'konni
/// topish uchun bir marta so'raladi (keyin StoreProvider ham so'raydi, lekin
/// ruxsat allaqachon berilgan bo'lsa jim o'tkazib yuboradi).
class LocationPermissionPage extends StatefulWidget {
  const LocationPermissionPage({super.key});

  @override
  State<LocationPermissionPage> createState() => _LocationPermissionPageState();
}

class _LocationPermissionPageState extends State<LocationPermissionPage> {
  bool _loading = false;

  Future<void> _allow() async {
    setState(() => _loading = true);
    try {
      if (await Geolocator.isLocationServiceEnabled()) {
        var permission = await Geolocator.checkPermission();
        if (permission == LocationPermission.denied) {
          await Geolocator.requestPermission();
        }
      }
    } finally {
      _goNext();
    }
  }

  // ponytail: har safar joriy (hali disposed bo'lmagan) sahifaning o'z
  // context'i orqali navigatsiya — bu navbatdagi sahifaga callback sifatida
  // uzatilgan tashqi context bilan bog'liq "deactivated widget" xatosini oldini oladi.
  void _goNext() {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const NotificationPermissionPage()),
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
                child: const Icon(Icons.location_on_rounded, size: 48, color: Colors.white),
              ),
              const SizedBox(height: 24),
              const Text(
                'Joylashuvingizni ulashing',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.slate900),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Text(
                'Eng yaqin do\'kon va yetkazib berish vaqtini aniq hisoblash uchun joylashuvingiz kerak',
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
