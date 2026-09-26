/// Server hisoblagan yakuniy summa (`POST /orders/quote`).
///
/// Ilova yetkazish haqini O'ZI hisoblamaydi: avval `free_delivery_from` "minimal
/// buyurtma", `delivery_fee` esa qat'iy narx deb qabul qilinardi — aslida
/// serverda ular "bepul yetkazish chegarasi" va "1 km narxi". Natijada
/// ekrandagi summa haqiqiy yozilgan summadan farq qilardi.
class QuoteIssue {
  QuoteIssue({
    required this.productId,
    required this.nameUz,
    this.nameRu = '',
    required this.reason,
    required this.availableStock,
    required this.message,
  });

  final int productId;
  final String nameUz;
  final String nameRu;

  /// "unavailable" — sotuvdan olingan; "out_of_stock" — qoldiq yetmaydi.
  final String reason;
  final double availableStock;
  final String message;

  String localizedMessage(String lang) {
    if (lang == 'ru') {
      final name = nameRu.isNotEmpty ? nameRu : nameUz;
      switch (reason) {
        case 'unavailable':
          return '"$name" снят с продажи — удалите из корзины';
        case 'out_of_stock':
          return availableStock <= 0
              ? '"$name" закончился — удалите из корзины'
              : '"$name" — доступно только ${availableStock.toInt()} шт';
        case 'price_changed':
          return 'Цена на "$name" изменилась';
        default:
          return message;
      }
    }
    return message;
  }

  factory QuoteIssue.fromJson(Map<String, dynamic> json) => QuoteIssue(
        productId: json['product_id'] as int,
        nameUz: (json['name_uz'] ?? '') as String,
        nameRu: (json['name_ru'] ?? '') as String,
        reason: (json['reason'] ?? '') as String,
        availableStock: (json['available_stock'] as num?)?.toDouble() ?? 0,
        message: (json['message'] ?? '') as String,
      );
}

class OrderQuote {
  OrderQuote({
    required this.itemsTotal,
    required this.deliveryFee,
    required this.total,
    required this.freeDeliveryFrom,
    required this.deliveryFeeKnown,
    required this.isOpen,
    this.distanceKm,
    this.issues = const [],
  });

  final int itemsTotal;
  final int deliveryFee;
  final int total;

  /// Shu summadan boshlab yetkazish bepul (do'kon sozlamasi).
  final int freeDeliveryFrom;

  /// Manzil hali tanlanmagan bo'lsa yetkazish haqi taxminiy — `false`.
  final bool deliveryFeeKnown;
  final bool isOpen;
  final double? distanceKm;
  final List<QuoteIssue> issues;

  bool get hasIssues => issues.isNotEmpty;
  bool get isFreeDelivery => deliveryFee == 0;

  factory OrderQuote.fromJson(Map<String, dynamic> json) => OrderQuote(
        itemsTotal: (json['items_total'] as num?)?.toInt() ?? 0,
        deliveryFee: (json['delivery_fee'] as num?)?.toInt() ?? 0,
        total: (json['total'] as num?)?.toInt() ?? 0,
        freeDeliveryFrom: (json['free_delivery_from'] as num?)?.toInt() ?? 0,
        deliveryFeeKnown: json['delivery_fee_known'] ?? false,
        isOpen: json['is_open'] ?? true,
        distanceKm: (json['distance_km'] as num?)?.toDouble(),
        issues: (json['issues'] as List?)
                ?.map((e) => QuoteIssue.fromJson(e as Map<String, dynamic>))
                .toList() ??
            const [],
      );
}
