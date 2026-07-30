import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/theme.dart';
import 'pages/login_page.dart';
import 'services/api.dart';
import 'services/cache.dart';
import 'services/location.dart';
import 'services/notifications.dart';
import 'state/auth.dart';
import 'state/order_alerts.dart';
import 'widgets/nav_shell.dart';
import 'widgets/splash.dart';
import 'widgets/toast.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  attachCachePrefs(prefs);
  await api.init();
  await notifications.init();
  runApp(const BarakaliCourierApp());
}

class BarakaliCourierApp extends StatefulWidget {
  const BarakaliCourierApp({super.key});

  @override
  State<BarakaliCourierApp> createState() => _BarakaliCourierAppState();
}

class _BarakaliCourierAppState extends State<BarakaliCourierApp> {
  // Boot splash: shown once on cold start with a minimum on-screen time so the
  // brand animation reads even on a fast connection (mirrors App.tsx).
  bool _booting = true;

  @override
  void initState() {
    super.initState();
    Timer(const Duration(milliseconds: 1700), () {
      if (mounted) setState(() => _booting = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthState()),
        ChangeNotifierProvider(create: (_) => OrderAlerts()),
      ],
      child: MaterialApp(
        title: 'BB Kuryer',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        home: const AuthGate(),
        builder: (context, child) {
          // Overlays hosted above every route: toast stack + boot splash.
          return Stack(
            children: [
              child ?? const SizedBox.shrink(),
              const ToastHost(),
              Positioned.fill(
                child: IgnorePointer(
                  ignoring: !_booting,
                  child: AnimatedOpacity(
                    opacity: _booting ? 1 : 0,
                    duration: const Duration(milliseconds: 450),
                    curve: Curves.easeInOut,
                    child: _booting ? const SplashScreen() : const SizedBox.shrink(),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Session gate — mirrors App.tsx `Protected`. No token → login. Token present →
/// verify with /me; a transient network failure keeps the session and offers a
/// retry (a 401 is handled in api.dart, which clears the token and, via
/// AuthState.onUnauthorized, bounces here to login).
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool _checked = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _verify();
  }

  Future<void> _verify() async {
    if (!api.hasToken) {
      setState(() {
        _checked = true;
        _failed = false;
      });
      return;
    }
    setState(() => _failed = false);
    try {
      await context.read<AuthState>().loadMe();
      if (mounted) setState(() => _failed = false);
    } catch (_) {
      // 401 already handled (token cleared). A network blip must NOT log out —
      // keep the token and offer a retry.
      if (mounted && api.hasToken) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _checked = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Rebuild on auth changes (login sets identity; logout/401 clears it).
    final auth = context.watch<AuthState>();

    if (!api.hasToken) return const LoginPage();

    // Logged in via the login form (identity set) — go straight to the shell.
    if (auth.username != null) {
      _ensureRuntimeServices();
      return const NavShell();
    }

    if (!_checked) {
      return const Scaffold(
        backgroundColor: AppColors.slate50,
        body: Center(
          child: Text('Yuklanmoqda…', style: TextStyle(color: AppColors.slate400)),
        ),
      );
    }

    if (_failed) {
      return Scaffold(
        backgroundColor: AppColors.slate50,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Ulanishda xatolik. Internetni tekshiring.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.slate400)),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () {
                    setState(() => _checked = false);
                    _verify();
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.slate600,
                    side: const BorderSide(color: AppColors.slate200),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Qayta urinish'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (api.hasToken) {
      _ensureRuntimeServices();
      return const NavShell();
    }
    return const LoginPage();
  }

  bool _servicesStarted = false;

  /// Login/sessiya tiklangach: bildirishnoma ruxsati + GPS tracking.
  void _ensureRuntimeServices() {
    if (_servicesStarted) return;
    _servicesStarted = true;
    // Best-effort — ruxsat rad etilsa ham app ishlaydi.
    unawaited(notifications.requestPermission());
    unawaited(locationService.start());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Logout bo'lganda keyingi login uchun qayta start.
    if (!api.hasToken) _servicesStarted = false;
  }
}
