from datetime import datetime

# pyrefly: ignore [missing-import]
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import OrderStatus, PaymentMethod, PaymentStatus


class AddressIn(BaseModel):
    label: str = "Uy"
    address_line: str
    lat: float | None = None
    lng: float | None = None
    entrance: str | None = None
    floor: str | None = None
    apartment: str | None = None
    comment: str | None = None


class AddressOut(AddressIn):
    id: int

    model_config = ConfigDict(from_attributes=True)


class CartItemIn(BaseModel):
    product_id: int
    quantity: float = Field(gt=0)
    note: str | None = None         # mahsulotga mijoz izohi (masalan "yetilgan bo'lsin")


class OrderCreateIn(BaseModel):
    restaurant_id: int
    items: list[CartItemIn]
    address_id: int | None = None
    # inline address (if not saved)
    address_line: str | None = None
    lat: float | None = None
    lng: float | None = None
    phone: str | None = None
    comment: str | None = None
    payment_method: PaymentMethod = PaymentMethod.cash


class OrderItemOut(BaseModel):
    id: int
    product_id: int
    name_uz: str
    name_ru: str
    image_url: str | None = None
    price: int
    quantity: float
    unit: str = "dona"
    note: str | None = None

    model_config = ConfigDict(from_attributes=True)


class OrderOut(BaseModel):
    id: int
    number: str
    restaurant_id: int
    status: OrderStatus
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    items_total: int
    delivery_fee: int
    total: int
    address_line: str
    lat: float | None = None
    lng: float | None = None
    customer_name: str | None = None
    phone: str | None = None
    comment: str | None = None
    distance_km: float | None = None
    eta_minutes: int | None = None
    assigned_courier_id: int | None = None
    assigned_courier_name: str | None = None
    assigned_courier_phone: str | None = None
    courier_accepted_at: datetime | None = None
    delivering_started_at: datetime | None = None
    courier_delivered_at: datetime | None = None
    created_at: datetime
    items: list[OrderItemOut] = []

    model_config = ConfigDict(from_attributes=True)


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    assigned_courier_id: int | None = None


class OrderAssignIn(BaseModel):
    assigned_courier_id: int
