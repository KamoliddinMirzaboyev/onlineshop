from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(
        ForeignKey("businesses.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(128), index=True)
    description_uz: Mapped[str | None] = mapped_column(Text)
    description_ru: Mapped[str | None] = mapped_column(Text)
    logo_url: Mapped[str | None] = mapped_column(String(512))
    cover_url: Mapped[str | None] = mapped_column(String(512))
    address: Mapped[str | None] = mapped_column(String(512))
    owner_name: Mapped[str | None] = mapped_column(String(128))
    # phones: ["+998901234567", ...]; socials: {"instagram": "https://...", ...}
    phones: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")
    socials: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Do'kon joylashuvi — masofa/ETA hisobida origin (bo'lmasa zona markazi fallback).
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    delivery_fee: Mapped[int] = mapped_column(Integer, default=0)         # in soʻm
    min_order: Mapped[int] = mapped_column(Integer, default=0)
    avg_delivery_minutes: Mapped[int] = mapped_column(Integer, default=40)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    categories = relationship("Category", back_populates="restaurant", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="restaurant", cascade="all, delete-orphan")


class CategoryGroup(Base):
    """Bosh sahifadagi kategoriya bo'limi sarlavhasi (masalan 'Meva va sabzavotlar').

    Faqat vizual guruhlash — mahsulot qo'shishda tanlanmaydi.
    """
    __tablename__ = "category_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    name_uz: Mapped[str] = mapped_column(String(128))
    name_ru: Mapped[str] = mapped_column(String(128))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), index=True
    )
    # Faqat top-level (parent_id IS NULL) qatorlarda ma'noli — Home sahifada
    # qaysi bo'lim ostida ko'rsatilishini belgilaydi. NULL = guruhsiz (sarlavhasiz).
    group_id: Mapped[int | None] = mapped_column(
        ForeignKey("category_groups.id", ondelete="SET NULL"), index=True
    )
    name_uz: Mapped[str] = mapped_column(String(128))
    name_ru: Mapped[str] = mapped_column(String(128))
    image_url: Mapped[str | None] = mapped_column(String(512))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    restaurant = relationship("Restaurant", back_populates="categories")
    parent = relationship("Category", remote_side=[id], back_populates="children")
    children = relationship("Category", back_populates="parent", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="category", cascade="all, delete-orphan")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="CASCADE"), index=True)
    name_uz: Mapped[str] = mapped_column(String(128))
    name_ru: Mapped[str] = mapped_column(String(128))
    description_uz: Mapped[str | None] = mapped_column(Text)
    description_ru: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(512))
    price: Mapped[int] = mapped_column(Integer)                          # sotuv narxi, soʻm
    cost: Mapped[int] = mapped_column(Integer, default=0)                # tannarx, soʻm
    stock: Mapped[float] = mapped_column(Float, default=0.0)             # ombor qoldigʻi
    unit: Mapped[str] = mapped_column(String(32), default="dona")        # oʻlchov birligi
    low_stock_threshold: Mapped[float] = mapped_column(Float, default=10.0)  # kam qoldiq chegarasi
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    restaurant = relationship("Restaurant", back_populates="products")
    category = relationship("Category", back_populates="products")
