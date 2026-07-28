import 'package:flutter/material.dart';

/// Brand palette — mirrors the courier web app (Tailwind `brand: #16A34A`,
/// slate greys, and the status accent colours).
class AppColors {
  static const brand = Color(0xFF16A34A);
  static const brandLight = Color(0xFF22C55E);

  // slate scale
  static const slate50 = Color(0xFFF8FAFC);
  static const slate100 = Color(0xFFF1F5F9);
  static const slate200 = Color(0xFFE2E8F0);
  static const slate300 = Color(0xFFCBD5E1);
  static const slate400 = Color(0xFF94A3B8);
  static const slate500 = Color(0xFF64748B);
  static const slate600 = Color(0xFF475569);
  static const slate700 = Color(0xFF334155);
  static const slate900 = Color(0xFF0F172A);

  // accents
  static const cyan600 = Color(0xFF0891B2);
  static const blue600 = Color(0xFF2563EB);
  static const emerald600 = Color(0xFF059669);
  static const rose500 = Color(0xFFF43F5E);
  static const red600 = Color(0xFFDC2626);
  static const amber600 = Color(0xFFD97706);
}

class AppTheme {
  static ThemeData get light {
    final base = ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: AppColors.slate50,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.brand,
        primary: AppColors.brand,
      ),
      fontFamily: 'Roboto',
    );
    return base.copyWith(
      textTheme: base.textTheme.apply(
        bodyColor: AppColors.slate900,
        displayColor: AppColors.slate900,
      ),
    );
  }
}

/// Rounded card container matching Tailwind `.card`
/// (`bg-white rounded-2xl shadow-sm border border-slate-100`).
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.color = Colors.white,
    this.border,
    this.borderRadius = 16,
    this.onTap,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color color;
  final BoxBorder? border;
  final double borderRadius;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final content = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(borderRadius),
        border: border ?? Border.all(color: AppColors.slate100),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 6,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: child,
    );
    if (onTap == null) return content;
    return _Pressable(onTap: onTap!, borderRadius: borderRadius, child: content);
  }
}

/// Tap feedback with a small scale-down, like the web `active:scale-95`.
class _Pressable extends StatefulWidget {
  const _Pressable({
    required this.child,
    required this.onTap,
    this.borderRadius = 16,
  });

  final Widget child;
  final VoidCallback onTap;
  final double borderRadius;

  @override
  State<_Pressable> createState() => _PressableState();
}

class _PressableState extends State<_Pressable> {
  double _scale = 1;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _scale = 0.97),
      onTapUp: (_) => setState(() => _scale = 1),
      onTapCancel: () => setState(() => _scale = 1),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _scale,
        duration: const Duration(milliseconds: 90),
        child: widget.child,
      ),
    );
  }
}

/// Public pressable wrapper reused by buttons/cards across pages.
class Pressable extends StatelessWidget {
  const Pressable({
    super.key,
    required this.child,
    required this.onTap,
    this.borderRadius = 16,
  });

  final Widget child;
  final VoidCallback onTap;
  final double borderRadius;

  @override
  Widget build(BuildContext context) =>
      _Pressable(onTap: onTap, borderRadius: borderRadius, child: child);
}
