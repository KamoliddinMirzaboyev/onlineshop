int _toInt(dynamic v) => (v is num) ? v.toInt() : (int.tryParse(v?.toString() ?? '') ?? 0);

class Product {
  final int id;
  final int restaurantId;
  final int categoryId;
  final String nameUz;
  final String nameRu;
  final String? descriptionUz;
  final String? descriptionRu;
  final String? imageUrl;
  final int price;
  final String? unit;
  final bool isAvailable;
  /// Ombor qoldig'i. Server buyurtmani `stock >= miqdor` bo'lmasa rad etadi —
  /// shuning uchun ilova ham xuddi shu qoidaga qarab "Tugagan" ko'rsatadi.
  final double stock;

  Product({
    required this.id, required this.restaurantId, required this.categoryId,
    required this.nameUz, required this.nameRu, this.descriptionUz,
    this.descriptionRu, this.imageUrl, required this.price,
    this.unit, required this.isAvailable, this.stock = 0,
  });

  /// Sotib olish mumkinmi — sotuvda va qoldig'i bor.
  bool get inStock => isAvailable && stock > 0;

  /// Savatga qo'shish mumkin bo'lgan eng ko'p miqdor (butun dona).
  /// Sotuvdan olingan mahsulot uchun 0 — barcha chaqiruvchilar shu yagona
  /// chegaradan o'tadi (savat, stepper).
  int get maxQuantity => inStock ? stock.floor() : 0;

  factory Product.fromJson(Map<String, dynamic> json) => Product(
    id: json['id'] as int,
    restaurantId: json['restaurant_id'] as int,
    categoryId: json['category_id'] as int,
    nameUz: (json['name_uz'] ?? '') as String,
    nameRu: (json['name_ru'] ?? '') as String,
    descriptionUz: json['description_uz'] as String?,
    descriptionRu: json['description_ru'] as String?,
    imageUrl: json['image_url'] as String?,
    price: _toInt(json['price']),
    unit: json['unit'] as String?,
    isAvailable: json['is_available'] ?? true,
    stock: (json['stock'] as num?)?.toDouble() ?? 0,
  );
  Map<String, dynamic> toJson() => {
    'id': id,
    'restaurant_id': restaurantId,
    'category_id': categoryId,
    'name_uz': nameUz,
    'name_ru': nameRu,
    'description_uz': descriptionUz,
    'description_ru': descriptionRu,
    'image_url': imageUrl,
    'price': price,
    'unit': unit,
    'is_available': isAvailable,
    'stock': stock,
  };
}

class Subcategory {
  final int id;
  final String nameUz;
  final String nameRu;
  final String? imageUrl;
  final int sortOrder;
  final List<Product> products;

  Subcategory({
    required this.id, required this.nameUz, required this.nameRu,
    this.imageUrl, required this.sortOrder, required this.products,
  });

  factory Subcategory.fromJson(Map<String, dynamic> json) => Subcategory(
    id: json['id'], nameUz: json['name_uz'], nameRu: json['name_ru'],
    imageUrl: json['image_url'], sortOrder: json['sort_order'],
    products: (json['products'] as List?)?.map((e) => Product.fromJson(e)).toList() ?? [],
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'name_uz': nameUz,
    'name_ru': nameRu,
    'image_url': imageUrl,
    'sort_order': sortOrder,
    'products': products.map((e) => e.toJson()).toList(),
  };
}

class Category {
  final int id;
  final int? groupId;
  final String nameUz;
  final String nameRu;
  final String? imageUrl;
  final int sortOrder;
  final String? bgColor;
  final List<Subcategory> subcategories;

  Category({
    required this.id, this.groupId, required this.nameUz, required this.nameRu,
    this.imageUrl, required this.sortOrder, this.bgColor, required this.subcategories,
  });

