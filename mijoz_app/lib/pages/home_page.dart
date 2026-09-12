import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/store.dart';
import '../services/notification_center.dart';
import '../models/catalog.dart';
import '../core/theme.dart';
import '../widgets/cart_pill.dart';
import '../widgets/common.dart';
import '../widgets/skeleton.dart';
import 'category_page.dart';
import 'notifications_page.dart';
import 'search_page.dart';

const _categoryGradients = [
  [Color(0xFFE8F5E9), Color(0xFFC8E6C9)],
  [Color(0xFFE3F2FD), Color(0xFFBBDEFB)],
  [Color(0xFFFFF3E0), Color(0xFFFFE0B2)],
  [Color(0xFFFCE4EC), Color(0xFFF8BBD0)],
  [Color(0xFFEDE7F6), Color(0xFFD1C4E9)],
  [Color(0xFFFFFDE7), Color(0xFFFFF9C4)],
];

final _hexColor = RegExp(r'^#[0-9A-Fa-f]{6}$');

/// Admin panelda kategoriya/guruh uchun belgilangan rang (`bg_color`) bo'lsa —
/// aynan shuni ishlatamiz; bo'lmasa mahalliy gradient palette fallback.
Color? _resolveBgColor(String? hex) {
  if (hex == null || !_hexColor.hasMatch(hex)) return null;
  return Color(int.parse(hex.substring(1), radix: 16) + 0xFF000000);
}

class HomePage extends StatefulWidget {
  const HomePage({super.key, this.isActive = true});
  final bool isActive;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  static const int _kLoopMultiplier = 1000;
  final _bannerPageController = PageController(initialPage: 500);
  int _bannerIndex = 0;
  Timer? _bannerTimer;

  static const _fallbackBanners = [
    (
      'Tezkor yetkazib berish ⚡️',
      'Do\'konimizdan yangi mahsulotlar 25-35 daqiqada uyingizda',
      Color(0xFF15803D), // solid brand green — NO GRADIENT
      Icons.delivery_dining_rounded,
    ),
    (
      'Barakali narxlar 🛒',
      'Har kuni sifatli va hamyonbop mahsulotlar xaridi',
      Color(0xFF0F172A), // solid dark slate — NO GRADIENT
      Icons.shopping_bag_rounded,
    ),
    (
      'Keng assortiment 🍎🥬',
      'Do\'konimizdagi yuzlab sara mahsulotlardan tanlang',
      Color(0xFF1E293B), // solid slate — NO GRADIENT
      Icons.storefront_rounded,
    ),
  ];

  @override
  void initState() {
    super.initState();
    if (widget.isActive) _startBannerTimer();
  }

  @override
  void didUpdateWidget(covariant HomePage oldWidget) {
    super.didUpdateWidget(oldWidget);
    // ponytail: boshqa tabga o'tilganda banner animatsiyasi fonda ishlab
    // yurmasin — faqat Home tab faol bo'lganda ishlaydi.
    if (widget.isActive && !oldWidget.isActive) {
      _startBannerTimer();
    } else if (!widget.isActive && oldWidget.isActive) {
      _bannerTimer?.cancel();
    }
  }

