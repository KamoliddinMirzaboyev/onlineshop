import 'package:flutter/material.dart';

import '../core/format.dart';
import '../core/theme.dart';
import '../models/order.dart';
import '../services/api.dart';
import '../services/cache.dart';
import '../widgets/common.dart';
import '../widgets/skeleton.dart';
import 'order_detail_page.dart';

/// Mirrors `pages/HistoryPage.tsx`.
class HistoryPage extends StatefulWidget {
  const HistoryPage({super.key});

  @override
  State<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<HistoryPage> {
  static const _filters = [
    ('all', 'Hammasi'),
    ('delivered', 'Yetkazilgan'),
    ('cancelled', 'Bekor'),
  ];

  // null = barcha kunlar, 0 = bugun, 1 = kecha, 2 = kechadan oldingi kun.
  static const _days = <int?>[null, 0, 1, 2];

  String _filter = 'all';
  int? _day;
  final Map<String, Resource<List<Order>>> _cache = {};

  // Toshkent (UTC+5, DST yo'q) sanasidagi tanlangan kun.
  static DateTime _tashkentDay(int back) {
    final now = DateTime.now().toUtc().add(const Duration(hours: 5));
    return DateTime(now.year, now.month, now.day).subtract(Duration(days: back));
  }

  static bool _isSameDay(String createdAtIso, int back) {
    final parsed = DateTime.tryParse(createdAtIso);
    if (parsed == null) return false;
    final c = parsed.toUtc().add(const Duration(hours: 5));
    final t = _tashkentDay(back);
    return c.year == t.year && c.month == t.month && c.day == t.day;
  }

  static String _dayLabel(int back) {
    final d = _tashkentDay(back);
    final dd = d.day.toString().padLeft(2, '0');
    final mm = d.month.toString().padLeft(2, '0');
    final name = back == 0
        ? 'Bugun'
        : back == 1
            ? 'Kecha'
            : 'Kechadan oldin';
    return '$name · $dd.$mm';
  }

  Resource<List<Order>> _res() {
    final key = '${_filter}_$_day';
    return _cache.putIfAbsent(
      key,
      () => Resource<List<Order>>(
        cacheKey: 'courier_history_$key',
        fetchRaw: () {
          final qs = <String>[
            if (_filter != 'all') 'status=$_filter',
            if (_day != null) 'day=$_day',
          ];
          return api.get(
              '/courier/history${qs.isEmpty ? '' : '?${qs.join('&')}'}');
        },
        parse: Order.listFrom,
        errorText: "Tarixni yuklab bo'lmadi. Internetni tekshiring.",
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _res();
  }

  @override
  void dispose() {
    for (final r in _cache.values) {
      r.dispose();
    }
    super.dispose();
  }

  void _open(int id) => Navigator.of(context)
      .push(MaterialPageRoute(builder: (_) => OrderDetailPage(orderId: id)));

  @override
  Widget build(BuildContext context) {
    final res = _res();
    return AnimatedBuilder(
      animation: res,
      builder: (context, _) {
        final all = res.data ?? [];
        final orders = _day == null
            ? all
            : all.where((o) => _isSameDay(o.createdAt, _day!)).toList();
        return Column(
          children: [
            PageHeader(
              title: 'Tarix',
              loading: res.loading || res.refreshing,
              onRefresh: res.refresh,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  for (final f in _filters) ...[
                    _FilterChip(
                      label: f.$2,
                      active: _filter == f.$1,
                      onTap: () => setState(() => _filter = f.$1),
                    ),
                    const SizedBox(width: 8),
                  ],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (final d in _days) ...[
                      _FilterChip(
                        label: d == null ? 'Barcha kunlar' : _dayLabel(d),
                        active: _day == d,
                        onTap: () => setState(() => _day = d),
                      ),
                      const SizedBox(width: 8),
                    ],
                  ],
                ),
              ),
            ),
            Expanded(
              child: res.loading
                  ? const HistorySkeleton()
                  : RefreshIndicator(
                      color: AppColors.brand,
                      onRefresh: () async => res.refresh(),
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          if (res.error != null) ...[
                            ErrorBanner(res.error!),
                            const SizedBox(height: 12),
                          ],
                          if (orders.isEmpty)
                            const EmptyState(
                              icon: Icons.access_time,
                              message: "Tarix bo'sh",
                            ),
                          ...orders.map((o) => Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: _HistoryCard(order: o, onTap: () => _open(o.id)),
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

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.active, required this.onTap});
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Pressable(
      borderRadius: 999,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active ? AppColors.brand : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: active ? null : Border.all(color: AppColors.slate200),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: active ? Colors.white : AppColors.slate500,
          ),
        ),
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.order, required this.onTap});
  final Order order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
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
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    StatusPill(order.status),
                  ],
                ),
              ),
              Text("${money(order.total)} so'm",
                  style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.brand)),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.location_on_outlined, size: 14, color: AppColors.slate400),
              const SizedBox(width: 6),
              Expanded(
                child: Text(order.addressLine,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 14, color: AppColors.slate500)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(formatDateTime(order.createdAt),
              style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
        ],
      ),
    );
  }
}
