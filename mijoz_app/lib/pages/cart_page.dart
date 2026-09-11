import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../services/cart.dart';
import '../services/store.dart';
import '../widgets/common.dart';
import 'checkout_page.dart';

class CartPage extends StatelessWidget {
  const CartPage({super.key});

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final store = context.watch<StoreProvider>().store;
    final items = cart.items;
    // `min_order` — serverda BEPUL YETKAZISH chegarasi (minimal buyurtma emas).
    // Avval ilova uni minimal buyurtma deb bilib, undan kam savatni bloklardi
    // va bepul chegara sifatida qat'iy 50000 ni ishlatardi.
    final freeFrom = (store?.minOrder ?? 0) > 0 ? store!.minOrder : 50000;
    final freeDelivery = cart.totalPrice >= freeFrom;

    return Scaffold(
      backgroundColor: AppColors.slate50,
      body: SafeArea(
        child: items.isEmpty
            ? Column(
                children: [
                  const PageHeader(title: 'Savatcha', back: true),
                  Expanded(
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 100,
                              height: 100,
                              decoration: const BoxDecoration(
                                color: AppColors.brandSoft,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.shopping_cart_outlined, size: 50, color: AppColors.brand),
                            ),
                            const SizedBox(height: 20),
                            const Text(
                              'Savatchangiz bo\'sh',
                              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.slate900),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Katalogimizdan sifatli va sara mahsulotlarni tanlang',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 14, color: AppColors.slate500),
                            ),
                            const SizedBox(height: 28),
                            AppButton(
                              label: 'Xaridni boshlash',
                              icon: Icons.arrow_back,
                              onPressed: () => Navigator.of(context).pop(),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              )
            : Column(
                children: [
                  PageHeader(
                    title: 'Savatcha',
                    subtitle: '${cart.totalItems} ta mahsulot',
                    back: true,
                    trailing: TextButton(
                      onPressed: cart.clear,
                      child: const Text('Tozalash', style: TextStyle(color: AppColors.red600, fontWeight: FontWeight.w600)),
                    ),
                  ),
                  // Bepul yetkazib berish progress paneli
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFF1F5F9)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(
                                freeDelivery ? Icons.check_circle_rounded : Icons.local_shipping_rounded,
                                size: 18,
                                color: freeDelivery ? AppColors.emerald600 : AppColors.brand,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  freeDelivery
                                      ? 'Yetkazib berish bepul!'
                                      : 'Bepul yetkazib berishgacha yana ${money(freeFrom - cart.totalPrice)} so‘m',
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w600,
                                    color: freeDelivery ? AppColors.emerald600 : AppColors.slate700,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: (cart.totalPrice / freeFrom).clamp(0.0, 1.0),
                              backgroundColor: AppColors.slate100,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                freeDelivery ? AppColors.emerald600 : AppColors.brand,
                              ),
                              minHeight: 6,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Expanded(
                    child: ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, i) {
                        final item = items[i];
                        final p = item.product;
                        return Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0xFFF1F5F9), width: 1.2),
                            boxShadow: const [
                              BoxShadow(color: Color(0x060F172A), blurRadius: 10, offset: Offset(0, 2)),
                            ],
                          ),
                          child: Row(
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(14),
                                child: Container(
                                  width: 68,
                                  height: 68,
                                  color: const Color(0xFFF8FAFC),
                                  child: p.imageUrl != null && p.imageUrl!.isNotEmpty
                                      ? CachedNetworkImage(
                                          imageUrl: p.imageUrl!,
                                          fit: BoxFit.cover,
                                          memCacheWidth: 200,
                                          errorWidget: (_, __, ___) => const Icon(Icons.fastfood_outlined, color: AppColors.slate400),
                                        )
                                      : const Icon(Icons.fastfood_outlined, color: AppColors.slate400),
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      p.nameUz,
                                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, color: AppColors.slate900),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      p.unit != null ? '1 ${p.unit}' : '',
                                      style: const TextStyle(fontSize: 12, color: AppColors.slate400),
                                    ),
                                    const SizedBox(height: 8),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          '${money(p.price * item.quantity)} so\'m',
                                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: AppColors.slate900),
                                        ),
                                        Container(
                                          height: 32,
                                          padding: const EdgeInsets.symmetric(horizontal: 2),
                                          decoration: BoxDecoration(
                                            color: AppColors.slate100,
                                            borderRadius: BorderRadius.circular(999),
                                          ),
                                          child: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              IconButton(
                                                icon: const Icon(Icons.remove_rounded, size: 16),
                                                visualDensity: VisualDensity.compact,
                                                padding: EdgeInsets.zero,
                                                onPressed: () => cart.setQty(p.id, item.quantity - 1),
                                              ),
                                              SizedBox(
                                                width: 24,
                                                child: Text(
                                                  '${item.quantity}',
                                                  textAlign: TextAlign.center,
                                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                                                ),
                                              ),
                                              IconButton(
                                                icon: Icon(
                                                  Icons.add_rounded,
                                                  size: 16,
                                                  color: item.quantity < p.maxQuantity
                                                      ? AppColors.slate700
                                                      : AppColors.slate300,
                                                ),
                                                visualDensity: VisualDensity.compact,
                                                padding: EdgeInsets.zero,
                                                onPressed: item.quantity < p.maxQuantity
                                                    ? () => cart.setQty(p.id, item.quantity + 1)
                                                    : null,
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
                  // Pastki yakuniy hisob paneli
                  Container(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: const Border(top: BorderSide(color: Color(0xFFF1F5F9), width: 1.2)),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0F172A).withValues(alpha: 0.06),
                          blurRadius: 20,
                          offset: const Offset(0, -6),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Mahsulotlar summasi', style: TextStyle(color: AppColors.slate500, fontSize: 13.5)),
                            Text('${money(cart.totalPrice)} so\'m', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Yetkazib berish', style: TextStyle(color: AppColors.slate500, fontSize: 13.5)),
                            // Bepul chegaradan o'tган bo'lsa aniq 0; aks holda
                            // haq masofaga bog'liq — manzil tanlangach hisoblanadi.
                            Text(
                              freeDelivery ? 'Bepul' : 'Manzilga qarab',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                                color: freeDelivery ? AppColors.emerald600 : AppColors.slate500,
                              ),
                            ),
                          ],
                        ),
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 10),
                          child: Divider(height: 1, color: Color(0xFFF1F5F9)),
                        ),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              freeDelivery ? 'Jami to\'lov' : 'Mahsulotlar uchun',
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.slate900),
                            ),
                            Text(
                              '${money(cart.totalPrice)} so\'m',
                              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: AppColors.brand),
                            ),
                          ],
                        ),
                        if (!freeDelivery)
                          const Padding(
                            padding: EdgeInsets.only(top: 4),
                            child: Text(
                              'Yetkazish haqi manzil tanlangach qo\'shiladi',
                              style: TextStyle(fontSize: 11.5, color: AppColors.slate400),
                            ),
                          ),
                        const SizedBox(height: 12),
                        GestureDetector(
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const CheckoutPage()),
                          ),
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            decoration: BoxDecoration(
                              gradient: AppColors.brandGradient,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.brand.withValues(alpha: 0.35),
                                  blurRadius: 16,
                                  offset: const Offset(0, 6),
                                ),
                              ],
                            ),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  'Buyurtma berish',
                                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
                                ),
                                SizedBox(width: 8),
                                Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 20),
                              ],
                            ),
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
