import 'dart:async';
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
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String v) {
    setState(() {});
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () {
      if (mounted) setState(() => _q = v);
    });
  }

  @override
  Widget build(BuildContext context) {
    final store = context.watch<StoreProvider>().store;
    final seen = <int>{};
    final all = <Product>[];
    for (final c in store?.categories ?? <Category>[]) {
      for (final sc in c.subcategories) {
        for (final p in sc.products) {
          if (seen.add(p.id)) {
            all.add(p);
          }
        }
      }
    }
    final needle = _q.trim().toLowerCase();
    final results = needle.isEmpty
        ? all
        : all
            .where((p) =>
                p.nameUz.toLowerCase().contains(needle) ||
                p.nameRu.toLowerCase().contains(needle))
            .toList();

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
                    autofocus: false,
                    onChanged: _onChanged,
                    decoration: InputDecoration(
                      hintText: 'Mahsulotlarni qidirish...',
                      prefixIcon: const Icon(Icons.search, size: 20),
                      suffixIcon: _controller.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.close_rounded, size: 18, color: AppColors.slate500),
                              onPressed: () {
                                _debounce?.cancel();
                                _controller.clear();
                                setState(() => _q = '');
                              },
                            )
                          : null,
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
                          padding: const EdgeInsets.fromLTRB(10, 0, 10, 100),
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 3,
                            mainAxisSpacing: 10,
                            crossAxisSpacing: 8,
                            childAspectRatio: 0.50,
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
