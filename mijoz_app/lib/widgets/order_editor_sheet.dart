import 'package:flutter/material.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../models/catalog.dart';
import '../models/order.dart';
import '../services/api.dart';
import 'common.dart';
import 'toast.dart';

/// Pending buyurtmani mijoz o'zi tahrirlaydi (miqdor, o'chirish, yangi
/// mahsulot) — TMA `OrderEditor` ning Flutter ekvivalenti. Saqlansa yangilangan
/// [Order] bilan yopiladi.
Future<Order?> showOrderEditorSheet(
  BuildContext context, {
  required Order order,
  required RestaurantDetail? store,
}) {
  return showModalBottomSheet<Order>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (_) => _OrderEditorSheet(order: order, store: store),
  );
}

class _Line {
  _Line({
    required this.productId,
    required this.nameUz,
    required this.nameRu,
    required this.price,
    required this.unit,
    required this.quantity,
    this.imageUrl,
    this.note,
  });

  final int productId;
  final String nameUz;
  final String nameRu;
  final num price;
  final String? unit;
  final String? imageUrl;
  final String? note;
  double quantity;

  String name(String lang) => (lang == 'ru' && nameRu.trim().isNotEmpty) ? nameRu : nameUz;
  double get step => (unit == 'kg' || unit == 'litr') ? 0.5 : 1.0;
}

class _OrderEditorSheet extends StatefulWidget {
  const _OrderEditorSheet({required this.order, required this.store});
  final Order order;
  final RestaurantDetail? store;

  @override
  State<_OrderEditorSheet> createState() => _OrderEditorSheetState();
}

class _OrderEditorSheetState extends State<_OrderEditorSheet> {
  // LinkedHashMap — qo'shilish tartibi saqlanadi.
  late final Map<int, _Line> _draft = {
    for (final it in widget.order.items)
      it.productId: _Line(
        productId: it.productId,
        nameUz: it.nameUz,
        nameRu: it.nameRu,
        price: it.price,
        unit: it.unit,
        quantity: it.quantity.toDouble(),
        imageUrl: it.imageUrl,
        note: it.note,
      ),
  };
  bool _picker = false;
  bool _saving = false;
  String _query = '';
  Category? _cat; // tanlovdagi kategoriya
  Subcategory? _sub; // tanlovdagi sub-kategoriya
  String? _error;

  List<Product> get _available => [
        for (final c in widget.store?.categories ?? const <Category>[])
          for (final sc in c.subcategories)
            for (final p in sc.products)
              if (p.inStock) p,
      ];

  List<Category> get _categories => [
        for (final c in widget.store?.categories ?? const <Category>[])
          if (c.subcategories.any((sc) => sc.products.any((p) => p.inStock))) c,
      ];

  List<Subcategory> _subsOf(Category c) =>
      [for (final sc in c.subcategories) if (sc.products.any((p) => p.inStock)) sc];

  void _openCategory(Category c) {
    final subs = _subsOf(c);
    setState(() {
      _cat = c;
      // Bitta sub-kategoriya bo'lsa — ortiqcha qadamsiz to'g'ridan-to'g'ri mahsulotlar.
      _sub = subs.length == 1 ? subs.first : null;
    });
  }

  /// Orqaga: mahsulotlar → sub-kategoriyalar → kategoriyalar → buyurtma ro'yxati.
  void _back() {
    setState(() {
      if (!_picker) return;
      if (_query.isNotEmpty) {
        _query = '';
      } else if (_sub != null && _cat != null && _subsOf(_cat!).length > 1) {
        _sub = null;
      } else if (_cat != null) {
        _cat = null;
        _sub = null;
      } else {
        _picker = false;
      }
    });
  }

  void _setQty(int pid, double qty) => setState(() {
        if (qty <= 1e-9) {
          _draft.remove(pid);
        } else {
          _draft[pid]!.quantity = qty;
        }
      });

