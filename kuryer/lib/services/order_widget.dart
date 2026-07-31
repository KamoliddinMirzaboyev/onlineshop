import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:home_widget/home_widget.dart';

import '../core/format.dart';
import '../models/order.dart';

/// Android Home Widget — faol buyurtmalar.
///
/// Ma’lumot SharedPreferences orqali native layoutga yoziladi
/// (`OrdersWidgetProvider`).
class OrderWidgetSync {
  OrderWidgetSync._();
  static final OrderWidgetSync instance = OrderWidgetSync._();

  static const androidName = 'OrdersWidgetProvider';
  static const _appGroup = 'group.uz.barakalibozor.kuryer';

  bool _ready = false;

  Future<void> init() async {
    if (_ready || kIsWeb || !Platform.isAndroid) return;
    try {
      await HomeWidget.setAppGroupId(_appGroup);
      _ready = true;
    } catch (e) {
      debugPrint('OrderWidget init: $e');
    }
  }

  /// Faol (accepted / delivering) buyurtmalarni widgetga yozadi.
  Future<void> updateFromOrders(List<Order> all) async {
    if (kIsWeb || !Platform.isAndroid) return;
    await init();

    final active = all
        .where((o) => o.status == 'accepted' || o.status == 'delivering')
        .toList()
      ..sort((a, b) {
        // Yetkazilayotganlar birinchi
        if (a.status != b.status) {
          if (a.status == 'delivering') return -1;
          if (b.status == 'delivering') return 1;
        }
        return (DateTime.tryParse(a.createdAt) ?? DateTime(0))
            .compareTo(DateTime.tryParse(b.createdAt) ?? DateTime(0));
      });

    final count = active.length;
    String line1 = '';
    String line2 = '';
    String line3 = '';
    if (count > 0) line1 = _formatLine(active[0]);
    if (count > 1) line2 = _formatLine(active[1]);
    if (count > 2) line3 = _formatLine(active[2]);

    final subtitle = count == 0
        ? 'Faol buyurtma yo‘q'
        : count == 1
            ? '1 ta faol buyurtma'
            : '$count ta faol buyurtma';

    try {
      await HomeWidget.saveWidgetData<String>('title', 'BB Kuryer');
      await HomeWidget.saveWidgetData<String>('subtitle', subtitle);
      await HomeWidget.saveWidgetData<int>('count', count);
      await HomeWidget.saveWidgetData<String>('line1', line1);
      await HomeWidget.saveWidgetData<String>('line2', line2);
      await HomeWidget.saveWidgetData<String>('line3', line3);
      await HomeWidget.saveWidgetData<String>(
        'updated',
        _clock(DateTime.now()),
      );
      await HomeWidget.updateWidget(androidName: androidName);
    } catch (e) {
      debugPrint('OrderWidget update: $e');
    }
  }

  Future<void> clear() async {
    if (kIsWeb || !Platform.isAndroid) return;
    await init();
    try {
      await HomeWidget.saveWidgetData<String>('title', 'BB Kuryer');
      await HomeWidget.saveWidgetData<String>('subtitle', 'Tizimga kiring');
      await HomeWidget.saveWidgetData<int>('count', 0);
      await HomeWidget.saveWidgetData<String>('line1', '');
      await HomeWidget.saveWidgetData<String>('line2', '');
      await HomeWidget.saveWidgetData<String>('line3', '');
      await HomeWidget.saveWidgetData<String>('updated', '');
      await HomeWidget.updateWidget(androidName: androidName);
    } catch (e) {
      debugPrint('OrderWidget clear: $e');
    }
  }

  String _formatLine(Order o) {
    final st = statusLabel(o.status);
    final addr = o.addressLine.trim();
    final short = addr.length > 36 ? '${addr.substring(0, 34)}…' : addr;
    return '№${o.number} · $st${short.isEmpty ? '' : '\n$short'}';
  }

  String _clock(DateTime d) {
    final h = d.hour.toString().padLeft(2, '0');
    final m = d.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
}

final orderWidget = OrderWidgetSync.instance;
