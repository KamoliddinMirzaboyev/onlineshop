from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AdminRole, AnnouncementStatus


class DeliveryZoneIn(BaseModel):
    name: str = "Yetkazish hududi"
    fee: int = 0
    min_order: int = 0
    is_active: bool = True
    polygon: str | None = None
    # Circle zona: markaz + radius (km).
    center_lat: float | None = None
    center_lng: float | None = None
    radius_km: float | None = None


class DeliveryZoneOut(DeliveryZoneIn):
    id: int

    model_config = ConfigDict(from_attributes=True)


class AdminUserOut(BaseModel):
    id: int
    username: str
    name: str | None = None
    phone: str | None = None
    role: AdminRole
    restaurant_id: int
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TopProduct(BaseModel):
    product_id: int
    name_uz: str
    image_url: str | None = None
    quantity: float
    revenue: int
    profit: int


class DashboardStats(BaseModel):
    orders_today: int
    revenue_today: int
    profit_today: int
    orders_week: int
    revenue_week: int
    profit_week: int
    orders_month: int
    revenue_month: int
    profit_month: int
    orders_total: int
    revenue_total: int
    profit_total: int
    pending_orders: int
    users_total: int
    products_total: int
    low_stock_count: int
    top_products: list[TopProduct] = []


class PeriodPoint(BaseModel):
    period: str          # ISO date (kun/hafta/oy boshi)
    orders: int
    revenue: int
    profit: int


class ReportTotals(BaseModel):
    orders: int
    revenue: int
    profit: int


class ReportsOut(BaseModel):
    totals: ReportTotals
    series: list[PeriodPoint] = []
    top_products: list[TopProduct] = []


class StockUpdate(BaseModel):
    stock: float = Field(ge=0)
    low_stock_threshold: float | None = Field(default=None, ge=0)


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionIn(BaseModel):
    endpoint: str
    keys: PushKeys


class SupplyRecordIn(BaseModel):
    product_id: int
    supplier_name: str
    quantity: float
    unit: str = "dona"
    cost_per_unit: int = 0
    supply_date: date
    notes: str | None = None


class SupplyRecordOut(BaseModel):
    id: int
    product_id: int
    product_name: str = ""
    restaurant_id: int = 0
    supplier_name: str
    quantity: float
    unit: str
    cost_per_unit: int
    total_cost: int
    supply_date: date
    notes: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AnnouncementIn(BaseModel):
    text: str
    image_url: str | None = None
    button_text: str = "🛍 Ochish"


class AnnouncementOut(BaseModel):
    id: int
    text: str
    image_url: str | None = None
    button_text: str
    status: AnnouncementStatus
    total_recipients: int
    sent_count: int
    failed_count: int
    created_at: datetime
    sent_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class NotificationEvent(BaseModel):
    type: str  # "new" | "accepted" | "delivered"
    order_id: int
    order_number: str
    total: int
    address_line: str
    at: datetime