  factory Category.fromJson(Map<String, dynamic> json) => Category(
    id: json['id'], groupId: json['group_id'], nameUz: json['name_uz'],
    nameRu: json['name_ru'], imageUrl: json['image_url'], sortOrder: json['sort_order'],
    bgColor: json['bg_color'] as String?,
    subcategories: (json['subcategories'] as List?)?.map((e) => Subcategory.fromJson(e)).toList() ?? [],
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'group_id': groupId,
    'name_uz': nameUz,
    'name_ru': nameRu,
    'image_url': imageUrl,
    'sort_order': sortOrder,
    'bg_color': bgColor,
    'subcategories': subcategories.map((e) => e.toJson()).toList(),
  };
}

class CategoryGroup {
  final int id;
  final String nameUz;
  final String nameRu;
  final int sortOrder;
  final String? bgColor;

  CategoryGroup({
    required this.id, required this.nameUz, required this.nameRu,
    required this.sortOrder, this.bgColor,
  });

  factory CategoryGroup.fromJson(Map<String, dynamic> json) => CategoryGroup(
    id: json['id'], nameUz: json['name_uz'], nameRu: json['name_ru'], sortOrder: json['sort_order'],
    bgColor: json['bg_color'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'name_uz': nameUz,
    'name_ru': nameRu,
    'sort_order': sortOrder,
    'bg_color': bgColor,
  };
}

class BannerItem {
  final int id;
  final String title;
  final String? subtitle;
  final String? imageUrl;
  final String? linkUrl;
  final int sortOrder;

  BannerItem({
    required this.id,
    required this.title,
    this.subtitle,
    this.imageUrl,
    this.linkUrl,
    this.sortOrder = 0,
  });

  factory BannerItem.fromJson(Map<String, dynamic> json) => BannerItem(
    id: json['id'] as int,
    title: (json['title'] ?? '') as String,
    subtitle: json['subtitle'] as String?,
    imageUrl: json['image_url'] as String?,
    linkUrl: json['link_url'] as String?,
    sortOrder: _toInt(json['sort_order']),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'subtitle': subtitle,
    'image_url': imageUrl,
    'link_url': linkUrl,
    'sort_order': sortOrder,
  };
}

class RestaurantDetail {
  final int id;
  final String name;
  final String? address;
  final List<String> phones;
  final Map<String, String> socials;
  final List<Category> categories;
  final List<CategoryGroup> categoryGroups;
  final List<BannerItem> banners;
  final int deliveryFee;
  final int minOrder;
  final int avgDeliveryMinutes;
  final bool isOpen;

  RestaurantDetail({
    required this.id, required this.name, this.address,
    required this.phones, required this.socials, required this.categories,
    required this.categoryGroups, this.banners = const [],
    required this.deliveryFee,
    required this.minOrder, required this.avgDeliveryMinutes,
    this.isOpen = true,
  });

  factory RestaurantDetail.fromJson(Map<String, dynamic> json) => RestaurantDetail(
    id: json['id'], name: json['name'], address: json['address'],
    phones: (json['phones'] as List?)?.map((e) => e.toString()).toList() ?? [],
    socials: (json['socials'] as Map?)?.map((k, v) => MapEntry(k.toString(), v.toString())) ?? {},
    categories: (json['categories'] as List?)?.map((e) => Category.fromJson(e)).toList() ?? [],
    categoryGroups: (json['category_groups'] as List?)?.map((e) => CategoryGroup.fromJson(e)).toList() ?? [],
    banners: (json['banners'] as List?)?.map((e) => BannerItem.fromJson(e)).toList() ?? [],
    isOpen: json['is_open'] ?? true,
    deliveryFee: _toInt(json['delivery_fee']),
    minOrder: _toInt(json['min_order']),
    avgDeliveryMinutes: _toInt(json['avg_delivery_minutes']),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'address': address,
    'phones': phones,
    'socials': socials,
    'categories': categories.map((e) => e.toJson()).toList(),
    'category_groups': categoryGroups.map((e) => e.toJson()).toList(),
    'banners': banners.map((e) => e.toJson()).toList(),
    'is_open': isOpen,
    'delivery_fee': deliveryFee,
    'min_order': minOrder,
    'avg_delivery_minutes': avgDeliveryMinutes,
  };
}
