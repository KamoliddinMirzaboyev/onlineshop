import 'dart:async';

import 'package:flutter/material.dart';

import '../core/format.dart';
import '../core/theme.dart';
import '../models/order.dart';
import '../services/api.dart';
import '../services/cache.dart';
import '../services/order_widget.dart';
import '../services/rate_prompt.dart';
import '../widgets/common.dart';
import '../widgets/skeleton.dart';
import '../widgets/toast.dart';
import 'order_detail_page.dart';

const _acceptable = {'pending', 'confirmed', 'preparing', 'ready'};
bool _isAcceptable(String s) => _acceptable.contains(s);

class OrdersPage extends StatefulWidget {
  const OrdersPage({super.key});

  @override
  State<OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends State<OrdersPage> {
  late final Resource<List<Order>> _res;
  int? _updating;

  @override
  void initState() {
    super.initState();
    _res = Resource<List<Order>>(
      cacheKey: 'courier_orders',
      fetchRaw: () => api.get('/courier/orders'),
      parse: (raw) {
        final list = Order.listFrom(raw);
        unawaited(orderWidget.updateFromOrders(list));
        return list;
      },
      pollMs: 20000,
      errorText: "Buyurtmalarni yangilab bo'lmadi. Internetni tekshiring.",
    );
    final cached = _res.data;
    if (cached != null) unawaited(orderWidget.updateFromOrders(cached));
  }

  @override
  void dispose() {
    _res.dispose();
    super.dispose();
  }

  Future<void> _setStatus(int id, String status) async {
    setState(() => _updating = id);
    try {
      await api.patch('/courier/orders/$id', {'status': status});
      toast.success(
        status == 'accepted'
            ? 'Buyurtma qabul qilindi ✅'
            : status == 'delivering'
                ? 'Yetkazish boshlandi 🛵 — mijozga ETA yuborildi'
                : 'Holat yangilandi',
      );
      _res.refresh();
    } catch (_) {
      toast.error("Holatni o'zgartirib bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      if (mounted) setState(() => _updating = null);
    }
  }

  Future<void> _markDelivered(int id) async {
    setState(() => _updating = id);
    try {
      await api.post('/courier/orders/$id/delivered', {});
      toast.success('Buyurtma yetkazildi ✅');
      _res.refresh();
      if (mounted) unawaited(ratePrompt.maybeShowAfterDelivery(context));
    } catch (_) {
      toast.error("Yakunlab bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      if (mounted) setState(() => _updating = null);
    }
  }

  void _open(int id) => Navigator.of(context)
      .push(MaterialPageRoute(builder: (_) => OrderDetailPage(orderId: id)));

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _res,
      builder: (context, _) {
        final orders = _res.data ?? [];
        return Column(
          children: [
            PageHeader(
              title: 'Buyurtmalar',
              subtitle: 'Faol: ${orders.length}',
              loading: _res.loading || _res.refreshing,
              onRefresh: _res.refresh,
            ),
            Expanded(
              child: _res.loading
                  ? const ListSkeleton(count: 3)
                  : RefreshIndicator(
                      color: AppColors.brand,
                      onRefresh: () async => _res.refresh(),
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          if (_res.error != null) ...[
                            ErrorBanner(_res.error!),
                            const SizedBox(height: 12),
                          ],
                          if (orders.isEmpty)
                            const Padding(
                              padding: EdgeInsets.only(top: 8),
                              child: EmptyState(
                                icon: Icons.pedal_bike,
                                message: "Hozircha buyurtma yo'q",
                              ),
                            ),
                          ...orders.map((o) => Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: _OrderCard(
                                  order: o,
                                  updating: _updating == o.id,
                                  onDetail: () => _open(o.id),
                                  onAccept: () => _setStatus(o.id, 'accepted'),
                                  onDeliver: () => _setStatus(o.id, 'delivering'),
                                  onDelivered: () => _markDelivered(o.id),
                                ),
                              )),
                        ],
                      ),
                    ),
            ),
          ],
        );
      },
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({
    required this.order,
    required this.updating,
    required this.onDetail,
    required this.onAccept,
    required this.onDeliver,
    required this.onDelivered,
  });

