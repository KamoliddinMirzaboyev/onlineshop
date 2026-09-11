from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Index, String, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class User(Base):
    """End user, identified by Telegram id."""

    __tablename__ = "users"
    __table_args__ = (
        # Partial unique — NULL ruxsat (hali telefon bog'lamagan TG userlar),
        # lekin bo'sh bo'lmagan qiymatlar bitta foydalanuvchiga tegishli bo'lishi
        # shart (Telegram va OTP orqali kirish — bitta profilga birlashishi uchun).
        # `create_all()` (fresh DB/testlar) shuni to'g'ridan-to'g'ri yaratadi;
        # mavjud production DB uchun aynan shu nom bilan `initdb.py` ham
        # qo'yadi — ikkalasi bir xil indexga ishora qiladi, ziddiyat yo'q.
        Index(
            "uq_users_phone_not_null", "phone",
            unique=True,
            postgresql_where=text("phone IS NOT NULL AND phone <> ''"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    telegram_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, index=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    fcm_token: Mapped[str | None] = mapped_column(String(512))
    username: Mapped[str | None] = mapped_column(String(64))
    first_name: Mapped[str | None] = mapped_column(String(128))
    last_name: Mapped[str | None] = mapped_column(String(128))
    phone: Mapped[str | None] = mapped_column(String(32))
    language: Mapped[str] = mapped_column(String(2), default="uz")
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    addresses = relationship("Address", back_populates="user", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="user")
