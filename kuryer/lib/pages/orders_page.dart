import 'dart:async';

import 'package:flutter/material.dart';

import '../core/format.dart';
import '../core/theme.dart';
import '../models/order.dart';
import '../services/api.dart';
import '../services/cache.dart';
import '../services/location.dart';
import '../services/order_widget.dart';
import '../services/rate_prompt.dart';
import '../services/route_flow.dart';
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

  Future<Map<String, dynamic>> _gpsBody([Map<String, dynamic>? extra]) async {
    final body = <String, dynamic>{...?extra};
    final pos = await locationService.getOnce();
    if (pos != null) {
      body['lat'] = pos.lat;
      body['lng'] = pos.lng;
    }
    return body;
  }

  Future<void> _setStatus(int id, String status) async {
    setState(() => _updating = id);
    try {
      if (status == 'delivering') {
        final body = await _gpsBody({'order_ids': null});
        final res = await api.post('/courier/route/start', body)
            as Map<String, dynamic>;
        final n = (res['orders'] as List?)?.length ?? 1;
        final km = res['total_distance_km'];
        final kmLabel = km is num ? ' · ~${km.toStringAsFixed(1)} km' : '';
        toast.success(
          n > 1
              ? 'Marshrut tuzildi 🛵 — $n ta stop$kmLabel'
              : 'Yetkazish boshlandi 🛵$kmLabel',
        );
      } else {
        await api.patch('/courier/orders/$id', {'status': status});
        toast.success('Buyurtma qabul qilindi ✅');
      }
      _res.refresh();
    } catch (_) {
      toast.error("Holatni o'zgartirib bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      if (mounted) setState(() => _updating = null);
    }
  }

  /// Barcha accepted buyurtmalarni optimal marshrut bilan yo'lga chiqaradi.
  Future<void> _startRoute({bool includeIntoActive = false}) async {
    final accepted =
        (_res.data ?? []).where((o) => o.status == 'accepted').toList();
    if (accepted.isEmpty) return;
    setState(() => _updating = -1);
    try {
      final Map<String, dynamic> res;
      if (includeIntoActive) {
        final body = await _gpsBody({'include_accepted': true});
        res = await api.post('/courier/route/reoptimize', body)
            as Map<String, dynamic>;
      } else {
        final body = await _gpsBody({
          'order_ids': accepted.map((o) => o.id).toList(),
        });
        res = await api.post('/courier/route/start', body)
            as Map<String, dynamic>;
      }
      final n = (res['orders'] as List?)?.length ?? accepted.length;
      final km = res['total_distance_km'];
      final kmLabel = km is num ? ' · ~${km.toStringAsFixed(1)} km' : '';
      toast.success(
        n > 1
            ? 'Marshrut tuzildi 🛵 — $n ta stop$kmLabel'
            : 'Yetkazish boshlandi 🛵$kmLabel',
      );
      _res.refresh();
    } catch (_) {
      toast.error("Marshrutni boshlab bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      if (mounted) setState(() => _updating = null);
    }
  }

  Future<void> _reoptimizeRoute() async {
    setState(() => _updating = -2);
    try {
      final body = await _gpsBody();
      final res = await api.post('/courier/route/reoptimize', body)
          as Map<String, dynamic>;
      final n = (res['orders'] as List?)?.length ?? 0;
      final km = res['total_distance_km'];
      final kmLabel = km is num ? ' · ~${km.toStringAsFixed(1)} km' : '';
      toast.success('Marshrut yangilandi 🔄 — $n ta stop$kmLabel');
      _res.refresh();
    } catch (_) {
      toast.error("Marshrutni yangilab bo'lmadi");
    } finally {
      if (mounted) setState(() => _updating = null);
    }
  }

  Future<void> _markDelivered(int id) async {
    Order? target;
    for (final o in _res.data ?? const <Order>[]) {
      if (o.id == id) {
        target = o;
        break;
      }
    }
    if (target != null &&
        !await RouteFlow.confirmOutOfOrder(
          context,
          target,
          deliveringPool: _res.data,
        )) {
      return;
    }

    setState(() => _updating = id);
    try {
      final body = await _gpsBody();
      await api.post('/courier/orders/$id/delivered', body);
      final remaining = (_res.data ?? [])
          .where((o) => o.status == 'delivering' && o.id != id)
          .length;
      toast.success(
        remaining > 0
            ? 'Yetkazildi ✅ · qolgan $remaining ta qayta tartiblandi'
            : 'Buyurtma yetkazildi ✅',
      );
      if (remaining > 0 && mounted) {
        await RouteFlow.offerNextStop(context);
        _res.refresh();
      } else {
        _res.refresh();
      }
      if (mounted) unawaited(ratePrompt.maybeShowAfterDelivery(context));
    } catch (_) {
      toast.error("Yakunlab bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      if (mounted) setState(() => _updating = null);
    }
  }

  void _open(int id) => Navigator.of(context)
      .push(MaterialPageRoute(builder: (_) => OrderDetailPage(orderId: id)));

  void _openFullRoute(List<Order> delivering) {
    final pts = delivering
        .where((o) => o.lat != null && o.lng != null)
        .toList()
      ..sort((a, b) =>
          (a.routeSequence ?? 999).compareTo(b.routeSequence ?? 999));
    if (pts.isEmpty) {
      toast.error("Koordinatali manzil yo'q");
      return;
    }
    final waypoints = [
      for (final o in pts) (lat: o.lat!, lng: o.lng!),
    ];
    showNavigationChooser(
      context,
      lat: pts.first.lat,
      lng: pts.first.lng,
      address: '${pts.length} ta stop',
      waypoints: waypoints,
    );
  }

  List<Order> _sorted(List<Order> orders) {
    int rank(Order o) {
      switch (o.status) {
        case 'delivering':
          return 0;
        case 'accepted':
          return 1;
        case 'ready':
        case 'preparing':
        case 'confirmed':
          return 2;
        default:
          return 3;
      }
    }

    final copy = [...orders];
    copy.sort((a, b) {
      final r = rank(a).compareTo(rank(b));
      if (r != 0) return r;
      if (a.status == 'delivering' && b.status == 'delivering') {
        return (a.routeSequence ?? 999).compareTo(b.routeSequence ?? 999);
      }
      return a.createdAt.compareTo(b.createdAt);
    });
    return copy;
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _res,
      builder: (context, _) {
        final orders = _sorted(_res.data ?? []);
        final accepted =
            orders.where((o) => o.status == 'accepted').toList();
        final delivering =
            orders.where((o) => o.status == 'delivering').toList();
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
                          if (accepted.isNotEmpty && delivering.isNotEmpty) ...[
                            _RouteBanner(
                              count: accepted.length,
                              loading: _updating == -1,
                              onStart: () => _startRoute(includeIntoActive: true),
                              title:
                                  '${accepted.length} ta yangi · marshrutga qo\'shish',
                              subtitle:
                                  'Joriy joydan qayta optimal tartib',
                              buttonLabel:
                                  '➕  Reysga qo\'shish (${accepted.length})',
                            ),
                            const SizedBox(height: 12),
                          ] else if (accepted.length >= 2) ...[
                            _RouteBanner(
                              count: accepted.length,
                              loading: _updating == -1,
                              onStart: () => _startRoute(),
                            ),
                            const SizedBox(height: 12),
                          ],
                          if (delivering.isNotEmpty) ...[
                            _RouteProgressBanner(delivering: delivering),
                            const SizedBox(height: 12),
                          ],
                          if (delivering.length >= 2) ...[
                            _ActiveRouteBanner(
                              count: delivering.length,
                              loading: _updating == -2,
                              onNav: () => _openFullRoute(delivering),
                              onReoptimize: _reoptimizeRoute,
                            ),
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

class _RouteProgressBanner extends StatelessWidget {
  const _RouteProgressBanner({required this.delivering});
  final List<Order> delivering;

  @override
  Widget build(BuildContext context) {
    final sorted = [...delivering]
      ..sort((a, b) =>
          (a.routeSequence ?? 999).compareTo(b.routeSequence ?? 999));
    final n = sorted.length;
    final remainKm = sorted.fold<double>(
      0,
      (s, o) => s + (o.routeLegKm ?? 0),
    );
    final next = sorted.isNotEmpty ? sorted.first : null;
    final kmLabel =
        remainKm > 0 ? ' · qolgan ~${remainKm.toStringAsFixed(1)} km' : '';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFECFDF5),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFA7F3D0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Reys: $n ta stop$kmLabel',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: Color(0xFF047857),
            ),
          ),
          if (next != null) ...[
            const SizedBox(height: 4),
            Text(
              'Keyingi: #${next.routeSequence ?? 1} · № ${next.number}',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF065F46),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _RouteBanner extends StatelessWidget {
  const _RouteBanner({
    required this.count,
    required this.loading,
    required this.onStart,
    this.title,
    this.subtitle,
    this.buttonLabel,
  });
  final int count;
  final bool loading;
  final VoidCallback onStart;
  final String? title;
  final String? subtitle;
  final String? buttonLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1D4ED8), Color(0xFF2563EB)],
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF2563EB).withValues(alpha: 0.25),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title ?? '$count ta buyurtma yig\'ilgan',
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 15,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle ?? 'Bir reysda eng qisqa yo\'l bilan yetkazish',
            style: const TextStyle(color: Color(0xFFBFDBFE), fontSize: 12),
          ),
          const SizedBox(height: 12),
          Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              onTap: loading ? null : onStart,
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Center(
                  child: Text(
                    loading
                        ? '…'
                        : (buttonLabel ?? '🛵  Yo\'lga chiqish ($count ta)'),
                    style: const TextStyle(
                      color: Color(0xFF1D4ED8),
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ActiveRouteBanner extends StatelessWidget {
  const _ActiveRouteBanner({
    required this.count,
    required this.onNav,
    required this.onReoptimize,
    this.loading = false,
  });
  final int count;
  final VoidCallback onNav;
  final VoidCallback onReoptimize;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFBFDBFE)),
      ),
      child: Column(
        children: [
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onNav,
              borderRadius: BorderRadius.circular(10),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
                child: Row(
                  children: [
                    const Icon(Icons.route, color: Color(0xFF2563EB), size: 22),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Faol marshrut: $count ta stop · Xaritada ochish',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF1E40AF),
                        ),
                      ),
                    ),
                    const Icon(Icons.chevron_right, color: Color(0xFF2563EB)),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 4),
          SizedBox(
            width: double.infinity,
            child: TextButton.icon(
              onPressed: loading ? null : onReoptimize,
              icon: loading
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.refresh, size: 16),
              label: Text(
                loading ? '…' : 'Joriy joydan qayta tartiblash',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              style: TextButton.styleFrom(
                foregroundColor: const Color(0xFF1D4ED8),
              ),
            ),
          ),
        ],
      ),
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
    final dist = orderDistanceLabel(
      status: order.status,
      routeLegKm: order.routeLegKm,
      distanceKm: order.distanceKm,
    );
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
                    if (order.routeSequence != null &&
                        order.status == 'delivering')
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: order.routeSequence == 1
                              ? const Color(0xFF16A34A)
                              : const Color(0xFF2563EB),
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(
                          order.routeSequence == 1
                              ? '#1 KEYINGI'
                              : '#${order.routeSequence}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
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
