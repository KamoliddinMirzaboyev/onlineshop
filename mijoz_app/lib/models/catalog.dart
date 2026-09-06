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

  Product({
    required this.id, required this.restaurantId, required this.categoryId,
    required this.nameUz, required this.nameRu, this.descriptionUz,
    this.descriptionRu, this.imageUrl, required this.price,
    this.unit, required this.isAvailable,
  });

  factory Product.fromJson(Map<String, dynamic> json) => Product(
    id: json['id'], restaurantId: json['restaurant_id'], categoryId: json['category_id'],
    nameUz: json['name_uz'], nameRu: json['name_ru'], descriptionUz: json['description_uz'],
    descriptionRu: json['description_ru'], imageUrl: json['image_url'],
    price: json['price'], unit: json['unit'], isAvailable: json['is_available'] ?? true,
  );
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
}

class Category {
  final int id;
  final int? groupId;
  final String nameUz;
  final String nameRu;
  final String? imageUrl;
  final int sortOrder;
  final List<Subcategory> subcategories;

  Category({
    required this.id, this.groupId, required this.nameUz, required this.nameRu,
    this.imageUrl, required this.sortOrder, required this.subcategories,
  });

  factory Category.fromJson(Map<String, dynamic> json) => Category(
    id: json['id'], groupId: json['group_id'], nameUz: json['name_uz'],
    nameRu: json['name_ru'], imageUrl: json['image_url'], sortOrder: json['sort_order'],
    subcategories: (json['subcategories'] as List?)?.map((e) => Subcategory.fromJson(e)).toList() ?? [],
  );
}

class CategoryGroup {
  final int id;
  final String nameUz;
  final String nameRu;
  final int sortOrder;

  CategoryGroup({required this.id, required this.nameUz, required this.nameRu, required this.sortOrder});

  factory CategoryGroup.fromJson(Map<String, dynamic> json) => CategoryGroup(
    id: json['id'], nameUz: json['name_uz'], nameRu: json['name_ru'], sortOrder: json['sort_order'],
  );
}

class RestaurantDetail {
  final int id;
  final String name;
  final String? address;
  final List<String> phones;
  final Map<String, String> socials;
  final List<Category> categories;
  final List<CategoryGroup> categoryGroups;
  final int deliveryFee;
  final int minOrder;
  final int avgDeliveryMinutes;

  RestaurantDetail({
    required this.id, required this.name, this.address,
    required this.phones, required this.socials, required this.categories,
    required this.categoryGroups, required this.deliveryFee,
    required this.minOrder, required this.avgDeliveryMinutes,
  });

  factory RestaurantDetail.fromJson(Map<String, dynamic> json) => RestaurantDetail(
    id: json['id'], name: json['name'], address: json['address'],
    phones: (json['phones'] as List?)?.map((e) => e.toString()).toList() ?? [],
    socials: (json['socials'] as Map?)?.map((k, v) => MapEntry(k.toString(), v.toString())) ?? {},
    categories: (json['categories'] as List?)?.map((e) => Category.fromJson(e)).toList() ?? [],
    categoryGroups: (json['category_groups'] as List?)?.map((e) => CategoryGroup.fromJson(e)).toList() ?? [],
    deliveryFee: json['delivery_fee'] ?? 0,
    minOrder: json['min_order'] ?? 0,
    avgDeliveryMinutes: json['avg_delivery_minutes'] ?? 0,
  );
}
