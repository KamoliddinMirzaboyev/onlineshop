import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../models/catalog.dart';
import 'api.dart';

class StoreProvider extends ChangeNotifier {
  RestaurantDetail? store;
  bool loading = true;
  bool error = false;
  bool outOfRange = false;
  bool needsLocation = false;

  StoreProvider() {
    load();
  }

  Future<Position?> _resolvePosition() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      needsLocation = true;
      return null;
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      needsLocation = true;
      return null;
    }

    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 15),
      ),
    );
  }

  Future<void> load() async {
    loading = true;
    error = false;
    outOfRange = false;
    needsLocation = false;
    notifyListeners();

    try {
      final position = await _resolvePosition();
      if (position == null) {
        // GPS yo'q — default do'kon (katalog ochiq).
        try {
          final res = await api.get('/restaurants/default');
          store = RestaurantDetail.fromJson(res);
        } catch (_) {
          store = null;
          error = true;
        }
        return;
      }
      final lat = position.latitude;
      final lng = position.longitude;
      try {
        final res = await api.get('/restaurants/nearest?lat=$lat&lng=$lng');
        store = RestaurantDetail.fromJson(res);
      } catch (e) {
        if (e.toString().contains('OUT_OF_RANGE')) {
          outOfRange = true;
          store = null;
        } else {
          // Tarmoq xatosi — default fallback (hudud emas).
          try {
            final res = await api.get('/restaurants/default');
            store = RestaurantDetail.fromJson(res);
          } catch (_) {
            error = true;
          }
        }
      }
    } catch (e) {
      if (e.toString().contains('OUT_OF_RANGE')) {
        outOfRange = true;
      } else {
        error = true;
      }
    } finally {
      loading = false;
      notifyListeners();
    }
  }
}
