import 'package:flutter/material.dart';
import '../core/theme.dart';

class _SlidingGradientTransform extends GradientTransform {
  const _SlidingGradientTransform(this.slidePercent);
  final double slidePercent;

  @override
  Matrix4? transform(Rect bounds, {TextDirection? textDirection}) {
    return Matrix4.translationValues(bounds.width * slidePercent, 0.0, 0.0);
  }
}

/// Professional, xoreografiyalangan animatsiyali Splash Screen.
/// Logotip elastik kiradi, uning ostida "Barakali Bozor" yozuvi harfma-harf
/// o'sib chiqadi, yorug'lik nuri (shimmer) to'lqinlanadi va nozik chiziq ochiladi.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  late final AnimationController _entranceController;
  late final AnimationController _ambientController;
  late final AnimationController _ringController;
  late final AnimationController _shimmerController;

  late final Animation<double> _logoScale;
  late final Animation<double> _logoFade;
  late final Animation<double> _lineWidth;
  late final Animation<double> _lineFade;
  late final Animation<double> _subtitleSlide;
  late final Animation<double> _subtitleFade;
  late final Animation<double> _footerFade;

  static const String _brandText = 'Barakali Bozor';

  @override
  void initState() {
    super.initState();

    // 1. Asosiy kirish xoreografiyasi
    _entranceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );

    // 2. Sokin nafas olish (ambient breathing pulse)
    _ambientController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat(reverse: true);

    // 3. Kengayuvchi nur halqalari (ripple glow)
    _ringController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2600),
    )..repeat();

    // 4. Matn ustidagi yorug'lik jilosi (shimmer sweep)
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat();

    // Logo animatsiyasi (0.0 -> 0.45)
    _logoScale = Tween<double>(begin: 0.25, end: 1.0).animate(
      CurvedAnimation(
        parent: _entranceController,
        curve: const Interval(0.0, 0.45, curve: Curves.easeOutBack),
      ),
    );

    _logoFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _entranceController,
        curve: const Interval(0.0, 0.30, curve: Curves.easeOut),
      ),
    );

    // Nozik dekorativ chiziq (0.65 -> 0.85)
    _lineWidth = Tween<double>(begin: 0.0, end: 140.0).animate(
      CurvedAnimation(
        parent: _entranceController,
        curve: const Interval(0.65, 0.85, curve: Curves.easeOutCubic),
      ),
    );

    _lineFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _entranceController,
        curve: const Interval(0.65, 0.80, curve: Curves.easeOut),
      ),
    );

    // Slogan (0.75 -> 0.95)
    _subtitleSlide = Tween<double>(begin: 14.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _entranceController,
        curve: const Interval(0.75, 0.95, curve: Curves.easeOutCubic),
      ),
    );

    _subtitleFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _entranceController,
        curve: const Interval(0.75, 0.92, curve: Curves.easeOut),
      ),
    );

    // Pastki versiya (0.85 -> 1.0)
    _footerFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _entranceController,
        curve: const Interval(0.85, 1.0, curve: Curves.easeOut),
      ),
    );

    _entranceController.forward();
  }

  @override
  void dispose() {
    _entranceController.dispose();
    _ambientController.dispose();
    _ringController.dispose();
    _shimmerController.dispose();
    super.dispose();
  }

  Widget _buildBrandText() {
    // Harflarning ketma-ket (staggered) logotip ostidan paydo bo'lishi
    const startInterval = 0.30;
    const endInterval = 0.70;
    final step = (endInterval - startInterval) / _brandText.length;

    return AnimatedBuilder(
      animation: Listenable.merge([_entranceController, _shimmerController]),
      builder: (context, _) {
        final shimmerVal = (_shimmerController.value * 3.0) - 1.0;

        return ShaderMask(
          blendMode: BlendMode.srcIn,
          shaderCallback: (bounds) {
            return LinearGradient(
              colors: const [
                Colors.white,
                Colors.white,
                Color(0xFFBBF7D0), // yorqin och zumrad jilo
                Colors.white,
                Color(0xFFFEF08A), // nozik oltin nuri
                Colors.white,
                Colors.white,
              ],
              stops: const [0.0, 0.35, 0.45, 0.50, 0.55, 0.65, 1.0],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              transform: _SlidingGradientTransform(shimmerVal),
            ).createShader(bounds);
          },
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(_brandText.length, (i) {
              final char = _brandText[i];
              if (char == ' ') {
                return const SizedBox(width: 8);
              }

              final charStart = (startInterval + (i * step)).clamp(0.0, 0.95);
              final charEnd = (charStart + 0.18).clamp(0.0, 1.0);

              final letterProgress = CurvedAnimation(
                parent: _entranceController,
                curve: Interval(charStart, charEnd, curve: Curves.easeOutBack),
              ).value;

              final opacity = CurvedAnimation(
                parent: _entranceController,
                curve: Interval(charStart, charEnd, curve: Curves.easeOut),
              ).value;

              final translateY = (1.0 - letterProgress) * 22.0;
              final scale = 0.3 + (letterProgress * 0.7);

              return Transform.translate(
                offset: Offset(0, translateY),
                child: Transform.scale(
                  scale: scale,
                  child: Opacity(
                    opacity: opacity,
                    child: Text(
                      char,
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                        letterSpacing: -0.3,
                        shadows: [
                          Shadow(
                            color: Colors.black38,
                            blurRadius: 14,
                            offset: Offset(0, 3),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F5132),
      body: Stack(
        alignment: Alignment.center,
        children: [
          // 1. Hashamatli zumrad gradientli fon
          Positioned.fill(
            child: Container(
              decoration: const BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment(0.0, -0.15),
                  radius: 1.15,
                  colors: [
                    Color(0xFF16A34A), // Yorqin zumrad yashil
                    Color(0xFF15803D), // Asosiy brend yashil
                    Color(0xFF0D5328), // Chuqur o'rmon yashil
                    Color(0xFF09371B), // Premium to'q yashil
                  ],
                  stops: [0.0, 0.35, 0.75, 1.0],
                ),
              ),
            ),
          ),

          // 2. Kengayuvchi nozik yorug'lik halqalari (Ripple glow rings)
          AnimatedBuilder(
            animation: _ringController,
            builder: (context, _) {
              return Stack(
                alignment: Alignment.center,
                children: [
                  for (final offset in [0.0, 0.5]) ...[
                    Builder(
                      builder: (_) {
                        final progress = (_ringController.value + offset) % 1.0;
                        final scale = 1.0 + (progress * 1.6);
                        final opacity = (0.28 * (1.0 - progress)).clamp(0.0, 1.0);
                        return Transform.scale(
                          scale: scale,
                          child: Opacity(
                            opacity: opacity,
                            child: Container(
                              width: 130,
                              height: 130,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: const Color(0xFF86EFAC).withValues(alpha: 0.6),
                                  width: 1.5,
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                ],
              );
            },
          ),

          // 3. Markaziy kontent
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo belgisi + nafas oluvchi soya
                AnimatedBuilder(
                  animation: Listenable.merge([_entranceController, _ambientController]),
                  builder: (context, child) {
                    final ambientScale = 1.0 + (_ambientController.value * 0.035);
                    return Transform.scale(
                      scale: _logoScale.value * ambientScale,
                      child: Opacity(
                        opacity: _logoFade.value,
                        child: child,
                      ),
                    );
                  },
                  child: Container(
                    width: 114,
                    height: 114,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(32),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.8),
                        width: 2.2,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF86EFAC).withValues(alpha: 0.40),
                          blurRadius: 40,
                          spreadRadius: 8,
                          offset: const Offset(0, 4),
                        ),
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.25),
                          blurRadius: 30,
                          offset: const Offset(0, 14),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(18),
                      child: Image.asset(
                        'assets/icon/icon.png',
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => Image.asset(
                          'assets/icon/logo.png',
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => const Icon(
                            Icons.storefront_rounded,
                            size: 54,
                            color: AppColors.brand,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 26),

                // Logotip ostidagi maxsus animatsiyali "Barakali Bozor" yozuvi
                _buildBrandText(),

                const SizedBox(height: 10),

                // Nozik yaltiraydigan kengayuvchi chiziq (glow line)
                AnimatedBuilder(
                  animation: _entranceController,
                  builder: (context, _) {
                    return Opacity(
                      opacity: _lineFade.value,
                      child: Container(
                        width: _lineWidth.value,
                        height: 2,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(2),
                          gradient: const LinearGradient(
                            colors: [
                              Colors.transparent,
                              Color(0xFF86EFAC),
                              Colors.white,
                              Color(0xFF86EFAC),
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),

                const SizedBox(height: 12),

                // Slogan: "Tezkor va sifatli yetkazib berish"
                AnimatedBuilder(
                  animation: _entranceController,
                  builder: (context, child) {
                    return Transform.translate(
                      offset: Offset(0, _subtitleSlide.value),
                      child: Opacity(
                        opacity: _subtitleFade.value,
                        child: child,
                      ),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.22),
                        width: 1,
                      ),
                    ),
                    child: Text(
                      'Tezkor va sifatli yetkazib berish',
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 4. Pastki qism: Nozik progress indikatori va brend versiyasi
          Positioned(
            bottom: 48,
            child: AnimatedBuilder(
              animation: _entranceController,
              builder: (context, child) {
                return Opacity(
                  opacity: _footerFade.value,
                  child: child,
                );
              },
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Nozik yuklanish chizig'i
                  SizedBox(
                    width: 72,
                    height: 3.5,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        backgroundColor: Colors.white.withValues(alpha: 0.2),
                        valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Barakali Bozor • v1.0.0',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.6),
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
