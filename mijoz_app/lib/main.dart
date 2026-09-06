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
      // Token bekor qilindi (401) — keyingi kim kirsa ham avvalgi
      // foydalanuvchining savatchasi ko'rmasin.
      context.read<CartProvider>().clear();
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
    try {
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      final token = await messaging.getToken();
      if (token != null) {
        await api.post('/auth/fcm-token', {'fcm_token': token});
      }
    } catch (e) {
      debugPrint('FCM Error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => StoreProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
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
    Future.delayed(const Duration(milliseconds: 1100), () {
      if (mounted) setState(() => _ready = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_ready) return const SplashScreen();
    return api.hasToken ? const AppShell() : const AuthPage();
  }
}
