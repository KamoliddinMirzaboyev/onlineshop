from datetime import datetime

# pyrefly: ignore [missing-import]
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import OrderStatus, PaymentMethod, PaymentStatus


class AddressIn(BaseModel):
    label: str = "Uy"
    address_line: str = Field(min_length=4, max_length=512)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    entrance: str | None = None
    floor: str | None = None
    apartment: str | None = None
    comment: str | None = None

    @field_validator("address_line")
    @classmethod
    def _addr(cls, v: str) -> str:
        s = (v or "").strip()
        if len(s) < 4:
            raise ValueError("Manzil juda qisqa")
        return s


class AddressOut(AddressIn):
    id: int

    model_config = ConfigDict(from_attributes=True)


class CartItemIn(BaseModel):
    product_id: int
    quantity: float = Field(gt=0)
    note: str | None = None         # mahsulotga mijoz izohi (masalan "yetilgan bo'lsin")


class OrderCreateIn(BaseModel):
    restaurant_id: int
    items: list[CartItemIn] = Field(min_length=1)
    address_id: int | None = None
    # inline address (if not saved)
    address_line: str | None = Field(default=None, max_length=512)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    phone: str | None = None
    comment: str | None = Field(default=None, max_length=1000)
    # Gateway yo'q — faqat naqd. Schema darajasida rad etiladi.
    payment_method: PaymentMethod = PaymentMethod.cash

    @field_validator("payment_method")
    @classmethod
    def only_cash_until_gateways(cls, v: PaymentMethod) -> PaymentMethod:
        if v != PaymentMethod.cash:
            raise ValueError("Hozircha faqat naqd to'lov (cash) qabul qilinadi")
        return v

    @field_validator("address_line")
    @classmethod
    def _addr_line(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        return s if s else None

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        if v is None or not str(v).strip():
            return None
        from app.core.phone import require_phone

        return require_phone(v)


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
    route_group_id: str | None = None
    route_sequence: int | None = None
    route_leg_km: float | None = None
    created_at: datetime
    items: list[OrderItemOut] = []

    model_config = ConfigDict(from_attributes=True)


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    assigned_courier_id: int | None = None


class OrderAssignIn(BaseModel):
    assigned_courier_id: int
