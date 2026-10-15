import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:mijoz_app/core/i18n.dart';

void main() {
  testWidgets('context.tr tugma handler\'ida (build tashqarisida) qulamaydi', (tester) async {
    String? got;
    await tester.pumpWidget(ChangeNotifierProvider(
      create: (_) => LanguageProvider(),
      child: MaterialApp(
        home: Builder(
          builder: (context) => TextButton(
            onPressed: () => got = context.tr.retry,
            child: Text(context.tr.retry),
          ),
        ),
      ),
    ));
    await tester.tap(find.byType(TextButton));
    expect(tester.takeException(), isNull);
    expect(got, isNotNull);
  });
}
