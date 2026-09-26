import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:provider/provider.dart';
import '../services/api.dart';

/// Mijoz ilovasi uchun ikki tilli (O'zbek / Rus) mahalliylashtirish tizimi.
/// Qat'iy tip xavfsizligi va barcha sahifalar uchun to'liq tarjimalar to'plami.

enum AppLanguage { uz, ru }

extension AppLanguageExt on AppLanguage {
  String get code => this == AppLanguage.ru ? 'ru' : 'uz';
  String get displayName => this == AppLanguage.ru ? 'Русский' : "O'zbekcha";
  String get flag => this == AppLanguage.ru ? '🇷🇺' : '🇺🇿';

  static AppLanguage fromCode(String? code) {
    if (code?.toLowerCase() == 'ru') return AppLanguage.ru;
    return AppLanguage.uz;
  }
}

class LanguageProvider extends ChangeNotifier {
  static const _storageKey = 'af_mijoz_lang';
  static const _storage = FlutterSecureStorage();

  static LanguageProvider? _instance;
  static LanguageProvider get instance => _instance ??= LanguageProvider();

  static AppStrings get currentStrings => (_instance?._current == AppLanguage.ru)
      ? _StringsRu.instance
      : _StringsUz.instance;
  static String get currentCode => _instance?.code ?? 'uz';

  AppLanguage _current = AppLanguage.uz;
  bool _initialized = false;

  LanguageProvider() {
    _instance = this;
  }

  AppLanguage get current => _current;
  String get code => _current.code;
  bool get isRussian => _current == AppLanguage.ru;
  bool get isUzbek => _current == AppLanguage.uz;

  AppStrings get strings => _current == AppLanguage.ru ? _StringsRu.instance : _StringsUz.instance;

  Future<void> init() async {
    if (_initialized) return;
    try {
      final saved = await _storage.read(key: _storageKey);
      if (saved != null && saved.isNotEmpty) {
        _current = AppLanguageExt.fromCode(saved);
      }
    } catch (_) {
      _current = AppLanguage.uz;
    }
    _initialized = true;
    notifyListeners();
  }

  Future<void> setLanguage(AppLanguage lang) async {
    if (_current == lang) return;
    _current = lang;
    notifyListeners();
    try {
      await _storage.write(key: _storageKey, value: lang.code);
      if (api.hasToken) {
        api.patch('/auth/me', {'language': lang.code}).catchError((_) => null);
      }
    } catch (_) {}
  }
}

/// Qulay chaqiruv: `context.tr` yoki `I18n.of(context)`
extension LanguageContextExt on BuildContext {
  AppStrings get tr => watch<LanguageProvider>().strings;
  LanguageProvider get lang => watch<LanguageProvider>();
  String get currentLangCode => watch<LanguageProvider>().code;
}

class I18n {
  static AppStrings of(BuildContext context) => context.watch<LanguageProvider>().strings;
  static LanguageProvider provider(BuildContext context) => context.watch<LanguageProvider>();
}

/// Barcha matnlar uchun abstrakt interfeys
abstract class AppStrings {
  // App info
  String get appName;

  // Bottom Navigation
  String get navHome;
  String get navSearch;
  String get navOrders;
  String get navProfile;

  // Umumiy so'zlar & tugmalar
  String get cancel;
  String get save;
  String get delete;
  String get edit;
  String get confirm;
  String get continueBtn;
  String get retry;
  String get close;
  String get back;
  String get clear;
  String get loading;
  String get errorOccurred;
  String get networkError;
  String get noInternetConnection;
  String get success;
  String get currency;
  String get unitKg;
  String get unitLitr;
  String get unitDona;
  String get unitMinShort;
  String get unitMinute;
  String get open;
  String get closed;
  String get free;
  String get total;
  String get delivery;
  String get deliveryFee;
  String get minOrder;
  String get productsCost;
  String itemsCount(int count);

  // Format helpers
  String formatMoney(num amount);
  String formatUnit(String? unit);
  String qtyWithUnit(num quantity, String? unit);
  String statusLabel(String status);
  String paymentLabel(String? method);
  String etaLabel(int? minutes);

  // Auth sahifasi
  String get authWelcomeTitle;
  String get authEnterPhone;
  String get authPhoneLabel;
  String get authPhoneHint;
  String get authLoginBtn;
  String get authTermsAgreement;
  String get authConfirmPhoneTitle;
  String get authConfirmPhoneDesc;
  String get authPhoneRequiredError;
  String get authEnterNameTitle;
  String get authFirstNameLabel;
  String get authFirstNameHint;
  String get authLastNameLabel;
  String get authLastNameHint;
  String get authSaveAndContinue;
  String get authNameRequiredError;
  String get authGeneralError;
  String get authSaveProfileError;
  String get authChooseLanguage;

  // Bosh sahifa (Home)
  String get homeStoreClosed;
  String homeStoreOpen(int minutes);
  String get homeSearchPlaceholder;
  String get homeCategories;
  String get homeAll;
  String get homeEmptyCatalog;
  String get homeDeliveryService;
  String get homeOutOfRangeTitle;
  String get homeOutOfRangeDesc;
  String get homeBanner1Title;
  String get homeBanner1Desc;
  String get homeBanner2Title;
  String get homeBanner2Desc;
  String get homeBanner3Title;
  String get homeBanner3Desc;

  // Kategoriya sahifasi
  String get categoryProducts;
  String get categoryEmpty;
  String get categoryAllSubs;

  // Qidiruv sahifasi
  String get searchPlaceholder;
  String get searchEmptyResult;
  String get searchTryAnotherWord;

  // Savatcha sahifasi
  String get cartTitle;
  String get cartEmptyTitle;
  String get cartEmptyDesc;
  String get cartStartShopping;
  String get cartClearBtn;
  String get cartClearConfirmTitle;
  String get cartClearConfirmDesc;
  String get cartFreeDeliveryUnlocked;
  String cartFreeDeliveryRemaining(num amount);
  String get cartCheckoutBtn;
  String get cartInYourCart;
  String get cartGoToCart;

  // Buyurtmani rasmiylashtirish (Checkout)
  String get checkoutTitle;
  String get checkoutDeliveryAddress;
  String get checkoutAddressLocating;
  String get checkoutAddressPickMap;
  String get checkoutAddressRefresh;
  String get checkoutAddressHint;
  String get checkoutAptHint;
  String get checkoutPhone;
  String get checkoutComment;
  String get checkoutCommentHint;
  String get checkoutFemaleCourier;
  String get checkoutFemaleCourierDesc;
  String get checkoutPaymentMethod;
  String get checkoutPayCash;
  String get checkoutOrderSummary;
  String get checkoutSubmitBtn;
  String get checkoutSuccessTitle;
  String get checkoutSuccessDesc;
  String get checkoutViewOrder;
  String get checkoutBackToHome;
  String checkoutMinOrderWarning(num minAmount);
  String get checkoutAddressRequired;
  String get checkoutPhoneRequired;
  String get checkoutOutOfArea;

