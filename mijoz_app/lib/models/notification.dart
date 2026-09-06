class AppNotification {
  AppNotification({
    required this.id,
    required this.kind,
    required this.title,
    required this.body,
    this.imageUrl,
    this.orderId,
    required this.isRead,
    required this.createdAt,
  });

  final int id;
  final String kind; // order_status | broadcast
  final String title;
  final String body;
  final String? imageUrl;
  final int? orderId;
  final bool isRead;
  final String createdAt;

  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
        id: j['id'] as int,
        kind: (j['kind'] ?? 'order_status') as String,
        title: (j['title'] ?? '') as String,
        body: (j['body'] ?? '') as String,
        imageUrl: j['image_url'] as String?,
        orderId: j['order_id'] as int?,
        isRead: (j['is_read'] ?? false) as bool,
        createdAt: (j['created_at'] ?? '') as String,
      );

  static List<AppNotification> listFrom(dynamic json) =>
      (json as List).map((e) => AppNotification.fromJson(e as Map<String, dynamic>)).toList();
}
