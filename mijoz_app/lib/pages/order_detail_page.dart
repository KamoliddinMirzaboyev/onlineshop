import 'dart:async';
import 'package:flutter/material.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../models/catalog.dart';
import '../models/order.dart';
import '../services/api.dart';
import '../widgets/common.dart';

const _terminal = {'delivered', 'cancelled'};

int _stageIndex(String status) {
  if (status == 'delivered') return 2;
  if (status == 'delivering') return 1;
  return 0;
}

const _stages = ['Tasdiqlangan', 'Yo\'lda', 'Yetkazildi'];

/// Buyurtma tafsiloti — status progressi, mahsulotlar, kuryer, chek.
/// Mirrors `OrderDetailPage.tsx` (xarita/websocket'siz — poll orqali).
class OrderDetailPage extends StatefulWidget {
  const OrderDetailPage({super.key, required this.orderId, this.justPlaced = false});
  final int orderId;
  final bool justPlaced;

  @override
  State<OrderDetailPage> createState() => _OrderDetailPageState();
}

class _OrderDetailPageState extends State<OrderDetailPage> {
  Order? _order;
  RestaurantDetail? _store;
  bool _error = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 10), (_) => _load());
  }

  @override
  void dispose() {
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
        backgroundColor: AppColors.slate50,
        elevation: 0,
        foregroundColor: AppColors.slate900,
        title: Text(order != null ? '№ ${order.number}' : ''),
        actions: [if (order != null) Padding(padding: const EdgeInsets.only(right: 12), child: Center(child: StatusPill(order.status)))],
      ),
      body: order == null
          ? Center(child: _error ? const Text('Xatolik') : const CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (widget.justPlaced && order.status != 'cancelled')
                    Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(20)),
                      child: const Row(
                        children: [
                          Icon(Icons.check_circle, color: Color(0xFF059669), size: 26),
                          SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Buyurtma yuborildi. Kuryer tez orada qabul qiladi.',
                              style: TextStyle(color: Color(0xFF047857), fontSize: 13, fontWeight: FontWeight.w500),
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (order.status == 'cancelled')
                    Container(
                      padding: const EdgeInsets.all(14),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(16)),
                      child: const Row(
                        children: [
                          Icon(Icons.cancel, color: AppColors.red600, size: 20),
                          SizedBox(width: 8),
                          Text('Buyurtma bekor qilindi', style: TextStyle(color: AppColors.red600, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    )
                  else
                    _StageProgress(stage: _stageIndex(order.status)),

                  AppCard(
                    child: Column(
                      children: [
                        for (final it in order.items)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(10),
                                  child: it.imageUrl != null
                                      ? Image.network(
                                          it.imageUrl!, width: 44, height: 44, fit: BoxFit.cover,
                                          errorBuilder: (_, __, ___) => Container(width: 44, height: 44, color: AppColors.slate100,
                                              alignment: Alignment.center, child: const Text('🍽')),
                                        )
                                      : Container(width: 44, height: 44, color: AppColors.slate100,
                                          alignment: Alignment.center, child: const Text('🍽')),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(it.nameUz, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13)),
                                      Text('${qtyUnit(it.quantity, it.unit)} × ${money(it.price)} so\'m',
                                          style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
                                    ],
                                  ),
                                ),
                                Text('${money(it.price * it.quantity)} so\'m', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                              ],
                            ),
                          ),
                        const Divider(height: 20, color: AppColors.slate100),
                        _kv('Yetkazish', order.deliveryFee == 0 ? 'Bepul' : '${money(order.deliveryFee)} so\'m'),
                        const SizedBox(height: 6),
                        _kv('Jami', '${money(order.total)} so\'m', bold: true),
                      ],
                    ),
                  ),

                  if (order.distanceKm != null || order.etaMinutes != null) ...[
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        if (order.distanceKm != null)
                          Expanded(child: _MiniStat(label: 'Masofa', value: distanceLabel(order.distanceKm) ?? '—')),
                        if (order.distanceKm != null && order.etaMinutes != null) const SizedBox(width: 10),
                        if (order.etaMinutes != null)
                          Expanded(child: _MiniStat(label: 'Taxminiy vaqt', value: etaLabel(order.etaMinutes) ?? '—', accent: true)),
                      ],
                    ),
                  ],

                  if (order.assignedCourierName != null) ...[
                    const SizedBox(height: 12),
                    AppCard(
                      child: Row(
                        children: [
                          Container(
                            width: 40, height: 40,
                            decoration: BoxDecoration(color: AppColors.brandLight.withValues(alpha: 0.3), shape: BoxShape.circle),
                            child: const Icon(Icons.person, color: AppColors.brand, size: 18),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Kuryer', style: TextStyle(fontSize: 11, color: AppColors.slate400)),
                                Text(order.assignedCourierName!, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                              ],
                            ),
                          ),
                          if (order.assignedCourierPhone != null)
                            IconButton(
                              icon: const Icon(Icons.call, color: AppColors.brand),
                              onPressed: () => launchPhone(order.assignedCourierPhone!),
                            ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 12),
                  AppCard(
                    child: Column(
                      children: [
                        _infoRow(Icons.location_on_outlined, order.addressLine),
                        if (order.phone != null) _infoRow(Icons.call_outlined, order.phone!),
                        _infoRow(Icons.credit_card, paymentLabel(order.paymentMethod)),
                        if (order.comment != null) _infoRow(Icons.chat_bubble_outline, order.comment!),
                        _infoRow(Icons.access_time, formatFull(order.createdAt), last: true),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),
                  GhostButton(label: 'Chekni ko\'rish', icon: Icons.receipt_long, expand: true, onPressed: _showReceipt),
                ],
              ),
            ),
    );
  }

  Widget _kv(String k, String v, {bool bold = false}) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(k, style: TextStyle(color: bold ? AppColors.slate900 : AppColors.slate400, fontWeight: bold ? FontWeight.w600 : FontWeight.normal)),
          Text(v, style: TextStyle(color: AppColors.slate900, fontWeight: bold ? FontWeight.w700 : FontWeight.w500)),
        ],
      );

  Widget _infoRow(IconData icon, String text, {bool last = false}) => Padding(
        padding: EdgeInsets.only(bottom: last ? 0 : 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 28, height: 28,
              decoration: BoxDecoration(color: AppColors.brandLight.withValues(alpha: 0.3), shape: BoxShape.circle),
              child: Icon(icon, size: 14, color: AppColors.brand),
            ),
            const SizedBox(width: 10),
            Expanded(child: Padding(padding: const EdgeInsets.only(top: 5), child: Text(text, style: const TextStyle(fontSize: 13)))),
          ],
        ),
      );
}

