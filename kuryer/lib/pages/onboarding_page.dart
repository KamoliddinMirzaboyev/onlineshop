import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/theme.dart';

const _onboardingKey = 'af_onboarding_done_v1';

Future<bool> isOnboardingDone() async {
  final p = await SharedPreferences.getInstance();
  return p.getBool(_onboardingKey) ?? false;
}

Future<void> markOnboardingDone() async {
  final p = await SharedPreferences.getInstance();
  await p.setBool(_onboardingKey, true);
}

class _Slide {
  const _Slide({
    required this.icon,
    required this.title,
    required this.body,
    required this.accent,
  });

  final IconData icon;
  final String title;
  final String body;
  final Color accent;
}

const _slides = [
  _Slide(
    icon: Icons.inventory_2_outlined,
    title: 'Buyurtmalarni boshqaring',
    body:
        'Yangi buyurtmalarni qabul qiling, holatini yangilang va yetkazib berishni bir joydan kuzating.',
    accent: AppColors.brand,
  ),
  _Slide(
    icon: Icons.navigation_outlined,
    title: 'Tez navigatsiya',
    body:
        'Google Maps yoki Yandex Navigator orqali mijoz manziliga bir bosishda yo‘l oling.',
    accent: AppColors.blue600,
  ),
  _Slide(
    icon: Icons.widgets_outlined,
    title: 'Uy ekranida buyurtmalar',
    body:
        'Home Widget orqali faol buyurtmalaringizni ilovani ochmasdan ham ko‘ring. Bildirishnomalar ham yoniq bo‘lsin.',
    accent: AppColors.cyan600,
  ),
];

/// Birinchi ochilishda ko‘rsatiladigan onboarding (3 sahifa).
class OnboardingPage extends StatefulWidget {
  const OnboardingPage({super.key, required this.onDone});

  final VoidCallback onDone;

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  final _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    await markOnboardingDone();
    widget.onDone();
  }

  void _next() {
    if (_index >= _slides.length - 1) {
      _finish();
      return;
    }
    _controller.nextPage(
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final slide = _slides[_index];
    final isLast = _index == _slides.length - 1;

    return Scaffold(
      backgroundColor: AppColors.slate50,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
              child: Row(
                children: [
                  const Spacer(),
                  if (!isLast)
                    TextButton(
                      onPressed: _finish,
                      child: const Text(
                        'O‘tkazib yuborish',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: AppColors.slate500,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _slides.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (context, i) {
                  final s = _slides[i];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 28),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 120,
                          height: 120,
                          decoration: BoxDecoration(
                            color: s.accent.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(32),
                            border: Border.all(
                              color: s.accent.withValues(alpha: 0.25),
                            ),
                          ),
                          child: Icon(s.icon, size: 56, color: s.accent),
                        ),
                        const SizedBox(height: 36),
                        Text(
                          s.title,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                            color: AppColors.slate900,
                            height: 1.25,
                          ),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          s.body,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 15,
                            height: 1.5,
                            color: AppColors.slate500,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 28),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(_slides.length, (i) {
                      final active = i == _index;
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 220),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        width: active ? 22 : 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: active ? slide.accent : AppColors.slate200,
                          borderRadius: BorderRadius.circular(99),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 22),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _next,
                      style: FilledButton.styleFrom(
                        backgroundColor: slide.accent,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: Text(
                        isLast ? 'Boshlash' : 'Keyingi',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
