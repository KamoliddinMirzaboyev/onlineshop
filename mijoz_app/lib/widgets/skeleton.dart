import 'package:flutter/material.dart';

import '../core/theme.dart';

/// Shimmering block — Tailwind `.af-skel` shimmer.
class Skeleton extends StatefulWidget {
  const Skeleton({
    super.key,
    this.width,
    this.height = 16,
    this.borderRadius = 8,
    this.color,
    this.expand = false,
  });

  final double? width;
  final double height;
  final double borderRadius;
  final Color? color;
  final bool expand;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = widget.color ?? const Color(0xFFE9EDF2);
    final block = AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        return ClipRRect(
          borderRadius: BorderRadius.circular(widget.borderRadius),
          child: Container(
            width: widget.width,
            height: widget.height,
            color: base,
            child: FractionalTranslation(
              translation: Offset(-1 + _c.value * 2, 0),
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Color(0x00FFFFFF),
                      Color(0x99FFFFFF),
                      Color(0x00FFFFFF),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
    return widget.expand ? SizedBox(width: double.infinity, child: block) : block;
  }
}

Widget _cardSkel(Widget child) => AppCard(child: child);

/// Bosh sahifa — banner slayder + kategoriya kartalari grid'i.
/// Mirrors `home_page.dart`'s `_buildBanners()` + category grid.
class HomeSkeleton extends StatelessWidget {
  const HomeSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        const Skeleton(height: 140, borderRadius: 22, expand: true),
        const SizedBox(height: 20),
        const Skeleton(width: 120, height: 18),
        const SizedBox(height: 12),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.3,
          children: List.generate(
            6,
            (_) => const Skeleton(width: double.infinity, height: double.infinity, borderRadius: 20),
          ),
        ),
      ],
    );
  }
}

/// Buyurtmalar ro'yxati — `orders_page.dart`'dagi `_OrderCard` bilan bir xil shakl.
class OrdersListSkeleton extends StatelessWidget {
  const OrdersListSkeleton({super.key, this.count = 4});
  final int count;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
      itemCount: count,
      itemBuilder: (_, __) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: _cardSkel(Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Skeleton(width: 64, height: 22, borderRadius: 8),
                const SizedBox(width: 8),
                Expanded(child: const Skeleton(height: 12, expand: true)),
                const SizedBox(width: 8),
                const Skeleton(width: 70, height: 20, borderRadius: 999),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: List.generate(
                4,
                (i) => const Padding(
                  padding: EdgeInsets.only(right: 8),
                  child: Skeleton(width: 48, height: 48, borderRadius: 12),
                ),
              ),
            ),
            const SizedBox(height: 14),
            const Divider(height: 1, color: Color(0xFFF1F5F9)),
            const SizedBox(height: 12),
            Row(
              children: const [
                Skeleton(width: 90, height: 13),
                Spacer(),
                Skeleton(width: 70, height: 15),
              ],
            ),
          ],
        )),
      ),
    );
  }
}

/// Bildirishnomalar ro'yxati — `notifications_page.dart`'dagi `_NotificationTile`
/// bilan bir xil shakl.
class NotificationsSkeleton extends StatelessWidget {
  const NotificationsSkeleton({super.key, this.count = 6});
  final int count;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: count,
      itemBuilder: (_, __) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: _cardSkel(Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Skeleton(width: 42, height: 42, borderRadius: 12),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Skeleton(height: 14, expand: true),
                  SizedBox(height: 8),
                  Skeleton(height: 12, expand: true),
                  SizedBox(height: 4),
                  Skeleton(width: 160, height: 12),
                  SizedBox(height: 8),
                  Skeleton(width: 90, height: 11),
                ],
              ),
            ),
          ],
        )),
      ),
    );
  }
}

/// Profil sahifasi — sarlavha karta + shaxsiy ma'lumotlar + yordam bo'limi.
/// Mirrors `profile_page.dart`'dagi haqiqiy karta tuzilishi.
class ProfileSkeleton extends StatelessWidget {
  const ProfileSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
      children: [
        _cardSkel(Row(
          children: [
            const Skeleton(width: 62, height: 62, borderRadius: 31),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Skeleton(width: 140, height: 17),
                  SizedBox(height: 8),
                  Skeleton(width: 110, height: 13),
                ],
              ),
            ),
          ],
        )),
        const SizedBox(height: 16),
        const Skeleton(width: 130, height: 13),
        const SizedBox(height: 8),
        _cardSkel(Column(
          children: [
            for (int i = 0; i < 3; i++) ...[
              if (i > 0) const Divider(height: 1, color: Color(0xFFF1F5F9)),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: const [
                    Skeleton(width: 20, height: 20, borderRadius: 6),
                    SizedBox(width: 14),
                    Skeleton(width: 70, height: 13),
                    Spacer(),
                    Skeleton(width: 90, height: 13),
                  ],
                ),
              ),
            ],
          ],
        )),
        const SizedBox(height: 16),
        const Skeleton(width: 160, height: 13),
        const SizedBox(height: 8),
        _cardSkel(Row(
          children: const [
            Skeleton(width: 36, height: 36, borderRadius: 10),
            SizedBox(width: 12),
            Expanded(child: Skeleton(height: 14, expand: true)),
          ],
        )),
      ],
    );
  }
}

/// Buyurtma tafsiloti — bosqich progress + mahsulotlar + ma'lumot kartasi.
class OrderDetailSkeleton extends StatelessWidget {
  const OrderDetailSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Skeleton(width: 80, height: 16),
        const SizedBox(height: 16),
        const Skeleton(width: 192, height: 28),
        const SizedBox(height: 8),
        const Skeleton(width: 128, height: 16),
        const SizedBox(height: 16),
        _cardSkel(Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: const [
            Skeleton(height: 16, expand: true),
            SizedBox(height: 10),
            Skeleton(width: 200, height: 16),
            SizedBox(height: 10),
            Skeleton(width: 140, height: 16),
            SizedBox(height: 12),
            Skeleton(height: 40, borderRadius: 12, expand: true),
          ],
        )),
        const SizedBox(height: 12),
        _cardSkel(Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Skeleton(width: 112, height: 16),
            const SizedBox(height: 12),
            ...List.generate(
              3,
              (i) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(children: const [
                  Skeleton(width: 48, height: 48, borderRadius: 12),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Skeleton(height: 16, expand: true),
                        SizedBox(height: 6),
                        Skeleton(width: 100, height: 12),
                      ],
                    ),
                  ),
                  SizedBox(width: 12),
                  Skeleton(width: 64, height: 16),
                ]),
              ),
            ),
          ],
        )),
      ],
    );
  }
}
