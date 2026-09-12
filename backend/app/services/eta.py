"""Adaptiv ETA (taxminiy yetkazib berish vaqti) — masofa + tarixiy ma'lumotdan.

G'oya: har bir yakunlangan buyurtma uchun kuryer "yetkazilmoqda" (delivering)
bosgan vaqt va "yetkazdim" (courier_delivered_at) bosgan vaqt orasidagi davomiylik
hamda yetkazish masofasi (distance_km) yig'iladi. Shulardan har 1 km uchun o'rtacha
sarflangan vaqt (min/km) o'rganiladi va keyingi buyurtmalar ETA'si shu asosda
hisoblanadi. Ma'lumot yetarli bo'lmaganda (yangi tizim) — shahar uchun statik
baseline (18 km/soat) ishlatiladi.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Order
from app.models.enums import OrderStatus

# Statik baseline — tarixiy ma'lumot yetarli bo'lmaganda.
_CITY_SPEED_KMH = 18.0
_FALLBACK_MIN_PER_KM = 60.0 / _CITY_SPEED_KMH      # ~3.33 daq/km
_BUFFER_MIN = 10.0                                 # yo'lga chiqish / qabul buferi
_MIN_SAMPLES = 5                                   # o'rganishga kerakli minimal namuna
_SAMPLE_LIMIT = 200                                # so'nggi N yetkazib berish
_SAMPLE_DAYS = 60                                  # so'nggi N kun
_ROUND_TO = 5                                      # ETA'ni 5 daqiqaga yaxlitlash
_MIN_ETA = 10
_MAX_ETA = 180
# Aqldan tashqari namunalarni chiqarib tashlash (GPS xato / juda sekin/tez).
_SANE_MIN_PER_KM = (0.3, 40.0)


def _minutes_between(start, end) -> float | None:
    if not start or not end:
        return None
    secs = (end - start).total_seconds()
    return secs / 60.0 if secs > 0 else None


def _duration_min(o: Order) -> float | None:
    return _minutes_between(o.delivering_started_at, o.courier_delivered_at)


def _samples(db: Session, restaurant_id: int | None = None) -> list[float]:
    """So'nggi yetkazib berishlardan min/km namunalari.

    Faqat kerakli 3 ta ustun o'qiladi — avval butun `Order` obyektlari
    (200 tagacha, item'lari bilan) yuklanardi.
    """
    since = datetime.now(timezone.utc) - timedelta(days=_SAMPLE_DAYS)
    cond = [
        Order.status == OrderStatus.delivered,
        Order.distance_km.is_not(None),
        Order.delivering_started_at.is_not(None),
        Order.courier_delivered_at.is_not(None),
        Order.updated_at >= since,
    ]
    if restaurant_id is not None:
        cond.append(Order.restaurant_id == restaurant_id)

    rows = db.execute(
        select(Order.distance_km, Order.delivering_started_at, Order.courier_delivered_at)
        .where(*cond)
        .order_by(Order.updated_at.desc())
        .limit(_SAMPLE_LIMIT)
    ).all()

    out: list[float] = []
    for dist, start, end in rows:
        dur = _minutes_between(start, end)
        dist = dist or 0.0
        if dur is None or dist < 0.2:        # juda yaqin — masofaga bog'lash noaniq
            continue
        mpk = dur / dist
        if _SANE_MIN_PER_KM[0] <= mpk <= _SANE_MIN_PER_KM[1]:
            out.append(mpk)
    return out


def learned_minutes_per_km(db: Session, restaurant_id: int | None = None) -> float:
    """O'rganilgan o'rtacha min/km; namuna kam bo'lsa — statik baseline."""
    s = _samples(db, restaurant_id)
    if len(s) >= _MIN_SAMPLES:
        return sum(s) / len(s)
    return _FALLBACK_MIN_PER_KM


def minutes_from_rate(distance_km: float | None, minutes_per_km: float) -> int:
    """Tayyor min/km dan ETA. Marshrutdagi har buyurtma uchun alohida
    `learned_minutes_per_km` chaqirish (N ta og'ir so'rov) shart emas."""
    dist = distance_km or 0.0
    raw = dist * minutes_per_km + _BUFFER_MIN
    rounded = round(raw / _ROUND_TO) * _ROUND_TO
    return int(max(_MIN_ETA, min(_MAX_ETA, rounded)))


def estimate_minutes(
    db: Session, distance_km: float | None, restaurant_id: int | None = None
) -> int:
    """Masofadan ETA (daqiqa). distance yo'q bo'lsa baseline buferni qaytaradi."""
    return minutes_from_rate(distance_km, learned_minutes_per_km(db, restaurant_id))


def delivery_stats(db: Session, restaurant_id: int) -> dict:
    """Tahlil uchun yig'ma o'rtachalar: namuna soni, o'rtacha masofa, vaqt, min/km."""
    since = datetime.now(timezone.utc) - timedelta(days=_SAMPLE_DAYS)
    rows = db.execute(
        select(Order.distance_km, Order.delivering_started_at, Order.courier_delivered_at)
        .where(
            Order.status == OrderStatus.delivered,
            Order.restaurant_id == restaurant_id,
            Order.distance_km.is_not(None),
            Order.delivering_started_at.is_not(None),
            Order.courier_delivered_at.is_not(None),
            Order.updated_at >= since,
        )
        .order_by(Order.updated_at.desc())
        .limit(_SAMPLE_LIMIT)
    ).all()

    durs: list[float] = []
    dists: list[float] = []
    mpks: list[float] = []
    for dist, start, end in rows:
        dur = _minutes_between(start, end)
        dist = dist or 0.0
        if dur is None or dist < 0.2:
            continue
        mpk = dur / dist
        if not (_SANE_MIN_PER_KM[0] <= mpk <= _SANE_MIN_PER_KM[1]):
            continue
        durs.append(dur)
        dists.append(dist)
        mpks.append(mpk)

    n = len(mpks)
    avg = lambda xs: round(sum(xs) / len(xs), 2) if xs else None  # noqa: E731
    return {
        "samples": n,
        "avg_distance_km": avg(dists),
        "avg_duration_min": avg(durs),
        "avg_minutes_per_km": avg(mpks),
        "learned": n >= _MIN_SAMPLES,
        "minutes_per_km_used": round(learned_minutes_per_km(db, restaurant_id), 2),
    }
