import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:mijoz_app/core/i18n.dart';
import 'package:mijoz_app/models/catalog.dart';
import 'package:mijoz_app/models/order.dart';
import 'package:mijoz_app/widgets/order_editor_sheet.dart';

Product _p(int id, String name) => Product(
      id: id, restaurantId: 1, categoryId: 1, nameUz: name, nameRu: name,
      price: 1000, isAvailable: true, stock: 10, unit: 'dona',
    );

void main() {
  testWidgets('kategoriyadan mahsulot tanlab qo\'shish', (tester) async {
    final store = RestaurantDetail.fromJson({
      'id': 1, 'name': 'S', 'is_open': true, 'phones': [], 'socials': {}, 'banners': [],
      'categories': [
        {
          'id': 1, 'name_uz': 'Mevalar', 'name_ru': 'Фрукты', 'sort_order': 0,
          'subcategories': [
            {'id': 11, 'name_uz': 'Olma', 'name_ru': 'Яблоки', 'sort_order': 0,
             'products': [_p(5, 'Golden olma').toJson()]},
          ],
        },
      ],
    });
    final order = Order.fromJson({
      'id': 1, 'number': 'A1', 'restaurant_id': 1, 'status': 'pending',
      'items_total': 1000, 'delivery_fee': 0, 'total': 1000, 'address_line': 'x',
      'created_at': '', 'items': [
        {'id': 1, 'product_id': 9, 'name_uz': 'Boshqa', 'name_ru': 'Другое', 'price': 1000, 'quantity': 1},
      ],
    });
    await tester.pumpWidget(ChangeNotifierProvider(
      create: (_) => LanguageProvider(),
      child: MaterialApp(
        home: Builder(builder: (c) => TextButton(
          onPressed: () => showOrderEditorSheet(c, order: order, store: store),
          child: const Text('open'),
        )),
      ),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Mahsulot qo‘shish'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Mevalar'));   // kategoriya (bitta sub — to'g'ridan-to'g'ri mahsulotlar)
    await tester.pumpAndSettle();
    expect(find.text('Golden olma'), findsOneWidget);
    await tester.tap(find.byIcon(Icons.add_rounded).last);
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.delete_outline_rounded), findsWidgets); // stepper paydo bo'ldi
    await tester.tap(find.byIcon(Icons.arrow_back_rounded)); // kategoriyalar
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.arrow_back_rounded)); // buyurtma ro'yxati
    await tester.pumpAndSettle();
    expect(find.text('Golden olma'), findsOneWidget);
    expect(find.text('Boshqa'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