  // Xarita tanlash (Map picker)
  String get mapPickTitle;
  String get mapMoveHint;
  String get mapConfirmBtn;
  String get mapMyLocation;

  // Buyurtmalar va tafsiloti (Orders & Detail)
  String get ordersTitle;
  String orderNumber(String num);
  String get orderDetailsTitle;
  String get ordersEmptyTitle;
  String get ordersEmptyDesc;
  String get orderLoadFailed;
  String get orderPendingBanner;
  String get orderJustPlacedBanner;
  String get orderCancelledBanner;
  String get orderCourier;
  String get orderCallCourier;
  String get orderReceipt;
  String get orderViewReceipt;
  String get orderCancelBtn;
  String get orderCancelConfirmTitle;
  String get orderCancelConfirmDesc;
  String get orderStore;
  String get orderAddress;
  String get orderPayment;
  String get orderThankYou;
  List<String> get orderStages;

  // Profil sahifasi
  String get profileTitle;
  String get profilePersonalInfo;
  String get profileFirstName;
  String get profileLastName;
  String get profilePhone;
  String get profileNotSpecified;
  String get profileSavedAddresses;
  String get profileAddAddress;
  String get profileNoSavedAddresses;
  String get profileAppSettings;
  String get profileLanguage;
  String get profileSupportAndApp;
  String get profileSupport;
  String get profilePrivacy;
  String get profileTerms;
  String get profileVersion;
  String get profileLogout;
  String get profileLogoutConfirmTitle;
  String get profileLogoutConfirmDesc;
  String get profileDeleteAccount;
  String get profileDeleteAccountConfirmTitle;
  String get profileDeleteAccountConfirmDesc;
  String get profileSelectLanguage;
  String get profileLanguageChanged;

  // Qo'llab-quvvatlash sahifasi (Contact)
  String get contactTitle;
  String get contactSupportBadge;
  String get contactHaveQuestions;
  String get contactOperatorsReady;
  String get contactNoInfoTitle;
  String get contactNoInfoDesc;
  String get contactCallPhone;
  String get contactWriteTelegram;
  String get contactWorkingHours;
  String get contactWorkingHoursDesc;

  // Bildirishnomalar sahifasi
  String get notificationsTitle;
  String get notificationsMarkAllRead;
  String get notificationsEmptyTitle;
  String get notificationsEmptyDesc;

  // Mahsulot kartasi va tafsilot
  String get productInStock;
  String get productOutOfStock;
  String get productAbout;
  String get productNoDescription;
  String get productAddToCart;
  String productInCartQty(String qty, String unit);

  // Ruxsat so'rash sahifalari (Permissions)
  String get permLocationTitle;
  String get permLocationDesc;
  String get permLocationAllow;
  String get permLocationLater;
  String get permNotificationTitle;
  String get permNotificationDesc;
  String get permNotificationAllow;

  // Majburiy yangilanish (Force update)
  String get updateRequiredTitle;
  String get updateRequiredDesc;
  String get updateInPlayMarket;

  // Savat sinxronlash xabarlari
  String cartSyncItemRemoved(String name);
  String cartSyncItemOutOfStock(String name);
  String cartSyncItemQuantityAdjusted(String name, num stock);
  String cartSyncItemPriceUpdated(String name);
  String get cartSyncUpdatedTitle;

  // Qo'shimcha tarjimalar
  String get cartDeliveryDependsOnAddress;
  String get cartDeliveryAddedAtCheckout;
  String get cartTotalToPay;
  String get cartTotalForProducts;

  String get checkoutStoreClosed;
  String get checkoutPayCashTitle;
  String get checkoutPayCashSubtitle;
  String get checkoutFixCart;
  String get checkoutStoreNotFound;
  String get checkoutComingSoon;
  String checkoutOnlineSoon(String name);
  String get checkoutCalculating;
  String checkoutFreeFrom(num from);
  String checkoutGpsLow(int meters);
  String checkoutGpsAccurate(int meters);
  String get checkoutLocInaccurate;
  String get checkoutLocFailed;

  String ordersCount(int count);
  String ordersItemsCount(int count);
  String get orderDeliveryService;
  String get orderTotalPayment;
  String get orderDeliveryInfo;
  String get orderPaymentType;
  String get orderCommentLabel;
  String get orderPlacedTime;
  String get orderContactStore;
  String get orderDistanceLabel;
  String get orderEstimatedTimeLabel;
  String orderReceiptNumber(String num);

  String homeCategoriesCount(int count);
  String categorySearchPlaceholder(String cat);

  String get profileAdminContactTitle;
  String get profileAdminContactEmpty;
  String get profileCallAdmin;
  String get profileTelegramAdmin;
  String get profileUserFallback;
  String get profileEditNameTitle;
  String get profileEditLastNameTitle;
  String get profileEditPhoneTitle;
  String get profileAddAddressTitle;
  String get profileAddressHint;
  String get profileAddBtn;
  String get profileAddressAdded;
  String get profileAddressSaveFailed;
  String get profileAddressDeleted;
  String get profileDeleteFailed;
  String get profileDataUpdated;
  String get profilePhoneAlreadyTaken;
  String get profileSaveFailed;
  String get profileAccountDeleted;
  String get profileDeleteAccountWarning;

  // Umumiy tarmoq va splash
  String get splashSlogan;
  String get networkSlow;
  String get networkNoConnection;
  String get generalError;
}

/// ============================================================================
/// O'ZBEKCHA TARJIMALAR (O'ZBEK TILI)
/// ============================================================================
class _StringsUz implements AppStrings {
  _StringsUz._();
  static final _StringsUz instance = _StringsUz._();

  @override
  String get appName => 'Barakali Bozor';

  // Bottom Navigation
  @override String get navHome => 'Bosh sahifa';
  @override String get navSearch => 'Qidiruv';
  @override String get navOrders => 'Buyurtmalar';
  @override String get navProfile => 'Profil';

  // Umumiy
  @override String get cancel => 'Bekor qilish';
  @override String get save => 'Saqlash';
  @override String get delete => "O'chirish";
  @override String get edit => 'Tahrirlash';
  @override String get confirm => 'Tasdiqlash';
  @override String get continueBtn => 'Davom etish';
  @override String get retry => 'Qayta urinish';
  @override String get close => 'Yopish';
  @override String get back => 'Orqaga';
  @override String get clear => 'Tozalash';
  @override String get loading => 'Yuklanmoqda...';
  @override String get errorOccurred => 'Xatolik yuz berdi';
  @override String get networkError => 'Aloqa yo\'q';
  @override String get noInternetConnection => 'Internet aloqasi yo\'q';
  @override String get success => 'Muvaffaqiyatli';
  @override String get currency => 'so\'m';
  @override String get unitKg => 'kg';
  @override String get unitLitr => 'litr';
  @override String get unitDona => 'dona';
  @override String get unitMinShort => 'daq';
  @override String get unitMinute => 'daqiqa';
  @override String get open => 'Ochiq';
  @override String get closed => 'Yopiq';
  @override String get free => 'Bepul';
  @override String get total => 'Jami';
  @override String get delivery => 'Yetkazib berish';
  @override String get deliveryFee => 'Yetkazib berish narxi';
  @override String get minOrder => 'Min. buyurtma';
  @override String get productsCost => 'Mahsulotlar narxi';
  @override String itemsCount(int count) => '$count ta mahsulot';

