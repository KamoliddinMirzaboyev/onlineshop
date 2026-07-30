import 'dart:async';

import 'package:geolocator/geolocator.dart';

import 'api.dart';

/// PWA `location.ts` ekvivalenti: app ochiq paytda GPS → POST /courier/location.
class LocationService {
  LocationService._();
  static final LocationService instance = LocationService._();

  StreamSubscription<Position>? _sub;
  bool _starting = false;

  bool get isRunning => _sub != null;

  /// Ruxsat so'rash + stream boshlash. Best-effort — rad etsa jim.
  Future<void> start() async {
    if (_sub != null || _starting) return;
    _starting = true;
    try {
      final serviceOn = await Geolocator.isLocationServiceEnabled();
      if (!serviceOn) return;

      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
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
          distanceFilter: 25, // 25 m harakatdan keyin
        ),
      ).listen(
        (pos) {
          unawaited(_post(pos));
        },
        onError: (_) {
          /* ruxsat o'chirilgan yoki GPS xato */
        },
      );
    } finally {
      _starting = false;
    }
  }

  Future<void> stop() async {
    await _sub?.cancel();
    _sub = null;
  }

  Future<void> _post(Position pos) async {
    if (!api.hasToken) return;
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
