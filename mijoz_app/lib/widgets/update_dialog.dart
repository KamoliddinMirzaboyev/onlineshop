import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../pages/force_update_page.dart';
import '../services/app_version.dart';
import 'common.dart';

/// Shu sessiyada "Keyinroq" bosilgan eng yuqori versiya — modal qayta-qayta
/// chiqmasin (ilova to'liq qayta ishga tushganda yana bir marta so'raladi).
int _dismissedLatest = 0;
bool _forceShown = false;

/// Ixtiyoriy yangilanish modali. Majburiy yangilanishda [AppUpdate.force]
/// ekrani [ForceUpdatePage] ishlatiladi, bu yerda faqat ixtiyoriysi.
Future<void> showUpdateDialog(BuildContext context, AppUpdate update) async {
  if (update.latest <= _dismissedLatest) return;
  final tr = context.tr;
  final notes = update.notes(context.currentLangCode);
  await showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      icon: Container(
        width: 64,
        height: 64,
        decoration: BoxDecoration(color: AppColors.brandSoft, borderRadius: BorderRadius.circular(20)),
        child: const Icon(Icons.system_update_rounded, size: 34, color: AppColors.brand),
      ),
      title: Text(tr.updateAvailableTitle, textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(tr.updateAvailableDesc, textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, color: AppColors.slate500, height: 1.4)),
            if (notes != null) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppColors.slate50, borderRadius: BorderRadius.circular(14)),
                child: Text(notes, style: const TextStyle(fontSize: 13, height: 1.4)),
              ),
            ],
          ],
        ),
      ),
      actionsAlignment: MainAxisAlignment.center,
      actionsOverflowDirection: VerticalDirection.down,
      actions: [
        AppButton(
          label: tr.updateInPlayMarket,
          icon: Icons.download_rounded,
          expand: true,
          onPressed: () {
            launchUrl(Uri.parse(update.storeUrl), mode: LaunchMode.externalApplication);
            Navigator.of(ctx).pop();
          },
        ),
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: Text(tr.updateLater, style: const TextStyle(color: AppColors.slate500)),
        ),
      ],
    ),
  );
  _dismissedLatest = update.latest;
}

/// Ilova fondan qaytganda chaqiriladi: majburiy bo'lsa ForceUpdatePage'ga
/// o'tkazadi, ixtiyoriy bo'lsa modal ko'rsatadi.
Future<void> checkAndPromptUpdate(GlobalKey<NavigatorState> navKey) async {
  if (_forceShown) return;
  final update = await fetchAppUpdate();
  if (update == null) return;
  final nav = navKey.currentState;
  final ctx = navKey.currentContext;
  if (nav == null || ctx == null || !ctx.mounted) return;
  if (update.force) {
    _forceShown = true;
    nav.pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => ForceUpdatePage(storeUrl: update.storeUrl)),
      (_) => false,
    );
  } else {
    await showUpdateDialog(ctx, update);
  }
}
