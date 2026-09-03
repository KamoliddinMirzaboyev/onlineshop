import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import '../widgets/toast.dart';
import 'api.dart';

/// Joylashuv ruxsati holati — banner shu asosda ko'rsatiladi.
enum LocState { ok, serviceOff, denied, blocked }

/// Global — NavShell banneri kuzatadi.
final locState = ValueNotifier<LocState>(LocState.ok);

/// Stream fix'lari — bundan yomon aniqlik saqlangan depot fallback'ini buzadi.
const _maxStreamAccuracyM = 200.0;
/// getOnce: bundan yomoni "soxta" (wifi/cell) deb hisoblanadi — ombor fallback xavfsizroq.
const _maxRouteAccuracyM = 500.0;

/// PWA `location.ts` ekvivalenti: app ochiq paytda GPS → POST /courier/location.
class LocationService {
  LocationService._();
  static final LocationService instance = LocationService._();

  StreamSubscription<Position>? _sub;
  bool _starting = false;
  bool _warnedNoGps = false;

  bool get isRunning => _sub != null;

  void _applyPerm(LocationPermission perm) {
    locState.value = switch (perm) {
      LocationPermission.deniedForever => LocState.blocked,
      LocationPermission.denied => LocState.denied,
      _ => LocState.ok,
    };
  }

  /// Oqim uzilib qolsa — obunani tozalaymiz, resume'da refreshState() qayta boshlaydi.
  void _dropStream() {
    _sub?.cancel();
    _sub = null;
  }

  /// Ruxsat so'rash + stream boshlash. Best-effort — rad etsa banner ko'rsatadi.
  Future<void> start() async {
    if (_sub != null || _starting) return;
    _starting = true;
    try {
      final serviceOn = await Geolocator.isLocationServiceEnabled();
      if (!serviceOn) {
        locState.value = LocState.serviceOff;
        return;
      }

      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      _applyPerm(perm);
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        return;
      }

      // Darhol bir marta yuborish.
      try {
        final pos = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 12),
          ),
        );
        await _post(pos);
      } catch (_) {
        /* GPS timeout — stream keyinroq urinib ko'radi */
      }

      _sub = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 15, // 15 m harakatdan keyin
        ),
      ).listen(
        (pos) => unawaited(_post(pos)),
        // Ruxsat o'chdi / GPS xato / OS oqimni to'xtatdi — obunani tashlaymiz.
        onError: (_) => _dropStream(),
        onDone: _dropStream,
        cancelOnError: true,
      );
    } finally {
      _starting = false;
    }
  }

  Future<void> stop() async {
    await _sub?.cancel();
    _sub = null;
  }

  /// Settings'dan qaytgach holatni yangilash — tizim dialogini ko'rsatmaydi.
  /// Oqim to'xtab qolgan bo'lsa (Android background throttle, xato) qayta boshlaydi.
  Future<void> refreshState() async {
    final serviceOn = await Geolocator.isLocationServiceEnabled();
    if (!serviceOn) {
      locState.value = LocState.serviceOff;
      return;
    }
    _applyPerm(await Geolocator.checkPermission());
    if (locState.value == LocState.ok && _sub == null) unawaited(start());
  }

  /// Banner "Ruxsat" tugmasi — tizim dialogi yoki app sozlamalari.
  Future<void> requestAgain() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      await Geolocator.openLocationSettings();
      return;
    }
    final perm = await Geolocator.requestPermission();
    _applyPerm(perm);
    if (perm == LocationPermission.deniedForever) {
      await Geolocator.openAppSettings();
    } else if (locState.value == LocState.ok && _sub == null) {
      unawaited(start());
    }
  }

  /// Marshrut uchun bir martalik GPS (tugma bosilganda — tez bo'lishi kerak).
  /// Yangi fix (12s) ni kutamiz; timeout bo'lsa oxirgi ma'lum joyга tushamiz.
  Future<({double lat, double lng})?> getOnce() async {
    try {
      final serviceOn = await Geolocator.isLocationServiceEnabled();
      if (!serviceOn) {
        locState.value = LocState.serviceOff;
        _warnOnce();
        return null;
      }
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      _applyPerm(perm);
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        return null;
      }

      Position? fresh;
      try {
        fresh = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 12),
          ),
        );
      } catch (_) {
        fresh = null;
      }

      // Fix kelmadi / noaniq — 2 daqiqadan yangi oxirgi joyni sinaymiz.
      Position? cached;
      if (fresh == null ||
          (fresh.accuracy > 0 && fresh.accuracy > _maxRouteAccuracyM)) {
        try {
          final last = await Geolocator.getLastKnownPosition();
          if (last != null &&
              DateTime.now().difference(last.timestamp) <
                  const Duration(minutes: 2)) {
            cached = last;
          }
        } catch (_) {
          /* ignore */
        }
      }

      final best = _moreAccurate(fresh, cached);
      // Hech narsa yo'q yoki aql bovar qilmas noaniqlik (wifi/cell) — null,
      // backend saqlangan/ombor fallback'i xavfsizroq.
      if (best == null ||
          (best.accuracy > 0 && best.accuracy > _maxRouteAccuracyM)) {
        _warnOnce();
        return null;
      }
      unawaited(_post(best));
      _warnedNoGps = false;
      return (lat: best.latitude, lng: best.longitude);
    } catch (_) {
      _warnOnce();
      return null;
    }
  }

  /// accuracy kichik = aniqroq (0 = noma'lum, eng oxirida).
  Position? _moreAccurate(Position? a, Position? b) {
    if (a == null) return b;
    if (b == null) return a;
    final aa = a.accuracy > 0 ? a.accuracy : 1e9;
    final ba = b.accuracy > 0 ? b.accuracy : 1e9;
    return aa <= ba ? a : b;
  }

  void _warnOnce() {
    if (locState.value == LocState.ok && !_warnedNoGps) {
      _warnedNoGps = true;
      toast.info("GPS aniqlanmadi — taxminiy masofa ishlatildi");
    }
  }

  Future<void> _post(Position pos) async {
    if (!api.hasToken) return;
    // Noaniq fix jonli manzil / depot fallback'ini buzadi — o'tkazib yuboramiz.
    if (pos.accuracy > 0 && pos.accuracy > _maxStreamAccuracyM) return;
    try {
      await api.post('/courier/location', {
        'lat': pos.latitude,
        'lng': pos.longitude,
      });
    } catch (_) {
      /* offline / 401 — keyingi tickda qayta */
    }
  }
}

final locationService = LocationService.instance;
