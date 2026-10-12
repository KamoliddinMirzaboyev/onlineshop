import 'dart:io' show Platform;
import 'package:package_info_plus/package_info_plus.dart';
import 'api.dart';

const String _appKey = 'mijoz';
const String _androidStoreUrl =
    'https://play.google.com/store/apps/details?id=uz.barakalibozor.mijoz';

/// Backend'dagi versiya sozlamasi bilan joriy build solishtirilgandagi natija.
class AppUpdate {
  const AppUpdate({
    required this.force,
    required this.storeUrl,
    required this.latest,
    this.notesUz,
    this.notesRu,
  });

  /// `true` — build `min_version_code`dan past: ilovadan foydalanib bo'lmaydi.
  /// `false` — ixtiyoriy yangilanish ("Keyinroq" bilan yopiladigan modal).
  final bool force;
  final String storeUrl;
  final int latest;
  final String? notesUz;
  final String? notesRu;

  String? notes(String lang) {
    final n = (lang == 'ru' ? notesRu : notesUz)?.trim();
    if (n != null && n.isNotEmpty) return n;
    final fallback = (lang == 'ru' ? notesUz : notesRu)?.trim();
    return (fallback != null && fallback.isNotEmpty) ? fallback : null;
  }
}

/// Backend'dan yangilanish holatini tekshiradi. Yangilanish kerak bo'lmasa,
/// tarmoq/server xatosida yoki do'kon havolasi noma'lum bo'lsa `null`
/// (fail-open: foydalanuvchi tarmoq muammosi tufayli qulflanib qolmasin).
Future<AppUpdate?> fetchAppUpdate() async {
  try {
    final res = await api.get('/app/version/$_appKey');
    final minCode = (res['min_version_code'] as num?)?.toInt() ?? 0;
    final latest = (res['latest_version_code'] as num?)?.toInt() ?? 0;
    final info = await PackageInfo.fromPlatform();
    final current = int.tryParse(info.buildNumber) ?? 0;
    final force = minCode > 0 && current < minCode;
    final optional = latest > current;
    if (!force && !optional) return null;

    final raw = res['store_url'] as String?;
    final storeUrl = (raw != null && raw.isNotEmpty)
        ? raw
        : (Platform.isAndroid ? _androidStoreUrl : null);
    // iOS'da App Store havolasi berilmagan bo'lsa noto'g'ri (Play) havolaga
    // yo'naltirmaymiz — yangilanish ko'rsatilmaydi.
    if (storeUrl == null) return null;
    return AppUpdate(
      force: force,
      storeUrl: storeUrl,
      latest: latest > minCode ? latest : minCode,
      notesUz: res['release_notes_uz'] as String?,
      notesRu: res['release_notes_ru'] as String?,
    );
  } catch (_) {
    return null;
  }
}
