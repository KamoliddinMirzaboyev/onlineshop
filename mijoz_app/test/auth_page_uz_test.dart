import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:mijoz_app/core/i18n.dart';
import 'package:mijoz_app/core/uz_localizations.dart';
import 'package:mijoz_app/pages/auth_page.dart';

void main() {
  testWidgets('AuthPage o\'zbek tilida telefon maydoni xatosiz chiziladi', (tester) async {
    await tester.pumpWidget(ChangeNotifierProvider.value(
      value: LanguageProvider(),
      child: MaterialApp(
        locale: const Locale('uz'),
        supportedLocales: const [Locale('uz'), Locale('ru')],
        localizationsDelegates: const [
          ...UzFallbackLocalizations.delegates,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: const AuthPage(),
      ),
    ));
    await tester.pump(const Duration(seconds: 1));
    expect(tester.takeException(), isNull);
    expect(find.byType(TextField), findsWidgets);
  });
}
