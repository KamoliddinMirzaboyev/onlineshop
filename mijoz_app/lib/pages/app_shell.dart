import 'package:flutter/material.dart';
import '../widgets/bottom_nav.dart';
import 'home_page.dart';
import 'orders_page.dart';
import 'profile_page.dart';
import 'search_page.dart';

/// Auth'dan keyingi ildiz — 4 ta tab (Home/Search/Orders/Profile) + pastki
/// navigatsiya. Mirrors TMA `App.tsx` + `BottomNav.tsx`.
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  static const _tabs = [HomePage(), SearchPage(), OrdersPage(), ProfilePage()];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _tabs),
      bottomNavigationBar: BottomNav(index: _index, onChanged: (i) => setState(() => _index = i)),
    );
  }
}
