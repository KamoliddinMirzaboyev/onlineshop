import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../core/theme.dart';
import '../widgets/common.dart';
import 'notification_permission_page.dart';

/// Onboarding — joylashuv ruxsati sahifasi.
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

  void _goNext() {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const NotificationPermissionPage()),
    );
  }

  @override
  Widget build(BuildContext context) {
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
                    colors: [Color(0xFF22C55E), Color(0xFF15803D)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.brand.withValues(alpha: 0.3),
                      blurRadius: 28,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: const Icon(Icons.location_on_rounded, size: 52, color: Colors.white),
              ),
              const SizedBox(height: 32),
              const Text(
                'Joylashuvingizni ulashing 📍',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  color: AppColors.slate900,
                  letterSpacing: -0.4,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              const Text(
                'Sizga eng yaqin bo\'lgan filiallarni ko\'rsatish va yetkazib berish vaqtini daqiqasigacha aniq hisoblash uchun joylashuv ruxsati zarur.',
                style: TextStyle(fontSize: 14, color: AppColors.slate500, height: 1.45),
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              AppButton(
                label: 'Ruxsat berish',
                expand: true,
                loading: _loading,
                onPressed: _allow,
              ),
              const SizedBox(height: 12),
              GhostButton(
                label: 'Keyinroq',
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
