import 'dart:async';

import 'package:flutter/material.dart';

import '../core/theme.dart';

enum ToastType { success, error, info, push }

class _ToastData {
  _ToastData(this.id, this.type, this.body, this.title);
  final int id;
  final ToastType type;
  final String body;
  final String? title;
}

/// Global toast controller — mirrors the web `ToastProvider`. Stacks up to 4
/// toasts at the top of the screen, each auto-dismissing after 4s.
class ToastController extends ChangeNotifier {
  ToastController._();
  static final ToastController instance = ToastController._();

  final List<_ToastData> _toasts = [];
  // ignore: library_private_types_in_public_api
  List<_ToastData> get toasts => List.unmodifiable(_toasts);
  int _id = 0;

  void _show(String body, ToastType type, {String? title, int duration = 4000}) {
    final id = ++_id;
    _toasts.add(_ToastData(id, type, body, title));
    if (_toasts.length > 4) _toasts.removeAt(0);
    notifyListeners();
    if (duration > 0) {
      Timer(Duration(milliseconds: duration), () => dismiss(id));
    }
  }

  void success(String body, {String? title}) => _show(body, ToastType.success, title: title);
  void error(String body, {String? title}) => _show(body, ToastType.error, title: title);
  void info(String body, {String? title}) => _show(body, ToastType.info, title: title);
  void push(String body, {String? title, int duration = 8000}) =>
      _show(body, ToastType.push, title: title, duration: duration);

  void dismiss(int id) {
    _toasts.removeWhere((t) => t.id == id);
    notifyListeners();
  }
}

final toast = ToastController.instance;

/// Overlay host — placed once above the app root. Renders the toast stack.
class ToastHost extends StatelessWidget {
  const ToastHost({super.key});

  static const _icons = {
    ToastType.success: Icons.check_circle_outline,
    ToastType.error: Icons.warning_amber_rounded,
    ToastType.info: Icons.info_outline,
    ToastType.push: Icons.notifications_none,
  };

  static const _badge = {
    ToastType.success: (Color(0xFFECFDF5), AppColors.emerald600),
    ToastType.error: (Color(0xFFFFF1F2), AppColors.rose500),
    ToastType.info: (Color(0xFFEFF6FF), AppColors.blue600),
    ToastType.push: (Color(0x1A16A34A), AppColors.brand),
  };

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.of(context).padding.top;
    return Positioned(
      top: topInset > 12 ? topInset : 12,
      left: 12,
      right: 12,
      child: SafeArea(
        bottom: false,
        child: AnimatedBuilder(
          animation: toast,
          builder: (context, _) {
            return Column(
              children: toast.toasts.map((t) {
                final (bg, fg) = _badge[t.type]!;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 448),
                      child: _ToastCard(
                        key: ValueKey(t.id),
                        onDismiss: () => toast.dismiss(t.id),
                        icon: _icons[t.type]!,
                        badgeBg: bg,
                        badgeFg: fg,
                        title: t.title,
                        body: t.body,
                      ),
                    ),
                  ),
                );
              }).toList(),
            );
          },
        ),
      ),
    );
  }
}

class _ToastCard extends StatefulWidget {
  const _ToastCard({
    super.key,
    required this.onDismiss,
    required this.icon,
    required this.badgeBg,
    required this.badgeFg,
    required this.body,
    this.title,
  });

  final VoidCallback onDismiss;
  final IconData icon;
  final Color badgeBg;
  final Color badgeFg;
  final String body;
  final String? title;

  @override
  State<_ToastCard> createState() => _ToastCardState();
}

class _ToastCardState extends State<_ToastCard> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 260),
  )..forward();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final anim = CurvedAnimation(parent: _c, curve: Curves.easeOutBack);
    return FadeTransition(
      opacity: _c,
      child: SlideTransition(
        position: Tween<Offset>(begin: const Offset(0, -0.4), end: Offset.zero).animate(anim),
        child: Material(
          color: Colors.transparent,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [
                BoxShadow(color: Color(0x1A0F172A), blurRadius: 18, offset: Offset(0, 6)),
              ],
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(color: widget.badgeBg, shape: BoxShape.circle),
                  child: Icon(widget.icon, size: 17, color: widget.badgeFg),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (widget.title != null)
                        Text(
                          widget.title!,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.slate900,
                          ),
                        ),
                      Text(
                        widget.body,
                        style: const TextStyle(fontSize: 14, color: AppColors.slate500),
                      ),
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: widget.onDismiss,
                  child: const Padding(
                    padding: EdgeInsets.only(left: 8, top: 2),
                    child: Icon(Icons.close, size: 15, color: AppColors.slate300),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
