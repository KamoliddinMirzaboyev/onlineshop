import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/format.dart';
import '../core/theme.dart';
import '../models/order.dart';
import '../models/stats.dart';
import '../services/api.dart';
import '../services/cache.dart';
import '../state/auth.dart';
import '../state/order_alerts.dart';
import '../widgets/common.dart';
import '../widgets/skeleton.dart';
import '../widgets/toast.dart';
import 'order_detail_page.dart';

/// Available order = not yet assigned to anyone and still in an acceptable state.
const _acceptable = {'pending', 'confirmed', 'preparing', 'ready'};
bool _isAcceptable(String s) => _acceptable.contains(s);

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key, required this.onGoTab});

  /// Jump to another bottom-nav tab (orders=1, history=2).
  final void Function(int index) onGoTab;

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  late final Resource<CourierStats> _stats;
  late final Resource<List<Order>> _orders;
  late final Resource<List<Order>> _recent;
  int? _updatingId;

  @override
  void initState() {
    super.initState();
    _stats = Resource<CourierStats>(
      cacheKey: 'courier_stats',
      fetchRaw: () => api.get('/courier/stats'),
      parse: CourierStats.fromJson,
      pollMs: 30000,
      errorText: "Statistikani yuklab bo'lmadi. Internetni tekshiring.",
    );
    _orders = Resource<List<Order>>(
      cacheKey: 'courier_orders',
      fetchRaw: () => api.get('/courier/orders'),
      parse: Order.listFrom,
      pollMs: 12000,
    );
    _recent = Resource<List<Order>>(
      cacheKey: 'courier_recent',
      fetchRaw: () => api.get('/courier/history?limit=3'),
      parse: Order.listFrom,
      pollMs: 30000,
    );
  }

  @override
  void dispose() {
    _stats.dispose();
    _orders.dispose();
    _recent.dispose();
    super.dispose();
  }

  List<Order> get _available {
    final list = (_orders.data ?? [])
        .where((o) => o.assignedCourierId == null && _isAcceptable(o.status))
        .toList()
      ..sort((a, b) =>
          (DateTime.tryParse(a.createdAt) ?? DateTime(0))
              .compareTo(DateTime.tryParse(b.createdAt) ?? DateTime(0)));
    return list;
  }

  // Orders already mine (accepted or out for delivery) — the courier's
  // "currently being collected" work, kept visible without leaving Dashboard.
  List<Order> get _myActive {
    final list = (_orders.data ?? [])
        .where((o) => o.status == 'accepted' || o.status == 'delivering')
        .toList()
      ..sort((a, b) =>
          (DateTime.tryParse(a.createdAt) ?? DateTime(0))
              .compareTo(DateTime.tryParse(b.createdAt) ?? DateTime(0)));
    return list;
  }

  Future<void> _accept(Order o) async {
    setState(() => _updatingId = o.id);
    try {
      await api.patch('/courier/orders/${o.id}', {'status': 'accepted'});
      toast.success('№ ${o.number} qabul qilindi ✅');
      _orders.refresh();
      _stats.refresh();
    } catch (_) {
      toast.error("Buyurtmani qabul qilib bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      if (mounted) setState(() => _updatingId = null);
    }
  }

  Future<void> _deliver(Order o) async {
    setState(() => _updatingId = o.id);
    try {
      await api.patch('/courier/orders/${o.id}', {'status': 'delivering'});
      toast.success('Yetkazish boshlandi 🛵 — mijozga ETA yuborildi');
      _orders.refresh();
    } catch (_) {
      toast.error("Holatni o'zgartirib bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      if (mounted) setState(() => _updatingId = null);
    }
  }

  Future<void> _markDelivered(Order o) async {
    setState(() => _updatingId = o.id);
    try {
      await api.post('/courier/orders/${o.id}/delivered', {});
      toast.success('Buyurtma yetkazildi ✅');
      _orders.refresh();
      _stats.refresh();
      _recent.refresh();
    } catch (_) {
      toast.error("Yakunlab bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      if (mounted) setState(() => _updatingId = null);
    }
  }

  void _openOrder(int id) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => OrderDetailPage(orderId: id)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final username = context.watch<AuthState>().username ?? 'kuryer';
    final alerts = context.watch<OrderAlerts>();

    return AnimatedBuilder(
      animation: Listenable.merge([_stats, _orders, _recent]),
      builder: (context, _) {
        final stats = _stats.data;
        final loading = _stats.loading;
        return Column(
          children: [
            PageHeader(
              title: 'Salom, $username 👋',
              subtitle: 'Barakali Bozor Kuryer',
              loading: _stats.loading || _stats.refreshing || _orders.refreshing,
              onRefresh: () {
                _stats.refresh();
                _orders.refresh();
              },
            ),
            Expanded(
              child: loading
                  ? const DashboardSkeleton()
                  : ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        if (_stats.error != null) ...[
                          ErrorBanner(_stats.error!),
                          const SizedBox(height: 16),
                        ],

                        // Available (unassigned) orders banner + preview cards
                        if (alerts.availableCount > 0) ...[
                          _AvailableBanner(
                            count: alerts.availableCount,
                            onTap: () => widget.onGoTab(1),
                          ),
                          const SizedBox(height: 10),
                          ..._available.take(3).map((o) => Padding(
                                padding: const EdgeInsets.only(bottom: 10),
                                child: _AvailableCard(
                                  order: o,
                                  accepting: _updatingId == o.id,
                                  onAccept: () => _accept(o),
                                  onView: () => _openOrder(o.id),
                                ),
                              )),
                          const SizedBox(height: 10),
                        ],

                        // My active orders — accepted / out for delivery
                        if (_myActive.isNotEmpty) ...[
                          _sectionLabel('Joriy buyurtma'),
                          const SizedBox(height: 8),
                          ..._myActive.map((o) => Padding(
                                padding: const EdgeInsets.only(bottom: 10),
                                child: _ActiveOrderCard(
                                  order: o,
                                  updating: _updatingId == o.id,
                                  onDeliver: () => _deliver(o),
                                  onDelivered: () => _markDelivered(o),
                                  onView: () => _openOrder(o.id),
                                ),
                              )),
                          const SizedBox(height: 6),
                        ],

                        // Active orders shortcut
                        AppCard(
                          onTap: () => widget.onGoTab(1),
                          child: Row(
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: AppColors.brand.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(Icons.pedal_bike, color: AppColors.brand),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('Faol buyurtmalar',
                                        style: TextStyle(fontSize: 14, color: AppColors.slate500)),
                                    Text('${stats?.active ?? 0}',
                                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                                  ],
                                ),
                              ),
                              const Text('Ko\'rish →',
                                  style: TextStyle(color: AppColors.brand, fontWeight: FontWeight.w600, fontSize: 14)),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Today
                        _sectionLabel('Bugun'),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: _StatCard(
                                icon: Icons.check_circle_outline,
                                iconColor: AppColors.emerald600,
                                value: '${stats?.today.delivered ?? 0}',
                                label: 'Yetkazildi',
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _StatCard(
                                icon: Icons.account_balance_wallet_outlined,
                                iconColor: AppColors.brand,
                                value: money(stats?.today.earnings ?? 0),
                                label: 'Daromad',
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _StatCard(
                                icon: Icons.cancel_outlined,
                                iconColor: AppColors.rose500,
                                value: '${stats?.today.cancelled ?? 0}',
                                label: 'Bekor',
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Week / Month
                        Row(
                          children: [
                            Expanded(
                              child: _PeriodCard(
                                title: 'Bu hafta',
                                delivered: stats?.week.delivered ?? 0,
                                cancelled: stats?.week.cancelled ?? 0,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _PeriodCard(
                                title: 'Bu oy',
                                delivered: stats?.month.delivered ?? 0,
                                cancelled: stats?.month.cancelled ?? 0,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // 7-day chart
                        _WeeklyChart(series: stats?.series ?? []),
                        const SizedBox(height: 16),

                        // Recent orders
                        if ((_recent.data ?? []).isNotEmpty) ...[
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              _sectionLabel("So'nggi buyurtmalar"),
                              GestureDetector(
                                onTap: () => widget.onGoTab(2),
                                child: const Text('Barchasi →',
                                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.brand)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          ...(_recent.data ?? []).map((o) => Padding(
                                padding: const EdgeInsets.only(bottom: 10),
                                child: _RecentCard(order: o, onTap: () => _openOrder(o.id)),
                              )),
                        ],
                      ],
                    ),
            ),
          ],
        );
      },
    );
  }

  Widget _sectionLabel(String text) => Text(
        text.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: AppColors.slate400,
          letterSpacing: 0.5,
        ),
      );
}

class _AvailableBanner extends StatelessWidget {
  const _AvailableBanner({required this.count, required this.onTap});
  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      color: AppColors.brand,
      border: Border.all(color: Colors.transparent),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.notifications_none, color: Colors.white, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Yangi buyurtma bor',
                    style: TextStyle(fontSize: 14, color: Colors.white.withValues(alpha: 0.8))),
                Text('$count ta',
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white)),
              ],
            ),
          ),
          const Text('Barchasi →',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14)),
        ],
      ),
    );
  }
}

