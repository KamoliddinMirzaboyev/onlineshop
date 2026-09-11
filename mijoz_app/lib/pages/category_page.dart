import 'package:flutter/material.dart';
import '../models/catalog.dart';
import '../widgets/cart_pill.dart';
import '../widgets/product_card.dart';

/// Korzinka Go uslubidagi Kategoriya va Mahsulotlar sahifasi
class CategoryPage extends StatefulWidget {
  const CategoryPage({super.key, required this.category});
  final Category category;

  @override
  State<CategoryPage> createState() => _CategoryPageState();
}

class _CategoryPageState extends State<CategoryPage> {
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _searchController = TextEditingController();

  bool _isSearching = false;
  String _searchQuery = '';
  late final ValueNotifier<int?> _activeSubNotifier;
  final ValueNotifier<bool> _showScrollTopNotifier = ValueNotifier<bool>(false);
  bool _isManualScrolling = false;
  int _lastScrollCheck = 0;

  final Map<int, GlobalKey> _sectionKeys = {};
  final Map<int, GlobalKey> _chipKeys = {};

  @override
  void initState() {
    super.initState();
    final sections = widget.category.subcategories.where((sc) => sc.products.isNotEmpty).toList();
    _activeSubNotifier = ValueNotifier<int?>(sections.isNotEmpty ? sections.first.id : null);
    for (final sc in sections) {
      _sectionKeys[sc.id] = GlobalKey();
      _chipKeys[sc.id] = GlobalKey();
    }
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _searchController.dispose();
    _activeSubNotifier.dispose();
    _showScrollTopNotifier.dispose();
    super.dispose();
  }

  double _lastCheckedOffset = 0;

  void _onScroll() {
    final offset = _scrollController.offset;
    final showTop = offset > 300;
    if (_showScrollTopNotifier.value != showTop) {
      _showScrollTopNotifier.value = showTop;
    }

    if (_isManualScrolling) return;

    // Tezkor skroll paytida har bir kichik pikselda hisoblash qilinmaydi (lag ni butunlay yo'qotadi)
    if ((offset - _lastCheckedOffset).abs() < 35) return;
    _lastCheckedOffset = offset;

    final now = DateTime.now().millisecondsSinceEpoch;
    if (now - _lastScrollCheck < 100) return;
    _lastScrollCheck = now;

    final sections = widget.category.subcategories.where((sc) => sc.products.isNotEmpty).toList();
    int? currentSubId;

    // Orqadan boshlab birinchi to'g'ri kelganini topishi bilanoq tsikldan chiqadi (break)
    for (int i = sections.length - 1; i >= 0; i--) {
      final sc = sections[i];
      final key = _sectionKeys[sc.id];
      final ctx = key?.currentContext;
      if (ctx != null && ctx.mounted) {
        final box = ctx.findRenderObject() as RenderBox?;
        if (box != null && box.hasSize) {
          final pos = box.localToGlobal(Offset.zero);
          if (pos.dy <= 200) {
            currentSubId = sc.id;
            break;
          }
        }
      }
    }

    if (currentSubId == null && sections.isNotEmpty) {
      currentSubId = sections.first.id;
    }

    if (currentSubId != null && currentSubId != _activeSubNotifier.value) {
      _activeSubNotifier.value = currentSubId;
      // Foydalanuvchi barmoq bilan skroll qilayotganda gorizontal chip barini
      // avtomatik animatsiya qilmaymiz — bu qotish (jank) hissini keltirib chiqaradi.
    }
  }

  void _onScrollEnd() {
    if (_isManualScrolling) return;
    final activeId = _activeSubNotifier.value;
    if (activeId != null) {
      _scrollChipToVisible(activeId);
    }
  }

  void _scrollToSection(int subId) {
    _activeSubNotifier.value = subId;
    _scrollChipToVisible(subId);

    final key = _sectionKeys[subId];
    if (key?.currentContext != null) {
      _isManualScrolling = true;
      Scrollable.ensureVisible(
        key!.currentContext!,
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
        alignment: 0.01,
      ).then((_) {
        Future.delayed(const Duration(milliseconds: 100), () {
          if (mounted) _isManualScrolling = false;
        });
      });
    }
  }

  void _scrollChipToVisible(int subId) {
    final chipKey = _chipKeys[subId];
    if (chipKey?.currentContext != null) {
      Scrollable.ensureVisible(
        chipKey!.currentContext!,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        alignment: 0.5,
      );
    }
  }

  void _scrollToTop() {
    _scrollController.animateTo(
      0,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final sections = widget.category.subcategories.where((sc) => sc.products.isNotEmpty).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                // 1. Header (Orqaga + Sarlavha + Qidiruv)
                _buildHeader(context),

                // 2. Subkategoriya Chip-filtrlari (Gorizontal bar)
                if (!_isSearching && sections.length > 1)
                  _buildSubcategoryChips(sections),

                // 3. Mahsulotlar ro'yxati yoki Qidiruv natijalari
                Expanded(
                  child: _isSearching
                      ? _buildSearchResults(sections)
                      : _buildCategoryContent(sections),
                ),
              ],
            ),

