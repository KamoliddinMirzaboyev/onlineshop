import 'package:flutter_test/flutter_test.dart';
import 'package:mijoz_app/models/catalog.dart';
import 'package:mijoz_app/models/quote.dart';
import 'package:mijoz_app/services/cart.dart';

Product _p({
  int id = 1,
  int price = 10000,
  double stock = 5,
  bool available = true,
  String name = 'Olma',
}) =>
    Product(
      id: id,
      restaurantId: 1,
      categoryId: 1,
      nameUz: name,
      nameRu: name,
      price: price,
      unit: 'kg',
      isAvailable: available,
      stock: stock,
    );

void main() {
  // Secure storage plugin testda yo'q — CartProvider uni try/catch bilan o'raydi.
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ombor qoldig\'i', () {
    test('qoldiqsiz mahsulot savatga tushmaydi', () {
      final cart = CartProvider();
      cart.add(_p(stock: 0));
      expect(cart.totalItems, 0, reason: 'server ham stock=0 ni rad etadi');
    });

    test('qoldiqdan oshirib qo\'shib bo\'lmaydi', () {
      final cart = CartProvider();
      final p = _p(stock: 2);
      cart.add(p);
      cart.add(p);
      cart.add(p); // uchinchisi — qoldiqdan tashqari
      expect(cart.quantityOf(p.id), 2);
    });

    test('sotuvda yo\'q mahsulot qo\'shilmaydi', () {
      final cart = CartProvider();
      cart.add(_p(stock: 10, available: false));
      expect(cart.totalItems, 0);
    });
  });

  group('savatni katalog bilan sinxronlash', () {
    test('sotuvdan olingan mahsulot savatdan chiqadi', () {
      final cart = CartProvider();
      cart.add(_p(id: 1, name: 'Olma'));
      final changes = cart.syncWithCatalog({
        1: _p(id: 1, name: 'Olma', available: false),
      });
      expect(cart.totalItems, 0);
      expect(changes.single, contains('Olma'));
    });

    test('katalogda yo\'q mahsulot savatdan chiqadi', () {
      final cart = CartProvider();
      cart.add(_p(id: 7, name: 'Uzum'));
      final changes = cart.syncWithCatalog({1: _p(id: 1)});
      expect(cart.totalItems, 0);
      expect(changes.single, contains('Uzum'));
    });

    test('qoldiq kamaysa miqdor shunga qisqaradi', () {
      final cart = CartProvider();
      final p = _p(id: 1, stock: 5);
      cart.add(p);
      cart.add(p);
      cart.add(p);
      expect(cart.quantityOf(1), 3);

      final changes = cart.syncWithCatalog({1: _p(id: 1, stock: 2)});
      expect(cart.quantityOf(1), 2);
      expect(changes.single, contains('2'));
    });

    test('narx o\'zgarsa savat yangi narxni oladi', () {
      final cart = CartProvider();
      cart.add(_p(id: 1, price: 10000));
      expect(cart.totalPrice, 10000);

      final changes = cart.syncWithCatalog({1: _p(id: 1, price: 12000)});
      expect(cart.totalPrice, 12000, reason: 'server yangi narx bo\'yicha yozadi');
      expect(changes.single, contains('narx'));
    });

    test('hech narsa o\'zgarmasa xabar ham bo\'lmaydi', () {
      final cart = CartProvider();
      cart.add(_p(id: 1, price: 10000, stock: 5));
      expect(cart.syncWithCatalog({1: _p(id: 1, price: 10000, stock: 5)}), isEmpty);
    });
  });

  group('server hisobi (quote)', () {
    test('javob to\'liq o\'qiladi', () {
      final q = OrderQuote.fromJson({
        'items_total': 20000,
        'delivery_fee': 8000,
        'total': 28000,
        'free_delivery_from': 50000,
        'delivery_fee_known': true,
        'is_open': true,
        'distance_km': 3.4,
        'issues': [
          {
            'product_id': 9,
            'name_uz': 'Pomidor',
            'reason': 'out_of_stock',
            'available_stock': 0,
            'message': "'Pomidor' tugagan",
          }
        ],
      });

      expect(q.total, 28000);
      expect(q.freeDeliveryFrom, 50000);
      expect(q.isFreeDelivery, isFalse);
      expect(q.hasIssues, isTrue);
      expect(q.issues.single.reason, 'out_of_stock');
    });

    test('yetkazish bepul bo\'lsa belgilanadi', () {
      final q = OrderQuote.fromJson({
        'items_total': 60000,
        'delivery_fee': 0,
        'total': 60000,
        'free_delivery_from': 50000,
        'delivery_fee_known': true,
      });
      expect(q.isFreeDelivery, isTrue);
      expect(q.hasIssues, isFalse);
    });
  });

  test('katalogdan kelgan stock o\'qiladi', () {
    final p = Product.fromJson({
      'id': 1,
      'restaurant_id': 1,
      'category_id': 1,
      'name_uz': 'Olma',
      'name_ru': 'Яблоко',
      'price': 10000,
      'stock': 2.5,
      'unit': 'kg',
      'is_available': true,
    });
    expect(p.stock, 2.5);
    expect(p.inStock, isTrue);
    expect(p.maxQuantity, 2);
  });
}
