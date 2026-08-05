import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/format.dart';
import '../core/theme.dart';
import 'toast.dart';

/// Dial a phone number (`tel:` link).
Future<void> launchPhone(String phone) async {
  final uri = Uri(scheme: 'tel', path: phone);
  try {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }
}

/// Open an external URL / deep link (Maps, Navigator).
Future<bool> launchExternal(String url) async {
  final uri = Uri.parse(url);
  try {
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (ok) return true;
  } catch (_) {}
  try {
    return await launchUrl(uri, mode: LaunchMode.platformDefault);
  } catch (_) {
    return false;
  }
}

/// Marshrut tanlash: Google Maps yoki Yandex Navigator.
/// [waypoints] berilsa multi-stop marshrut ochiladi.
Future<void> showNavigationChooser(
  BuildContext context, {
  double? lat,
  double? lng,
  String? address,
  List<({double lat, double lng})>? waypoints,
}) async {
  final multi = waypoints != null && waypoints.isNotEmpty;
  if (!multi && !canNavigate(lat: lat, lng: lng, address: address)) {
    toast.error("Manzil yoki koordinata yo'q");
    return;
  }

  final google = googleMapsNavUrl(
    lat: lat,
    lng: lng,
    address: address,
    waypoints: multi ? waypoints : null,
  );
  final yandexApp = multi
      ? null
      : yandexNaviUrl(lat: lat, lng: lng);
  final yandexWeb = yandexMapsUrl(
    lat,
    lng,
    address: address,
    waypoints: multi ? waypoints : null,
  );

  await showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.slate200,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              const Text(
                'Navigatsiya',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 4),
              Text(
                multi
                    ? '${waypoints.length} ta stop — optimal marshrut'
                    : address?.trim().isNotEmpty == true
                        ? address!.trim()
                        : (lat != null && lng != null
                            ? '${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}'
                            : 'Manzil'),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13, color: AppColors.slate500),
              ),
              const SizedBox(height: 16),
              if (google != null)
                _NavOption(
                  icon: Icons.map_outlined,
                  color: const Color(0xFF4285F4),
                  title: 'Google Maps',
                  subtitle: 'Marshrut ochish',
                  onTap: () async {
                    Navigator.of(ctx).pop();
                    final ok = await launchExternal(google);
                    if (!ok) toast.error("Google Maps ochilmadi");
                  },
                ),
              if (google != null) const SizedBox(height: 10),
              _NavOption(
                icon: Icons.navigation,
                color: const Color(0xFFFC3F1D),
                title: 'Yandex Navigator',
                subtitle: lat != null ? 'Ilovada marshrut' : 'Yandex Xarita',
                onTap: () async {
                  Navigator.of(ctx).pop();
                  // Avval native Navigator, bo'lmasa Yandex Maps web.
                  bool ok = false;
                  if (yandexApp != null) {
                    ok = await launchExternal(yandexApp);
                  }
                  if (!ok && yandexWeb != null) {
                    ok = await launchExternal(yandexWeb);
                  }
                  if (!ok) toast.error("Yandex ochilmadi");
                },
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Bekor', style: TextStyle(color: AppColors.slate500)),
              ),
            ],
          ),
        ),
      );
    },
  );
}

class _NavOption extends StatelessWidget {
  const _NavOption({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.slate50,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                    Text(subtitle,
                        style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: AppColors.slate300),
            ],
          ),
        ),
      ),
    );
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
  });

  final String title;
  final String? subtitle;
  final bool loading;
  final VoidCallback? onRefresh;

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
          if (onRefresh != null)
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