            // Chap pastdagi "Tepaga qaytish" tugmasi (Stack ning to'g'ridan-to'g'ri Positioned bolasi)
            Positioned(
              left: 16,
              bottom: 86,
              child: ValueListenableBuilder<bool>(
                valueListenable: _showScrollTopNotifier,
                builder: (context, show, _) {
                  if (!show) return const SizedBox.shrink();
                  return GestureDetector(
                    onTap: _scrollToTop,
                    child: Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.10),
                            blurRadius: 10,
                            offset: const Offset(0, 3),
                          ),
                        ],
                        border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
                      ),
                      child: const Icon(Icons.arrow_upward_rounded, size: 22, color: Color(0xFF0F172A)),
                    ),
                  );
                },
              ),
            ),

            // Savat nishoni
            const CartPill(),
          ],
        ),
      ),
    );
  }

  /// Header (Orqaga, Kategoriya nomi, Qidiruv)
  Widget _buildHeader(BuildContext context) {
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9), width: 1)),
      ),
      child: _isSearching
          ? Row(
              children: [
                GestureDetector(
                  onTap: () {
                    setState(() {
                      _isSearching = false;
                      _searchQuery = '';
                      _searchController.clear();
                    });
                  },
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    width: 38,
                    height: 38,
                    alignment: Alignment.center,
                    child: const Icon(Icons.arrow_back_ios_new_rounded, size: 19, color: Color(0xFF0F172A)),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Container(
                    height: 40,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: TextField(
                      controller: _searchController,
                      autofocus: true,
                      onChanged: (v) => setState(() => _searchQuery = v.trim().toLowerCase()),
                      style: const TextStyle(fontSize: 14, color: Color(0xFF0F172A)),
                      decoration: InputDecoration(
                        hintText: '${widget.category.nameUz} bo\'yicha qidirish...',
                        hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                        prefixIcon: const Icon(Icons.search_rounded, size: 20, color: Color(0xFF64748B)),
                        suffixIcon: _searchQuery.isNotEmpty
                            ? GestureDetector(
                                onTap: () {
                                  _searchController.clear();
                                  setState(() => _searchQuery = '');
                                },
                                child: const Icon(Icons.close_rounded, size: 18, color: Color(0xFF64748B)),
                              )
                            : null,
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                    ),
                  ),
                ),
              ],
            )
          : Row(
              children: [
                // Orqaga qaytish tugmasi
                GestureDetector(
                  onTap: () => Navigator.of(context).pop(),
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    width: 38,
                    height: 38,
                    alignment: Alignment.center,
                    child: const Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: Color(0xFF0F172A)),
                  ),
                ),
                // Kategoriya nomi
                Expanded(
                  child: Text(
                    widget.category.nameUz,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 16.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                // Qidiruv tugmasi
                GestureDetector(
                  onTap: () => setState(() => _isSearching = true),
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    width: 38,
                    height: 38,
                    alignment: Alignment.center,
                    child: const Icon(Icons.search_rounded, size: 24, color: Color(0xFF0F172A)),
                  ),
                ),
              ],
            ),
    );
  }

  /// Yuqoridagi Subkategoriya Chip-filtrlari
  Widget _buildSubcategoryChips(List<Subcategory> sections) {
    return Container(
      height: 48,
      color: Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: ValueListenableBuilder<int?>(
        valueListenable: _activeSubNotifier,
        builder: (context, activeSubId, _) {
          return ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            itemCount: sections.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              final sub = sections[i];
              final isSelected = activeSubId == sub.id;

              return GestureDetector(
                key: _chipKeys[sub.id],
                onTap: () => _scrollToSection(sub.id),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: isSelected ? const Color(0xFFE2E8F0) : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isSelected ? const Color(0xFFCBD5E1) : const Color(0xFFE2E8F0),
                      width: 1.2,
                    ),
                  ),
                  child: Center(
                    child: Text(
                      sub.nameUz,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                        color: isSelected ? const Color(0xFF0F172A) : const Color(0xFF64748B),
                      ),
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }

  /// Asosiy Kategoriya Mahsulotlari (3 talik Grid)
  Widget _buildCategoryContent(List<Subcategory> sections) {
    if (sections.isEmpty) {
      return const Center(
        child: Text('Bu yerda hozircha mahsulot yo\'q', style: TextStyle(color: Color(0xFF94A3B8))),
      );
    }

    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (notification is ScrollEndNotification) {
          _onScrollEnd();
        }
        return false;
      },
      child: CustomScrollView(
        controller: _scrollController,
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        cacheExtent: 600,
        slivers: [
          const SliverPadding(padding: EdgeInsets.only(top: 8)),
          for (final sub in sections) ...[
            SliverToBoxAdapter(
              child: Padding(
                key: _sectionKeys[sub.id],
                padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
                child: Text(
                  sub.nameUz,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.3,
                  ),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 8,
                  childAspectRatio: 0.50,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, pi) => RepaintBoundary(
                    child: ProductCard(product: sub.products[pi]),
                  ),
                  childCount: sub.products.length,
                  addAutomaticKeepAlives: false,
                  addRepaintBoundaries: false,
                ),
              ),
            ),
            const SliverPadding(padding: EdgeInsets.only(bottom: 24)),
          ],
          const SliverPadding(padding: EdgeInsets.only(bottom: 76)),
        ],
      ),
    );
  }

  /// Kategoriya ichidagi Qidiruv natijalari
  Widget _buildSearchResults(List<Subcategory> sections) {
    final allProducts = <Product>[
      for (final sc in sections) ...sc.products,
    ];

    final results = _searchQuery.isEmpty
        ? allProducts
        : allProducts.where((p) => p.nameUz.toLowerCase().contains(_searchQuery)).toList();

    if (results.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.search_off_rounded, size: 52, color: Color(0xFF94A3B8)),
            const SizedBox(height: 12),
            Text(
              '"$_searchQuery" bo\'yicha mahsulot topilmadi',
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF475569)),
            ),
            const SizedBox(height: 4),
            const Text(
              'Boshqa so\'z kiritib ko\'ring',
              style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
            ),
          ],
        ),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(10, 14, 10, 100),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 10,
        crossAxisSpacing: 8,
        childAspectRatio: 0.50,
      ),
      itemCount: results.length,
      itemBuilder: (context, i) => ProductCard(product: results[i]),
    );
  }
}