  final Order order;
  final bool updating;
  final VoidCallback onDetail;
  final VoidCallback onAccept;
  final VoidCallback onDeliver;
  final VoidCallback onDelivered;

  @override
  Widget build(BuildContext context) {
    final dist = distanceLabel(order.distanceKm);
    final eta = etaLabel(order.etaMinutes);
    final hasNote = order.items.any((it) => it.note != null && it.note!.isNotEmpty);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 8,
                  runSpacing: 4,
                  children: [
                    Text('№ ${order.number}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                    StatusPill(order.status),
                  ],
                ),
              ),
              Text("${money(order.total)} so'm",
                  style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.brand)),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.location_on_outlined, size: 14, color: AppColors.slate400),
              const SizedBox(width: 6),
              Expanded(
                child: Text(order.addressLine,
                    style: const TextStyle(fontSize: 14, color: AppColors.slate600)),
              ),
            ],
          ),
          if (order.phone != null) ...[
            const SizedBox(height: 4),
            Row(children: [
              const Icon(Icons.phone_outlined, size: 14, color: AppColors.slate400),
              const SizedBox(width: 6),
              GestureDetector(
                onTap: () => launchPhone(order.phone!),
                child: Text(order.phone!,
                    style: const TextStyle(fontSize: 14, color: AppColors.brand, fontWeight: FontWeight.w500)),
              ),
            ]),
          ],
          if (dist != null || eta != null) ...[
            const SizedBox(height: 4),
            Row(children: [
              if (dist != null) ...[
                const Icon(Icons.navigation_outlined, size: 12, color: AppColors.slate400),
                const SizedBox(width: 4),
                Text(dist, style: const TextStyle(fontSize: 12, color: AppColors.slate500)),
                const SizedBox(width: 12),
              ],
              if (eta != null) ...[
                const Icon(Icons.access_time, size: 12, color: AppColors.slate400),
                const SizedBox(width: 4),
                Text(eta, style: const TextStyle(fontSize: 12, color: AppColors.slate500)),
              ],
            ]),
          ],
          const SizedBox(height: 12),
          // Item thumbnails
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                ...order.items.map((it) => Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: _Thumb(imageUrl: it.imageUrl),
                    )),
                Center(
                  child: Text('${order.items.length} ta mahsulot',
                      style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
                ),
              ],
            ),
          ),
          if (hasNote) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text('💬 Mahsulot izohlari bor — batafsilda ko\'ring',
                  style: TextStyle(fontSize: 12, color: Color(0xFFB45309))),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: GhostButton(
                  label: 'Batafsil',
                  expand: true,
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  onPressed: onDetail,
                ),
              ),
              if (_isAcceptable(order.status)) ...[
                const SizedBox(width: 8),
                Expanded(
                  child: AppButton(
                    label: updating ? '…' : 'Qabul qilish ✅',
                    color: AppColors.cyan600,
                    expand: true,
                    loading: updating,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    onPressed: updating ? null : onAccept,
                  ),
                ),
              ],
              if (order.status == 'accepted') ...[
                const SizedBox(width: 8),
                Expanded(
                  child: AppButton(
                    label: updating ? '…' : 'Yetkazaman 🛵',
                    color: AppColors.blue600,
                    expand: true,
                    loading: updating,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    onPressed: updating ? null : onDeliver,
                  ),
                ),
              ],
              if (order.status == 'delivering') ...[
                const SizedBox(width: 8),
                Expanded(
                  child: AppButton(
                    label: updating ? '…' : 'Yetkazdim ✓',
                    color: AppColors.emerald600,
                    expand: true,
                    loading: updating,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    onPressed: updating ? null : onDelivered,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _Thumb extends StatelessWidget {
  const _Thumb({this.imageUrl});
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    if (imageUrl != null && imageUrl!.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.network(
          imageUrl!,
          width: 40,
          height: 40,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _placeholder(),
        ),
      );
    }
    return _placeholder();
  }

  Widget _placeholder() => Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: AppColors.slate100,
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Center(child: Text('🍽', style: TextStyle(fontSize: 14))),
      );
}