class _AvailableCard extends StatelessWidget {
  const _AvailableCard({
    required this.order,
    required this.accepting,
    required this.onAccept,
    required this.onView,
  });

  final Order order;
  final bool accepting;
  final VoidCallback onAccept;
  final VoidCallback onView;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      border: Border.all(color: AppColors.brand.withValues(alpha: 0.25), width: 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Text('№ ${order.number}', style: const TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(width: 8),
                      StatusPill(order.status),
                    ]),
                    const SizedBox(height: 4),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.location_on_outlined, size: 14, color: AppColors.slate500),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(order.addressLine,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 14, color: AppColors.slate500)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(children: [
                      const Icon(Icons.access_time, size: 12, color: AppColors.slate400),
                      const SizedBox(width: 4),
                      Text(formatDateTime(order.createdAt),
                          style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
                    ]),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text("${money(order.total)} so'm",
                  style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.brand)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: accepting ? '…' : 'Qabul qilish ✅',
                  color: AppColors.cyan600,
                  expand: true,
                  loading: accepting,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  onPressed: accepting ? null : onAccept,
                ),
              ),
              const SizedBox(width: 8),
              GhostButton(
                label: "Ko'rish",
                textColor: AppColors.slate600,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                onPressed: onView,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.iconColor,
    required this.value,
    required this.label,
  });

  final IconData icon;
  final Color iconColor;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: iconColor),
          const SizedBox(height: 4),
          Text(value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, height: 1.1)),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
        ],
      ),
    );
  }
}