  // Format helpers
  @override
  String formatMoney(num amount) {
    final s = amount.round().abs().toString();
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write(' ');
      buf.write(s[i]);
    }
    final numStr = (amount < 0 ? '-' : '') + buf.toString();
    return '$numStr so\'m';
  }

  @override
  String formatUnit(String? unit) {
    if (unit == null || unit.isEmpty) return unitDona;
    final lower = unit.toLowerCase();
    if (lower == 'kg') return 'kg';
    if (lower == 'litr' || lower == 'l') return 'litr';
    if (lower == 'dona' || lower == 'sht') return 'dona';
    return unit;
  }

  @override
  String qtyWithUnit(num quantity, String? unit) {
    final qStr = quantity == quantity.roundToDouble()
        ? quantity.round().toString()
        : quantity.toStringAsFixed(1);
    return '$qStr ${formatUnit(unit)}';
  }

  @override
  String statusLabel(String status) {
    switch (status) {
      case 'confirmed': return 'Tasdiqlangan';
      case 'preparing': return 'Tayyorlanmoqda';
      case 'ready': return 'Tayyor';
      case 'accepted': return 'Qabul qilindi';
      case 'delivering': return 'Yetkazilmoqda';
      case 'delivered': return 'Yetkazildi';
      case 'cancelled': return 'Bekor qilindi';
      case 'pending':
      default: return 'Yangi';
    }
  }

  @override
  String paymentLabel(String? method) {
    switch (method) {
      case 'cash': return 'Naqd (kuryerga)';
      case 'payme': return 'Payme';
      case 'click': return 'Click';
      case 'uzum': return 'Uzum';
      default: return method ?? '—';
    }
  }

  @override
  String etaLabel(int? minutes) => (minutes != null && minutes > 0) ? '~$minutes daqiqa' : null.toString();

  // Auth
  @override String get authWelcomeTitle => 'Xush kelibsiz!';
  @override String get authEnterPhone => 'Xush kelibsiz! Telefon raqamingizni kiriting';
  @override String get authPhoneLabel => 'Telefon raqami';
  @override String get authPhoneHint => '+998 90 123 45 67';
  @override String get authLoginBtn => 'Kirish';
  @override String get authTermsAgreement => 'Davom etish orqali siz ilovadan foydalanish shartlariga rozilik bildirasiz.';
  @override String get authConfirmPhoneTitle => 'Raqamni tasdiqlang';
  @override String get authConfirmPhoneDesc => 'Telefon raqamingiz sizniki ekanligiga ishonch hosil qiling:';
  @override String get authPhoneRequiredError => 'Telefon raqamingizni to\'liq kiriting';
  @override String get authEnterNameTitle => 'Ismingizni kiriting';
  @override String get authFirstNameLabel => 'Ismingiz *';
  @override String get authFirstNameHint => 'Ismingizni kiriting';
  @override String get authLastNameLabel => 'Familiyangiz (ixtiyoriy)';
  @override String get authLastNameHint => 'Familiyangizni kiriting';
  @override String get authSaveAndContinue => 'Saqlash va davom etish';
  @override String get authNameRequiredError => 'Ismingizni kiriting';
  @override String get authGeneralError => 'Kirishda xatolik yuz berdi. Qayta urinib ko\'ring';
  @override String get authSaveProfileError => 'Ma\'lumotlarni saqlashda xatolik yuz berdi';
  @override String get authChooseLanguage => 'Tilni tanlang / Выберите язык';

  // Home
  @override String get homeStoreClosed => 'Hozircha yopiq';
  @override String homeStoreOpen(int minutes) => 'Ochiq • Yetkazish ~$minutes daqiqa';
  @override String get homeSearchPlaceholder => 'Mahsulotlarni qidirish...';
  @override String get homeCategories => 'Kategoriyalar';
  @override String get homeAll => 'Barchasi';
  @override String get homeEmptyCatalog => 'Katalog bo\'sh';
  @override String get homeDeliveryService => 'Yetkazib berish xizmati';
  @override String get homeOutOfRangeTitle => 'Yetkazib berish hududidan tashqarida';
  @override String get homeOutOfRangeDesc => 'Uzr, biz hozircha sizning hududingizga mahsulotlarni yetkazib berolmaymiz';
  @override String get homeBanner1Title => 'Tezkor yetkazib berish ⚡️';
  @override String get homeBanner1Desc => 'Do\'konimizdan yangi mahsulotlar 25-35 daqiqada uyingizda';
  @override String get homeBanner2Title => 'Barakali narxlar 🛒';
  @override String get homeBanner2Desc => 'Har kuni sifatli va hamyonbop mahsulotlar xaridi';
  @override String get homeBanner3Title => 'Keng assortiment 🍎🥬';
  @override String get homeBanner3Desc => 'Do\'konimizdagi yuzlab sara mahsulotlardan tanlang';

  // Category
  @override String get categoryProducts => 'Mahsulotlar';
  @override String get categoryEmpty => 'Bu kategoriyada mahsulot yo\'q';
  @override String get categoryAllSubs => 'Barchasi';

  // Search
  @override String get searchPlaceholder => 'Mahsulotlarni qidirish...';
  @override String get searchEmptyResult => 'Hech narsa topilmadi';
  @override String get searchTryAnotherWord => 'Boshqa so\'z bilan qidirib ko\'ring';

  // Cart
  @override String get cartTitle => 'Savatcha';
  @override String get cartEmptyTitle => 'Savatchangiz bo\'sh';
  @override String get cartEmptyDesc => 'Katalogimizdan sifatli va sara mahsulotlarni tanlang';
  @override String get cartStartShopping => 'Xaridni boshlash';
  @override String get cartClearBtn => 'Tozalash';
  @override String get cartClearConfirmTitle => 'Savatchani tozalash';
  @override String get cartClearConfirmDesc => 'Barcha mahsulotlarni savatchadan o\'chirmoqchimisiz?';
  @override String get cartFreeDeliveryUnlocked => 'Yetkazib berish bepul!';
  @override String cartFreeDeliveryRemaining(num amount) => 'Bepul yetkazib berishgacha yana ${formatMoney(amount)}';
  @override String get cartCheckoutBtn => 'Rasmiylashtirish';
  @override String get cartInYourCart => 'Savatchangizda';
  @override String get cartGoToCart => 'O\'tish';

  // Checkout
  @override String get checkoutTitle => 'Rasmiylashtirish';
  @override String get checkoutDeliveryAddress => 'Yetkazish manzili';
  @override String get checkoutAddressLocating => 'Manzil aniqlanmoqda...';
  @override String get checkoutAddressPickMap => 'Xaritadan tanlash';
  @override String get checkoutAddressRefresh => 'Qayta aniqlash';
  @override String get checkoutAddressHint => 'Mo\'ljal yoki to\'liq manzil (ko\'cha, uy raqami)';
  @override String get checkoutAptHint => 'Podezd, qavat, xonadon (ixtiyoriy)';
  @override String get checkoutPhone => 'Telefon raqami';
  @override String get checkoutComment => 'Buyurtmaga izoh';
  @override String get checkoutCommentHint => 'Kuryer uchun eslatma (masalan: domofon ishlamaydi)';
  @override String get checkoutFemaleCourier => 'Ayol kishi yetkazsin';
  @override String get checkoutFemaleCourierDesc => 'Buyurtmani ayol kuryer yetkazib beradi';
  @override String get checkoutPaymentMethod => 'To\'lov turi';
  @override String get checkoutPayCash => 'Naqd (kuryerga)';
  @override String get checkoutOrderSummary => 'Buyurtma tarkibi';
  @override String get checkoutSubmitBtn => 'Buyurtma berish';
  @override String get checkoutSuccessTitle => 'Buyurtma qabul qilindi!';
  @override String get checkoutSuccessDesc => 'Buyurtmangiz muvaffaqiyatli rasmiylashtirildi';
  @override String get checkoutViewOrder => 'Buyurtmani ko\'rish';
  @override String get checkoutBackToHome => 'Bosh sahifaga qaytish';
  @override String checkoutMinOrderWarning(num minAmount) => 'Minimal buyurtma summasi: ${formatMoney(minAmount)}';
  @override String get checkoutAddressRequired => 'Yetkazish manzilini kiriting';
  @override String get checkoutPhoneRequired => 'Telefon raqamingizni kiriting';
  @override String get checkoutOutOfArea => 'Tanlangan manzil yetkazib berish hududidan tashqarida';

  // Map Picker
  @override String get mapPickTitle => 'Manzilni tanlang';
  @override String get mapMoveHint => 'Xaritani surib kerakli nuqtaga qo\'ying';
  @override String get mapConfirmBtn => 'Shu manzilni tanlash';
  @override String get mapMyLocation => 'Mening joylashuvim';

  // Orders
  @override String get ordersTitle => 'Buyurtmalar';
  @override String orderNumber(String num) => 'Buyurtma № $num';
  @override String get orderDetailsTitle => 'Buyurtma tafsiloti';
  @override String get ordersEmptyTitle => 'Hozircha buyurtmalar yo\'q';
  @override String get ordersEmptyDesc => 'Birorta buyurtma bersangiz, u shu yerda chiqadi';
  @override String get orderLoadFailed => 'Buyurtmani yuklab bo\'lmadi';
  @override String get orderPendingBanner => 'Buyurtmangiz do‘kon tomonidan ko‘rib chiqilmoqda.';
  @override String get orderJustPlacedBanner => 'Buyurtma qabul qilindi. Tez orada yetkaziladi!';
  @override String get orderCancelledBanner => 'Buyurtma bekor qilingan';
  @override String get orderCourier => 'Kuryer';
  @override String get orderCallCourier => 'Qo\'ng\'iroq qilish';
  @override String get orderReceipt => 'Chek';
  @override String get orderViewReceipt => 'Chekni ko\'rish';
  @override String get orderCancelBtn => 'Buyurtmani bekor qilish';
  @override String get orderCancelConfirmTitle => 'Buyurtmani bekor qilish';
  @override String get orderCancelConfirmDesc => 'Haqiqatan ham buyurtmani bekor qilmoqchimisiz?';
  @override String get orderStore => 'Do\'kon';
  @override String get orderAddress => 'Manzil';
  @override String get orderPayment => 'To\'lov';
  @override String get orderThankYou => 'Xaridingiz uchun rahmat! 🙏';
  @override List<String> get orderStages => const ['Yangi', 'Tayyorlash', 'Yetkazish', 'Yetkazildi'];

  // Profile
  @override String get profileTitle => 'Profil';
  @override String get profilePersonalInfo => 'Shaxsiy ma\'lumotlar';
  @override String get profileFirstName => 'Ism';
  @override String get profileLastName => 'Familiya';
  @override String get profilePhone => 'Telefon';
  @override String get profileNotSpecified => 'Kiritilmagan';
  @override String get profileSavedAddresses => 'Saqlangan manzillar';
  @override String get profileAddAddress => 'Yangi manzil qo\'shish';
  @override String get profileNoSavedAddresses => 'Saqlangan manzillar yo\'q';
  @override String get profileAppSettings => 'Ilova sozlamalari';
  @override String get profileLanguage => 'Ilova tili';
  @override String get profileSupportAndApp => 'Qo\'llab-quvvatlash va ilova';
  @override String get profileSupport => 'Texnik qo\'llab-quvvatlash';
  @override String get profilePrivacy => 'Maxfiylik siyosati';
  @override String get profileTerms => 'Ommaviy oferta';
  @override String get profileVersion => 'Ilova versiyasi';
  @override String get profileLogout => 'Hisobdan chiqish';
  @override String get profileLogoutConfirmTitle => 'Hisobdan chiqish';
  @override String get profileLogoutConfirmDesc => 'Haqiqatan ham hisobingizdan chiqmoqchimisiz?';
  @override String get profileDeleteAccount => 'Hisobni o\'chirish';
  @override String get profileDeleteAccountConfirmTitle => 'Hisobni o\'chirish';
  @override String get profileDeleteAccountConfirmDesc => 'Hisobingiz va unga tegishli barcha ma\'lumotlar butunlay o\'chiriladi. Bu amalni ortga qaytarib bo\'lmaydi.';
  @override String get profileSelectLanguage => 'Ilova tilini tanlang';
  @override String get profileLanguageChanged => 'Ilova tili muvaffaqiyatli o\'zgartirildi';

  // Contact
  @override String get contactTitle => 'Mijozlarni qo\'llab-quvvatlash';
  @override String get contactSupportBadge => '24/7 XIZMATINGIZDAMIZ';
  @override String get contactHaveQuestions => 'Savollaringiz bormi?';
  @override String get contactOperatorsReady => 'Operatorlarimiz buyurtmangiz bo\'yicha har qanday yordamni berishga tayyor.';
  @override String get contactNoInfoTitle => 'Ma\'lumot kiritilmagan';
  @override String get contactNoInfoDesc => 'Do\'kon ma\'muriyati tez orada aloqa ma\'lumotlarini kiritadi.';
  @override String get contactCallPhone => 'Telefon orqali bog\'lanish';
  @override String get contactWriteTelegram => 'Telegram orqali yozish';
  @override String get contactWorkingHours => 'Ish vaqti';
  @override String get contactWorkingHoursDesc => 'Har kuni: 09:00 - 22:00';

  // Notifications
  @override String get notificationsTitle => 'Bildirishnomalar';
  @override String get notificationsMarkAllRead => 'Barchasini o\'qildi';
  @override String get notificationsEmptyTitle => 'Hozircha bildirishnomalar yo\'q';
  @override String get notificationsEmptyDesc => 'Buyurtmangiz holati va yangiliklar shu yerda chiqadi';

  // Product
  @override String get productInStock => 'Sotuvda bor';
  @override String get productOutOfStock => 'Tugagan';
  @override String get productAbout => 'Mahsulot haqida';
  @override String get productNoDescription => 'Ushbu mahsulot uchun qo‘shimcha tavsif berilmagan. Sifatli va yangi mahsulot.';
  @override String get productAddToCart => 'Savatga qo\'shish';
  @override String productInCartQty(String qty, String unit) => '$qty $unit savatda';

  // Permissions
  @override String get permLocationTitle => 'Joylashuvingizni ulashing 📍';
  @override String get permLocationDesc => 'Sizga eng yaqin bo\'lgan filiallarni ko\'rsatish va yetkazib berish vaqtini daqiqasigacha aniq hisoblash uchun joylashuv ruxsati zarur.';
  @override String get permLocationAllow => 'Ruxsat berish';
  @override String get permLocationLater => 'Keyinroq';
  @override String get permNotificationTitle => 'Bildirishnomalarni yoqing 🔔';
  @override String get permNotificationDesc => 'Buyurtmangiz qabul qilingani, tayyorlanayotgani va kuryer yetib kelgani haqida darhol xabardor bo\'ling.';
  @override String get permNotificationAllow => 'Bildirishnomalarni yoqish';

  // Force Update
  @override String get updateRequiredTitle => 'Yangi versiya chiqdi';
  @override String get updateRequiredDesc => 'Davom etish uchun ilovani yangilang. Eski versiyada ishlash vaqtincha to\'xtatildi.';
  @override String get updateInPlayMarket => 'Play Marketda yangilash';

  // Cart sync
  @override String cartSyncItemRemoved(String name) => '"$name" sotuvdan olindi — savatdan chiqarildi';
  @override String cartSyncItemOutOfStock(String name) => '"$name" tugadi — savatdan chiqarildi';
  @override String cartSyncItemQuantityAdjusted(String name, num stock) => '"$name" — omborda $stock ta qoldi';
  @override String cartSyncItemPriceUpdated(String name) => '"$name" narxi yangilandi';
  @override String get cartSyncUpdatedTitle => 'Savat yangilandi';

  // Yangi qo'shimcha tarjimalar (Uzbek)
  @override String get cartDeliveryDependsOnAddress => 'Manzilga qarab';
  @override String get cartDeliveryAddedAtCheckout => 'Yetkazish haqi manzil tanlangach qo\'shiladi';
  @override String get cartTotalToPay => 'Jami to\'lov';
  @override String get cartTotalForProducts => 'Mahsulotlar uchun';

  @override String get checkoutStoreClosed => 'Do\'kon hozir yopiq — buyurtma qabul qilinmaydi.';
  @override String get checkoutPayCashTitle => 'Naqd pul orqali';
  @override String get checkoutPayCashSubtitle => 'Yetkazilganda kuryerga';
  @override String get checkoutFixCart => 'Savatni to\'g\'rilash kerak';
  @override String get checkoutStoreNotFound => 'Do‘kon topilmadi';
  @override String get checkoutComingSoon => 'Tez kunda';
  @override String checkoutOnlineSoon(String name) => '$name tizimi tez orada ishga tushadi. Hozircha naqd to\'lov amal qiladi.';
  @override String get checkoutCalculating => 'Hisoblanmoqda…';
  @override String checkoutFreeFrom(num from) => '${formatMoney(from)}dan bepul';
  @override String checkoutGpsLow(int meters) => 'GPS aniqligi past (~$meters m) — xaritadan belgilang';
  @override String checkoutGpsAccurate(int meters) => 'GPS aniqligi ~$meters m · manzilni qo\'lda tahrirlashingiz mumkin';
  @override String get checkoutLocInaccurate => 'Aniq joylashuv olinmadi — xaritadan tekshiring.';
  @override String get checkoutLocFailed => 'Joylashuv olinmadi. Xaritadan tanlang.';

  @override String ordersCount(int count) => '$count ta buyurtma';
  @override String ordersItemsCount(int count) => '$count xil mahsulot';
  @override String get orderDeliveryService => 'Yetkazib berish xizmati';
  @override String get orderTotalPayment => 'Jami to\'lov';
  @override String get orderDeliveryInfo => 'Yetkazish ma\'lumotlari';
  @override String get orderPaymentType => 'To\'lov turi';
  @override String get orderCommentLabel => 'Izoh';
  @override String get orderPlacedTime => 'Buyurtma vaqti';
  @override String get orderContactStore => 'Do\'kon bilan bog\'lanish';
  @override String get orderDistanceLabel => 'Masofa';
  @override String get orderEstimatedTimeLabel => 'Taxminiy vaqt';
  @override String orderReceiptNumber(String num) => 'Buyurtma raqami: № $num';

  @override String homeCategoriesCount(int count) => '$count turkum';
  @override String categorySearchPlaceholder(String cat) => '$cat bo\'yicha qidirish...';

  @override String get profileAdminContactTitle => 'Buyurtma bo\'yicha adminga bog\'lanish';
  @override String get profileAdminContactEmpty => 'Bog\'lanish ma\'lumoti kiritilmagan';
  @override String get profileCallAdmin => 'Qo\'ng\'iroq';
  @override String get profileTelegramAdmin => 'Telegram';
  @override String get profileUserFallback => 'Foydalanuvchi';
  @override String get profileEditNameTitle => 'Ismingizni o\'zgartirish';
  @override String get profileEditLastNameTitle => 'Familiyangizni o\'zgartirish';
  @override String get profileEditPhoneTitle => 'Telefon raqamini o\'zgartirish';
  @override String get profileAddAddressTitle => 'Yangi manzil qo\'shish';
  @override String get profileAddressHint => 'Masalan: Chilonzor 9, 24-uy, 15-xonadon';
  @override String get profileAddBtn => 'Qo\'shish';
  @override String get profileAddressAdded => 'Manzil qo\'shildi';
  @override String get profileAddressSaveFailed => 'Manzilni saqlab bo\'lmadi';
  @override String get profileAddressDeleted => 'Manzil o\'chirildi';
  @override String get profileDeleteFailed => 'O\'chirib bo\'lmadi';
  @override String get profileDataUpdated => 'Ma\'lumot yangilandi';
  @override String get profilePhoneAlreadyTaken => 'Bu telefon raqami band bo\'lishi mumkin';
  @override String get profileSaveFailed => 'Saqlab bo\'lmadi';
  @override String get profileAccountDeleted => 'Hisobingiz muvaffaqiyatli o\'chirildi';
  @override String get profileDeleteAccountWarning => 'Haqiqatan ham hisobingizni o\'chirmoqchimisiz? Barcha shaxsiy ma\'lumotlaringiz, buyurtmalar tarixi va saqlangan manzillaringiz qaytarib bo\'lmas darajada o\'chiriladi.';

  @override String get splashSlogan => 'Tezkor va sifatli yetkazib berish';
  @override String get networkSlow => 'Internet sekin ishlayapti. Mobil tarmoqni tekshiring.';
  @override String get networkNoConnection => 'Internet aloqasi yo\'q. Mobil tarmoqni yoqib ko\'ring.';
  @override String get generalError => 'Xatolik yuz berdi';
}

