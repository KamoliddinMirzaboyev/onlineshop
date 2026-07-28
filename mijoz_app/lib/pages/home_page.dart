import 'package:flutter/material.dart';

import 'package:provider/provider.dart';
import '../services/store.dart';
import '../models/catalog.dart';
import '../core/theme.dart';
import '../services/cart.dart';
import 'category_page.dart';
import 'cart_page.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  final palettes = const [
    Color(0xFFE1F3D8),
    Color(0xFFCDE3FC),
    Color(0xFFFBE9D0),
    Color(0xFFF7DEE6),
    Color(0xFFE6E0FB),
    Color(0xFFFDF0C4),
  ];

  @override
  Widget build(BuildContext context) {
    final storeProvider = context.watch<StoreProvider>();

    if (storeProvider.loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (storeProvider.error) {
      return const Scaffold(body: Center(child: Text('Xatolik yuz berdi')));
    }
    if (storeProvider.outOfRange) {
      return const Scaffold(body: Center(child: Text('Kechirasiz, hududingizga yetkazib berolmaymiz')));
    }

    final store = storeProvider.store;
    if (store == null) return const Scaffold();

    final groups = store.categoryGroups;
    final categories = store.categories;

    final sections = <Map<String, dynamic>>[];
    for (final g in groups) {
      final cats = categories.where((c) => c.groupId == g.id).toList();
      if (cats.isNotEmpty) {
        sections.add({'title': g.nameUz, 'cats': cats});
      }
    }
    final ungrouped = categories.where((c) => !groups.any((g) => g.id == c.groupId)).toList();
    if (ungrouped.isNotEmpty) {
      sections.add({'title': null, 'cats': ungrouped});
    }

    return Scaffold(
      backgroundColor: AppColors.slate50,
      appBar: AppBar(
        title: const Text('Barakali Bozor', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: Colors.black,
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: sections.length,
        itemBuilder: (context, si) {
          final section = sections[si];
          final String? title = section['title'];
          final List<Category> cats = section['cats'];

          return Padding(
            padding: const EdgeInsets.only(bottom: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title != null) ...[
                  Text(
                    title,
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.black87),
                  ),
                  const SizedBox(height: 16),
                ],
                // Basic grid logic (in React it was a complex masonry-like flex, we'll do GridView for simplicity)
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 1.1,
                  ),
                  itemCount: cats.length,
                  itemBuilder: (context, ci) {
                    final c = cats[ci];
                    final bgColor = palettes[si % palettes.length];
                    return GestureDetector(
                      onTap: () {
                        Navigator.push(context, MaterialPageRoute(builder: (_) => CategoryPage(category: c)));
                      },
                      child: Container(
                        decoration: BoxDecoration(
                          color: bgColor,
                          borderRadius: BorderRadius.circular(24),
                        ),
                        padding: const EdgeInsets.all(16),
                        child: Stack(
                          children: [
                            Text(
                              c.nameUz,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.black87),
                            ),
                            if (c.imageUrl != null)
                              Positioned(
                                right: -10,
                                bottom: -10,
                                child: Image.network(
                                  c.imageUrl!,
                                  width: 80,
                                  height: 80,
                                  fit: BoxFit.cover,
                                ),
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          );
        },
      ),
      floatingActionButton: Consumer<CartProvider>(
        builder: (context, cart, _) {
          if (cart.totalItems == 0) return const SizedBox.shrink();
          return FloatingActionButton.extended(
            onPressed: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const CartPage()));
            },
            backgroundColor: AppColors.brand,
            icon: const Icon(Icons.shopping_cart),
            label: Text('${cart.totalPrice} so\'m'),
          );
        },
      ),
    );
  }
}

