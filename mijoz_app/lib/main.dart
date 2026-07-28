import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'core/theme.dart';
import 'services/api.dart';
import 'pages/auth_page.dart';
import 'pages/home_page.dart';
import 'services/store.dart';
import 'services/cart.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await api.init();
  try {
    await Firebase.initializeApp();
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
      _navKey.currentState?.pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const AuthPage()),
        (route) => false,
      );
    };
    if (api.hasToken) {
      _setupFCM();
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
        home: api.hasToken ? const HomePage() : const AuthPage(),
      ),
    );
  }
}
