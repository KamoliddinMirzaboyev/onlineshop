import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/catalog.dart';

class CartItem {
  final Product product;
  int quantity;

  CartItem({required this.product, required this.quantity});

  /// Backend POST /orders payload formati
  Map<String, dynamic> toOrderPayload() => {
    'product_id': product.id,
    'quantity': quantity,
  };

  /// Mahalliy xotira (kesh) formati
  Map<String, dynamic> toStorageJson() => {
    'product': product.toJson(),
    'quantity': quantity,
  };

  factory CartItem.fromStorageJson(Map<String, dynamic> json) => CartItem(
    product: Product.fromJson(json['product'] as Map<String, dynamic>),
    quantity: (json['quantity'] as num?)?.toInt() ?? 1,
  );
}

class CartProvider extends ChangeNotifier {
  static const _storageKey = 'af_mijoz_cart';
  final _storage = const FlutterSecureStorage();
  final Map<int, CartItem> _items = {};

  CartProvider() {
    _loadFromStorage();
  }

  List<CartItem> get items => _items.values.toList();
  
  int get totalItems => _items.values.fold(0, (sum, item) => sum + item.quantity);
  
  int get totalPrice => _items.values.fold(0, (sum, item) => sum + (item.product.price * item.quantity));

  int quantityOf(int productId) => _items[productId]?.quantity ?? 0;

  Future<void> _loadFromStorage() async {
    try {
      final raw = await _storage.read(key: _storageKey);
      if (raw != null && raw.isNotEmpty) {
        final list = jsonDecode(raw) as List<dynamic>;
        _items.clear();
        for (final item in list) {
          if (item is Map<String, dynamic>) {
            final cartItem = CartItem.fromStorageJson(item);
            _items[cartItem.product.id] = cartItem;
          }
        }
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Cart load from storage error: $e');
    }
  }

  Future<void> _saveToStorage() async {
    try {
      if (_items.isEmpty) {
        await _storage.delete(key: _storageKey);
      } else {
        final list = _items.values.map((e) => e.toStorageJson()).toList();
        await _storage.write(key: _storageKey, value: jsonEncode(list));
      }
    } catch (e) {
      debugPrint('Cart save to storage error: $e');
    }
  }

  /// Savatga qo'shadi. Ombor qoldig'idan oshmaydi — server ham aynan shu
  /// chegarani qo'yadi (`reserve_stock_atomic`), shuning uchun oshirib
  /// qo'yilsa buyurtma checkout'da rad etilardi.
  void add(Product product) {
    final current = _items[product.id]?.quantity ?? 0;
    final max = product.maxQuantity;
    if (max <= 0 || current >= max) return;
    if (_items.containsKey(product.id)) {
      _items[product.id]!.quantity = current + 1;
    } else {
      _items[product.id] = CartItem(product: product, quantity: 1);
    }
    _saveToStorage();
    notifyListeners();
  }

  void remove(int productId) {
    if (!_items.containsKey(productId)) return;
    if (_items[productId]!.quantity > 1) {
      _items[productId]!.quantity--;
    } else {
      _items.remove(productId);
    }
    _saveToStorage();
    notifyListeners();
  }

  void setQty(int productId, int quantity) {
    if (quantity <= 0) {
      _items.remove(productId);
    } else if (_items.containsKey(productId)) {
      _items[productId]!.quantity = quantity;
    } else {
      return;
    }
    _saveToStorage();
    notifyListeners();
  }

  void delete(int productId) {
    _items.remove(productId);
    _saveToStorage();
    notifyListeners();
  }

  void clear() {
    _items.clear();
    _saveToStorage();
    notifyListeners();
  }

  /// Savatni yangi katalog bilan solishtiradi.
  ///
  /// Savat qurilmada mahsulotning to'liq nusxasi (narxi bilan) sifatida
  /// saqlanadi — sinxronlanmasa mijoz eski narxni ko'rib, serverdan boshqa
  /// summa yozilardi; sotuvdan olingan yoki tugagan mahsulot esa faqat
  /// checkout'da xato berardi. Shu yerda hammasi oldindan to'g'rilanadi.
  ///
  /// Qaytaradi: foydalanuvchiga ko'rsatiladigan o'zgarishlar ro'yxati.
  List<String> syncWithCatalog(Map<int, Product> catalog) {
    if (_items.isEmpty || catalog.isEmpty) return const [];

    final changes = <String>[];
    final removed = <int>[];

    for (final entry in _items.entries.toList()) {
      final cached = entry.value;
      final fresh = catalog[entry.key];

      if (fresh == null || !fresh.isAvailable) {
        removed.add(entry.key);
        changes.add('"${cached.product.nameUz}" sotuvdan olindi — savatdan chiqarildi');
        continue;
      }
      if (fresh.maxQuantity <= 0) {
        removed.add(entry.key);
        changes.add('"${fresh.nameUz}" tugadi — savatdan chiqarildi');
        continue;
      }

      if (cached.quantity > fresh.maxQuantity) {
        changes.add('"${fresh.nameUz}" — omborda ${fresh.maxQuantity} ta qoldi');
        cached.quantity = fresh.maxQuantity;
      }
      if (cached.product.price != fresh.price) {
        changes.add('"${fresh.nameUz}" narxi yangilandi');
      }
      // Nusxani har doim yangisiga almashtiramiz (narx, rasm, qoldiq).
      _items[entry.key] = CartItem(product: fresh, quantity: cached.quantity);
    }

    for (final id in removed) {
      _items.remove(id);
    }

    if (changes.isNotEmpty) {
      _saveToStorage();
      notifyListeners();
    }
    return changes;
  }
}