/// ============================================================================
/// RUSCHA TARJIMALAR (РУССКИЙ ЯЗЫК)
/// ============================================================================
class _StringsRu implements AppStrings {
  _StringsRu._();
  static final _StringsRu instance = _StringsRu._();

  @override
  String get appName => 'Barakali Bozor';

  // Bottom Navigation
  @override String get navHome => 'Главная';
  @override String get navSearch => 'Поиск';
  @override String get navOrders => 'Заказы';
  @override String get navProfile => 'Профиль';

  // Umumiy
  @override String get cancel => 'Отмена';
  @override String get save => 'Сохранить';
  @override String get delete => 'Удалить';
  @override String get edit => 'Изменить';
  @override String get confirm => 'Подтвердить';
  @override String get continueBtn => 'Продолжить';
  @override String get retry => 'Повторить';
  @override String get close => 'Закрыть';
  @override String get back => 'Назад';
  @override String get clear => 'Очистить';
  @override String get loading => 'Загрузка...';
  @override String get errorOccurred => 'Произошла ошибка';
  @override String get networkError => 'Нет связи';
  @override String get noInternetConnection => 'Нет подключения к интернету';
  @override String get success => 'Успешно';
  @override String get currency => 'сум';
  @override String get unitKg => 'кг';
  @override String get unitLitr => 'л';
  @override String get unitDona => 'шт';
  @override String get unitMinShort => 'мин';
  @override String get unitMinute => 'минут';
  @override String get open => 'Открыто';
  @override String get closed => 'Закрыто';
  @override String get free => 'Бесплатно';
  @override String get total => 'Итого';
  @override String get delivery => 'Доставка';
  @override String get deliveryFee => 'Стоимость доставки';
  @override String get minOrder => 'Мин. заказ';
  @override String get productsCost => 'Стоимость товаров';
  @override String itemsCount(int count) => '$count тов.';

