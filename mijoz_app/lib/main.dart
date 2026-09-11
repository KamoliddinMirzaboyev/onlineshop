import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'core/theme.dart';
import 'services/api.dart';
import 'pages/app_shell.dart';
import 'pages/auth_page.dart';
import 'pages/notifications_page.dart';
import 'pages/order_detail_page.dart';
import 'services/store.dart';
import 'services/cart.dart';
import 'services/push.dart';
import 'widgets/splash.dart';
import 'widgets/toast.dart';

/// App yopiq/fonda bo'lganda kelgan push — tizim bildirishnomani o'zi
/// ko'rsatadi, bu yerda hozircha qo'shimcha ish yo'q (Firebase buni background
/// isolate'da chaqirish uchun top-level funksiya talab qiladi).
@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {}

/// Push bosilganda (fonda yoki yopiq holatdan ochilganda) tegishli sahifaga
/// o'tish — `fcm.py`dagi `url: "/orders/<id>"` payloadini o'qiydi.
void _handleMessageTap(GlobalKey<NavigatorState> navKey, RemoteMessage message) {
  final nav = navKey.currentState;
  if (nav == null) return;
  final url = message.data['url'] as String?;
  final match = url != null ? RegExp(r'^/orders/(\d+)').firstMatch(url) : null;
  if (match != null) {
    final orderId = int.parse(match.group(1)!);
    nav.push(MaterialPageRoute(builder: (_) => OrderDetailPage(orderId: orderId)));
  } else {
    nav.push(MaterialPageRoute(builder: (_) => const NotificationsPage()));
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Xotira va keshni tejash: mahsulotlar rasmlari xotiradan oshib ketmasligi uchun chegara
  PaintingBinding.instance.imageCache.maximumSize = 120;
  PaintingBinding.instance.imageCache.maximumSizeBytes = 60 * 1024 * 1024; // 60MB
  await api.init();
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);
  } catch (e) {
    debugPrint('Firebase init failed: $e');
  }
  runApp(const MijozApp());
}

class MijozApp extends StatefulWidget {
  const MijozApp({super.key});

  @override
  State<MijozApp> createState() => _MijozAppState();
}

class _MijozAppState extends State<MijozApp> {
  final _navKey = GlobalKey<NavigatorState>();

  @override
  void initState() {
    super.initState();
    api.onUnauthorized = () {
      // Token muddati tugaganda / bekor bo'lganda kirish sahifasiga yo'naltirish.
      // Savatcha o'chirilmaydi — foydalanuvchi qayta kirganda buyumlari saqlanib qoladi.
      _navKey.currentState?.pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const AuthPage()),
        (route) => false,
      );
    };
    _setupPushHandlers();
    if (api.hasToken) {
      _setupFCM();
    }
  }

  /// Foreground push (ilova ochiq ekan kelsa — tizim buni o'zi ko'rsatmaydi,
  /// shuning uchun mavjud toast orqali) + bosilganda navigatsiya.
  void _setupPushHandlers() {
    try {
      FirebaseMessaging.onMessage.listen((message) {
        final n = message.notification;
        if (n == null) return;
        toast.push(n.body ?? '', title: n.title);
      });
      FirebaseMessaging.onMessageOpenedApp.listen((m) => _handleMessageTap(_navKey, m));
      FirebaseMessaging.instance.getInitialMessage().then((m) {
        if (m != null) _handleMessageTap(_navKey, m);
      });
    } catch (e) {
      debugPrint('FCM handlers not set up: $e');
    }
  }

  Future<void> _setupFCM() async {
    await registerFcmToken(askPermission: true);
    listenFcmTokenRefresh();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => StoreProvider()),
        // Katalog har yangilanganda savat u bilan solishtiriladi: eski narx,
        // tugagan yoki sotuvdan olingan mahsulot checkout'gacha emas, darhol
        // to'g'rilanadi va mijozga aytiladi.
        ChangeNotifierProxyProvider<StoreProvider, CartProvider>(
          create: (_) => CartProvider(),
          update: (_, store, cart) {
            final c = cart ?? CartProvider();
            // build ichida notifyListeners chaqirmaslik uchun — frame'dan keyin.
            WidgetsBinding.instance.addPostFrameCallback((_) {
              for (final msg in c.syncWithCatalog(store.productsById)) {
                toast.push(msg, title: 'Savat yangilandi');
              }
            });
            return c;
          },
        ),
      ],
      child: MaterialApp(
        title: 'Barakali Bozor',
        navigatorKey: _navKey,
        theme: AppTheme.light,
        debugShowCheckedModeBanner: false,
        // ToastHost hech qayerda mount qilinmagan edi — toast.error/success
        // chaqiruvlari (auth, profil va h.k.) butunlay jim qolardi.
        builder: (context, child) => Stack(
          children: [
            if (child != null) child,
            const ToastHost(),
          ],
        ),
        home: const _BootGate(),
      ),
    );
  }
}

/// Brand splash bir zum ko'rinadi, so'ng token borligiga qarab Home/Auth'ga
/// o'tadi (mirrors TMA: Splash unmounts once auth/store resolve).
class _BootGate extends StatefulWidget {
  const _BootGate();

  @override
  State<_BootGate> createState() => _BootGateState();
}

class _BootGateState extends State<_BootGate> {
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    // Splash animatsiyasi to'liq, chiroyli ko'rinishi uchun 2100ms
    Future.delayed(const Duration(milliseconds: 2100), () {
      if (mounted) setState(() => _ready = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 500),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      transitionBuilder: (child, animation) {
        return FadeTransition(
          opacity: animation,
          child: child,
        );
      },
      child: _ready
          ? (api.hasToken
              ? const AppShell(key: ValueKey('shell_screen'))
              : const AuthPage(key: ValueKey('auth_screen')))
          : const SplashScreen(key: ValueKey('splash_screen')),
    );
  }
}
