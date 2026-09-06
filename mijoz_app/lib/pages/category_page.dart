import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../models/catalog.dart';
import '../widgets/cart_pill.dart';
import '../widgets/common.dart';
import '../widgets/product_card.dart';

/// Kategoriya ichidagi mahsulotlar, subkategoriya bo'yicha guruhlangan.
/// Mirrors `CategoryPage.tsx`.
class CategoryPage extends StatelessWidget {
  const CategoryPage({super.key, required this.category});
  final Category category;

  @override
  Widget build(BuildContext context) {
    final sections = category.subcategories.where((sc) => sc.products.isNotEmpty).toList();

    return Scaffold(
      backgroundColor: AppColors.slate50,
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                PageHeader(title: category.nameUz, back: true),
                Expanded(
                  child: sections.isEmpty
                      ? const Center(child: Text('Bu yerda hozircha mahsulot yo\'q', style: TextStyle(color: AppColors.slate400)))
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(12, 12, 12, 100),
                          itemCount: sections.length,
                          itemBuilder: (context, i) {
                            final sub = sections[i];
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 20),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(sub.nameUz, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.slate900)),
                                      const SizedBox(width: 8),
                                      Expanded(child: Container(height: 1, color: AppColors.slate200)),
                                      const SizedBox(width: 8),
                                      Text('${sub.products.length}', style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
                                    ],
                                  ),
                                  const SizedBox(height: 10),
                                  GridView.builder(
                                    shrinkWrap: true,
                                    physics: const NeverScrollableScrollPhysics(),
                                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                      crossAxisCount: 3, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 0.62,
                                    ),
                                    itemCount: sub.products.length,
                                    itemBuilder: (context, pi) => ProductCard(product: sub.products[pi]),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
            const CartPill(),
          ],
        ),
      ),
    );
  }
}
