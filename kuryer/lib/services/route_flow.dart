import 'package:flutter/material.dart';

import '../models/order.dart';
import '../widgets/common.dart';
import 'api.dart';

/// Marshrut UX: tartib ogohlantirish + keyingi stop navigatsiya.
class RouteFlow {
  RouteFlow._();

  /// #1 dan oldin #2+ yetkazmoqchi bo'lsa — yumshoq ogohlantirish.
  static Future<bool> confirmOutOfOrder(
    BuildContext context,
    Order target, {
    List<Order>? deliveringPool,
  }) async {
    final seq = target.routeSequence;
    if (seq == null || seq <= 1 || target.status != 'delivering') return true;

    List<Order> pool = deliveringPool ?? const [];
    if (pool.isEmpty) {
      try {
        final raw = await api.get('/courier/orders');
        pool = Order.listFrom(raw);
      } catch (_) {
        return true;
      }
    }

    final earlier = pool.where(
      (o) =>
          o.status == 'delivering' &&
          o.id != target.id &&
          (o.routeSequence ?? 999) < seq,
    );
    if (earlier.isEmpty) return true;
    final first = earlier.reduce(
      (a, b) => (a.routeSequence ?? 999) <= (b.routeSequence ?? 999) ? a : b,
    );
    if (!context.mounted) return false;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Tartibdan tashqari?'),
        content: Text(
          'Marshrut bo\'yicha avval #${first.routeSequence} '
          '(№ ${first.number}) turadi.\n\n'
          'Baribir № ${target.number} ni yetkazasizmi?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Bekor'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Ha, yetkazaman'),
          ),
        ],
      ),
    );
    return ok == true;
  }

  /// Yetkazgandan keyin keyingi #1 ga navigatsiya taklif.
  /// [hasRemaining] true bo'lsa dialog ochadi; false bo'lsa jim.
  static Future<bool> offerNextStop(BuildContext context) async {
    if (!context.mounted) return false;
    try {
      final raw = await api.get('/courier/orders');
      final nextList = Order.listFrom(raw)
          .where((o) => o.status == 'delivering')
          .toList()
        ..sort((a, b) =>
            (a.routeSequence ?? 999).compareTo(b.routeSequence ?? 999));
      if (nextList.isEmpty || !context.mounted) return false;
      final next = nextList.first;
      final go = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Keyingi stop'),
          content: Text(
            '#${next.routeSequence ?? 1} · № ${next.number}\n'
            '${next.addressLine}'
            '${next.routeLegKm != null ? '\n~${next.routeLegKm!.toStringAsFixed(1)} km' : ''}',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Keyinroq'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Navigatsiya'),
            ),
          ],
        ),
      );
      if (go == true && context.mounted) {
        showNavigationChooser(
          context,
          lat: next.lat,
          lng: next.lng,
          address: next.addressLine,
        );
      }
      return true;
    } catch (_) {
      return false;
    }
  }
}
