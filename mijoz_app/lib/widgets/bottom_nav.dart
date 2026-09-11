import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../core/theme.dart';

/// Zamonaviy va nafis pastki navigatsiya paneli — tanlangan tab ostida
/// siljib yuruvchi pill + bosganda ikonka "pop" animatsiyasi bilan.
class BottomNav extends StatelessWidget {
  const BottomNav({super.key, required this.index, required this.onChanged});
  final int index;
  final ValueChanged<int> onChanged;

  static const _items = [
    (Icons.home_rounded, Icons.home_outlined, 'Bosh sahifa'),
    (Icons.search_rounded, Icons.search_outlined, 'Qidiruv'),
    (Icons.receipt_long_rounded, Icons.receipt_long_outlined, 'Buyurtmalar'),
    (Icons.person_rounded, Icons.person_outline_rounded, 'Profil'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(top: BorderSide(color: Color(0xFFF1F5F9), width: 1.2)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.05),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
          child: SizedBox(
            height: 56,
            child: LayoutBuilder(
              builder: (context, constraints) {
                final itemWidth = constraints.maxWidth / _items.length;
                return Stack(
                  children: [
                    // Tanlangan tab ostida siljib yuruvchi pill
                    AnimatedPositioned(
                      duration: const Duration(milliseconds: 320),
                      curve: Curves.easeOutCubic,
                      left: itemWidth * index,
                      width: itemWidth,
                      top: 0,
                      bottom: 0,
                      child: Center(
                        child: Container(
                          width: itemWidth - 12,
                          height: 52,
                          decoration: BoxDecoration(
                            color: AppColors.brandSoft,
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                      ),
                    ),
                    Row(
                      children: List.generate(_items.length, (i) {
                        final (activeIcon, inactiveIcon, label) = _items[i];
                        return SizedBox(
                          width: itemWidth,
                          child: _NavItem(
                            active: i == index,
                            activeIcon: activeIcon,
                            inactiveIcon: inactiveIcon,
                            label: label,
                            onTap: () {
                              if (i != index) HapticFeedback.selectionClick();
                              onChanged(i);
                            },
                          ),
                        );
                      }),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatefulWidget {
  const _NavItem({
    required this.active,
    required this.activeIcon,
    required this.inactiveIcon,
    required this.label,
    required this.onTap,
  });
  final bool active;
  final IconData activeIcon;
  final IconData inactiveIcon;
  final String label;
  final VoidCallback onTap;

  @override
  State<_NavItem> createState() => _NavItemState();
}

class _NavItemState extends State<_NavItem> with SingleTickerProviderStateMixin {
  late final _pop = AnimationController(vsync: this, duration: const Duration(milliseconds: 380));

  @override
  void didUpdateWidget(covariant _NavItem old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) _pop.forward(from: 0);
  }

  @override
  void dispose() {
    _pop.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scale = Tween(begin: 1.0, end: 1.16)
        .chain(CurveTween(curve: Curves.elasticOut))
        .animate(_pop);
    return GestureDetector(
      onTap: widget.onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedBuilder(
            animation: scale,
            builder: (context, child) => Transform.scale(
              scale: widget.active ? scale.value : 1.0,
              child: child,
            ),
            child: Icon(
              widget.active ? widget.activeIcon : widget.inactiveIcon,
              size: 23,
              color: widget.active ? AppColors.brand : AppColors.slate400,
            ),
          ),
          const SizedBox(height: 3),
          AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 200),
            style: TextStyle(
              fontSize: 11,
              fontWeight: widget.active ? FontWeight.w700 : FontWeight.w500,
              color: widget.active ? AppColors.brand : AppColors.slate500,
              letterSpacing: -0.1,
            ),
            child: Text(widget.label),
          ),
        ],
      ),
    );
  }
}
