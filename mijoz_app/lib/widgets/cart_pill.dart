import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../pages/cart_page.dart';
import '../services/cart.dart';

/// Floating "savatcha" tugmasi — har bir ko'rish (browse) ekranida ko'rinadi.
/// Mirrors `CartPill.tsx`.
class CartPill extends StatelessWidget {
  const CartPill({super.key});

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    if (cart.totalItems == 0) return const SizedBox.shrink();

    return Positioned(
      right: 16,
      bottom: 88,
      child: GestureDetector(
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CartPage())),
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 10, 16, 10),
          decoration: BoxDecoration(
            color: AppColors.brand,
            borderRadius: BorderRadius.circular(999),
            boxShadow: [BoxShadow(color: AppColors.brand.withValues(alpha: 0.35), blurRadius: 16, offset: const Offset(0, 6))],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  const Icon(Icons.shopping_basket, color: Colors.white, size: 20),
                  Positioned(
                    top: -6,
                    right: -6,
                    child: Container(
                      width: 16,
                      height: 16,
                      alignment: Alignment.center,
                      decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                      child: Text('${cart.totalItems}',
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.brand)),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 8),
              Text('${money(cart.totalPrice)} so\'m',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500, fontSize: 14)),
            ],
          ),
        ),
      ),
    );
  }
}
