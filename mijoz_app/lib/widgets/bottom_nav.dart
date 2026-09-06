import 'package:flutter/material.dart';
import '../core/theme.dart';

/// Pastki navigatsiya — Uy/Qidiruv/Buyurtmalar/Profil. Mirrors `BottomNav.tsx`.
class BottomNav extends StatelessWidget {
  const BottomNav({super.key, required this.index, required this.onChanged});
  final int index;
  final ValueChanged<int> onChanged;

  static const _items = [
    (Icons.home_rounded, 'Bosh sahifa'),
    (Icons.search_rounded, 'Qidiruv'),
    (Icons.receipt_long_rounded, 'Buyurtmalar'),
    (Icons.person_rounded, 'Profil'),
  ];

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: AppColors.slate200)),
        ),
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: List.generate(_items.length, (i) {
            final active = i == index;
            final (icon, label) = _items[i];
            return Expanded(
              child: GestureDetector(
                onTap: () => onChanged(i),
                behavior: HitTestBehavior.opaque,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: active ? AppColors.brand : Colors.transparent,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(icon, size: 22, color: active ? Colors.white : AppColors.slate400),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                        color: active ? AppColors.brand : AppColors.slate400,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}
