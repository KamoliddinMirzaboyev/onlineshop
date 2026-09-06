import 'package:flutter/material.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../models/notification.dart';
import '../services/api.dart';
import '../widgets/common.dart';
import 'order_detail_page.dart';

/// Bot orqali yuborilgan barcha xabarlar — buyurtma holati va e'lonlar.
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
                  ? ErrorBanner('Xatolik. Qayta urinib ko\'ring.')
                  : _loading
                      ? const Center(child: CircularProgressIndicator())
                      : _items.isEmpty
                          ? const Center(
                              child: Text('🔔  Bildirishnoma yo\'q', style: TextStyle(color: AppColors.slate400)),
                            )
                          : RefreshIndicator(
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
      padding: const EdgeInsets.only(bottom: 10),
      child: AppCard(
        onTap: item.orderId != null
            ? () => Navigator.of(context)
                .push(MaterialPageRoute(builder: (_) => OrderDetailPage(orderId: item.orderId!)))
            : null,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: (_broadcast ? AppColors.amber600 : AppColors.brand).withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Icon(
                _broadcast ? Icons.campaign_rounded : Icons.local_shipping_rounded,
                size: 18,
                color: _broadcast ? AppColors.amber600 : AppColors.brand,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(item.title,
                            style: TextStyle(
                                fontWeight: item.isRead ? FontWeight.w500 : FontWeight.w700,
                                fontSize: 13.5, color: AppColors.slate900)),
                      ),
                      if (!item.isRead)
                        Container(
                          width: 7, height: 7,
                          margin: const EdgeInsets.only(left: 6, top: 2),
                          decoration: const BoxDecoration(color: AppColors.brand, shape: BoxShape.circle),
                        ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(item.body,
                      style: const TextStyle(fontSize: 12.5, color: AppColors.slate500, height: 1.35),
                      maxLines: 3, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 6),
                  Text(formatDateTime(item.createdAt), style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
