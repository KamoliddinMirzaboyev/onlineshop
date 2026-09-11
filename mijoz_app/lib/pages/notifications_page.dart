import 'package:flutter/material.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../models/notification.dart';
import '../services/api.dart';
import '../widgets/common.dart';
import '../widgets/skeleton.dart';
import 'order_detail_page.dart';

/// Bildirishnomalar sahifasi.
class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<AppNotification> _items = [];
  bool _loading = true;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await api.get('/notifications');
      if (!mounted) return;
      setState(() {
        _items = AppNotification.listFrom(res);
        _loading = false;
      });
      if (_items.any((n) => !n.isRead)) {
        api.post('/notifications/read-all', {}).catchError((_) => null);
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = true;
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
            const PageHeader(title: 'Bildirishnomalar', back: true),
            Expanded(
              child: _error
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.error_outline_rounded, size: 40, color: AppColors.red500),
                            const SizedBox(height: 10),
                            const Text('Xatolik yuz berdi', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                            const SizedBox(height: 12),
                            AppButton(label: 'Qayta urinish', onPressed: _load),
                          ],
                        ),
                      ),
                    )
                  : _loading
                      ? const NotificationsSkeleton()
                      : _items.isEmpty
                          ? const AppEmptyState(
                              icon: Icons.notifications_off_outlined,
                              title: 'Yangi xabarlar yo\'q',
                              subtitle: 'Buyurtmangiz holati va maxsus takliflar shu yerda ko\'rsatiladi.',
                            )
                          : RefreshIndicator(
                              color: AppColors.brand,
                              onRefresh: _load,
                              child: ListView.builder(
                                padding: const EdgeInsets.all(16),
                                itemCount: _items.length,
                                itemBuilder: (context, i) => _NotificationTile(item: _items[i]),
                              ),
                            ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.item});
  final AppNotification item;

  bool get _broadcast => item.kind == 'broadcast';

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: AppCard(
        onTap: item.orderId != null
            ? () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => OrderDetailPage(orderId: item.orderId!)),
                )
            : null,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: (_broadcast ? const Color(0xFFFEF3C7) : AppColors.brandSoft),
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: Icon(
                _broadcast ? Icons.campaign_rounded : Icons.local_shipping_rounded,
                size: 22,
                color: _broadcast ? const Color(0xFFD97706) : AppColors.brand,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          item.title,
                          style: TextStyle(
                            fontWeight: item.isRead ? FontWeight.w600 : FontWeight.w800,
                            fontSize: 14,
                            color: AppColors.slate900,
                          ),
                        ),
                      ),
                      if (!item.isRead)
                        Container(
                          width: 8,
                          height: 8,
                          margin: const EdgeInsets.only(left: 6),
                          decoration: const BoxDecoration(color: AppColors.brand, shape: BoxShape.circle),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.body,
                    style: const TextStyle(fontSize: 13, color: AppColors.slate500, height: 1.35),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(formatDateTime(item.createdAt), style: const TextStyle(fontSize: 11.5, color: AppColors.slate400)),
                      if (item.orderId != null)
                        const Row(
                          children: [
                            Text('Ko\'rish', style: TextStyle(fontSize: 12, color: AppColors.brand, fontWeight: FontWeight.w700)),
                            Icon(Icons.chevron_right_rounded, size: 16, color: AppColors.brand),
                          ],
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
