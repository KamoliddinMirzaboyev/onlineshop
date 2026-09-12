import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/format.dart';
import '../core/theme.dart';
import '../models/order.dart';
import '../models/stats.dart';
import '../services/api.dart';
import '../services/cache.dart';
import '../services/location.dart';
import '../services/order_widget.dart';
import '../services/rate_prompt.dart';
import '../services/route_flow.dart';
import '../state/auth.dart';
import '../state/order_alerts.dart';
import '../widgets/common.dart';
import '../widgets/skeleton.dart';
import '../widgets/toast.dart';
import 'order_detail_page.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key, required this.onGoTab});

  final void Function(int index) onGoTab;

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  late final Resource<CourierStats> _stats;
  late final Resource<List<Order>> _orders;
  int? _updatingId;

  @override
  void initState() {
    super.initState();
    _stats = Resource<CourierStats>(
      cacheKey: 'courier_stats',
      fetchRaw: () => api.get('/courier/stats'),
      parse: CourierStats.fromJson,
      pollMs: 30000,
      errorText: "Statistikani yuklab bo'lmadi.",
    );
    _orders = Resource<List<Order>>(
      cacheKey: 'courier_orders',
      fetchRaw: () => api.get('/courier/orders'),
      parse: (raw) {
        final list = Order.listFrom(raw);
        unawaited(orderWidget.updateFromOrders(list));
        return list;
      },
      pollMs: 12000,
    );
    // Cache'dan darhol widget yangilash.
    final cached = _orders.data;
    if (cached != null) unawaited(orderWidget.updateFromOrders(cached));
  }

  @override
  void dispose() {
    _stats.dispose();
    _orders.dispose();
    super.dispose();
  }

  List<Order> get _myActive {
    final list = (_orders.data ?? [])
        .where((o) => o.status == 'accepted' || o.status == 'delivering')
        .toList()
      ..sort((a, b) =>
          (DateTime.tryParse(a.createdAt) ?? DateTime(0))
              .compareTo(DateTime.tryParse(b.createdAt) ?? DateTime(0)));
    return list;
  }

  Future<void> _deliver(Order o) async {
    if (_updatingId != null) return; // takroriy yetkazish so'rovi bo'lmasin
    setState(() => _updatingId = o.id);
    try {
      // Faqat shu buyurtma — order_ids: null bo'lsa backend courierning
      // BARCHA accepted buyurtmalarini reysga qo'shib yuboradi.
      final body = await locationService.gpsBody({
        'order_ids': [o.id],
      });
      final res =
          await api.post('/courier/route/start', body) as Map<String, dynamic>;
      final n = (res['orders'] as List?)?.length ?? 1;
      toast.success(
        n > 1
            ? 'Marshrut tuzildi 🛵 — $n ta stop'
            : 'Yetkazish boshlandi 🛵',
      );
      _orders.refresh();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Holatni o'zgartirib bo'lmadi"));
    } finally {
      if (mounted) setState(() => _updatingId = null);
    }
  }

  Future<void> _markDelivered(Order o) async {
    if (_updatingId != null) return;
    final pool = _orders.data ?? const <Order>[];
    if (!await RouteFlow.confirmOutOfOrder(context, o, deliveringPool: pool)) {
      return;
    }
    // Tasdiq dialogi ochiq ekan sahifa yopilgan bo'lishi mumkin.
    if (!mounted) return;
    final remainingBefore =
        pool.where((x) => x.status == 'delivering' && x.id != o.id).length;
    setState(() => _updatingId = o.id);
    try {
      final body = await locationService.gpsBody();
      await api.post('/courier/orders/${o.id}/delivered', body);
      toast.success(
        remainingBefore > 0
            ? 'Yetkazildi ✅ · qolgan $remainingBefore ta qayta tartiblandi'
            : 'Yetkazildi ✅',
      );
      _orders.refresh();
      _stats.refresh();
      if (remainingBefore > 0 && mounted) {
        await RouteFlow.offerNextStop(context);
      }
      if (mounted) unawaited(ratePrompt.maybeShowAfterDelivery(context));
    } catch (e) {
      toast.error(apiErrorMessage(e, "Yakunlab bo'lmadi"));
    } finally {
      if (mounted) setState(() => _updatingId = null);
    }
  }

  void _openOrder(int id) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => OrderDetailPage(orderId: id)),
    );
  }

  String get _greetName {
    final auth = context.watch<AuthState>();
    final n = auth.name?.trim();
    if (n != null && n.isNotEmpty) return n.split(RegExp(r'\s+')).first;
    return auth.username ?? 'kuryer';
  }

  @override
  Widget build(BuildContext context) {
    final alerts = context.watch<OrderAlerts>();

    return AnimatedBuilder(
      animation: Listenable.merge([_stats, _orders]),
      builder: (context, _) {
        final stats = _stats.data;
        final loading = _stats.loading && stats == null;
        return Column(
          children: [
            PageHeader(
              title: 'Salom, $_greetName 👋',
              subtitle: 'BB Kuryer',
              loading: _stats.loading || _stats.refreshing || _orders.refreshing,
              onRefresh: () {
                _stats.refresh();
                _orders.refresh();
              },
            ),
            Expanded(
              child: loading
                  ? const DashboardSkeleton()
                  : RefreshIndicator(
                      color: AppColors.brand,
                      onRefresh: () async {
                        _stats.refresh();
                        _orders.refresh();
                        // poller yangilanishini kutish
                        await Future<void>.delayed(const Duration(milliseconds: 400));
                      },
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                        children: [
                          if (_stats.error != null) ...[
                            ErrorBanner(_stats.error!),
                            const SizedBox(height: 12),
                          ],

                          // Bugungi KPI — faqat 2 ta
                          Row(
                            children: [
                              Expanded(
                                child: _Kpi(
                                  icon: Icons.check_circle_outline,
                                  tint: AppColors.emerald600,
                                  bg: const Color(0xFFECFDF5),
                                  value: '${stats?.today.delivered ?? 0}',
                                  label: 'Bugun yetkazildi',
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: _Kpi(
                                  icon: Icons.payments_outlined,
                                  tint: AppColors.brand,
                                  bg: AppColors.brand.withValues(alpha: 0.08),
                                  value: money(stats?.today.earnings ?? 0),
                                  label: "Bugungi daromad",
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),

                          // Joriy ish
                          if (_myActive.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            const Text(
                              'JORIY ISH',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: AppColors.slate400,
                                letterSpacing: 0.6,
                              ),
                            ),
                            const SizedBox(height: 8),
                            ..._myActive.map(
                              (o) => Padding(
                                padding: const EdgeInsets.only(bottom: 10),
                                child: _ActiveOrderCard(
                                  order: o,
                                  updating: _updatingId == o.id,
                                  onDeliver: () => _deliver(o),
                                  onDelivered: () => _markDelivered(o),
                                  onView: () => _openOrder(o.id),
                                ),
                              ),
                            ),
                          ],

                          // Bo'sh holat
                          if (alerts.availableCount == 0 && _myActive.isEmpty) ...[
                            const SizedBox(height: 24),
                            AppCard(
                              child: Column(
                                children: [
                                  Icon(Icons.pedal_bike,
                                      size: 40, color: AppColors.brand.withValues(alpha: 0.35)),
                                  const SizedBox(height: 10),
                                  const Text('Hozircha ish yo‘q',
                                      style: TextStyle(
                                          fontWeight: FontWeight.w600, color: AppColors.slate600)),
                                  const SizedBox(height: 4),
                                  const Text(
                                    'Yangi buyurtma kelganda shu yerda chiqadi',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(fontSize: 13, color: AppColors.slate400),
                                  ),
                                  const SizedBox(height: 12),
                                  GhostButton(
                                    label: "Buyurtmalarga o'tish",
                                    onPressed: () => widget.onGoTab(1),
                                  ),
                                ],
                              ),
                            ),
                          ],
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

class _Kpi extends StatelessWidget {
  const _Kpi({
    required this.icon,
    required this.tint,
    required this.bg,
    required this.value,
    required this.label,
  });

  final IconData icon;
  final Color tint;
  final Color bg;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, size: 18, color: tint),
          ),
          const SizedBox(height: 10),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, height: 1.1),
          ),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
        ],
      ),
    );
  }
}

class _ActiveOrderCard extends StatelessWidget {
  const _ActiveOrderCard({
    required this.order,
    required this.updating,
    required this.onDeliver,
    required this.onDelivered,
    required this.onView,
  });

  final Order order;
  final bool updating;
  final VoidCallback onDeliver;
  final VoidCallback onDelivered;
  final VoidCallback onView;

  @override
  Widget build(BuildContext context) {
    final isAccepted = order.status == 'accepted';
    return AppCard(
      onTap: onView,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('№ ${order.number}', style: const TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(width: 8),
              StatusPill(order.status),
              const Spacer(),
              Text("${money(order.total)} so'm",
                  style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.brand)),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.location_on_outlined, size: 14, color: AppColors.slate400),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  order.addressLine,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, color: AppColors.slate500),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (isAccepted)
            AppButton(
              label: updating ? '…' : "Yo'lga chiqish 🛵",
              expand: true,
              loading: updating,
              padding: const EdgeInsets.symmetric(vertical: 10),
              onPressed: updating ? null : onDeliver,
            )
          else
            AppButton(
              label: updating ? '…' : 'Yetkazildi ✅',
              color: AppColors.emerald600,
              expand: true,
              loading: updating,
              padding: const EdgeInsets.symmetric(vertical: 10),
              onPressed: updating ? null : onDelivered,
            ),
        ],
      ),
    );
  }
}
