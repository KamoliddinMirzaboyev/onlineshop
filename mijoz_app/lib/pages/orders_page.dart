import 'dart:async';
import 'package:flutter/material.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../models/order.dart';
import '../services/api.dart';
import '../widgets/common.dart';
import 'order_detail_page.dart';

const _pollInterval = Duration(seconds: 15);

/// Buyurtmalar ro'yxati. Mirrors `OrdersPage.tsx`.
class OrdersPage extends StatefulWidget {
  const OrdersPage({super.key});

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
            const PageHeader(title: 'Barakali Bozor'),
            Expanded(
              child: _error
                  ? ErrorBanner('Xatolik. Qayta urinib ko\'ring.')
                  : _loading
                      ? const Center(child: CircularProgressIndicator())
                      : _orders.isEmpty
                          ? const Center(
                              child: Text('🧾  Buyurtmalar yo\'q', style: TextStyle(color: AppColors.slate400)),
                            )
                          : RefreshIndicator(
                              onRefresh: _load,
                              child: ListView.builder(
                                padding: const EdgeInsets.all(16),
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

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: AppCard(
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => OrderDetailPage(orderId: order.id))),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('№ ${order.number}', style: const TextStyle(fontWeight: FontWeight.w600)),
                StatusPill(order.status),
              ],
            ),
            const SizedBox(height: 2),
            Text(formatDateTime(order.createdAt), style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
            const SizedBox(height: 10),
            SizedBox(
              height: 40,
              child: Row(
                children: [
                  for (final it in order.items.take(5))
                    Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: it.imageUrl != null
                            ? Image.network(
                                it.imageUrl!, width: 40, height: 40, fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(
                                  width: 40, height: 40, color: AppColors.slate100,
                                  alignment: Alignment.center,
                                  child: const Text('🍽', style: TextStyle(fontSize: 16)),
                                ),
                              )
                            : Container(
                                width: 40, height: 40, color: AppColors.slate100,
                                alignment: Alignment.center,
                                child: const Text('🍽', style: TextStyle(fontSize: 16)),
                              ),
                      ),
                    ),
                  if (order.items.length > 5)
                    Text('+${order.items.length - 5}', style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
                ],
              ),
            ),
            const Divider(height: 20, color: AppColors.slate100),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('${order.items.length} mahsulot', style: const TextStyle(fontSize: 13, color: AppColors.slate400)),
                Text('${money(order.total)} so\'m', style: const TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
