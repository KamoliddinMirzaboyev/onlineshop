from pydantic import BaseModel


class ProductOut(BaseModel):
    id: int
    restaurant_id: int
    category_id: int
    name_uz: str
    name_ru: str
    description_uz: str | None = None
    description_ru: str | None = None
    image_url: str | None = None
    price: int
    cost: int = 0
    stock: float = 0
    unit: str = "dona"
    low_stock_threshold: float = 10
    is_available: bool

    class Config:
        from_attributes = True


class CategoryOut(BaseModel):
    id: int
    parent_id: int | None = None
    # Faqat top-level kategoriyalarda — qaysi Title (CategoryGroup) ostida ko'rsatilishi.
    group_id: int | None = None
    name_uz: str
    name_ru: str
    image_url: str | None = None
    bg_color: str | None = None  # pastel hex, masalan #E1F3D8
    sort_order: int

    class Config:
        from_attributes = True


class CategoryGroupOut(BaseModel):
    """Title — bosh sahifada bir nechta kategoriyani guruhlaydigan sarlavha."""
    id: int
    name_uz: str
    name_ru: str
    sort_order: int

    class Config:
        from_attributes = True


class SubcategoryOut(CategoryOut):
    products: list[ProductOut] = []


class CategoryWithSubcategories(CategoryOut):
    subcategories: list[SubcategoryOut] = []


class RestaurantOut(BaseModel):
    id: int
    name: str
    description_uz: str | None = None
    description_ru: str | None = None
    logo_url: str | None = None
    cover_url: str | None = None
    address: str | None = None
    owner_name: str | None = None
    phones: list[str] = []
    socials: dict[str, str] = {}
    lat: float | None = None
    lng: float | None = None
    is_active: bool
    is_open: bool
    rating: float
    delivery_fee: int
    min_order: int
    avg_delivery_minutes: int

    class Config:
        from_attributes = True


class StoreSettingsIn(BaseModel):
    """Do'kon identifikatsiya sozlamalari (admin sozlamalar sahifasi)."""
    name: str
    description_uz: str | None = None
    description_ru: str | None = None
    logo_url: str | None = None
    cover_url: str | None = None
    address: str | None = None
    owner_name: str | None = None
    phones: list[str] = []
    socials: dict[str, str] = {}
    lat: float | None = None
    lng: float | None = None
    # Yetkazish: min_order = bepul chegara (so'm); delivery_fee = so'm/km.
    min_order: int = 50_000
    delivery_fee: int = 2_000


class RestaurantDetail(RestaurantOut):
    categories: list[CategoryWithSubcategories] = []
    # Title'lar — mijoz ilovasi shu ro'yxat + har categoriyaning group_id'si orqali
    # kategoriyalarni sarlavha ostida guruhlaydi (group_id=None — sarlavhasiz).
    category_groups: list[CategoryGroupOut] = []


# ── Admin write schemas ──────────────────────────────────────────
class RestaurantIn(BaseModel):
    name: str
    description_uz: str | None = None
    description_ru: str | None = None
    logo_url: str | None = None
    cover_url: str | None = None
    is_active: bool = True
    is_open: bool = True
    delivery_fee: int = 2000   # so'm/km
    min_order: int = 50_000    # bepul yetkazish chegarasi
    avg_delivery_minutes: int = 40


class CategoryIn(BaseModel):
    parent_id: int | None = None
    group_id: int | None = None
    name_uz: str
    name_ru: str
    image_url: str | None = None
    bg_color: str | None = None
    sort_order: int = 0


class CategoryGroupIn(BaseModel):
    name_uz: str
    name_ru: str
    sort_order: int = 0


class ProductIn(BaseModel):
    category_id: int
    name_uz: str
    name_ru: str
    description_uz: str | None = None
    description_ru: str | None = None
    image_url: str | None = None
    price: int
    cost: int = 0
    stock: float = 0
    unit: str = "dona"
    low_stock_threshold: float = 10
    is_available: bool = True
    sort_order: int = 0
