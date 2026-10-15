import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mijoz_app/core/uz_localizations.dart';

void main() {
  for (final code in ['uz', 'ru']) {
    testWidgets('TextField $code locale\'da qulamaydi', (tester) async {
      await tester.pumpWidget(MaterialApp(
        locale: Locale(code),
        supportedLocales: const [Locale('uz'), Locale('ru')],
        localizationsDelegates: const [
          ...UzFallbackLocalizations.delegates,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: const Scaffold(body: TextField()),
      ));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.byType(TextField), findsOneWidget);
    });
  }
}
