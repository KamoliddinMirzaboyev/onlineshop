import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Local notifications wrapper — the Flutter counterpart to the web app's
/// `push.ts`. The web courier gets OS notifications via a service worker + web
/// push; on native we drive alerts from the in-app order poller (see
/// `NavShell`), which shows a heads-up notification with sound when a new,
/// not-yet-assigned order appears — mirroring `useNewOrderAlerts` +
/// `playOrderAlertSound()`.
///
/// True background/killed-app push would need Firebase Cloud Messaging plus a
/// backend that stores FCM tokens (the current backend only speaks Web Push /
/// VAPID). Everything here works while the app is running or resumed.
class NotificationService extends ChangeNotifier {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  static const _channelId = 'courier_orders';
  static const _channelName = 'Buyurtmalar';
  static const _channelDesc = 'Yangi buyurtma bildirishnomalari';

  bool _ready = false;
  bool _granted = false;
  int _id = 0;

  bool get granted => _granted;

  /// Called once from main() before runApp.
  Future<void> init() async {
    if (_ready) return;
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const darwin = DarwinInitializationSettings(
      // Ask on first foreground alert instead of at launch, matching the web
      // flow where permission is requested on a user gesture (login/toggle).
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    await _plugin.initialize(
      const InitializationSettings(android: android, iOS: darwin),
    );

    // Pre-create the Android channel so the first notification is a heads-up
    // one with sound (importance high).
    final androidImpl =
        _plugin.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    await androidImpl?.createNotificationChannel(
      const AndroidNotificationChannel(
        _channelId,
        _channelName,
        description: _channelDesc,
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
        showBadge: true,
      ),
    );

    // Reflect whatever permission the OS already remembers.
    _granted = await _checkEnabled();
    _ready = true;
  }

  Future<bool> _checkEnabled() async {
    final androidImpl =
        _plugin.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    if (androidImpl != null) {
      return await androidImpl.areNotificationsEnabled() ?? false;
    }
    return _granted;
  }

  /// Request OS permission (Android 13+, iOS). Returns whether it's now granted.
  Future<bool> requestPermission() async {
    if (!_ready) await init();
    final androidImpl =
        _plugin.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    if (androidImpl != null) {
      _granted = await androidImpl.requestNotificationsPermission() ??
          await _checkEnabled();
    }
    final iosImpl =
        _plugin.resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin>();
    if (iosImpl != null) {
      _granted = await iosImpl.requestPermissions(
            alert: true,
            badge: true,
            sound: true,
          ) ??
          false;
    }
    notifyListeners();
    return _granted;
  }

  /// Re-sync the cached permission flag (e.g. when the Profile screen regains
  /// focus after the user changed it in system settings).
  Future<void> refreshPermission() async {
    final now = await _checkEnabled();
    if (now != _granted) {
      _granted = now;
      notifyListeners();
    }
  }

  /// Show a heads-up "new order" notification with sound.
  Future<void> showOrderAlert({
    required String title,
    required String body,
  }) async {
    if (!_ready) await init();
    final details = NotificationDetails(
      android: AndroidNotificationDetails(
        _channelId,
        _channelName,
        channelDescription: _channelDesc,
        importance: Importance.max,
        priority: Priority.max,
        playSound: true,
        enableVibration: true,
        ticker: 'Yangi buyurtma',
        category: AndroidNotificationCategory.message,
        visibility: NotificationVisibility.public,
        fullScreenIntent: true,
        styleInformation: BigTextStyleInformation(body, contentTitle: title),
      ),
      iOS: const DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
        interruptionLevel: InterruptionLevel.timeSensitive,
      ),
    );
    await _plugin.show(_id++, title, body, details);
  }
}

final notifications = NotificationService.instance;
