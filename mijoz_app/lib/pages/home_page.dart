import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/store.dart';
import '../models/catalog.dart';
import '../core/theme.dart';
import '../widgets/cart_pill.dart';
import '../widgets/common.dart';
import 'category_page.dart';
import 'notifications_page.dart';

const _palette = [
  Color(0xFFE1F3D8),
  Color(0xFFCDE3FC),
  Color(0xFFFBE9D0),
  Color(0xFFF7DEE6),
  Color(0xFFE6E0FB),
  Color(0xFFFDF0C4),
];

/// Bosh sahifa — kategoriya kartochkalari, guruhlar bo'yicha.
/// Mirrors `HomePage.tsx` (soddalashtirilgan simmetrik grid — asl asimmetrik
/// masonry o'rniga; ponytail: vizual paritet uchun yetarli, farq sezilarli
/// bo'lsa keyinroq moslashtiriladi).
class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final storeProvider = context.watch<StoreProvider>();

    Widget body;
    if (storeProvider.loading) {
      body = const Center(child: CircularProgressIndicator());
    } else if (storeProvider.error) {
      body = const Center(child: Text('Xatolik yuz berdi', style: TextStyle(color: AppColors.slate400)));
    } else if (storeProvider.outOfRange) {
      body = const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('Kechirasiz, hududingizga yetkazib berolmaymiz', textAlign: TextAlign.center, style: TextStyle(color: AppColors.slate400)),
        ),
      );
    } else if (storeProvider.needsLocation) {
      body = Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('📍', style: TextStyle(fontSize: 40)),
              const SizedBox(height: 12),
              const Text('Yaqin do\'konni topish uchun joylashuv kerak', textAlign: TextAlign.center, style: TextStyle(color: AppColors.slate500)),
              const SizedBox(height: 16),
              AppButton(label: 'Qayta urinish', onPressed: storeProvider.load),
            ],
          ),
        ),
      );
    } else {
      final store = storeProvider.store;
      if (store == null) {
        body = const SizedBox.shrink();
      } else {
        final groups = store.categoryGroups;
        final categories = store.categories;
        final sections = <(String?, List<Category>)>[
          for (final g in groups)
            (g.nameUz, categories.where((c) => c.groupId == g.id).toList()),
          (null, categories.where((c) => !groups.any((g) => g.id == c.groupId)).toList()),
        ].where((s) => s.$2.isNotEmpty).toList();

        body = sections.isEmpty
            ? const Center(child: Text('Kategoriyalar yo\'q', style: TextStyle(color: AppColors.slate400)))
            : ListView.builder(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 100),
                itemCount: sections.length,
                itemBuilder: (context, si) {
                  final (title, cats) = sections[si];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (title != null) ...[
                          Text(title, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: AppColors.slate900)),
                          const SizedBox(height: 10),
                        ],
                        GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 1.35,
                          ),
                          itemCount: cats.length,
                          itemBuilder: (context, ci) => _CategoryCard(
                            category: cats[ci],
                            bg: _palette[(si * 7 + ci) % _palette.length],
                          ),
                        ),
                      ],
                    ),
                  );
                },
              );
      }
    }

    return Scaffold(
      backgroundColor: AppColors.slate50,
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                PageHeader(
                  title: 'Barakali Bozor',
                  trailing: IconButton(
                    icon: const Icon(Icons.notifications_none_rounded, color: AppColors.slate400),
                    onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const NotificationsPage())),
                  ),
                ),
                Expanded(child: body),
              ],
            ),
            const CartPill(),
          ],
        ),
      ),
    );
  }
}

class _CategoryCard extends StatelessWidget {
  const _CategoryCard({required this.category, required this.bg});
  final Category category;
  final Color bg;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => CategoryPage(category: category))),
      child: Container(
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            if (category.imageUrl != null)
              Positioned(
                right: -8,
                bottom: -8,
                child: Image.network(
                  category.imageUrl!, width: 84, height: 84, fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                ),
              )
            else
              const Positioned(right: 12, bottom: 12, child: Icon(Icons.chevron_right, color: Colors.black26)),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Align(
                alignment: Alignment.topLeft,
                child: Text(
                  category.nameUz,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.slate900),
                  maxLines: 2,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
