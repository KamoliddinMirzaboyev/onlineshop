/// Data models mirroring `src/types.ts`.
library;

double? _toDouble(dynamic v) => v == null ? null : (v as num).toDouble();
int? _toInt(dynamic v) => v == null ? null : (v as num).toInt();

class OrderItem {
  OrderItem({
    required this.id,
    required this.nameUz,
    required this.nameRu,
    this.imageUrl,
    required this.price,
    required this.quantity,
    this.unit,
    this.note,
  });

  final int id;
  final String nameUz;
  final String nameRu;
  final String? imageUrl;
  final num price;
  final num quantity;
  final String? unit;
  final String? note;

  factory OrderItem.fromJson(Map<String, dynamic> j) => OrderItem(
        id: j['id'] as int,
        nameUz: (j['name_uz'] ?? '') as String,
        nameRu: (j['name_ru'] ?? '') as String,
        imageUrl: j['image_url'] as String?,
        price: (j['price'] ?? 0) as num,
        quantity: (j['quantity'] ?? 0) as num,
        unit: j['unit'] as String?,
        note: j['note'] as String?,
      );
}

class Order {
  Order({
    required this.id,
    required this.number,
    required this.restaurantId,
    required this.status,
    this.paymentMethod,
    this.paymentStatus,
    required this.itemsTotal,
    required this.deliveryFee,
    required this.total,
    required this.addressLine,
    this.lat,
    this.lng,
    this.phone,
    this.comment,
    this.distanceKm,
    this.etaMinutes,
    this.assignedCourierId,
    this.assignedCourierName,
    this.assignedCourierPhone,
    required this.createdAt,
    required this.items,
  });

  final int id;
  final String number;
  final int restaurantId;
  final String status;
  final String? paymentMethod;
  final String? paymentStatus;
  final num itemsTotal;
  final num deliveryFee;
  final num total;
  final String addressLine;
  final double? lat;
  final double? lng;
  final String? phone;
  final String? comment;
  final double? distanceKm;
  final int? etaMinutes;
  final int? assignedCourierId;
  final String? assignedCourierName;
  final String? assignedCourierPhone;
  final String createdAt;
  final List<OrderItem> items;

  factory Order.fromJson(Map<String, dynamic> j) => Order(
        id: j['id'] as int,
        number: (j['number'] ?? '') as String,
        restaurantId: (j['restaurant_id'] ?? 0) as int,
        status: (j['status'] ?? 'pending') as String,
        paymentMethod: j['payment_method'] as String?,
        paymentStatus: j['payment_status'] as String?,
        itemsTotal: (j['items_total'] ?? 0) as num,
        deliveryFee: (j['delivery_fee'] ?? 0) as num,
        total: (j['total'] ?? 0) as num,
        addressLine: (j['address_line'] ?? '') as String,
        lat: _toDouble(j['lat']),
        lng: _toDouble(j['lng']),
        phone: j['phone'] as String?,
        comment: j['comment'] as String?,
        distanceKm: _toDouble(j['distance_km']),
        etaMinutes: _toInt(j['eta_minutes']),
        assignedCourierId: _toInt(j['assigned_courier_id']),
        assignedCourierName: j['assigned_courier_name'] as String?,
        assignedCourierPhone: j['assigned_courier_phone'] as String?,
        createdAt: (j['created_at'] ?? '') as String,
        items: ((j['items'] ?? []) as List)
            .map((e) => OrderItem.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  static List<Order> listFrom(dynamic json) =>
      (json as List).map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
}
