import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../models/order.dart';
import '../services/api.dart';
import '../services/cache.dart';
import '../services/notifications.dart';
import '../state/order_alerts.dart';
import '../pages/dashboard_page.dart';
import '../pages/orders_page.dart';
import '../pages/history_page.dart';
import '../pages/profile_page.dart';
import 'toast.dart';

/// The logged-in shell: four tabs + bottom nav. Mirrors `Layout.tsx` +
/// `BottomNav.tsx`, including the app-wide new-order poller (`useNewOrderAlerts`)
/// that fires a notification + sound + toast when a new, unassigned order shows
/// up, and keeps [OrderAlerts.availableCount] in sync for the Dashboard banner.
class NavShell extends StatefulWidget {
  const NavShell({super.key});

  @override
  State<NavShell> createState() => _NavShellState();
}

const _acceptable = {'pending', 'confirmed', 'preparing', 'ready'};
bool _isAcceptable(String s) => _acceptable.contains(s);

class _NavShellState extends State<NavShell> {
  int _index = 0;
  late final Resource<List<Order>> _orders;
  Set<int>? _seenIds;
  late final OrderAlerts _alerts;

  static const _tabs = [
    (Icons.home_outlined, Icons.home, 'Asosiy'),
    (Icons.inventory_2_outlined, Icons.inventory_2, 'Buyurtma'),
    (Icons.access_time, Icons.access_time_filled, 'Tarix'),
    (Icons.person_outline, Icons.person, 'Profil'),
  ];

  @override
  void initState() {
    super.initState();
    _alerts = context.read<OrderAlerts>();
    _orders = Resource<List<Order>>(
      cacheKey: 'courier_orders',
      fetchRaw: () => api.get('/courier/orders'),
      parse: Order.listFrom,
      pollMs: 20000,
    );
    _orders.addListener(_onOrders);
    _onOrders();
  }

  void _onOrders() {
    final data = _orders.data;
    if (data == null) return;
    final available = data
        .where((o) => o.assignedCourierId == null && _isAcceptable(o.status))
        .toList();
    _alerts.setAvailableCount(available.length);

    final ids = available.map((o) => o.id).toSet();
    final prev = _seenIds;
    if (prev != null) {
      final fresh = available.where((o) => !prev.contains(o.id)).toList();
      if (fresh.isNotEmpty) _alert(fresh);
    }
    _seenIds = ids;
  }

  void _alert(List<Order> fresh) {
    final title = fresh.length == 1
        ? 'Yangi buyurtma № ${fresh.first.number}'
        : '${fresh.length} ta yangi buyurtma';
    final body = fresh.length == 1
        ? fresh.first.addressLine
        : 'Yangi buyurtmalarni ko\'rish uchun oching';
    notifications.showOrderAlert(title: title, body: body);
    toast.push(body, title: title);
  }

  @override
  void dispose() {
    _orders.removeListener(_onOrders);
    _orders.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      DashboardPage(onGoTab: (i) => setState(() => _index = i)),
      const OrdersPage(),
      const HistoryPage(),
      const ProfilePage(),
    ];

    return Scaffold(
      backgroundColor: AppColors.slate50,
      body: SafeArea(
        bottom: false,
        child: IndexedStack(index: _index, children: pages),
      ),
      bottomNavigationBar: _BottomNav(
        index: _index,
        tabs: _tabs,
        onTap: (i) => setState(() => _index = i),
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  const _BottomNav({required this.index, required this.tabs, required this.onTap});
  final int index;
  final List<(IconData, IconData, String)> tabs;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.slate200)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 58,
          child: Row(
            children: [
              for (var i = 0; i < tabs.length; i++)
                Expanded(
                  child: _NavItem(
                    icon: tabs[i].$1,
                    activeIcon: tabs[i].$2,
                    label: tabs[i].$3,
                    active: index == i,
                    onTap: () => onTap(i),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = active ? AppColors.brand : AppColors.slate400;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Stack(
        alignment: Alignment.topCenter,
        children: [
          if (active)
            Container(
              width: 32,
              height: 2,
              decoration: BoxDecoration(
                color: AppColors.brand,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedScale(
                scale: active ? 1.12 : 1,
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeOut,
                child: Icon(active ? activeIcon : icon, size: 20, color: color),
              ),
              const SizedBox(height: 2),
              Text(label,
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: color)),
            ],
          ),
        ],
      ),
    );
  }
}
