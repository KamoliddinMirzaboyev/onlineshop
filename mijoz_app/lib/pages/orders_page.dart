import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../models/order.dart';
import '../services/api.dart';
import '../widgets/common.dart';
import '../widgets/skeleton.dart';
import 'order_detail_page.dart';

const _pollInterval = Duration(seconds: 15);

/// Buyurtmalar ro'yxati sahifasi.
class OrdersPage extends StatefulWidget {
  const OrdersPage({super.key, this.isActive = true});
  final bool isActive;

  @override
  State<OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends State<OrdersPage> {
  List<Order> _orders = [];
  bool _loading = true;
  bool _error = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    if (widget.isActive) _startPolling();
  }

  @override
  void didUpdateWidget(covariant OrdersPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    // ponytail: boshqa tabda bo'lganda buyurtmalarni 15s'da so'rab turmasin.
    if (widget.isActive && !oldWidget.isActive) {
      _load(silent: true);
      _startPolling();
    } else if (!widget.isActive && oldWidget.isActive) {
      _timer?.cancel();
    }
  }

  void _startPolling() {
    _timer?.cancel();
    _timer = Timer.periodic(_pollInterval, (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final res = await api.get('/orders');
      if (!mounted) return;
      setState(() {
        _orders = Order.listFrom(res);
        _loading = false;
        _error = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          if (!silent) _error = true;
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.slate50,
      body: SafeArea(
        child: Column(
          children: [
            PageHeader(
              title: 'Buyurtmalarim',
              subtitle: _orders.isNotEmpty ? '${_orders.length} ta buyurtma' : null,
              loading: _loading,
              onRefresh: () => _load(),
            ),
            Expanded(
              child: _error
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.error_outline_rounded, size: 44, color: AppColors.red500),
                            const SizedBox(height: 12),
                            const Text('Xatolik yuz berdi', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                            const SizedBox(height: 4),
                            const Text(
                              'Buyurtmalarni yuklab bo\'lmadi. Qayta urinib ko\'ring.',
                              style: TextStyle(color: AppColors.slate500, fontSize: 13),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 16),
                            AppButton(label: 'Qayta urinish', onPressed: () => _load()),
                          ],
                        ),
                      ),
                    )
                  : _loading && _orders.isEmpty
                      ? const OrdersListSkeleton()
                      : _orders.isEmpty
                          ? AppEmptyState(
                              icon: Icons.receipt_long_rounded,
                              title: 'Buyurtmalar yo\'q',
                              subtitle: 'Siz hali birorta ham buyurtma bermagansiz. Sevimli mahsulotlaringizni xarid qiling!',
                            )
                          : RefreshIndicator(
                              color: AppColors.brand,
                              onRefresh: _load,
                              child: ListView.builder(
                                padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
                                itemCount: _orders.length,
                                itemBuilder: (context, i) => _OrderCard(order: _orders[i]),
                              ),
                            ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order});
  final Order order;

  bool get _isActive =>
      order.status != 'delivered' && order.status != 'cancelled';

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: AppCard(
        border: _isActive
            ? Border.all(color: AppColors.brand.withValues(alpha: 0.35), width: 1.4)
            : null,
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => OrderDetailPage(orderId: order.id)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Sarlavha: Raqam, Sana va Status
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.slate100,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '№ ${order.number}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                      color: AppColors.slate900,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    formatDateTime(order.createdAt),
                    style: const TextStyle(fontSize: 12, color: AppColors.slate400),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                StatusPill(order.status),
              ],
            ),
            const SizedBox(height: 14),

            // Mahsulotlar rasmlari prevyusi
            SizedBox(
              height: 48,
              child: Row(
                children: [
                  for (final it in order.items.take(4))
                    Container(
                      margin: const EdgeInsets.only(right: 8),
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: AppColors.slate50,
                        borderRadius: BorderRadius.circular(12),
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
                  if (order.items.length > 4)
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: AppColors.slate100,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        '+${order.items.length - 4}',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.slate600,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            const Divider(height: 1, color: Color(0xFFF1F5F9)),
            const SizedBox(height: 12),

            // Pastki qism: Mahsulotlar soni va Jami summa
            Row(
              children: [
                Text(
                  '${order.items.length} xil mahsulot',
                  style: const TextStyle(fontSize: 13, color: AppColors.slate500, fontWeight: FontWeight.w500),
                ),
                const Spacer(),
                Text(
                  '${money(order.total)} so\'m',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                    color: AppColors.slate900,
                    letterSpacing: -0.2,
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right_rounded, size: 20, color: AppColors.slate400),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