  void _add(Product p) => setState(() {
        final cur = _draft[p.id];
        if (cur != null) {
          cur.quantity += p.qtyStep;
        } else {
          _draft[p.id] = _Line(
            productId: p.id,
            nameUz: p.nameUz,
            nameRu: p.nameRu,
            price: p.price,
            unit: p.unit,
            quantity: p.qtyStep,
            imageUrl: p.imageUrl,
          );
        }
      });

  Future<void> _save() async {
    if (_draft.isEmpty || _saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final res = await api.patch('/orders/${widget.order.id}/items', {
        'items': [
          for (final l in _draft.values)
            {'product_id': l.productId, 'quantity': l.quantity, 'note': l.note},
        ],
      });
      if (!mounted) return;
      toast.success(context.tr.orderEditSaved);
      Navigator.of(context).pop(Order.fromJson(res as Map<String, dynamic>));
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.userFriendlyMessage);
    } catch (_) {
      if (mounted) setState(() => _error = LanguageProvider.currentStrings.generalError);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tr = context.tr;
    final lang = context.currentLangCode;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 12, 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    !_picker
                        ? tr.orderEdit
                        : (_sub?.name(context.currentLangCode) ??
                            _cat?.name(context.currentLangCode) ??
                            tr.orderEditAddProduct),
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.slate900),
                  ),
                ),
                IconButton(
                  onPressed: () => _picker ? _back() : Navigator.of(context).pop(),
                  icon: Icon(
                    _picker ? Icons.arrow_back_rounded : Icons.close_rounded,
                    color: AppColors.slate700,
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.slate100),
          Flexible(child: _picker ? _buildPicker(tr, lang) : _buildLines(tr, lang)),
          if (!_picker) _buildFooter(tr, lang),
        ],
      ),
    );
  }

  Widget _thumb(String? url) => ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 48,
          height: 48,
          color: AppColors.slate100,
          alignment: Alignment.center,
          child: (url != null && url.isNotEmpty)
              ? Image.network(url, width: 48, height: 48, fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const Text('🍽'))
              : const Text('🍽', style: TextStyle(fontSize: 20)),
        ),
      );

  Widget _roundBtn(IconData icon, VoidCallback onTap, {bool filled = false, Color? iconColor}) => InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: filled ? AppColors.brand : AppColors.slate100,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 17, color: iconColor ?? (filled ? Colors.white : AppColors.slate700)),
        ),
      );

  Widget _buildLines(AppStrings tr, String lang) {
    final lines = _draft.values.toList();
    return ListView(
      shrinkWrap: true,
      padding: const EdgeInsets.all(16),
      children: [
        if (lines.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Text(tr.orderEditKeepOne,
                textAlign: TextAlign.center, style: const TextStyle(color: AppColors.slate400)),
          ),
        for (final l in lines)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                _thumb(l.imageUrl),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l.name(lang),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 2),
                      Text(formatPrice(l.price * l.quantity, lang),
                          style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
                    ],
                  ),
                ),
                _roundBtn(
                  l.quantity <= l.step ? Icons.delete_outline_rounded : Icons.remove_rounded,
                  () => _setQty(l.productId, l.quantity - l.step),
                  iconColor: l.quantity <= l.step ? AppColors.red600 : null,
                ),
                SizedBox(
                  width: 40,
                  child: Text(formatQty(l.quantity),
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
                _roundBtn(Icons.add_rounded, () => _setQty(l.productId, l.quantity + l.step), filled: true),
              ],
            ),
          ),
        OutlinedButton.icon(
          onPressed: () => setState(() {
            _query = '';
            _cat = null;
            _sub = null;
            _picker = true;
          }),
          icon: const Icon(Icons.add_rounded, size: 18),
          label: Text(tr.orderEditAddProduct),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.brand,
            side: BorderSide(color: AppColors.brand.withValues(alpha: 0.4)),
            padding: const EdgeInsets.symmetric(vertical: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
        ),
      ],
    );
  }

  Widget _productRow(Product p, String lang) {
    final inDraft = _draft[p.id];
    final step = p.qtyStep;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
      leading: _thumb(p.imageUrl),
      title: Text(p.name(lang), maxLines: 2, overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
      subtitle: Text(formatPrice(p.price, lang),
          style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
      trailing: inDraft == null
          ? _roundBtn(Icons.add_rounded, () => _add(p), filled: true)
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _roundBtn(
                  inDraft.quantity <= step ? Icons.delete_outline_rounded : Icons.remove_rounded,
                  () => _setQty(p.id, inDraft.quantity - step),
                  iconColor: inDraft.quantity <= step ? AppColors.red600 : null,
                ),
                SizedBox(
                  width: 36,
                  child: Text(formatQty(inDraft.quantity),
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
                _roundBtn(Icons.add_rounded, () => _add(p), filled: true),
              ],
            ),
    );
  }

  Widget _navRow(String title, String? subtitle, String? image, VoidCallback onTap) => ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 4),
        leading: _thumb(image),
        title: Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
        subtitle: subtitle == null
            ? null
            : Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
        trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.slate400),
        onTap: onTap,
      );

  Widget _buildPicker(AppStrings tr, String lang) {
    final q = _query.trim().toLowerCase();

    // Qidiruv — ixtiyoriy yordamchi; asosiy yo'l kategoriyalar orqali.
    final search = Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: TextField(
        onChanged: (v) => setState(() => _query = v),
        decoration: InputDecoration(
          hintText: tr.orderEditSearch,
          prefixIcon: const Icon(Icons.search_rounded, size: 20),
          filled: true,
          fillColor: AppColors.slate100,
          isDense: true,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
        ),
      ),
    );

    Widget list(List<Widget> children) => Flexible(
          child: children.isEmpty
              ? Padding(
                  padding: const EdgeInsets.all(32),
                  child: Text(tr.orderEditNotFound, style: const TextStyle(color: AppColors.slate400)),
                )
              : ListView(shrinkWrap: true, padding: const EdgeInsets.all(12), children: children),
        );

    if (q.isNotEmpty) {
      final found = _available
          .where((p) => p.nameUz.toLowerCase().contains(q) || p.nameRu.toLowerCase().contains(q))
          .toList();
      return Column(mainAxisSize: MainAxisSize.min, children: [
        search,
        list([for (final p in found) _productRow(p, lang)]),
      ]);
    }

    // 3-daraja: mahsulotlar
    if (_sub != null) {
      final products = _sub!.products.where((p) => p.inStock).toList();
      return Column(mainAxisSize: MainAxisSize.min, children: [
        list([for (final p in products) _productRow(p, lang)]),
      ]);
    }

    // 2-daraja: sub-kategoriyalar
    if (_cat != null) {
      return Column(mainAxisSize: MainAxisSize.min, children: [
        list([
          for (final sc in _subsOf(_cat!))
            _navRow(
              sc.name(lang),
              '${sc.products.where((p) => p.inStock).length}',
              sc.imageUrl ?? sc.products.firstWhere((p) => p.inStock).imageUrl,
              () => setState(() => _sub = sc),
            ),
        ]),
      ]);
    }

    // 1-daraja: kategoriyalar
    return Column(mainAxisSize: MainAxisSize.min, children: [
      search,
      list([
        for (final c in _categories)
          _navRow(
            c.name(lang),
            null,
            c.imageUrl ??
                c.subcategories.expand((sc) => sc.products).firstWhere((p) => p.inStock).imageUrl,
            () => _openCategory(c),
          ),
      ]),
    ]);
  }

  Widget _buildFooter(AppStrings tr, String lang) {
    final subtotal = _draft.values.fold<num>(0, (n, l) => n + l.price * l.quantity);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.slate100))),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(tr.orderEditProducts, style: const TextStyle(color: AppColors.slate400, fontSize: 13)),
              Text(formatPrice(subtotal, lang), style: const TextStyle(fontWeight: FontWeight.w800)),
            ],
          ),
          const SizedBox(height: 6),
          Text(tr.orderEditRecalcNote, style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(fontSize: 12, color: AppColors.red600)),
          ],
          const SizedBox(height: 12),
          AppButton(
            label: tr.save,
            expand: true,
            loading: _saving,
            onPressed: _draft.isEmpty || _saving ? null : _save,
          ),
        ],
      ),
    );
  }
}
