import 'dart:async';
import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Lightweight stale-while-revalidate cache, mirroring `src/lib/cache.ts`.
///
/// - Memory layer: instant, survives in-session navigation.
/// - SharedPreferences layer: survives cold starts so a returning courier sees
///   data immediately (no skeleton) while a fresh copy loads in background.
///
/// A page shows the skeleton ONLY on a true cold load (no cached value at all).
/// On error we keep the last good value and surface the error separately.
class _CacheStore {
  _CacheStore._();
  static final _CacheStore instance = _CacheStore._();

  static const _prefix = 'af_cache_';
  final Map<String, dynamic> _memory = {};
  SharedPreferences? _prefs;

  void attach(SharedPreferences prefs) => _prefs = prefs;

  dynamic read(String key) {
    if (_memory.containsKey(key)) return _memory[key];
    final raw = _prefs?.getString(_prefix + key);
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw);
      _memory[key] = decoded;
      return decoded;
    } catch (_) {
      return null;
    }
  }

  void write(String key, dynamic data) {
    _memory[key] = data;
    try {
      _prefs?.setString(_prefix + key, jsonEncode(data));
    } catch (_) {/* storage full — memory cache still works */}
  }

  void clear() {
    _memory.clear();
    final prefs = _prefs;
    if (prefs == null) return;
    for (final k in prefs.getKeys()) {
      if (k.startsWith(_prefix)) prefs.remove(k);
    }
  }
}

/// Drop everything (called on logout so the next courier starts clean).
void clearCache() => _CacheStore.instance.clear();

void attachCachePrefs(SharedPreferences prefs) =>
    _CacheStore.instance.attach(prefs);

/// A reusable resource controller. Fetches raw JSON, caches it, and parses it
/// into a typed value on read. Handles cold load / background refresh / polling
/// / lifecycle-resume revalidation exactly like the web `useResource` hook.
class Resource<T> extends ChangeNotifier with WidgetsBindingObserver {
  Resource({
    required this.cacheKey,
    required this.fetchRaw,
    required this.parse,
    this.pollMs,
    this.backgroundPollMs,
    this.errorText = "Yuklab bo'lmadi. Internetni tekshiring.",
  }) {
    final cached = _CacheStore.instance.read(cacheKey);
    if (cached != null) {
      try {
        _data = parse(cached);
        _loading = false;
      } catch (_) {
        _loading = true;
      }
    } else {
      _loading = true;
    }
    WidgetsBinding.instance.addObserver(this);
    _load(silent: false);
    _startPolling();
  }

  final String cacheKey;
  final Future<dynamic> Function() fetchRaw;
  final T Function(dynamic json) parse;
  final int? pollMs;

  /// Ilova fonda ekan poll oralig'i. `null` — fonda umuman so'ralmaydi
  /// (aksariyat ekranlar uchun shu to'g'ri). Faqat yangi buyurtma signali
  /// FCM'siz ham kelishi kerak bo'lgan joyda sekin interval beriladi.
  final int? backgroundPollMs;
  final String errorText;

  T? _data;
  bool _loading = true;
  bool _refreshing = false;
  String? _error;
  int _reqId = 0;
  Timer? _timer;
  bool _disposed = false;

  T? get data => _data;
  bool get loading => _loading;
  bool get refreshing => _refreshing;
  String? get error => _error;

  Future<void> _load({required bool silent}) async {
    final myId = ++_reqId;
    final hadData = _data != null;
    if (silent || hadData) {
      _refreshing = true;
    } else {
      _loading = true;
    }
    _safeNotify();
    try {
      final raw = await fetchRaw();
      if (myId != _reqId || _disposed) return;
      _CacheStore.instance.write(cacheKey, raw);
      _data = parse(raw);
      _error = null;
    } catch (_) {
      if (myId != _reqId || _disposed) return;
      _error = errorText; // keep stale data; surface error separately
    } finally {
      if (myId == _reqId && !_disposed) {
        _loading = false;
        _refreshing = false;
        _safeNotify();
      }
    }
  }

  /// Manual reload (pull-to-refresh / header button).
  void refresh() => _load(silent: true);

  void _startPolling({bool background = false}) {
    _timer?.cancel();
    _timer = null;
    if (_disposed) return;
    final ms = background ? backgroundPollMs : pollMs;
    if (ms == null) return;
    _timer = Timer.periodic(Duration(milliseconds: ms), (_) {
      _load(silent: true);
    });
  }

  /// Fonda poll to'xtaydi yoki (`backgroundPollMs` berilgan bo'lsa) sekinlashadi
  /// — avval telefon cho'ntakda yotganda ham har pollMs'da so'rov ketardi
  /// (batareya, trafik, server yuki). Qaytganda darhol bitta yangilash bo'ladi.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _load(silent: true);
      _startPolling();
    } else {
      _startPolling(background: true);
    }
  }

  void _safeNotify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
