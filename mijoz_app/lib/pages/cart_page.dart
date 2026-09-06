import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../services/cart.dart';
import '../widgets/common.dart';
import 'checkout_page.dart';

/// Savatcha. Mirrors `CartPage.tsx`.
class CartPage extends StatelessWidget {
  const CartPage({super.key});

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final items = cart.items;

    return Scaffold(
      backgroundColor: AppColors.slate50,
      body: SafeArea(
        child: items.isEmpty
            ? Column(
                children: [
                  const PageHeader(title: 'Savatcha', back: true),
                  const Expanded(
                    child: Center(
                      child: Text('🛒  Savatcha bo\'sh', style: TextStyle(color: AppColors.slate400)),
                    ),
                  ),
                ],
              )
            : Column(
                children: [
                  PageHeader(title: 'Savatcha', subtitle: '${cart.totalItems} mahsulot', back: true),
                  Expanded(
                    child: ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const Divider(height: 1, color: AppColors.slate100),
                      itemBuilder: (context, i) {
                        final item = items[i];
                        final p = item.product;
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(14),
                                child: p.imageUrl != null
                                    ? Image.network(
                                        p.imageUrl!, width: 60, height: 60, fit: BoxFit.cover,
                                        errorBuilder: (_, __, ___) => Container(
                                          width: 60, height: 60, color: AppColors.slate100,
                                          alignment: Alignment.center,
                                          child: const Text('🛒'),
                                        ),
                                      )
                                    : Container(
                                        width: 60, height: 60, color: AppColors.slate100,
                                        alignment: Alignment.center,
                                        child: const Text('🛒'),
                                      ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Expanded(
                                          child: Text(p.nameUz,
                                              style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
                                              maxLines: 1, overflow: TextOverflow.ellipsis),
                                        ),
                                        GestureDetector(
                                          onTap: () => cart.delete(p.id),
                                          child: const Padding(
                                            padding: EdgeInsets.only(left: 8),
                                            child: Icon(Icons.delete_outline, size: 18, color: AppColors.slate400),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 3),
                                    Text('1${p.unit ?? ''}', style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
                                    const SizedBox(height: 8),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text('${money(p.price * item.quantity)} so\'m',
                                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 2),
                                          decoration: BoxDecoration(color: AppColors.slate100, borderRadius: BorderRadius.circular(999)),
                                          child: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              IconButton(
                                                icon: const Icon(Icons.remove, size: 16),
                                                visualDensity: VisualDensity.compact,
                                                onPressed: () => cart.setQty(p.id, item.quantity - 1),
                                              ),
                                              SizedBox(
                                                width: 28,
                                                child: Text('${item.quantity}', textAlign: TextAlign.center,
                                                    style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13)),
                                              ),
                                              IconButton(
                                                icon: const Icon(Icons.add, size: 16),
                                                visualDensity: VisualDensity.compact,
                                                onPressed: () => cart.setQty(p.id, item.quantity + 1),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                  Container(
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      border: Border(top: BorderSide(color: AppColors.slate100)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                          child: GestureDetector(
                            onTap: cart.clear,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                              decoration: BoxDecoration(color: const Color(0xFFFFF1F2), borderRadius: BorderRadius.circular(999)),
                              child: const Text('Savatni tozalash',
                                  style: TextStyle(color: Color(0xFFF43F5E), fontSize: 13, fontWeight: FontWeight.w500)),
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
                          child: Row(
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('Jami', style: TextStyle(fontSize: 13, color: AppColors.slate500, fontWeight: FontWeight.w500)),
                                  const SizedBox(height: 2),
                                  Text('${money(cart.totalPrice)} so\'m', style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700)),
                                ],
                              ),
                              const Spacer(),
                              AppButton(
                                label: 'Buyurtma berish',
                                icon: Icons.arrow_forward,
                                onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CheckoutPage())),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
