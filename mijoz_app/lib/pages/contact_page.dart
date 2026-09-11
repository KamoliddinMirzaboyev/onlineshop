import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../services/store.dart';
import '../widgets/common.dart';

/// Mijozlarni qo'llab-quvvatlash sahifasi.
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
          children: [
            const PageHeader(title: 'Mijozlarni qo\'llab-quvvatlash', back: true),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Yordam hero banneri
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF16A34A), Color(0xFF0D9488)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.brand.withValues(alpha: 0.25),
                          blurRadius: 18,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.2),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Text(
                                  '24/7 XIZMATINGIZDAMIZ',
                                  style: TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                                ),
                              ),
                              const SizedBox(height: 10),
                              const Text(
                                'Savollaringiz bormi?',
                                style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Operatorlarimiz buyurtmangiz bo\'yicha har qanday yordamni berishga tayyor.',
                                style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 12.5, height: 1.3),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Container(
                          width: 56,
                          height: 56,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.headset_mic_rounded, color: Colors.white, size: 30),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  if (empty)
                    const AppEmptyState(
                      icon: Icons.contact_support_outlined,
                      title: 'Ma\'lumot kiritilmagan',
                      subtitle: 'Do\'kon ma\'muriyati tez orada aloqa ma\'lumotlarini kiritadi.',
                    )
                  else ...[
                    // Telefon raqamlari
                    if (phones.isNotEmpty) ...[
                      const Padding(
                        padding: EdgeInsets.only(left: 4, bottom: 8),
                        child: Text(
                          'Telefon orqali bog\'lanish',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.slate400),
                        ),
                      ),
                      for (final p in phones)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: AppCard(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                            child: Row(
                              children: [
                                Container(
                                  width: 40,
                                  height: 40,
                                  decoration: BoxDecoration(
                                    color: AppColors.brandSoft,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Icon(Icons.call_rounded, color: AppColors.brand, size: 20),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text('Do\'kon administratori', style: TextStyle(fontSize: 11.5, color: AppColors.slate400, fontWeight: FontWeight.w500)),
                                      const SizedBox(height: 2),
                                      Text(
                                        p,
                                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: AppColors.slate900),
                                      ),
                                    ],
                                  ),
                                ),
                                ElevatedButton(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.brand,
                                    foregroundColor: Colors.white,
                                    elevation: 0,
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  ),
                                  onPressed: () => launchPhone(p),
                                  child: const Text('Qo\'ng\'iroq', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                                ),
                              ],
                            ),
                          ),
                        ),
                      const SizedBox(height: 10),
                    ],

                    // Telegram orqali bog'lanish
                    if (telegram != null && telegram.isNotEmpty) ...[
                      const Padding(
                        padding: EdgeInsets.only(left: 4, bottom: 8),
                        child: Text(
                          'Ijtimoiy tarmoqlar',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.slate400),
                        ),
                      ),
                      AppCard(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        child: Row(
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: const Color(0xFFE0F2FE),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.send_rounded, color: Color(0xFF0284C7), size: 20),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('Telegram orqali yordam', style: TextStyle(fontSize: 11.5, color: AppColors.slate400, fontWeight: FontWeight.w500)),
                                  const SizedBox(height: 2),
                                  Text(
                                    '@$telegram',
                                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Color(0xFF0284C7)),
                                  ),
                                ],
                              ),
                            ),
                            ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF0284C7),
                                foregroundColor: Colors.white,
                                elevation: 0,
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                              onPressed: () => launchExternal('https://t.me/$telegram'),
                              child: const Text('Yozish', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
