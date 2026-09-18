from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class AppVersion(Base):
    """Mobil ilovalar (mijoz/kuryer) uchun majburiy yangilanish (force update) sozlamasi."""

    __tablename__ = "app_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    app: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    min_version_code: Mapped[int] = mapped_column(Integer, default=0)
    store_url: Mapped[str | None] = mapped_column(String(512))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
