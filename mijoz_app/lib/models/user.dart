class User {
  final int id;
  final String? firstName;
  final String? lastName;
  final String? phone;
  final String language;
  final String? createdAt;

  User({
    required this.id,
    this.firstName,
    this.lastName,
    this.phone,
    required this.language,
    this.createdAt,
  });

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'] as int,
        firstName: json['first_name'] as String?,
        lastName: json['last_name'] as String?,
        phone: json['phone'] as String?,
        language: (json['language'] ?? 'uz') as String,
        createdAt: json['created_at'] as String?,
      );
}

class Address {
  final int id;
  final String label;
  final String addressLine;
  final double? lat;
  final double? lng;
  final String? entrance;
  final String? floor;
  final String? apartment;
  final String? comment;

  Address({
    required this.id,
    required this.label,
    required this.addressLine,
    this.lat,
    this.lng,
    this.entrance,
    this.floor,
    this.apartment,
    this.comment,
  });

  factory Address.fromJson(Map<String, dynamic> json) => Address(
        id: json['id'] as int,
        label: (json['label'] ?? '') as String,
        addressLine: (json['address_line'] ?? '') as String,
        lat: json['lat'] != null ? (json['lat'] as num).toDouble() : null,
        lng: json['lng'] != null ? (json['lng'] as num).toDouble() : null,
        entrance: json['entrance'] as String?,
        floor: json['floor'] as String?,
        apartment: json['apartment'] as String?,
        comment: json['comment'] as String?,
      );
}
