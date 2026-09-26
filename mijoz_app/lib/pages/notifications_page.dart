import 'package:flutter/material.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../models/notification.dart';
import '../services/api.dart';
import '../services/notification_center.dart';
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
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = true;
          _loading = false;
        });
      }
    }
  }

  void _markAllRead() {
    setState(() {
      _items = _items.map((n) => n.isRead ? n : n.copyWith(isRead: true)).toList();
    });
    notificationCenter.markAllRead();
    api.post('/notifications/read-all', {}).catchError((_) => null);
  }

  @override
  Widget build(BuildContext context) {
    final tr = context.tr;
    return Scaffold(
      backgroundColor: AppColors.slate50,
      body: SafeArea(
        child: Column(
          children: [
            PageHeader(
              title: tr.notificationsTitle,
              back: true,
              trailing: _items.any((n) => !n.isRead)
                  ? GestureDetector(
                      onTap: _markAllRead,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                        child: Text(
                          tr.notificationsMarkAllRead,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.brand,
                          ),
                        ),
                      ),
                    )
                  : null,
            ),
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
                            Text(tr.errorOccurred, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                            const SizedBox(height: 12),
                            AppButton(label: tr.retry, onPressed: _load),
                          ],
                        ),
                      ),
                    )
                  : _loading
                      ? const NotificationsSkeleton()
                      : _items.isEmpty
                          ? AppEmptyState(
                              icon: Icons.notifications_off_outlined,
                              title: tr.notificationsEmptyTitle,
                              subtitle: tr.notificationsEmptyDesc,
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
                        Row(
                          children: [
                            Text(context.lang.isRussian ? 'Посмотреть' : 'Ko\'rish', style: const TextStyle(fontSize: 12, color: AppColors.brand, fontWeight: FontWeight.w700)),
                            const Icon(Icons.chevron_right_rounded, size: 16, color: AppColors.brand),
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
