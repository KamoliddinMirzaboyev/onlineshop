import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../services/store.dart';
import '../widgets/common.dart';

/// Do'kon bilan bog'lanish — telefon(lar) + telegram. Mirrors TMA ContactPage.
class ContactPage extends StatelessWidget {
  const ContactPage({super.key});

  @override
  Widget build(BuildContext context) {
    final store = context.watch<StoreProvider>().store;
    final phones = (store?.phones ?? []).take(2).toList();
    final telegram = store?.socials['telegram']?.replaceFirst('@', '');
    final empty = phones.isEmpty && (telegram == null || telegram.isEmpty);

    return Scaffold(
      backgroundColor: AppColors.slate50,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const PageHeader(title: 'Texnik qo\'llab-quvvatlash', back: true),
            Padding(
              padding: const EdgeInsets.all(16),
              child: AppCard(
                padding: EdgeInsets.zero,
                child: empty
                    ? const Padding(
                        padding: EdgeInsets.all(24),
                        child: Text(
                          'Bog\'lanish ma\'lumoti kiritilmagan',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppColors.slate400),
                        ),
                      )
                    : Column(
                        children: [
                          for (final p in phones)
                            _Row(
                              icon: Icons.call_rounded,
                              label: 'Qo\'ng\'iroq',
                              value: p,
                              divider: p != phones.last || telegram != null,
                              onTap: () => launchPhone(p),
                            ),
                          if (telegram != null && telegram.isNotEmpty)
                            _Row(
                              icon: Icons.send_rounded,
                              label: 'Telegram',
                              value: '@$telegram',
                              divider: false,
                              onTap: () => launchExternal('https://t.me/$telegram'),
                            ),
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    required this.icon,
    required this.label,
    required this.value,
    required this.divider,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final String value;
  final bool divider;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Icon(icon, size: 18, color: AppColors.slate400),
                const SizedBox(width: 12),
                Text(label, style: const TextStyle(color: AppColors.slate900)),
                const Spacer(),
                Text(value, style: const TextStyle(color: AppColors.brand, fontWeight: FontWeight.w500)),
              ],
            ),
          ),
        ),
        if (divider) const Divider(height: 1, color: AppColors.slate100, indent: 16, endIndent: 16),
      ],
    );
  }
}