  // Format helpers
  @override
  String formatMoney(num amount) {
    final s = amount.round().abs().toString();
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write(' ');
      buf.write(s[i]);
    }
    final numStr = (amount < 0 ? '-' : '') + buf.toString();
    return '$numStr сум';
  }

  @override
  String formatUnit(String? unit) {
    if (unit == null || unit.isEmpty) return unitDona;
    final lower = unit.toLowerCase();
    if (lower == 'kg' || lower == 'кг') return 'кг';
    if (lower == 'litr' || lower == 'l' || lower == 'л') return 'л';
    if (lower == 'dona' || lower == 'sht' || lower == 'шт') return 'шт';
    return unit;
  }

  @override
  String qtyWithUnit(num quantity, String? unit) {
    final qStr = quantity == quantity.roundToDouble()
        ? quantity.round().toString()
        : quantity.toStringAsFixed(1);
    return '$qStr ${formatUnit(unit)}';
  }

  @override
  String statusLabel(String status) {
    switch (status) {
      case 'confirmed': return 'Подтверждён';
      case 'preparing': return 'Готовится';
      case 'ready': return 'Готов';
      case 'accepted': return 'Принят';
      case 'delivering': return 'В пути';
      case 'delivered': return 'Доставлен';
      case 'cancelled': return 'Отменён';
      case 'pending':
      default: return 'Новый';
    }
  }

  @override
  String paymentLabel(String? method) {
    switch (method) {
      case 'cash': return 'Наличные (курьеру)';
      case 'payme': return 'Payme';
      case 'click': return 'Click';
      case 'uzum': return 'Uzum';
      default: return method ?? '—';
    }
  }

  @override
  String etaLabel(int? minutes) => (minutes != null && minutes > 0) ? '~$minutes мин' : null.toString();

  // Auth
  @override String get authWelcomeTitle => 'Добро пожаловать!';
  @override String get authEnterPhone => 'Добро пожаловать! Введите номер телефона';
  @override String get authPhoneLabel => 'Номер телефона';
  @override String get authPhoneHint => '+998 90 123 45 67';
  @override String get authLoginBtn => 'Войти';
  @override String get authTermsAgreement => 'Продолжая, вы соглашаетесь с условиями использования.';
  @override String get authConfirmPhoneTitle => 'Подтвердите номер';
  @override String get authConfirmPhoneDesc => 'Убедитесь, что это ваш номер телефона:';
  @override String get authPhoneRequiredError => 'Введите номер телефона полностью';
  @override String get authEnterNameTitle => 'Введите ваше имя';
  @override String get authFirstNameLabel => 'Ваше имя *';
  @override String get authFirstNameHint => 'Введите ваше имя';
  @override String get authLastNameLabel => 'Фамилия (необязательно)';
  @override String get authLastNameHint => 'Введите вашу фамилию';
  @override String get authSaveAndContinue => 'Сохранить и продолжить';
  @override String get authNameRequiredError => 'Пожалуйста, введите ваше имя';
  @override String get authGeneralError => 'Ошибка при входе. Попробуйте снова';
  @override String get authSaveProfileError => 'Ошибка при сохранении данных';
  @override String get authChooseLanguage => 'Tilni tanlang / Выберите язык';

  // Home
  @override String get homeStoreClosed => 'Сейчас закрыто';
  @override String homeStoreOpen(int minutes) => 'Открыто • Доставка ~$minutes мин';
  @override String get homeSearchPlaceholder => 'Поиск товаров...';
  @override String get homeCategories => 'Категории';
  @override String get homeAll => 'Все';
  @override String get homeEmptyCatalog => 'Каталог пуст';
  @override String get homeDeliveryService => 'Служба доставки';
  @override String get homeOutOfRangeTitle => 'Вне зоны доставки';
  @override String get homeOutOfRangeDesc => 'Извините, мы пока не доставляем в ваш район';
  @override String get homeBanner1Title => 'Быстрая доставка ⚡️';
  @override String get homeBanner1Desc => 'Свежие продукты из нашего магазина у вас дома за 25-35 минут';
  @override String get homeBanner2Title => 'Выгодные цены 🛒';
  @override String get homeBanner2Desc => 'Качественные и доступные товары каждый день';
  @override String get homeBanner3Title => 'Широкий ассортимент 🍎🥬';
  @override String get homeBanner3Desc => 'Выбирайте из сотен отборных товаров в нашем магазине';

  // Category
  @override String get categoryProducts => 'Товары';
  @override String get categoryEmpty => 'В этой категории нет товаров';
  @override String get categoryAllSubs => 'Все';

  // Search
  @override String get searchPlaceholder => 'Поиск товаров...';
  @override String get searchEmptyResult => 'Ничего не найдено';
  @override String get searchTryAnotherWord => 'Попробуйте поискать по другому слову';

  // Cart
  @override String get cartTitle => 'Корзина';
  @override String get cartEmptyTitle => 'Ваша корзина пуста';
  @override String get cartEmptyDesc => 'Выберите качественные и отборные товары из каталога';
  @override String get cartStartShopping => 'Перейти к покупкам';
  @override String get cartClearBtn => 'Очистить';
  @override String get cartClearConfirmTitle => 'Очистить корзину';
  @override String get cartClearConfirmDesc => 'Вы действительно хотите удалить все товары из корзины?';
  @override String get cartFreeDeliveryUnlocked => 'Бесплатная доставка!';
  @override String cartFreeDeliveryRemaining(num amount) => 'До бесплатной доставки ещё ${formatMoney(amount)}';
  @override String get cartCheckoutBtn => 'Оформить заказ';
  @override String get cartInYourCart => 'В вашей корзине';
  @override String get cartGoToCart => 'Перейти';

  // Checkout
  @override String get checkoutTitle => 'Оформление заказа';
  @override String get checkoutDeliveryAddress => 'Адрес доставки';
  @override String get checkoutAddressLocating => 'Определение адреса...';
  @override String get checkoutAddressPickMap => 'Выбрать на карте';
  @override String get checkoutAddressRefresh => 'Определить снова';
  @override String get checkoutAddressHint => 'Ориентир или полный адрес (улица, дом)';
  @override String get checkoutAptHint => 'Подъезд, этаж, кв. (необязательно)';
  @override String get checkoutPhone => 'Номер телефона';
  @override String get checkoutComment => 'Комментарий к заказу';
  @override String get checkoutCommentHint => 'Примечание для курьера (например: не работает домофон)';
  @override String get checkoutFemaleCourier => 'Пусть заказ доставит женщина';
  @override String get checkoutFemaleCourierDesc => 'Заказ будет доставлен женщиной-курьером';
  @override String get checkoutPaymentMethod => 'Способ оплаты';
  @override String get checkoutPayCash => 'Наличные (курьеру)';
  @override String get checkoutOrderSummary => 'Состав заказа';
  @override String get checkoutSubmitBtn => 'Оформить заказ';
  @override String get checkoutSuccessTitle => 'Заказ принят!';
  @override String get checkoutSuccessDesc => 'Ваш заказ успешно оформлен';
  @override String get checkoutViewOrder => 'Посмотреть заказ';
  @override String get checkoutBackToHome => 'На главную';
  @override String checkoutMinOrderWarning(num minAmount) => 'Минимальная сумма заказа: ${formatMoney(minAmount)}';
  @override String get checkoutAddressRequired => 'Пожалуйста, укажите адрес доставки';
  @override String get checkoutPhoneRequired => 'Пожалуйста, укажите номер телефона';
  @override String get checkoutOutOfArea => 'Выбранный адрес находится вне зоны доставки';

  // Map Picker
  @override String get mapPickTitle => 'Выберите адрес';
  @override String get mapMoveHint => 'Переместите карту в нужную точку';
  @override String get mapConfirmBtn => 'Выбрать этот адрес';
  @override String get mapMyLocation => 'Моё местоположение';

  // Orders
  @override String get ordersTitle => 'Заказы';
  @override String orderNumber(String num) => 'Заказ № $num';
  @override String get orderDetailsTitle => 'Детали заказа';
  @override String get ordersEmptyTitle => 'Заказов пока нет';
  @override String get ordersEmptyDesc => 'Когда вы сделаете заказ, он появится здесь';
  @override String get orderLoadFailed => 'Не удалось загрузить заказ';
  @override String get orderPendingBanner => 'Ваш заказ рассматривается магазином.';
  @override String get orderJustPlacedBanner => 'Заказ принят. Скоро будет доставлен!';
  @override String get orderCancelledBanner => 'Заказ отменён';
  @override String get orderCourier => 'Курьер';
  @override String get orderCallCourier => 'Позвонить';
  @override String get orderReceipt => 'Чек';
  @override String get orderViewReceipt => 'Посмотреть чек';
  @override String get orderCancelBtn => 'Отменить заказ';
  @override String get orderCancelConfirmTitle => 'Отменить заказ';
  @override String get orderCancelConfirmDesc => 'Вы действительно хотите отменить заказ?';
  @override String get orderStore => 'Магазин';
  @override String get orderAddress => 'Адрес';
  @override String get orderPayment => 'Оплата';
  @override String get orderThankYou => 'Спасибо за покупку! 🙏';
  @override List<String> get orderStages => const ['Новый', 'Готовится', 'В пути', 'Доставлен'];

  // Profile
  @override String get profileTitle => 'Профиль';
  @override String get profilePersonalInfo => 'Личные данные';
  @override String get profileFirstName => 'Имя';
  @override String get profileLastName => 'Фамилия';
  @override String get profilePhone => 'Телефон';
  @override String get profileNotSpecified => 'Не указано';
  @override String get profileSavedAddresses => 'Сохранённые адреса';
  @override String get profileAddAddress => 'Добавить адрес';
  @override String get profileNoSavedAddresses => 'Нет сохранённых адресов';
  @override String get profileAppSettings => 'Настройки приложения';
  @override String get profileLanguage => 'Язык приложения';
  @override String get profileSupportAndApp => 'Поддержка и приложение';
  @override String get profileSupport => 'Техническая поддержка';
  @override String get profilePrivacy => 'Политика конфиденциальности';
  @override String get profileTerms => 'Публичная оферта';
  @override String get profileVersion => 'Версия приложения';
  @override String get profileLogout => 'Выйти из аккаунта';
  @override String get profileLogoutConfirmTitle => 'Выход из аккаунта';
  @override String get profileLogoutConfirmDesc => 'Вы действительно хотите выйти из своего аккаунта?';
  @override String get profileDeleteAccount => 'Удалить аккаунт';
  @override String get profileDeleteAccountConfirmTitle => 'Удаление аккаунта';
  @override String get profileDeleteAccountConfirmDesc => 'Ваш аккаунт и все связанные с ним данные будут безвозвратно удалены. Это действие нельзя отменить.';
  @override String get profileSelectLanguage => 'Выберите язык приложения';
  @override String get profileLanguageChanged => 'Язык приложения успешно изменён';

  // Contact
  @override String get contactTitle => 'Служба поддержки';
  @override String get contactSupportBadge => '24/7 К ВАШИМ УСЛУГАМ';
  @override String get contactHaveQuestions => 'Есть вопросы?';
  @override String get contactOperatorsReady => 'Наши операторы готовы помочь по любому вопросу вашего заказа.';
  @override String get contactNoInfoTitle => 'Информация не указана';
  @override String get contactNoInfoDesc => 'Администрация магазина скоро добавит контактную информацию.';
  @override String get contactCallPhone => 'Связаться по телефону';
  @override String get contactWriteTelegram => 'Написать в Telegram';
  @override String get contactWorkingHours => 'Время работы';
  @override String get contactWorkingHoursDesc => 'Ежедневно: 09:00 - 22:00';

  // Notifications
  @override String get notificationsTitle => 'Уведомления';
  @override String get notificationsMarkAllRead => 'Прочитать все';
  @override String get notificationsEmptyTitle => 'Уведомлений пока нет';
  @override String get notificationsEmptyDesc => 'Здесь будут отображаться статусы ваших заказов и новости';

  // Product
  @override String get productInStock => 'В наличии';
  @override String get productOutOfStock => 'Нет в наличии';
  @override String get productAbout => 'О товаре';
  @override String get productNoDescription => 'Для этого товара описание не указано. Качественный и свежий продукт.';
  @override String get productAddToCart => 'В корзину';
  @override String productInCartQty(String qty, String unit) => '$qty $unit в корзине';

  // Permissions
  @override String get permLocationTitle => 'Разрешите доступ к геолокации 📍';
  @override String get permLocationDesc => 'Доступ к геолокации необходим для определения ближайшего магазина и точного времени доставки.';
  @override String get permLocationAllow => 'Разрешить доступ';
  @override String get permLocationLater => 'Позже';
  @override String get permNotificationTitle => 'Включите уведомления 🔔';
  @override String get permNotificationDesc => 'Узнавайте первыми о подтверждении заказа, его готовности и прибытии курьера.';
  @override String get permNotificationAllow => 'Включить уведомления';

  // Force Update
  @override String get updateRequiredTitle => 'Доступна новая версия';
  @override String get updateRequiredDesc => 'Пожалуйста, обновите приложение. Работа со старой версией временно приостановлена.';
  @override String get updateInPlayMarket => 'Обновить в Play Market';

  // Cart sync
  @override String cartSyncItemRemoved(String name) => '"$name" снят с продажи — удалён из корзины';
  @override String cartSyncItemOutOfStock(String name) => '"$name" закончился — удалён из корзины';
  @override String cartSyncItemQuantityAdjusted(String name, num stock) => '"$name" — на складе осталось $stock шт';
  @override String cartSyncItemPriceUpdated(String name) => 'Цена на "$name" обновлена';
  @override String get cartSyncUpdatedTitle => 'Корзина обновлена';

  // Новые дополнительные переводы (Русский)
  @override String get cartDeliveryDependsOnAddress => 'По адресу';
  @override String get cartDeliveryAddedAtCheckout => 'Стоимость доставки добавится после выбора адреса';
  @override String get cartTotalToPay => 'Итого к оплате';
  @override String get cartTotalForProducts => 'За товары';

  @override String get checkoutStoreClosed => 'Магазин сейчас закрыт — заказы не принимаются.';
  @override String get checkoutPayCashTitle => 'Наличными';
  @override String get checkoutPayCashSubtitle => 'Курьеру при получении';
  @override String get checkoutFixCart => 'Необходимо исправить корзину';
  @override String get checkoutStoreNotFound => 'Магазин не найден';
  @override String get checkoutComingSoon => 'Скоро';
  @override String checkoutOnlineSoon(String name) => 'Оплата через $name скоро появится. Пока доступна оплата наличными.';
  @override String get checkoutCalculating => 'Расчёт…';
  @override String checkoutFreeFrom(num from) => 'Бесплатно от ${formatMoney(from)}';
  @override String checkoutGpsLow(int meters) => 'Низкая точность GPS (~$meters м) — укажите на карте';
  @override String checkoutGpsAccurate(int meters) => 'Точность GPS ~$meters м · адрес можно изменить вручную';
  @override String get checkoutLocInaccurate => 'Точное местоположение не определено — проверьте на карте.';
  @override String get checkoutLocFailed => 'Не удалось определить местоположение. Выберите на карте.';

  @override String ordersCount(int count) => '$count зак.';
  @override String ordersItemsCount(int count) => '$count тов.';
  @override String get orderDeliveryService => 'Служба доставки';
  @override String get orderTotalPayment => 'Итого к оплате';
  @override String get orderDeliveryInfo => 'Информация о доставке';
  @override String get orderPaymentType => 'Способ оплаты';
  @override String get orderCommentLabel => 'Комментарий';
  @override String get orderPlacedTime => 'Время заказа';
  @override String get orderContactStore => 'Связаться с магазином';
  @override String get orderDistanceLabel => 'Расстояние';
  @override String get orderEstimatedTimeLabel => 'Примерное время';
  @override String orderReceiptNumber(String num) => 'Номер заказа: № $num';

  @override String homeCategoriesCount(int count) => '$count подкат.';
  @override String categorySearchPlaceholder(String cat) => 'Поиск по $cat...';

  @override String get profileAdminContactTitle => 'Связаться с администратором по заказу';
  @override String get profileAdminContactEmpty => 'Контактная информация не указана';
  @override String get profileCallAdmin => 'Позвонить';
  @override String get profileTelegramAdmin => 'Telegram';
  @override String get profileUserFallback => 'Пользователь';
  @override String get profileEditNameTitle => 'Изменить имя';
  @override String get profileEditLastNameTitle => 'Изменить фамилию';
  @override String get profileEditPhoneTitle => 'Изменить номер телефона';
  @override String get profileAddAddressTitle => 'Добавить новый адрес';
  @override String get profileAddressHint => 'Например: Чиланзар 9, дом 24, кв. 15';
  @override String get profileAddBtn => 'Добавить';
  @override String get profileAddressAdded => 'Адрес добавлен';
  @override String get profileAddressSaveFailed => 'Не удалось сохранить адрес';
  @override String get profileAddressDeleted => 'Адрес удалён';
  @override String get profileDeleteFailed => 'Не удалось удалить';
  @override String get profileDataUpdated => 'Данные обновлены';
  @override String get profilePhoneAlreadyTaken => 'Этот номер телефона уже занят';
  @override String get profileSaveFailed => 'Не удалось сохранить';
  @override String get profileAccountDeleted => 'Ваш аккаунт успешно удалён';
  @override String get profileDeleteAccountWarning => 'Вы действительно хотите удалить аккаунт? Все ваши личные данные, история заказов и сохранённые адреса будут удалены безвозвратно.';

  @override String get splashSlogan => 'Быстрая и качественная доставка';
  @override String get networkSlow => 'Медленный интернет. Проверьте сеть.';
  @override String get networkNoConnection => 'Нет подключения к интернету. Проверьте мобильную связь.';
  @override String get generalError => 'Произошла ошибка';
}
