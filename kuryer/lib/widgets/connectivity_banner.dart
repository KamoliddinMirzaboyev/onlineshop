import 'dart:async';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';

import '../core/theme.dart';

/// Internet aloqasi uzilganda ekran tepasida ingichka ogohlantirish paydo
/// bo'ladi, qayta ulanganda avtomatik yo'qoladi.
///
/// `connectivity_plus` faqat tarmoq interfeysini ko'radi va Wi-Fi ↔ mobil
/// almashganda, VPN/Private DNS'da, fondan qaytganda yolg'on `none` beradi.
/// Shuning uchun `none` kelsa banner darhol chiqmaydi: qisqa kutib, serverga
/// haqiqiy TCP ulanish bilan tekshiriladi — faqat u ham yiqilsa ko'rsatiladi.
class ConnectivityBanner extends StatefulWidget {
  const ConnectivityBanner({super.key});

  @override
  State<ConnectivityBanner> createState() => _ConnectivityBannerState();
}

class _ConnectivityBannerState extends State<ConnectivityBanner> with WidgetsBindingObserver {
  static const _host = 'api.barakali-bozor.uz';
  static const _settle = Duration(seconds: 2);
  static const _recheck = Duration(seconds: 5);

  StreamSubscription<List<ConnectivityResult>>? _sub;
  Timer? _timer;
  bool _offline = false;
  int _gen = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _sub = Connectivity().onConnectivityChanged.listen(_apply);
    Connectivity().checkConnectivity().then(_apply);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _sub?.cancel();
    _timer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) Connectivity().checkConnectivity().then(_apply);
  }

  void _apply(List<ConnectivityResult> results) {
    _timer?.cancel();
    _gen++;
    if (results.any((r) => r != ConnectivityResult.none)) {
      _set(false);
    } else {
      _timer = Timer(_settle, _verify);
    }
  }

  Future<void> _verify() async {
    final gen = _gen;
    final reachable = await _reachable();
    if (!mounted || gen != _gen) return;
    _set(!reachable);
    // Ulanish tiklanganda plugin hodisa bermasligi mumkin — davriy qayta tekshiramiz.
    if (!reachable) _timer = Timer(_recheck, _verify);
  }

  Future<bool> _reachable() async {
    try {
      final s = await Socket.connect(_host, 443, timeout: const Duration(seconds: 4));
      s.destroy();
      return true;
    } on Object {
      return false;
    }
  }

  void _set(bool offline) {
    if (mounted && offline != _offline) setState(() => _offline = offline);
  }

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: SafeArea(
        bottom: false,
        child: AnimatedSlide(
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOutCubic,
          offset: _offline ? Offset.zero : const Offset(0, -1.2),
          child: Material(
            color: AppColors.red600,
            child: SizedBox(
              width: double.infinity,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Icon(Icons.wifi_off_rounded, size: 16, color: Colors.white),
                    SizedBox(width: 8),
                    Text(
                      'Internet aloqasi yo\'q',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
