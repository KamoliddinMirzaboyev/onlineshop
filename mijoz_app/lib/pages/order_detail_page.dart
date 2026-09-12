import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../models/catalog.dart';
import '../models/order.dart';
import '../services/api.dart';
import '../widgets/common.dart';
import '../widgets/skeleton.dart';
import 'contact_page.dart';

const _terminal = {'delivered', 'cancelled'};

int _stageIndex(String status) {
  if (status == 'delivered') return 3;
  if (status == 'delivering' || status == 'accepted') return 2;
  if (status == 'confirmed' || status == 'preparing' || status == 'ready') return 1;
  return 0; // pending
}

const _stages = [
  ('Yangi', Icons.receipt_long_rounded),
  ('Tayyorlash', Icons.soup_kitchen_rounded),
  ('Yetkazish', Icons.delivery_dining_rounded),
  ('Yetkazildi', Icons.check_circle_rounded),
];

/// Buyurtma tafsiloti — status progressi, mahsulotlar, kuryer, chek.
class OrderDetailPage extends StatefulWidget {
  const OrderDetailPage({super.key, required this.orderId, this.justPlaced = false});
  final int orderId;
  final bool justPlaced;

  @override
  State<OrderDetailPage> createState() => _OrderDetailPageState();
}

class _OrderDetailPageState extends State<OrderDetailPage> with WidgetsBindingObserver {
  Order? _order;
  RestaurantDetail? _store;
  bool _error = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
    _startPolling();
  }

  void _startPolling() {
    _timer?.cancel();
    // Yakunlangan buyurtmani qayta so'rashning hojati yo'q.
    if (_order != null && _terminal.contains(_order!.status)) return;
    _timer = Timer.periodic(const Duration(seconds: 10), (_) => _load());
  }

  /// Fonda poll to'xtaydi, qaytganda darhol bir marta yangilanadi.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _load();
      _startPolling();
    } else {
      _timer?.cancel();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final res = await api.get('/orders/${widget.orderId}');
      if (!mounted) return;
      final order = Order.fromJson(res);
      setState(() {
        _order = order;
        _error = false;
      });
      if (_terminal.contains(order.status)) _timer?.cancel();
      if (_store == null) {
        api.get('/restaurants/${order.restaurantId}').then((r) {
          if (mounted) setState(() => _store = RestaurantDetail.fromJson(r));
        }).catchError((_) {});
      }
    } catch (_) {
      if (mounted) setState(() => _error = true);
    }
  }

  void _showReceipt() {
    final order = _order;
    if (order == null) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => _ReceiptSheet(order: order, store: _store),
    );
  }

  @override
  Widget build(BuildContext context) {
    final order = _order;
    return Scaffold(
      backgroundColor: AppColors.slate50,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: Padding(
          padding: const EdgeInsets.only(left: 12),
          child: Center(
            child: GestureDetector(
              onTap: () => Navigator.of(context).pop(),
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.slate100,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.arrow_back_ios_new_rounded, size: 16, color: AppColors.slate700),
              ),
            ),
          ),
        ),
        title: Text(
          order != null ? 'Buyurtma № ${order.number}' : 'Buyurtma tafsiloti',
          style: const TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w800,
            color: AppColors.slate900,
            letterSpacing: -0.2,
          ),
        ),
        actions: [
          if (order != null)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(child: StatusPill(order.status)),
            ),
        ],
      ),
      body: order == null
          ? (_error
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.error_outline_rounded, size: 40, color: AppColors.red500),
                      const SizedBox(height: 10),
                      const Text('Buyurtmani yuklab bo\'lmadi', style: TextStyle(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 12),
                      AppButton(label: 'Qayta urinish', onPressed: _load),
                    ],
                  ),
                )
              : const OrderDetailSkeleton())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Status bannerlari
                  if (order.status == 'pending')
                    Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFBEB),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0xFFFDE68A), width: 1),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.hourglass_top_rounded, color: Color(0xFFD97706), size: 22),
                          SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Buyurtmangiz do‘kon tomonidan ko‘rib chiqilmoqda.',
                              style: TextStyle(color: Color(0xFF92400E), fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                    )
                  else if (widget.justPlaced && order.status != 'cancelled')
                    Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0xFFA7F3D0), width: 1),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.check_circle_rounded, color: Color(0xFF059669), size: 24),
                          SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Buyurtma qabul qilindi. Tez orada yetkaziladi!',
                              style: TextStyle(color: Color(0xFF065F46), fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                    ),

                  // Bekor qilindi holati
                  if (order.status == 'cancelled')
                    Container(
                      padding: const EdgeInsets.all(14),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0xFFFECDD3), width: 1),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.cancel_rounded, color: AppColors.red600, size: 22),
                          SizedBox(width: 10),
                          Expanded(
                            child: Text('Buyurtma bekor qilingan', style: TextStyle(color: AppColors.red600, fontWeight: FontWeight.w700)),
                          ),
                        ],
                      ),
                    )
                  else
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: _StageProgress(stage: _stageIndex(order.status)),
                    ),

                  // Masofa va yetkazish vaqti
                  if (order.distanceKm != null || order.etaMinutes != null) ...[
                    Row(
                      children: [
                        if (order.distanceKm != null)
                          Expanded(
                            child: _MiniStat(
                              icon: Icons.route_rounded,
                              label: 'Masofa',
                              value: distanceLabel(order.distanceKm) ?? '—',
                            ),
                          ),
                        if (order.distanceKm != null && order.etaMinutes != null) const SizedBox(width: 12),
                        if (order.etaMinutes != null)
                          Expanded(
                            child: _MiniStat(
                              icon: Icons.access_time_rounded,
                              label: 'Taxminiy vaqt',
                              value: etaLabel(order.etaMinutes) ?? '—',
                              accent: true,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 14),
                  ],

                  // Biriktirilgan kuryer
                  if (order.assignedCourierName != null) ...[
                    AppCard(
                      child: Row(
                        children: [
                          Container(
                            width: 46,
                            height: 46,
                            decoration: BoxDecoration(
                              color: AppColors.brandSoft,
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: const Icon(Icons.delivery_dining_rounded, color: AppColors.brand, size: 26),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Yetkazib beruvchi kuryer', style: TextStyle(fontSize: 11, color: AppColors.slate400, fontWeight: FontWeight.w500)),
                                const SizedBox(height: 2),
                                Text(
                                  order.assignedCourierName!,
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.slate900),
                                ),
                              ],
                            ),
                          ),
                          if (order.assignedCourierPhone != null)
                            GestureDetector(
                              onTap: () => launchPhone(order.assignedCourierPhone!),
                              child: Container(
                                width: 40,
                                height: 40,
                                decoration: BoxDecoration(
                                  color: AppColors.brandSoft,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.call_rounded, color: AppColors.brand, size: 20),
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                  ],

                  // Mahsulotlar ro'yxati
                  AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.shopping_basket_outlined, size: 18, color: AppColors.slate600),
                            const SizedBox(width: 8),
                            Text(
                              'Mahsulotlar (${order.items.length})',
                              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.slate900),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        const Divider(height: 1, color: Color(0xFFF1F5F9)),
                        const SizedBox(height: 8),
                        for (final it in order.items)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                Container(
                                  width: 44,
                                  height: 44,
                                  decoration: BoxDecoration(
                                    color: AppColors.slate50,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: const Color(0xFFF1F5F9), width: 1),
                                  ),
                                  clipBehavior: Clip.antiAlias,
                                  child: it.imageUrl != null && it.imageUrl!.isNotEmpty
                                      ? CachedNetworkImage(
                                          imageUrl: it.imageUrl!,
                                          fit: BoxFit.cover,
                                          memCacheWidth: 200,
                                          errorWidget: (_, __, ___) => const Center(
                                            child: Icon(Icons.inventory_2_outlined, size: 20, color: AppColors.slate400),
                                          ),
                                        )
                                      : const Center(
                                          child: Icon(Icons.inventory_2_outlined, size: 20, color: AppColors.slate400),
                                        ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        it.nameUz,
                                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5, color: AppColors.slate900),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        '${qtyUnit(it.quantity, it.unit)} × ${money(it.price)} so\'m',
                                        style: const TextStyle(fontSize: 12, color: AppColors.slate400),
                                      ),
                                    ],
                                  ),
                                ),
                                Text(
                                  '${money(it.price * it.quantity)} so\'m',
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: AppColors.slate900),
                                ),
                              ],
                            ),
                          ),
                        const SizedBox(height: 8),
                        const Divider(height: 1, color: Color(0xFFF1F5F9)),
                        const SizedBox(height: 12),
                        _kv('Yetkazib berish xizmati', order.deliveryFee == 0 ? 'Bepul' : '${money(order.deliveryFee)} so\'m'),
                        const SizedBox(height: 8),
                        _kv('Jami to\'lov', '${money(order.total)} so\'m', bold: true),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Yetkazish ma'lumotlari
                  AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.info_outline_rounded, size: 18, color: AppColors.slate600),
                            SizedBox(width: 8),
                            Text(
                              'Yetkazish ma\'lumotlari',
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.slate900),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        const Divider(height: 1, color: Color(0xFFF1F5F9)),
                        const SizedBox(height: 12),
                        _infoRow(Icons.location_on_rounded, 'Manzil', order.addressLine),
                        if (order.phone != null) _infoRow(Icons.call_rounded, 'Telefon', order.phone!),
                        _infoRow(Icons.payment_rounded, 'To\'lov turi', paymentLabel(order.paymentMethod)),
                        if (order.comment != null && order.comment!.isNotEmpty)
                          _infoRow(Icons.chat_bubble_rounded, 'Izoh', order.comment!),
                        _infoRow(Icons.access_time_filled_rounded, 'Buyurtma vaqti', formatFull(order.createdAt), last: true),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),
                  GhostButton(
                    label: 'Elektron chekni ko\'rish',
                    icon: Icons.receipt_long_rounded,
                    expand: true,
                    onPressed: _showReceipt,
                  ),
                  if (_store != null && (_store!.phones.isNotEmpty || _store!.socials.isNotEmpty)) ...[
                    const SizedBox(height: 10),
                    GhostButton(
                      label: 'Do\'kon bilan bog\'lanish',
                      icon: Icons.support_agent_rounded,
                      expand: true,
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const ContactPage()),
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),
                ],
              ),
            ),
    );
  }

  Widget _kv(String k, String v, {bool bold = false}) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            k,
            style: TextStyle(
              color: bold ? AppColors.slate900 : AppColors.slate500,
              fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
              fontSize: bold ? 15 : 13,
            ),
          ),
          Text(
            v,
            style: TextStyle(
              color: bold ? AppColors.brand : AppColors.slate900,
              fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
              fontSize: bold ? 16 : 13.5,
              letterSpacing: bold ? -0.2 : 0,
            ),
          ),
        ],
      );

  Widget _infoRow(IconData icon, String label, String text, {bool last = false}) => Padding(
        padding: EdgeInsets.only(bottom: last ? 0 : 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: AppColors.brandSoft,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 16, color: AppColors.brand),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(fontSize: 11, color: AppColors.slate400, fontWeight: FontWeight.w500)),
                  const SizedBox(height: 2),
                  Text(text, style: const TextStyle(fontSize: 13.5, color: AppColors.slate900, fontWeight: FontWeight.w500)),
                ],
              ),
            ),
          ],
        ),
      );
}

