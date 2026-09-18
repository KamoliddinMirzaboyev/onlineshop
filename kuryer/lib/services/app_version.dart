import 'package:package_info_plus/package_info_plus.dart';
import 'api.dart';

const String _appKey = 'kuryer';
const String _defaultStoreUrl =
    'https://play.google.com/store/apps/details?id=uz.barakalibozor.kuryer';

/// Backend'dan majburiy yangilanish chegarasini tekshiradi.
/// Tarmoq/server xatosida `null` qaytaradi — chaqiruvchi bloklamasligi kerak
/// (fail-open: foydalanuvchi tarmoq muammosi tufayli qulflanib qolmasin).
Future<String?> checkForceUpdateStoreUrl() async {
  try {
    final res = await api.get('/app/version/$_appKey');
    final minCode = (res['min_version_code'] as num?)?.toInt() ?? 0;
    if (minCode <= 0) return null;
    final info = await PackageInfo.fromPlatform();
    final current = int.tryParse(info.buildNumber) ?? 0;
    if (current >= minCode) return null;
    final storeUrl = res['store_url'] as String?;
    return (storeUrl != null && storeUrl.isNotEmpty) ? storeUrl : _defaultStoreUrl;
  } catch (_) {
    return null;
  }
}
