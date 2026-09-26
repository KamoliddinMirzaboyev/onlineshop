import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../widgets/common.dart';

/// Majburiy yangilanish ekrani — orqaga qaytib bo'lmaydi, foydalanuvchi
/// Play Market'da yangilamaguncha ilovaga kira olmaydi.
class ForceUpdatePage extends StatelessWidget {
  const ForceUpdatePage({super.key, required this.storeUrl});
  final String storeUrl;

  @override
  Widget build(BuildContext context) {
    final tr = context.tr;
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: AppColors.slate50,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 84,
                    height: 84,
                    decoration: BoxDecoration(
                      color: AppColors.brandSoft,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.system_update_rounded,
                      size: 44,
                      color: AppColors.brand,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    tr.updateRequiredTitle,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate900,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    tr.updateRequiredDesc,
                    style: const TextStyle(fontSize: 14, color: AppColors.slate500, height: 1.4),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 28),
                  AppButton(
                    label: tr.updateInPlayMarket,
                    icon: Icons.download_rounded,
                    expand: true,
                    onPressed: () => launchUrl(
                      Uri.parse(storeUrl),
                      mode: LaunchMode.externalApplication,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