class _StageProgress extends StatelessWidget {
  const _StageProgress({required this.stage});
  final int stage;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Row(
        children: List.generate(_stages.length, (i) {
          final (title, icon) = _stages[i];
          final done = i < stage;
          final active = i == stage;

          return Expanded(
            child: Column(
              children: [
                Row(
                  children: [
                    if (i > 0)
                      Expanded(
                        child: Container(
                          height: 3,
                          decoration: BoxDecoration(
                            color: i <= stage ? AppColors.brand : const Color(0xFFE2E8F0),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: done || active ? AppColors.brand : const Color(0xFFF1F5F9),
                        shape: BoxShape.circle,
                        boxShadow: active
                            ? [
                                BoxShadow(
                                  color: AppColors.brand.withValues(alpha: 0.35),
                                  blurRadius: 10,
                                  offset: const Offset(0, 3),
                                ),
                              ]
                            : null,
                      ),
                      alignment: Alignment.center,
                      child: Icon(
                        icon,
                        size: 18,
                        color: done || active ? Colors.white : AppColors.slate400,
                      ),
                    ),
                    if (i < _stages.length - 1)
                      Expanded(
                        child: Container(
                          height: 3,
                          decoration: BoxDecoration(
                            color: i < stage ? AppColors.brand : const Color(0xFFE2E8F0),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: active || done ? FontWeight.w700 : FontWeight.w500,
                    color: active ? AppColors.brand : (done ? AppColors.slate800 : AppColors.slate400),
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );
        }),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.icon, required this.label, required this.value, this.accent = false});
  final IconData icon;
  final String label;
  final String value;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: accent ? AppColors.brandSoft : AppColors.slate100,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: accent ? AppColors.brand : AppColors.slate600),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 11, color: AppColors.slate400, fontWeight: FontWeight.w500)),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 13.5,
                    color: accent ? AppColors.brand : AppColors.slate900,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ReceiptSheet extends StatelessWidget {
  const _ReceiptSheet({required this.order, this.store});
  final Order order;
  final RestaurantDetail? store;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(
                    color: AppColors.slate200,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Center(
                child: Column(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: AppColors.brandSoft,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Icon(Icons.receipt_long_rounded, color: AppColors.brand, size: 28),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      store?.name ?? 'Barakali Bozor',
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.slate900),
                    ),
                    const SizedBox(height: 4),
                    Text('Buyurtma raqami: № ${order.number}', style: const TextStyle(fontSize: 13, color: AppColors.slate400)),
                    if (store?.address != null) ...[
                      const SizedBox(height: 2),
                      Text(store!.address!, style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const Divider(height: 1, color: Color(0xFFF1F5F9)),
              const SizedBox(height: 12),
              for (final it in order.items)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${it.nameUz} × ${it.quantity}',
                          style: const TextStyle(fontSize: 13.5, color: AppColors.slate800),
                        ),
                      ),
                      Text(
                        '${money(it.price * it.quantity)} so\'m',
                        style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: AppColors.slate900),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 8),
              const Divider(height: 1, color: Color(0xFFF1F5F9)),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Yetkazish', style: TextStyle(fontSize: 13, color: AppColors.slate500)),
                  Text(
                    order.deliveryFee == 0 ? 'Bepul' : '${money(order.deliveryFee)} so\'m',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.slate900),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Jami', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.slate900)),
                  Text(
                    '${money(order.total)} so\'m',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AppColors.brand),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              AppButton(label: 'Yopish', expand: true, onPressed: () => Navigator.pop(context)),
            ],
          ),
        ),
      ),
    );
  }
}
