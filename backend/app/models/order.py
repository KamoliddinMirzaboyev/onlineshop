from datetime import datetime

from sqlalchemy import (
    BigInteger, Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.enums import OrderStatus, PaymentMethod, PaymentStatus


class Address(Base):
    __tablename__ = "addresses"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(64), default="Uy")        # Home / Work
    address_line: Mapped[str] = mapped_column(Text)
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    entrance: Mapped[str | None] = mapped_column(String(32))            # podyezd
    floor: Mapped[str | None] = mapped_column(String(32))
    apartment: Mapped[str | None] = mapped_column(String(32))
    comment: Mapped[str | None] = mapped_column(Text)

    user = relationship("User", back_populates="addresses")


class DeliveryZone(Base):
    __tablename__ = "delivery_zones"

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(
        ForeignKey("restaurants.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(128))
    fee: Mapped[int] = mapped_column(Integer, default=0)
    min_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # simplified polygon: JSON list of [lat,lng]; kept as text for portability
    polygon: Mapped[str | None] = mapped_column(Text)
    # Circle zone: markaz + radius (km). Order shu doira ichida bo'lsa qabul qilinadi.
    center_lat: Mapped[float | None] = mapped_column(Float)
    center_lng: Mapped[float | None] = mapped_column(Float)
    radius_km: Mapped[float | None] = mapped_column(Float)




class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id"), index=True)
    # Web kuryer akkaunti (AdminUser, role=courier) — admin biriktiradi.
    assigned_courier_id: Mapped[int | None] = mapped_column(
        ForeignKey("admin_users.id"), index=True
    )

    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.pending, index=True)
    payment_method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod), default=PaymentMethod.cash)
    payment_status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.unpaid)

    items_total: Mapped[int] = mapped_column(Integer, default=0)
    delivery_fee: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)

    # delivery snapshot (denormalized so address edits don't change history)
    address_line: Mapped[str] = mapped_column(Text)
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    phone: Mapped[str | None] = mapped_column(String(32))
    comment: Mapped[str | None] = mapped_column(Text)

    # Do'kon ↔ mijoz masofasi (km) — buyurtma yaratilganda snapshot qilinadi.
    distance_km: Mapped[float | None] = mapped_column(Float)
    # Taxminiy yetkazib berish vaqti (daqiqa) — kuryer "delivering" bosganda hisoblanadi.
    eta_minutes: Mapped[int | None] = mapped_column(Integer)

    # Oqim vaqt belgilari (ETA o'rganish + tahlil uchun).
    courier_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivering_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Kuryer "yetkazdim" bosgan vaqt — mijoz tasdig'i kutilmoqda (status hali delivering).
    courier_delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Multi-stop marshrut: bir "yo'lga chiqish"dagi guruh + tartib (1,2,3…).
    route_group_id: Mapped[str | None] = mapped_column(String(36), index=True)
    route_sequence: Mapped[int | None] = mapped_column(Integer)
    # Oldingi nuqtadan (depot yoki oldingi stop) shu stopgacha leg km.
    route_leg_km: Mapped[float | None] = mapped_column(Float)


    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="orders")
    restaurant = relationship("Restaurant")
    assigned_courier = relationship("AdminUser")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

    # Mijoz/tadbirkor/admin uchun — kuryerning ismi/telefoni (OrderOut'ga
    # to'g'ridan-to'g'ri chiqadi). Eager-load qilinmasa lazy-load bo'ladi.
    @property
    def assigned_courier_name(self) -> str | None:
        return self.assigned_courier.name if self.assigned_courier else None

    @property
    def customer_name(self) -> str | None:
        if self.user:
            return f"{self.user.first_name or ''} {self.user.last_name or ''}".strip() or self.user.username
        return None

    @property
    def assigned_courier_phone(self) -> str | None:
        return self.assigned_courier.phone if self.assigned_courier else None


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    name_uz: Mapped[str] = mapped_column(String(128))                   # snapshot
    name_ru: Mapped[str] = mapped_column(String(128))
    image_url: Mapped[str | None] = mapped_column(String(512))          # rasm snapshot
    price: Mapped[int] = mapped_column(Integer)                         # sotuv narxi snapshot
    cost: Mapped[int] = mapped_column(Integer, default=0)               # tannarx snapshot
    quantity: Mapped[float] = mapped_column(Float, default=1.0)
    unit: Mapped[str] = mapped_column(String(32), default="dona")       # o'lchov birligi snapshot (kg/dona/litr)
    note: Mapped[str | None] = mapped_column(Text)                      # mahsulotga mijoz izohi

    order = relationship("Order", back_populates="items")
