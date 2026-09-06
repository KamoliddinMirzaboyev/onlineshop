import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/format.dart';
import '../core/theme.dart';

/// Dial a phone number (`tel:` link).
Future<void> launchPhone(String phone) async {
  final uri = Uri(scheme: 'tel', path: phone);
  if (await canLaunchUrl(uri)) await launchUrl(uri);
}

/// Open an external URL (e.g. Yandex Maps navigation).
Future<void> launchExternal(String url) async {
  final uri = Uri.parse(url);
  if (await canLaunchUrl(uri)) {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

/// Status pill — Tailwind `.pill` with per-status colours.
class StatusPill extends StatelessWidget {
  const StatusPill(this.status, {super.key});
  final String status;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = statusPillColors(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(
        statusLabel(status),
        style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}

/// Filled brand button — Tailwind `.btn`. `color` overrides the fill.
class AppButton extends StatefulWidget {
  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.color = AppColors.brand,
    this.expand = false,
    this.loading = false,
    this.padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
    this.fontSize = 14,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final Color color;
  final bool expand;
  final bool loading;
  final EdgeInsetsGeometry padding;
  final double fontSize;
  final IconData? icon;

  @override
  State<AppButton> createState() => _AppButtonState();
}

class _AppButtonState extends State<AppButton> {
  double _scale = 1;

  @override
  Widget build(BuildContext context) {
    final disabled = widget.onPressed == null || widget.loading;
    final child = Container(
      width: widget.expand ? double.infinity : null,
      padding: widget.padding,
      decoration: BoxDecoration(
        color: widget.color.withValues(alpha: disabled ? 0.5 : 1),
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [
          BoxShadow(color: Color(0x0A000000), blurRadius: 4, offset: Offset(0, 1)),
        ],
      ),
      child: Row(
        mainAxisSize: widget.expand ? MainAxisSize.max : MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (widget.icon != null) ...[
            Icon(widget.icon, size: 16, color: Colors.white),
            const SizedBox(width: 8),
          ],
          Text(
            widget.label,
            style: TextStyle(
              color: Colors.white,
              fontSize: widget.fontSize,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );

    return GestureDetector(
      onTapDown: disabled ? null : (_) => setState(() => _scale = 0.95),
      onTapUp: disabled ? null : (_) => setState(() => _scale = 1),
      onTapCancel: () => setState(() => _scale = 1),
      onTap: disabled ? null : widget.onPressed,
      child: AnimatedScale(
        scale: _scale,
        duration: const Duration(milliseconds: 90),
        child: child,
      ),
    );
  }
}

/// Outlined "ghost" button — Tailwind `.btn-ghost`.
class GhostButton extends StatelessWidget {
  const GhostButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.expand = false,
    this.icon,
    this.padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
    this.fontSize = 14,
    this.textColor = AppColors.slate700,
    this.borderColor = AppColors.slate200,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool expand;
  final IconData? icon;
  final EdgeInsetsGeometry padding;
  final double fontSize;
  final Color textColor;
  final Color borderColor;

  @override
  Widget build(BuildContext context) {
    return Pressable(
      borderRadius: 12,
      onTap: onPressed ?? () {},
      child: Container(
        width: expand ? double.infinity : null,
        padding: padding,
        decoration: BoxDecoration(
          border: Border.all(color: borderColor),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 16, color: textColor),
              const SizedBox(width: 8),
            ],
            Text(
              label,
              style: TextStyle(
                color: textColor,
                fontSize: fontSize,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Sticky page header — Tailwind `PageHeader.tsx`.
class PageHeader extends StatelessWidget {
  const PageHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.loading = false,
    this.onRefresh,
    this.trailing,
    this.back = false,
  });

  final String title;
  final String? subtitle;
  final bool loading;
  final VoidCallback? onRefresh;
  /// Refresh tugmasi o'rniga (yoki undan tashqari) ko'rsatiladigan vidjet —
  /// masalan bildirishnomalar qo'ng'irog'i.
  final Widget? trailing;
  /// Push qilingan (tab bo'lmagan) sahifalarda orqaga tugmasi — bo'lmasa
  /// iOS'da chiqib ketishning UI yo'li qolmaydi (Android tizim tugmasi bor,
  /// lekin iOS'da yo'q).
  final bool back;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.slate200)),
      ),
      child: Row(
        children: [
          if (back)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.arrow_back_ios_new, size: 18),
                color: AppColors.slate700,
                visualDensity: VisualDensity.compact,
              ),
            ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    style: const TextStyle(fontSize: 12, color: AppColors.slate400),
                  ),
              ],
            ),
          ),
          if (trailing != null)
            trailing!
          else if (onRefresh != null)
            IconButton(
              onPressed: onRefresh,
              tooltip: 'Yangilash',
              icon: _SpinningRefresh(spinning: loading),
              color: AppColors.slate400,
            ),
        ],
      ),
    );
  }
}

class _SpinningRefresh extends StatefulWidget {
  const _SpinningRefresh({required this.spinning});
  final bool spinning;

  @override
  State<_SpinningRefresh> createState() => _SpinningRefreshState();
}

class _SpinningRefreshState extends State<_SpinningRefresh>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(seconds: 1));

  @override
  void didUpdateWidget(covariant _SpinningRefresh old) {
    super.didUpdateWidget(old);
    if (widget.spinning) {
      _c.repeat();
    } else {
      _c.stop();
      _c.reset();
    }
  }

  @override
  void initState() {
    super.initState();
    if (widget.spinning) _c.repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      RotationTransition(turns: _c, child: const Icon(Icons.refresh, size: 18));
}

/// Inline red error banner — Tailwind `text-red-600 bg-red-50`.
class ErrorBanner extends StatelessWidget {
  const ErrorBanner(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        text,
        style: const TextStyle(color: AppColors.red600, fontSize: 13),
      ),
    );
  }
}

/// Empty-state card — icon + message centered in a card.
class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.message});
  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(40),
      child: Column(
        children: [
          Icon(icon, size: 32, color: AppColors.slate400.withValues(alpha: 0.4)),
          const SizedBox(height: 8),
          Text(message, style: const TextStyle(color: AppColors.slate400)),
        ],
      ),
    );
  }
}
