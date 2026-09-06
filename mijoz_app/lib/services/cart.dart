import 'package:flutter/material.dart';
import '../models/catalog.dart';

class CartItem {
  final Product product;
  int quantity;

  CartItem({required this.product, required this.quantity});

  Map<String, dynamic> toJson() => {
    'product_id': product.id,
    'quantity': quantity,
  };
}

class CartProvider extends ChangeNotifier {
  final Map<int, CartItem> _items = {};

  List<CartItem> get items => _items.values.toList();
  
  int get totalItems => _items.values.fold(0, (sum, item) => sum + item.quantity);
  
  int get totalPrice => _items.values.fold(0, (sum, item) => sum + (item.product.price * item.quantity));

  int quantityOf(int productId) => _items[productId]?.quantity ?? 0;

  void add(Product product) {
    if (_items.containsKey(product.id)) {
      _items[product.id]!.quantity++;
    } else {
      _items[product.id] = CartItem(product: product, quantity: 1);
    }
    notifyListeners();
  }

  void remove(int productId) {
    if (!_items.containsKey(productId)) return;
    if (_items[productId]!.quantity > 1) {
      _items[productId]!.quantity--;
    } else {
      _items.remove(productId);
    }
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
    notifyListeners();
  }

  void delete(int productId) {
    _items.remove(productId);
    notifyListeners();
  }

  void clear() {
    _items.clear();
    notifyListeners();
  }
}
