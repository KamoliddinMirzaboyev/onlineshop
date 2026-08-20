import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/theme.dart';

/// Play Market baholash — professional soft-prompt.
///
/// Triggerlar:
/// - app ochilishlari (login bo‘lgach)
/// - muvaffaqiyatli yetkazishdan keyin
///
/// Qoidalar: baholangan / “boshqa so‘rama” / cooldown / dismiss limiti.
class RatePrompt {
  RatePrompt._();
  static final RatePrompt instance = RatePrompt._();

  static const packageId = 'uz.barakalibozor.kuryer';
  static const _kOpens = 'af_rate_opens';
  static const _kDeliveries = 'af_rate_deliveries';
  static const _kDone = 'af_rate_done';
  static const _kNever = 'af_rate_never';
  static const _kDismisses = 'af_rate_dismisses';
  static const _kLastPrompt = 'af_rate_last_ms';

  static const _minOpens = 3;
  static const _minDeliveries = 1;
  static const _maxDismisses = 2;
  static const _cooldownDays = 7;

  SharedPreferences? _prefs;
  bool _dialogOpen = false;

  Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  Future<void> recordAppOpen() async {
    await init();
    final n = (_prefs!.getInt(_kOpens) ?? 0) + 1;
    await _prefs!.setInt(_kOpens, n);
  }

  Future<void> recordDelivery() async {
    await init();
    final n = (_prefs!.getInt(_kDeliveries) ?? 0) + 1;
    await _prefs!.setInt(_kDeliveries, n);
  }

  Future<bool> _shouldShow() async {
    await init();
    if (_prefs!.getBool(_kDone) == true) return false;
    if (_prefs!.getBool(_kNever) == true) return false;
    if ((_prefs!.getInt(_kDismisses) ?? 0) >= _maxDismisses) return false;

    final opens = _prefs!.getInt(_kOpens) ?? 0;
    final deliveries = _prefs!.getInt(_kDeliveries) ?? 0;
    final ready = opens >= _minOpens || deliveries >= _minDeliveries;
    if (!ready) return false;

    final last = _prefs!.getInt(_kLastPrompt) ?? 0;
    if (last > 0) {
      final elapsed = DateTime.now().millisecondsSinceEpoch - last;
      if (elapsed < _cooldownDays * 24 * 60 * 60 * 1000) return false;
    }
    return true;
  }

  /// Login sessiyasi tayyor bo‘lgach chaqirish (kichik kechikish bilan).
  Future<void> maybeShow(BuildContext context, {Duration delay = const Duration(seconds: 2)}) async {
    if (!await _shouldShow()) return;
    await Future<void>.delayed(delay);
    if (!context.mounted || _dialogOpen) return;
    await show(context);
  }

  /// Yetkazish muvaffaqiyatidan keyin — biroz kechroq (toast o‘tsin).
  Future<void> maybeShowAfterDelivery(BuildContext context) async {
    await recordDelivery();
    if (!await _shouldShow()) return;
    await Future<void>.delayed(const Duration(milliseconds: 900));
    if (!context.mounted || _dialogOpen) return;
    await show(context);
  }

  Future<void> show(BuildContext context, {bool force = false}) async {
    if (_dialogOpen) return;
    if (!force && !await _shouldShow()) return;
    await init();
    await _prefs!.setInt(_kLastPrompt, DateTime.now().millisecondsSinceEpoch);

    _dialogOpen = true;
    try {
      if (!context.mounted) return;
      final action = await showDialog<_RateAction>(
        context: context,
        barrierDismissible: true,
        builder: (ctx) => const _RateDialog(),
      );
      if (action == null || action == _RateAction.later) {
        final d = (_prefs!.getInt(_kDismisses) ?? 0) + 1;
        await _prefs!.setInt(_kDismisses, d);
        return;
      }
      if (action == _RateAction.never) {
        await _prefs!.setBool(_kNever, true);
        return;
      }
      if (action == _RateAction.rate) {
        await _prefs!.setBool(_kDone, true);
        await openPlayStore();
      }
    } finally {
      _dialogOpen = false;
    }
  }

  Future<void> openPlayStore() async {
    final market = Uri.parse('market://details?id=$packageId');
    final web = Uri.parse(
      'https://play.google.com/store/apps/details?id=$packageId',
    );
    try {
      final ok = await launchUrl(market, mode: LaunchMode.externalApplication);
      if (ok) return;
    } catch (_) {}
    try {
      await launchUrl(web, mode: LaunchMode.externalApplication);
    } catch (_) {}
  }
}

final ratePrompt = RatePrompt.instance;

enum _RateAction { rate, later, never }

class _RateDialog extends StatelessWidget {
  const _RateDialog();

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 28),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 24, 22, 18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.brand.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Icon(Icons.star_rounded, size: 36, color: AppColors.brand),
            ),
            const SizedBox(height: 16),
            const Text(
              'Ilovani baholang ⭐',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.w800,
                color: AppColors.slate900,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'BB Kuryer sizga yoqdimi? Play Marketda qisqa izoh qoldiring — '
              'bu bizga yaxshilashga yordam beradi.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                height: 1.45,
                color: AppColors.slate500,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                5,
                (i) => const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 2),
                  child: Icon(Icons.star_rounded, color: Color(0xFFFBBF24), size: 28),
                ),
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.pop(context, _RateAction.rate),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.brand,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: const Text(
                  'Baholash',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                ),
              ),
            ),
            const SizedBox(height: 6),
            TextButton(
              onPressed: () => Navigator.pop(context, _RateAction.later),
              child: const Text(
                'Keyinroq',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: AppColors.slate500,
                ),
              ),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, _RateAction.never),
              child: const Text(
                'Boshqa so‘ralmasin',
                style: TextStyle(fontSize: 12, color: AppColors.slate400),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
