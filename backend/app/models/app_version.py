from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class AppVersion(Base):
    """Mobil ilovalar (mijoz/kuryer) uchun majburiy yangilanish (force update) sozlamasi."""

    __tablename__ = "app_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    app: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    min_version_code: Mapped[int] = mapped_column(Integer, default=0)
    store_url: Mapped[str | None] = mapped_column(String(512))
    # Ixtiyoriy yangilanish: current < latest bo'lsa ilova "Keyinroq" tugmali modal ko'rsatadi.
    latest_version_code: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    release_notes_uz: Mapped[str | None] = mapped_column(Text)
    release_notes_ru: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
