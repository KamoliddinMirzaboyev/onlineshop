import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

/// Flutter'ning Material/Cupertino/Widgets lokalizatsiyasida o'zbek tili yo'q.
/// `Locale('uz')` bo'lganda `TextField` va boshqa Material vidjetlar
/// "No MaterialLocalizations found" xatosi bilan qulaydi. Bu delegatlar `uz`
/// uchun tizim matnlarini (nusxa olish, OK/Cancel, sana tanlagich) inglizcha
/// yuklaydi; ilovaning o'z matnlari esa `AppStrings` orqali o'zbekcha qoladi.
class UzFallbackLocalizations {
  static const List<LocalizationsDelegate<dynamic>> delegates = [
    _UzDelegate<MaterialLocalizations>(_loadMaterial),
    _UzDelegate<CupertinoLocalizations>(_loadCupertino),
    _UzDelegate<WidgetsLocalizations>(_loadWidgets),
  ];
}

Future<MaterialLocalizations> _loadMaterial(Locale _) =>
    GlobalMaterialLocalizations.delegate.load(const Locale('en'));
Future<CupertinoLocalizations> _loadCupertino(Locale _) =>
    GlobalCupertinoLocalizations.delegate.load(const Locale('en'));
Future<WidgetsLocalizations> _loadWidgets(Locale _) =>
    GlobalWidgetsLocalizations.delegate.load(const Locale('en'));

class _UzDelegate<T> extends LocalizationsDelegate<T> {
  const _UzDelegate(this._loader);
  final Future<T> Function(Locale) _loader;

  @override
  bool isSupported(Locale locale) => locale.languageCode == 'uz';

  @override
  Future<T> load(Locale locale) => _loader(locale);

  @override
  bool shouldReload(covariant LocalizationsDelegate<T> old) => false;
}
