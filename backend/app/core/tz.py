"""Butun backend uchun yagona 'bugun' aniqlanishi — Toshkent (UTC+5).

Avval admin/business/platform statistikasi UTC yarim tunidan, kuryer esa
Toshkent yarim tunidan hisoblardi — 00:00–05:00 Toshkent vaqtida "bugungi"
buyurtmalar ikki xil kunga bo'linib ketardi.
"""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

TASHKENT = ZoneInfo("Asia/Tashkent")


def tashkent_today_start_utc(now: datetime | None = None) -> datetime:
    """Toshkent vaqti bo'yicha joriy kun 00:00'ning UTC instant'i (DB bilan
    solishtirish uchun — TIMESTAMPTZ ustunlar timezone-aware)."""
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    local = now.astimezone(TASHKENT)
    start = datetime(local.year, local.month, local.day, tzinfo=TASHKENT)
    return start.astimezone(timezone.utc)
