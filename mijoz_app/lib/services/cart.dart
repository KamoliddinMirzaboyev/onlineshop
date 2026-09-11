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

  void add(Product product) {
    if (_items.containsKey(product.id)) {
      _items[product.id]!.quantity++;
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
}
