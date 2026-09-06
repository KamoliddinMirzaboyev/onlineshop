import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../models/catalog.dart';
import '../services/cart.dart';

/// Grid mahsulot kartasi — rasm + narx/nom, ustiga +/- stepper.
/// Mirrors `ProductCard.tsx`.
class ProductCard extends StatelessWidget {
  const ProductCard({super.key, required this.product});
  final Product product;

  @override
  Widget build(BuildContext context) {
    final qty = context.select<CartProvider, int>((c) => c.quantityOf(product.id));

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.slate200.withValues(alpha: 0.8)),
        boxShadow: const [BoxShadow(color: Color(0x0F0F172A), blurRadius: 12, offset: Offset(0, 2))],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: Stack(
              fit: StackFit.expand,
              children: [
                Container(
                  color: const Color(0xFFF3F4F6),
                  child: product.imageUrl != null
                      ? Image.network(
                          product.imageUrl!, fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const Center(child: Text('🛒', style: TextStyle(fontSize: 28))),
                        )
                      : const Center(child: Text('🛒', style: TextStyle(fontSize: 28))),
                ),
                Positioned(
                  right: 6,
                  bottom: 6,
                  child: qty == 0
                      ? _RoundIconButton(
                          icon: Icons.add,
                          background: Colors.white,
                          foreground: AppColors.slate900,
                          onTap: () => context.read<CartProvider>().add(product),
                        )
                      : _Stepper(product: product, qty: qty),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 6, 10, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RichText(
                  text: TextSpan(
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate900),
                    children: [
                      TextSpan(text: money(product.price)),
                      const TextSpan(
                        text: ' so\'m',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: AppColors.slate400),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 2),
                SizedBox(
                  height: 30,
                  child: Text(
                    product.nameUz,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.slate700, height: 1.2),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Text(
                  product.unit != null ? '1${product.unit}' : '',
                  style: const TextStyle(fontSize: 11, color: AppColors.slate400),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({
    required this.icon,
    required this.background,
    required this.foreground,
    required this.onTap,
  });
  final IconData icon;
  final Color background;
  final Color foreground;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 30,
        height: 30,
        decoration: BoxDecoration(
          color: background,
          shape: BoxShape.circle,
          boxShadow: const [BoxShadow(color: Color(0x24000000), blurRadius: 8)],
        ),
        child: Icon(icon, size: 17, color: foreground),
      ),
    );
  }
}

class _Stepper extends StatelessWidget {
  const _Stepper({required this.product, required this.qty});
  final Product product;
  final int qty;

  @override
  Widget build(BuildContext context) {
    final cart = context.read<CartProvider>();
    return Container(
      height: 30,
      padding: const EdgeInsets.symmetric(horizontal: 2),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        boxShadow: const [BoxShadow(color: Color(0x24000000), blurRadius: 8)],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          GestureDetector(
            onTap: () => cart.remove(product.id),
            child: const Padding(
              padding: EdgeInsets.all(4),
              child: Icon(Icons.remove, size: 15, color: AppColors.slate900),
            ),
          ),
          SizedBox(
            width: 18,
            child: Text('$qty', textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.slate900)),
          ),
          GestureDetector(
            onTap: () => cart.add(product),
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: const BoxDecoration(color: AppColors.brand, shape: BoxShape.circle),
              child: const Icon(Icons.add, size: 15, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}