  void _startBannerTimer() {
    _bannerTimer?.cancel();
    _bannerTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted || !_bannerPageController.hasClients) return;
      _bannerPageController.nextPage(
        duration: const Duration(milliseconds: 600),
        curve: Curves.easeInOutCubic,
      );
    });
  }

  @override
  void dispose() {
    _bannerTimer?.cancel();
    _bannerPageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final storeProvider = context.watch<StoreProvider>();

    return Scaffold(
      backgroundColor: AppColors.slate50,
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                _buildHeader(context, storeProvider),
                Expanded(child: _buildBody(storeProvider)),
              ],
            ),
            const CartPill(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, StoreProvider storeProvider) {
    final store = storeProvider.store;
    final isOpen = store?.isOpen ?? true;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9), width: 1)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.brand.withValues(alpha: 0.15),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                clipBehavior: Clip.antiAlias,
                child: Image.asset(
                  'assets/icon/logo.png',
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    color: AppColors.brandSoft,
                    alignment: Alignment.center,
                    child: const Icon(Icons.shopping_bag_rounded, color: AppColors.brand, size: 22),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Text(
                          'Barakali Bozor',
                          style: TextStyle(
                            fontSize: 16.5,
                            fontWeight: FontWeight.w800,
                            color: AppColors.slate900,
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: isOpen ? AppColors.emerald500 : AppColors.red500,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isOpen ? 'Ochiq • Yetkazish ~${store?.avgDeliveryMinutes ?? 30} daqiqa' : 'Hozircha yopiq',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: isOpen ? AppColors.emerald600 : AppColors.red500,
                      ),
                    ),
                  ],
                ),
              ),
              GestureDetector(
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const NotificationsPage()),
                ),
                child: AnimatedBuilder(
                  animation: notificationCenter,
                  builder: (context, _) {
                    final count = notificationCenter.unreadCount;
                    return Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            color: AppColors.slate100,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.notifications_none_rounded, color: AppColors.slate700, size: 20),
                        ),
                        if (count > 0)
                          Positioned(
                            top: -4,
                            right: -4,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 4),
                              constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: AppColors.red500,
                                borderRadius: BorderRadius.circular(9),
                              ),
                              child: Text(
                                count > 9 ? '9+' : '$count',
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
                              ),
                            ),
                          ),
                      ],
                    );
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Qidiruv paneli
          GestureDetector(
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SearchPage()),
            ),
            child: Container(
              height: 44,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: AppColors.slate100,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
              ),
              child: const Row(
                children: [
                  Icon(Icons.search_rounded, size: 20, color: AppColors.slate400),
                  SizedBox(width: 10),
                  Text(
                    'Mahsulotlarni qidirish...',
                    style: TextStyle(color: AppColors.slate400, fontSize: 13.5, fontWeight: FontWeight.w500),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(StoreProvider storeProvider) {
    if (storeProvider.loading) {
      return const HomeSkeleton();
    }
    if (storeProvider.error) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off_rounded, size: 48, color: AppColors.slate400),
              const SizedBox(height: 12),
              const Text('Internetga ulanishda xatolik', style: TextStyle(color: AppColors.slate500, fontSize: 15)),
              const SizedBox(height: 16),
              AppButton(label: 'Qayta urinish', onPressed: storeProvider.load),
            ],
          ),
        ),
      );
    }

    final store = storeProvider.store;
    if (store == null) return const SizedBox.shrink();

    final groups = store.categoryGroups;
    final categories = store.categories;
    final sections = <(String?, String?, List<Category>)>[
      for (final g in groups)
        (g.nameUz, g.bgColor, categories.where((c) => c.groupId == g.id).toList()),
      (null, null, categories.where((c) => !groups.any((g) => g.id == c.groupId)).toList()),
    ].where((s) => s.$3.isNotEmpty).toList();

    return RefreshIndicator(
      color: AppColors.brand,
      onRefresh: storeProvider.load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        children: [
          // Bannerlar slayderi
          _buildBanners(storeProvider),
          const SizedBox(height: 20),

          // Bo'limlar va kategoriyalar
          if (sections.isEmpty)
            const Center(child: Text('Kategoriyalar yo\'q', style: TextStyle(color: AppColors.slate400)))
          else
            for (int si = 0; si < sections.length; si++) ...[
              if (sections[si].$1 != null) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      sections[si].$1!,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.slate900),
                    ),
                    Text(
                      '${sections[si].$3.length} turkum',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.slate400),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
              ],
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.3,
                ),
                itemCount: sections[si].$3.length,
                itemBuilder: (context, ci) {
                  final cat = sections[si].$3[ci];
                  return _CategoryCard(
                    category: cat,
                    bgColor: _resolveBgColor(sections[si].$2) ?? _resolveBgColor(cat.bgColor),
                    gradient: _categoryGradients[(si * 4 + ci) % _categoryGradients.length],
                  );
                },
              ),
              const SizedBox(height: 24),
            ],
        ],
      ),
    );
  }

  Widget _buildBanners(StoreProvider storeProvider) {
    final backendBanners = storeProvider.store?.banners ?? [];
    final hasBackend = backendBanners.isNotEmpty;
    final totalCount = hasBackend ? backendBanners.length : _fallbackBanners.length;

    if (totalCount == 0) return const SizedBox.shrink();

    return Column(
      children: [
        SizedBox(
          height: 144,
          child: PageView.builder(
            controller: _bannerPageController,
            onPageChanged: (i) => setState(() => _bannerIndex = i % totalCount),
            itemCount: totalCount * _kLoopMultiplier,
            itemBuilder: (context, i) {
              final idx = i % totalCount;
              if (hasBackend) {
                final b = backendBanners[idx];
                final hasImage = b.imageUrl != null && b.imageUrl!.isNotEmpty;

                return GestureDetector(
                  onTap: () {
                    if (b.linkUrl != null && b.linkUrl!.isNotEmpty) {
                      launchExternal(b.linkUrl!);
                    }
                  },
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A), // solid dark slate
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x0A0F172A),
                          blurRadius: 14,
                          offset: Offset(0, 4),
                        ),
                      ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: hasImage
                        ? Stack(
                            fit: StackFit.expand,
                            children: [
                              CachedNetworkImage(
                                imageUrl: b.imageUrl!,
                                fit: BoxFit.cover,
                                memCacheWidth: 800,
                                errorWidget: (_, __, ___) => const Center(
                                  child: Icon(Icons.broken_image_outlined, color: AppColors.slate400),
                                ),
                              ),
                              if (b.title.isNotEmpty || (b.subtitle != null && b.subtitle!.isNotEmpty))
                                Container(
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.45),
                                  ),
                                  padding: const EdgeInsets.all(16),
                                  alignment: Alignment.bottomLeft,
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        b.title,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w800,
                                          fontSize: 16,
                                          letterSpacing: -0.2,
                                        ),
                                      ),
                                      if (b.subtitle != null && b.subtitle!.isNotEmpty) ...[
                                        const SizedBox(height: 2),
                                        Text(
                                          b.subtitle!,
                                          style: TextStyle(
                                            color: Colors.white.withValues(alpha: 0.9),
                                            fontSize: 12,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                            ],
                          )
                        : Padding(
                            padding: const EdgeInsets.all(18),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        b.title,
                                        style: const TextStyle(
                                          fontSize: 17,
                                          fontWeight: FontWeight.w800,
                                          color: Colors.white,
                                          letterSpacing: -0.2,
                                        ),
                                      ),
                                      if (b.subtitle != null && b.subtitle!.isNotEmpty) ...[
                                        const SizedBox(height: 6),
                                        Text(
                                          b.subtitle!,
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: Colors.white.withValues(alpha: 0.8),
                                            height: 1.3,
                                          ),
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  width: 48,
                                  height: 48,
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.12),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(Icons.campaign_rounded, size: 26, color: Colors.white),
                                ),
                              ],
                            ),
                          ),
                  ),
                );
              }

              // Fallback solid banner
              final (title, subtitle, solidColor, icon) = _fallbackBanners[idx];
              return Container(
                margin: const EdgeInsets.symmetric(horizontal: 2),
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: solidColor, // solid rang — gradient emas
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x0A0F172A),
                      blurRadius: 14,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            title,
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                              letterSpacing: -0.2,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            subtitle,
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.white.withValues(alpha: 0.85),
                              height: 1.3,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(icon, size: 26, color: Colors.white),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(totalCount, (i) {
            final active = i == (_bannerIndex % totalCount);
            return AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: active ? 20 : 6,
              height: 6,
              decoration: BoxDecoration(
                color: active ? AppColors.brand : AppColors.slate300,
                borderRadius: BorderRadius.circular(3),
              ),
            );
          }),
        ),
      ],
    );
  }
}

