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
  // ponytail: faqat bir marta ochilgan tab qurilib, IndexedStack'da saqlanadi —
  // ilova ochilishida barcha 4 tab (va ularning timer/tarmoq so'rovlari) darhol
  // ishga tushmaydi.
  final Set<int> _visited = {0};

  @override
  Widget build(BuildContext context) {
    _visited.add(_index);
    final tabs = [
      HomePage(isActive: _index == 0),
      const SearchPage(),
      OrdersPage(isActive: _index == 2),
      const ProfilePage(),
    ];
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          for (var i = 0; i < tabs.length; i++)
            _visited.contains(i) ? tabs[i] : const SizedBox.shrink(),
        ],
      ),
      bottomNavigationBar: BottomNav(index: _index, onChanged: (i) => setState(() => _index = i)),
    );
  }
}