class _PeriodCard extends StatelessWidget {
  const _PeriodCard({required this.title, required this.delivered, required this.cancelled});
  final String title;
  final int delivered;
  final int cancelled;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 14, color: AppColors.slate500)),
          const SizedBox(height: 8),
          Row(children: [
            const Icon(Icons.check_circle_outline, size: 15, color: AppColors.emerald600),
            const SizedBox(width: 6),
            Text('$delivered yetkazildi',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          ]),
          const SizedBox(height: 4),
          Row(children: [
            const Icon(Icons.cancel_outlined, size: 15, color: AppColors.rose500),
            const SizedBox(width: 6),
            Text('$cancelled bekor qilindi',
                style: const TextStyle(fontSize: 13, color: AppColors.slate400)),
          ]),
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
    final isDelivering = order.status == 'delivering';
    return AppCard(
      border: Border.all(
        color: (isDelivering ? AppColors.emerald600 : AppColors.blue600).withValues(alpha: 0.25),
        width: 2,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Text('№ ${order.number}', style: const TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(width: 8),
                      StatusPill(order.status),
                    ]),
                    const SizedBox(height: 4),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.location_on_outlined, size: 14, color: AppColors.slate500),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(order.addressLine,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 14, color: AppColors.slate500)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text("${money(order.total)} so'm",
                  style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.brand)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: updating ? '…' : (isDelivering ? 'Yetkazdim ✓' : 'Yetkazaman 🛵'),
                  color: isDelivering ? AppColors.emerald600 : AppColors.blue600,
                  expand: true,
                  loading: updating,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  onPressed: updating ? null : (isDelivering ? onDelivered : onDeliver),
                ),
              ),
              const SizedBox(width: 8),
              GhostButton(
                label: "Ko'rish",
                textColor: AppColors.slate600,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                onPressed: onView,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _WeeklyChart extends StatelessWidget {
  const _WeeklyChart({required this.series});
  final List<DaySeries> series;

  @override
  Widget build(BuildContext context) {
    final maxEarn = [1.0, ...series.map((d) => d.earnings.toDouble())].reduce((a, b) => a > b ? a : b);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text("SO'NGGI 7 KUN",
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.slate400, letterSpacing: 0.5)),
          const SizedBox(height: 12),
          SizedBox(
            height: 112,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: series.map((d) {
                final frac = (d.earnings / maxEarn).clamp(0.0, 1.0);
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 3),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        SizedBox(
                          height: 80,
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              TweenAnimationBuilder<double>(
                                tween: Tween(begin: 0, end: frac),
                                duration: const Duration(milliseconds: 600),
                                curve: Curves.easeOutBack,
                                builder: (context, v, _) => Container(
                                  height: (80 * v).clamp(d.earnings > 0 ? 4.0 : 0.0, 80.0),
                                  decoration: BoxDecoration(
                                    color: AppColors.brand.withValues(alpha: 0.8),
                                    borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(formatDay(d.date),
                            style: const TextStyle(fontSize: 10, color: AppColors.slate400)),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _RecentCard extends StatelessWidget {
  const _RecentCard({required this.order, required this.onTap});
  final Order order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(children: [
                Text('№ ${order.number}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                const SizedBox(width: 8),
                StatusPill(order.status),
              ]),
              Text("${money(order.total)} so'm",
                  style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.brand, fontSize: 14)),
            ],
          ),
          const SizedBox(height: 4),
          Row(children: [
            const Icon(Icons.location_on_outlined, size: 12, color: AppColors.slate400),
            const SizedBox(width: 6),
            Expanded(
              child: Text(order.addressLine,
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: AppColors.slate500)),
            ),
          ]),
          const SizedBox(height: 4),
          Row(children: [
            const Icon(Icons.access_time, size: 11, color: AppColors.slate400),
            const SizedBox(width: 4),
            Text(formatDateTime(order.createdAt),
                style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
          ]),
        ],
      ),
    );
  }
}