class _StageProgress extends StatelessWidget {
  const _StageProgress({required this.stage});
  final int stage;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: List.generate(_stages.length, (i) {
          final done = i < stage;
          final active = i == stage;
          return Expanded(
            child: Column(
              children: [
                Row(
                  children: [
                    if (i > 0) Expanded(child: Container(height: 2, color: i <= stage ? AppColors.brand : AppColors.slate200)),
                    Container(
                      width: 28, height: 28,
                      decoration: BoxDecoration(
                        color: done || active ? AppColors.brand : AppColors.slate200,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: done
                          ? const Icon(Icons.check, size: 14, color: Colors.white)
                          : Text('${i + 1}', style: TextStyle(fontSize: 12, color: active ? Colors.white : AppColors.slate500)),
                    ),
                    if (i < _stages.length - 1) Expanded(child: Container(height: 2, color: i < stage ? AppColors.brand : AppColors.slate200)),
                  ],
                ),
                const SizedBox(height: 4),
                Text(_stages[i], style: TextStyle(fontSize: 11, color: i <= stage ? AppColors.slate900 : AppColors.slate400)),
              ],
            ),
          );
        }),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.label, required this.value, this.accent = false});
  final String label;
  final String value;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Column(
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
          const SizedBox(height: 2),
          Text(value, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: accent ? AppColors.brand : AppColors.slate900)),
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
        padding: const EdgeInsets.all(20),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.slate200, borderRadius: BorderRadius.circular(2)))),
              const SizedBox(height: 16),
              Center(
                child: Column(
                  children: [
                    Text(store?.name ?? 'Barakali Bozor', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                    if (store?.address != null) Text('📍 ${store!.address}', style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
                    if (store?.phones.isNotEmpty ?? false) Text('📱 ${store!.phones.first}', style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
                  ],
                ),
              ),
              const Divider(height: 28),
              for (final it in order.items)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      Expanded(child: Text(it.nameUz, style: const TextStyle(fontSize: 13))),
                      Text('${money(it.price * it.quantity)} so\'m', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
              const Divider(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Jami', style: TextStyle(fontWeight: FontWeight.w700)),
                  Text('${money(order.total)} so\'m', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                ],
              ),
              const SizedBox(height: 20),
              AppButton(label: 'Yopish', expand: true, onPressed: () => Navigator.pop(context)),
            ],
          ),
        ),
      ),
    );
  }
}
