import 'package:flutter/material.dart';

import '../core/theme.dart';

/// Boot splash — mirrors `Splash.tsx`: pulsing rings, popping logo, wobbling
/// bike icon, and loading dots on a brand gradient.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  late final AnimationController _ring =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))..repeat();
  late final AnimationController _logo =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 700))..forward();
  late final AnimationController _wobble =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..repeat(reverse: true);
  late final AnimationController _dots =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat();

  @override
  void dispose() {
    _ring.dispose();
    _logo.dispose();
    _wobble.dispose();
    _dots.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [AppColors.brandLight, AppColors.brand],
        ),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox(
                width: 180,
                height: 130,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // Pulsing rings
                    for (final delay in [0.0, 0.5])
                      AnimatedBuilder(
                        animation: _ring,
                        builder: (context, _) {
                          final t = (_ring.value + delay) % 1.0;
                          return Opacity(
                            opacity: (0.5 * (1 - t)).clamp(0.0, 0.5),
                            child: Transform.scale(
                              scale: 1 + t * 0.8,
                              child: Container(
                                width: 96,
                                height: 96,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(24),
                                  border: Border.all(color: Colors.white.withValues(alpha: 0.4), width: 2),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    // Logo pop — transparent brand mark
                    ScaleTransition(
                      scale: CurvedAnimation(parent: _logo, curve: Curves.elasticOut),
                      child: AnimatedBuilder(
                        animation: _wobble,
                        builder: (context, child) => Transform.translate(
                          offset: Offset((_wobble.value - 0.5) * 6, 0),
                          child: child,
                        ),
                        child: Image.asset(
                          'assets/icon/logo.png',
                          width: 96,
                          height: 96,
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => const Icon(
                            Icons.shopping_bag_rounded,
                            size: 46,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Barakali Bozor',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
              ),
              const SizedBox(height: 4),
              Text(
                'Taomlarni yetkazib berish',
                style: TextStyle(fontSize: 14, color: Colors.white.withValues(alpha: 0.8)),
              ),
            ],
          ),
          Positioned(
            bottom: 64,
            child: AnimatedBuilder(
              animation: _dots,
              builder: (context, _) {
                return Row(
                  mainAxisSize: MainAxisSize.min,
                  children: List.generate(3, (i) {
                    final t = (_dots.value + i * 0.15) % 1.0;
                    final wave = (0.5 - (t - 0.5).abs()) * 2; // 0..1..0
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      child: Transform.translate(
                        offset: Offset(0, -4 * wave),
                        child: Opacity(
                          opacity: 0.3 + 0.7 * wave,
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                          ),
                        ),
                      ),
                    );
                  }),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
