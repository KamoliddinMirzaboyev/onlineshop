import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../models/catalog.dart';
import '../services/cart.dart';

/// Mahsulotning to'liq tafsiloti ochiladigan pastki modal oyna
void showProductDetailSheet(BuildContext context, Product product) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => ProductDetailSheet(product: product),
  );
}

class ProductDetailSheet extends StatelessWidget {
  const ProductDetailSheet({super.key, required this.product});
  final Product product;

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final qty = cart.quantityOf(product.id);
    final maxQty = product.maxQuantity;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.88,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Drag handle va yopish tugmasi
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 10, bottom: 4),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  GestureDetector(
                    onTap: () => Navigator.of(context).pop(),
                    child: Container(
                      width: 32,
                      height: 32,
                      decoration: const BoxDecoration(
                        color: AppColors.slate100,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.close_rounded, size: 18, color: AppColors.slate600),
                    ),
                  ),
                ],
              ),
            ),

            // Asosiy aylantiriluvchi qism
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Mahsulot rasmi
                    Center(
                      child: Container(
                        height: 240,
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0xFFF1F5F9), width: 1.2),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            if (product.imageUrl != null && product.imageUrl!.isNotEmpty)
                              CachedNetworkImage(
                                imageUrl: product.imageUrl!,
                                fit: BoxFit.contain,
                                memCacheWidth: 600,
                                placeholder: (_, __) => const Center(
                                  child: Icon(Icons.image_outlined, size: 40, color: Color(0xFFCBD5E1)),
                                ),
                                errorWidget: (_, __, ___) => const Center(
                                  child: Icon(Icons.shopping_basket_outlined, size: 48, color: AppColors.slate400),
                                ),
                              )
                            else
                              const Center(
                                child: Icon(Icons.shopping_basket_outlined, size: 48, color: AppColors.slate400),
                              ),

                            // Ombor holati nishoni
                            Positioned(
                              top: 12,
                              left: 12,
                              child: _buildStockBadge(),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 18),

                    // Narx
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          '${money(product.price)} so\'m',
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F172A),
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          product.unit != null && product.unit!.isNotEmpty
                              ? '/ 1 ${product.unit}'
                              : '/ 1 dona',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),

                    // Mahsulot nomi
                    Text(
                      product.nameUz,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1E293B),
                        height: 1.25,
                      ),
                    ),
                    if (product.nameRu.isNotEmpty && product.nameRu != product.nameUz) ...[
                      const SizedBox(height: 2),
                      Text(
                        product.nameRu,
                        style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF94A3B8),
                        ),
                      ),
                    ],

                    const SizedBox(height: 18),
                    const Divider(height: 1, color: Color(0xFFF1F5F9)),
                    const SizedBox(height: 16),

                    // Tavsif sarlavhasi
                    const Row(
                      children: [
                        Icon(Icons.notes_rounded, size: 18, color: AppColors.brand),
                        SizedBox(width: 8),
                        Text(
                          'Mahsulot haqida',
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),

                    // Tavsif matni
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
                      ),
                      child: Text(
                        (product.descriptionUz != null && product.descriptionUz!.trim().isNotEmpty)
                            ? product.descriptionUz!.trim()
                            : 'Ushbu mahsulot uchun qo‘shimcha tavsif berilmagan. Sifatli va yangi mahsulot.',
                        style: const TextStyle(
                          fontSize: 13.5,
                          height: 1.45,
                          color: Color(0xFF334155),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Pastki harakat paneli (Savatga qo'shish / Stepper)
            Container(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: Color(0xFFF1F5F9), width: 1.2)),
                boxShadow: [
                  BoxShadow(
                    color: Color(0x080F172A),
                    blurRadius: 12,
                    offset: Offset(0, -3),
                  ),
                ],
              ),
              child: _buildBottomActionBar(context, cart, qty, maxQty),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStockBadge() {
    if (!product.inStock) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: AppColors.red600,
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Text(
          'Tugagan',
          style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
        ),
      );
    }

    if (product.stock <= 5) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: const Color(0xFFD97706),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          'Omborda ${product.stock.toInt()} dona qoldi',
          style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.emerald600,
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Text(
        'Sotuvda mavjud',
        style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
      ),
    );
  }

  Widget _buildBottomActionBar(
    BuildContext context,
    CartProvider cart,
    double qty,
    double maxQty,
  ) {
    if (!product.inStock) {
      return Container(
        height: 50,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.slate100,
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Text(
          'Hozirda sotuvda mavjud emas',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.slate400),
        ),
      );
    }

    if (qty == 0) {
      return GestureDetector(
        onTap: () => cart.add(product),
        child: Container(
          height: 52,
          decoration: BoxDecoration(
            gradient: AppColors.brandGradient,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: AppColors.brand.withValues(alpha: 0.35),
                blurRadius: 14,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.shopping_cart_outlined, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Text(
                'Savatga qo\'shish • ${money(product.price)} so\'m',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Row(
      children: [
        // Stepper
        Container(
          height: 52,
          decoration: BoxDecoration(
            color: const Color(0xFFF0FDF4),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.brand.withValues(alpha: 0.4), width: 1.5),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                icon: const Icon(Icons.remove_rounded, size: 20, color: AppColors.brand),
                onPressed: () => cart.remove(product.id),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Text(
                  formatQty(qty),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppColors.brand,
                  ),
                ),
              ),
              IconButton(
                icon: Icon(
                  Icons.add_rounded,
                  size: 20,
                  color: qty >= maxQty ? AppColors.slate300 : AppColors.brand,
                ),
                onPressed: qty >= maxQty ? null : () => cart.add(product),
              ),
            ],
          ),
        ),
        const SizedBox(width: 14),

        // Jami narx va savat holati
        Expanded(
          child: Container(
            height: 52,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Savatdagi jami:',
                  style: TextStyle(fontSize: 11, color: AppColors.slate500),
                ),
                Text(
                  '${money(product.price * qty)} so\'m',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.slate900,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