Route _createCategoryRoute(Category category) {
  return PageRouteBuilder(
    pageBuilder: (context, animation, secondaryAnimation) => CategoryPage(category: category),
    transitionDuration: const Duration(milliseconds: 280),
    reverseTransitionDuration: const Duration(milliseconds: 240),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final curve = CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutCubic,
        reverseCurve: Curves.easeInCubic,
      );

      return FadeTransition(
        opacity: Tween<double>(begin: 0.0, end: 1.0).animate(curve),
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0.0, 0.06), // Nozik va nafis pastdan ko'tarilish
            end: Offset.zero,
          ).animate(curve),
          child: child,
        ),
      );
    },
  );
}

class _CategoryCard extends StatefulWidget {
  const _CategoryCard({required this.category, required this.gradient, this.bgColor});
  final Category category;
  final List<Color> gradient;
  /// Admin panelda belgilangan haqiqiy rang — bo'lsa gradient o'rniga shu ishlatiladi.
  final Color? bgColor;

  @override
  State<_CategoryCard> createState() => _CategoryCardState();
}

class _CategoryCardState extends State<_CategoryCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final category = widget.category;
    final hasImage = category.imageUrl != null && category.imageUrl!.isNotEmpty;
    final baseColor = widget.bgColor ?? widget.gradient.first;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () => Navigator.of(context).push(_createCategoryRoute(category)),
      child: AnimatedScale(
        scale: _pressed ? 0.96 : 1.0,
        duration: const Duration(milliseconds: 140),
        curve: Curves.easeOutCubic,
        child: Container(
          decoration: BoxDecoration(
            color: widget.bgColor,
            gradient: widget.bgColor == null
                ? LinearGradient(colors: widget.gradient, begin: Alignment.topLeft, end: Alignment.bottomRight)
                : null,
            borderRadius: BorderRadius.circular(20),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0A000000),
                blurRadius: 10,
                offset: Offset(0, 3),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            children: [
              // Katta, to'liq maydonli rasm (avvalgi holatiga qaytarildi)
              if (hasImage)
                Positioned.fill(
                  child: Align(
                    alignment: Alignment.bottomRight,
                    child: FractionallySizedBox(
                      heightFactor: 1.15,
                      widthFactor: 1.05,
                      child: CachedNetworkImage(
                        imageUrl: category.imageUrl!,
                        fit: BoxFit.contain,
                        memCacheWidth: 320,
                        alignment: Alignment.bottomRight,
                        errorWidget: (_, __, ___) => const SizedBox.shrink(),
                      ),
                    ),
                  ),
                )
              else
                const Positioned(
                  right: 12,
                  bottom: 12,
                  child: Icon(Icons.arrow_forward_rounded, color: Colors.black26, size: 22),
                ),

              // Yuqori qismdagi mayin gradient (TMA dagi kabi matn oson o'qilishi uchun)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                height: 60,
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        baseColor.withValues(alpha: 0.90),
                        baseColor.withValues(alpha: 0.0),
                      ],
                    ),
                  ),
                ),
              ),

              // Kategoriya nomi
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 10, 8),
                child: Align(
                  alignment: Alignment.topLeft,
                  child: Text(
                    category.nameUz,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                      color: AppColors.slate900,
                      letterSpacing: -0.3,
                      height: 1.18,
                      shadows: [
                        Shadow(
                          color: Colors.white,
                          blurRadius: 12,
                        ),
                        Shadow(
                          color: Colors.white,
                          blurRadius: 4,
                        ),
                      ],
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
