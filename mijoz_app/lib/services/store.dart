import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show compute;
import 'package:geolocator/geolocator.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/catalog.dart';
import 'api.dart';

// ponytail: katalogda yuzlab mahsulot bo'lsa, RestaurantDetail.fromJson'ning
// nested map/toList zanjiri UI isolate'ni bir necha frame band qilishi mumkin —
// compute() bilan alohida isolate'da parse qilinadi.
RestaurantDetail _parseRestaurant(Map<String, dynamic> json) => RestaurantDetail.fromJson(json);

class StoreProvider extends ChangeNotifier {
  static const _catalogCacheKey = 'af_cached_catalog';
  final _storage = const FlutterSecureStorage();

  /// Katalogdagi barcha mahsulot — id bo'yicha. Savatni yangi narx/qoldiq
  /// bilan solishtirish uchun (`CartProvider.syncWithCatalog`).
  ///
  /// Natija keshlanadi: avval har chaqiruvda yuzlab mahsulot bo'yicha uch
  /// qavatli sikl aylanib, yangi Map yig'ilardi — Provider `update` har
  /// bildirishnomada buni qayta hisoblardi.
  Map<int, Product>? _productsByIdCache;
  Map<int, Product> get productsById => _productsByIdCache ??= {
        for (final c in store?.categories ?? const <Category>[])
          for (final sc in c.subcategories)
            for (final p in sc.products) p.id: p,
      };

  RestaurantDetail? _store;
  RestaurantDetail? get store => _store;
  set store(RestaurantDetail? value) {
    _store = value;
    _productsByIdCache = null; // katalog o'zgardi — indeks qayta quriladi
  }

  bool loading = true;
  bool error = false;
  /// Joylashuv aniqlandi, lekin hech bir do'kon hududi qamramaydi. Katalog
  /// ochiq qoladi (buyurtma berishda server rad etadi) — bu faqat mijozga
  /// savatni to'ldirishdan oldin ogohlantirish ko'rsatish uchun.
  bool outOfZone = false;
  bool needsLocation = false;

  StoreProvider() {
    _initFromCacheAndLoad();
  }

  Future<void> _initFromCacheAndLoad() async {
    // Stale-While-Revalidate: avval keshdagi do'kon va mahsulotlarni o'qiymiz
    try {
      final cached = await _storage.read(key: _catalogCacheKey);
      if (cached != null && cached.isNotEmpty) {
        final decoded = jsonDecode(cached);
        if (decoded is Map<String, dynamic>) {
          store = RestaurantDetail.fromJson(decoded);
          loading = false;
          notifyListeners();
        }
      }
    } catch (e) {
      debugPrint('Store cache read error: $e');
    }

    // Tarmoq orqali yangilab olamiz
    await load();
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

    // Tezkor koordinata: avval tizim xotirasidagi oxirgi koordinatani tekshiramiz (<50ms)
    try {
      final lastPos = await Geolocator.getLastKnownPosition();
      if (lastPos != null) {
        return lastPos;
      }
    } catch (_) {}

    // Aniqroq GPS: 4 soniya timeLimit bilan (15s kutib qotib qolmasligi uchun)
    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 4),
        ),
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> _saveCatalogToCache(RestaurantDetail detail) async {
    try {
      final jsonStr = jsonEncode(detail.toJson());
      await _storage.write(key: _catalogCacheKey, value: jsonStr);
    } catch (e) {
      debugPrint('Store cache write error: $e');
    }
  }

  Future<void> load() async {
    // Agar keshdan ma'lumot mavjud bo'lsa, ekran bo'sh qolmasligi uchun loading=true qilib to'sib qo'ymaymiz
    if (store == null) {
      loading = true;
    }
    error = false;
    outOfZone = false;
    needsLocation = false;
    notifyListeners();

    try {
      final position = await _resolvePosition();
      if (position == null) {
        // GPS yo'q — default do'kon (katalog ochiq).
        try {
          final res = await api.get('/restaurants/default');
          final parsed = await compute(_parseRestaurant, res as Map<String, dynamic>);
          store = parsed;
          _saveCatalogToCache(parsed);
        } catch (_) {
          if (store == null) {
            error = true;
          }
        }
        return;
      }
      final lat = position.latitude;
      final lng = position.longitude;
      try {
        final res = await api.get('/restaurants/nearest?lat=$lat&lng=$lng');
        final parsed = await compute(_parseRestaurant, res as Map<String, dynamic>);
        store = parsed;
        _saveCatalogToCache(parsed);
      } catch (e) {
        // Hudud tashqarisi ham, tarmoq xatosi ham — katalog ochiq qoladi.
        // Zona tekshiruvi buyurtma berishda (POST /orders) bo'ladi.
        outOfZone = e.toString().contains('OUT_OF_RANGE');
        try {
          final res = await api.get('/restaurants/default');
          final parsed = await compute(_parseRestaurant, res as Map<String, dynamic>);
          store = parsed;
          _saveCatalogToCache(parsed);
        } catch (_) {
          if (store == null) {
            error = true;
          }
        }
      }
    } catch (_) {
      if (store == null) {
        error = true;
      }
    } finally {
      loading = false;
      notifyListeners();
    }
  }
}
