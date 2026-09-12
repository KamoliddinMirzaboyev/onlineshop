import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../models/catalog.dart';
import '../services/cart.dart';
import 'product_detail_sheet.dart';

/// Korzinka Go uslubidagi 3 talik grid mahsulot kartasi
class ProductCard extends StatelessWidget {
  const ProductCard({super.key, required this.product});
  final Product product;

  @override
  Widget build(BuildContext context) {
    final qty = context.select<CartProvider, double>((c) => c.quantityOf(product.id));

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF1F5F9), width: 1),
        boxShadow: const [
          BoxShadow(
            color: Color(0x080F172A),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Rasm bloki (bosilganda to'liq ma'lumot ochiladi)
          GestureDetector(
            onTap: () => showProductDetailSheet(context, product),
            behavior: HitTestBehavior.opaque,
            child: ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
              child: AspectRatio(
                aspectRatio: 1.0,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Container(
                      color: const Color(0xFFF3F4F6),
                      child: product.imageUrl != null && product.imageUrl!.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: product.imageUrl!,
                              fit: BoxFit.cover,
                              alignment: Alignment.center,
                              memCacheWidth: 240,
                              placeholder: (context, url) => Container(
                                color: const Color(0xFFF1F5F9),
                                alignment: Alignment.center,
                                child: const Icon(Icons.image_outlined, size: 24, color: Color(0xFFCBD5E1)),
                              ),
                              errorWidget: (context, url, error) => Container(
                                color: const Color(0xFFF1F5F9),
                                alignment: Alignment.center,
                                child: const Icon(Icons.shopping_basket_outlined, size: 28, color: AppColors.slate400),
                              ),
                            )
                          : Container(
                              color: const Color(0xFFF1F5F9),
                              alignment: Alignment.center,
                              child: const Icon(Icons.shopping_basket_outlined, size: 28, color: AppColors.slate400),
                            ),
                    ),
                  // Sotuvda yo'q / ombor tugagan overlay
                  if (!product.inStock)
                    Positioned.fill(
                      child: Container(
                        color: Colors.black.withValues(alpha: 0.45),
                        alignment: Alignment.center,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.red600,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            'Tugagan',
                            style: TextStyle(color: Colors.white, fontSize: 9.5, fontWeight: FontWeight.w700),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),

          // 2. Ma'lumotlar bloki (Narx birinchi -> Nomi -> Birligi -> Savatga)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(6, 6, 6, 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  GestureDetector(
                    onTap: () => showProductDetailSheet(context, product),
                    behavior: HitTestBehavior.opaque,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Narx (katta va qora)
                        Text(
                          '${money(product.price)} so\'m',
                          style: const TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                            letterSpacing: -0.2,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),

                        // Nomi (aniq va kattaroq)
                        Text(
                          product.nameUz,
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF1E293B),
                            height: 1.2,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),

                        // Birligi (1 dona / kg)
                        Text(
                          product.unit != null && product.unit!.isNotEmpty
                              ? '1 ${product.unit}'
                              : '1 dona',
                          style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF64748B),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),

                  const Spacer(),

                  // 3. "Savatga" tugmasi / Mini-stepper
                  // Qoldiq yo'q mahsulotni savatga qo'shib bo'lmaydi — aks holda
                  // buyurtma checkout'da server tomonidan rad etilardi.
                  if (!product.inStock)
                    Container(
                      height: 34,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Text(
                        'Yo\'q',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.slate400),
                      ),
                    )
                  else if (qty == 0)
                    _CartPillButton(onTap: () => context.read<CartProvider>().add(product))
                  else
                    _MiniStepper(product: product, qty: qty),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Skrinshotdagi oq "Savatga" tugmasi
class _CartPillButton extends StatefulWidget {
  const _CartPillButton({required this.onTap});
  final VoidCallback onTap;

  @override
  State<_CartPillButton> createState() => _CartPillButtonState();
}

class _CartPillButtonState extends State<_CartPillButton> {
  double _scale = 1.0;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _scale = 0.94),
      onTapUp: (_) => setState(() => _scale = 1.0),
      onTapCancel: () => setState(() => _scale = 1.0),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _scale,
        duration: const Duration(milliseconds: 100),
        child: Container(
          height: 34,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
            boxShadow: const [
              BoxShadow(
                color: Color(0x06000000),
                blurRadius: 4,
                offset: Offset(0, 1),
              ),
            ],
          ),
          child: const Text(
            'Savatga',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: Color(0xFF0F172A),
            ),
          ),
        ),
      ),
    );
  }
}

/// Savatga qo'shilganda paydo bo'ladigan stepper — +/- butunlay
/// bosiladigan zona balandligi 34px (avval ~22px edi, barmoq uchun kichik).
class _MiniStepper extends StatelessWidget {
  const _MiniStepper({required this.product, required this.qty});
  final Product product;
  final double qty;

  static const double _height = 34;

  @override
  Widget build(BuildContext context) {
    final cart = context.read<CartProvider>();
    final atMax = qty >= product.maxQuantity;

    return Container(
      height: _height,
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.brand.withValues(alpha: 0.35), width: 1),
      ),
      child: Row(
        children: [
          _StepperButton(
            icon: Icons.remove_rounded,
            onTap: () => cart.remove(product.id),
          ),
          Expanded(
            child: Center(
              child: Text(
                formatQty(qty),
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w800,
                  color: AppColors.brand,
                ),
              ),
            ),
          ),
          // Qo'shish — qoldiqdan oshmaydi (server ham shu chegarani qo'yadi).
          _StepperButton(
            icon: Icons.add_rounded,
            onTap: atMax ? null : () => cart.add(product),
            disabled: atMax,
          ),
        ],
      ),
    );
  }
}

class _StepperButton extends StatelessWidget {
  const _StepperButton({required this.icon, required this.onTap, this.disabled = false});
  final IconData icon;
  final VoidCallback? onTap;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 36,
        height: _MiniStepper._height,
        child: Icon(icon, size: 18, color: disabled ? AppColors.slate300 : AppColors.brand),
      ),
    );
  }
}
