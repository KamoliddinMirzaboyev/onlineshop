import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../models/catalog.dart';
import '../services/store.dart';
import '../widgets/cart_pill.dart';
import '../widgets/common.dart';
import '../widgets/product_card.dart';

/// Mahsulot qidiruvi. Mirrors `SearchPage.tsx`.
class SearchPage extends StatefulWidget {
  const SearchPage({super.key});

  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  final _controller = TextEditingController();
  String _q = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final store = context.watch<StoreProvider>().store;
    final all = <Product>[
      for (final c in store?.categories ?? <Category>[])
        for (final sc in c.subcategories) ...sc.products,
    ];
    final needle = _q.trim().toLowerCase();
    final results = needle.isEmpty ? all : all.where((p) => p.nameUz.toLowerCase().contains(needle)).toList();

    return Scaffold(
      backgroundColor: AppColors.slate50,
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                const PageHeader(title: 'Barakali Bozor'),
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: TextField(
                    controller: _controller,
                    autofocus: true,
                    onChanged: (v) => setState(() => _q = v),
                    decoration: InputDecoration(
                      hintText: 'Qidirish',
                      prefixIcon: const Icon(Icons.search, size: 20),
                      filled: true,
                      fillColor: AppColors.slate100,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                    ),
                  ),
                ),
                Expanded(
                  child: results.isEmpty
                      ? const Center(child: Text('Hech narsa topilmadi', style: TextStyle(color: AppColors.slate400)))
                      : GridView.builder(
                          padding: const EdgeInsets.fromLTRB(12, 0, 12, 100),
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 3, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 0.62,
                          ),
                          itemCount: results.length,
                          itemBuilder: (context, i) => ProductCard(product: results[i]),
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
