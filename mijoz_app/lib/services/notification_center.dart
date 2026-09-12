import 'package:flutter/foundation.dart';

import '../models/notification.dart';
import 'api.dart';

/// Bell iconidagi o'qilmagan bildirishnomalar soni — global singleton,
/// `toast`/`api` bilan bir xil pattern.
class NotificationCenter extends ChangeNotifier {
  NotificationCenter._();
  static final NotificationCenter instance = NotificationCenter._();

  int unreadCount = 0;

  /// Boot vaqtida va login'dan keyin — mavjud `/notifications` ro'yxatidan
  /// o'qilmaganlar sonini hisoblaydi (alohida unread-count endpoint kerak emas).
  Future<void> refresh() async {
    try {
      final items = AppNotification.listFrom(await api.get('/notifications'));
      unreadCount = items.where((n) => !n.isRead).length;
      notifyListeners();
    } catch (_) {
      // Tarmoq xatosi — badge eski holatida qoladi, alohida xabar shart emas
      // (so'rovning o'zi allaqachon tarmoq toast'ini ko'rsatadi).
    }
  }

  void increment() {
    unreadCount++;
    notifyListeners();
  }

  void markAllRead() {
    if (unreadCount == 0) return;
    unreadCount = 0;
    notifyListeners();
  }
}

final notificationCenter = NotificationCenter.instance;
