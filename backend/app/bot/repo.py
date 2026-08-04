"""User persistence helpers for the bot. One place that touches the DB for
user rows, so handlers/onboarding stay free of session boilerplate."""

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.db import SessionLocal
from app.core.phone import normalize_phone
from app.models import DeliveryZone, Order, OrderStatus, Restaurant, User
from app.services.geo import (
    distance_to_user,
    is_within_zone,
    reverse_geocode,
    zone_is_configured,
)
from app.services.orders import calc_delivery_fee


def get_user(tg_id: int) -> User | None:
    with SessionLocal() as db:
        return db.scalar(select(User).where(User.telegram_id == tg_id))


def get_or_create_user(tg_id: int, first_name: str | None, username: str | None) -> User:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.telegram_id == tg_id))
        if user:
            return user
        user = User(telegram_id=tg_id, first_name=first_name, username=username)
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
        except IntegrityError:
            db.rollback()
            user = db.scalar(select(User).where(User.telegram_id == tg_id))
            if not user:
                raise
        return user


def set_lang(tg_id: int, lang: str) -> None:
    lang = lang if lang in ("uz", "ru") else "uz"
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.telegram_id == tg_id))
        if user:
            user.language = lang
            db.commit()


def set_phone(tg_id: int, phone: str) -> bool:
    """Telefon saqlaydi. Boshqa user band qilgan bo'lsa False."""
    normalized = normalize_phone(phone)
    if not normalized:
        return False
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.telegram_id == tg_id))
        if not user:
            user = User(telegram_id=tg_id, phone=normalized)
            db.add(user)
            try:
                db.commit()
            except IntegrityError:
                db.rollback()
                return False
            return True
        clash = db.scalar(
            select(User).where(User.phone == normalized, User.id != user.id)
        )
        if clash:
            return False
        user.phone = normalized
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return False
        return True


def set_name(tg_id: int, first_name: str, last_name: str | None) -> None:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.telegram_id == tg_id))
        if user:
            user.first_name = first_name
            user.last_name = last_name or None
            db.commit()


def is_onboarded(user: User) -> bool:
    """Onboarding: telefon + ism yetarli (familiya ixtiyoriy)."""
    return bool(user.phone and user.first_name)


def get_latest_pending_order(tg_id: int) -> Order | None:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.telegram_id == tg_id))
        if not user:
            return None
        return db.scalar(
            select(Order)
            .where(Order.user_id == user.id, Order.status == OrderStatus.pending)
            .order_by(Order.created_at.desc())
        )


def set_order_location(order_id: int, lat: float, lng: float) -> tuple[bool, str | None]:
    """lat/lng + reverse-geocode manzil + masofa/fee qayta hisob.

    Returns (ok, error_code) — error_code: out_of_zone | not_found | None
    """
    with SessionLocal() as db:
        order = db.get(Order, order_id)
        if not order:
            return False, "not_found"

        order.lat = lat
        order.lng = lng

        line = reverse_geocode(lat, lng)
        if line:
            order.address_line = line
        elif not (order.address_line or "").strip():
            order.address_line = f"📍 {lat:.5f}, {lng:.5f}"

        restaurant = db.get(Restaurant, order.restaurant_id)
        zone = db.scalar(
            select(DeliveryZone)
            .where(
                DeliveryZone.restaurant_id == order.restaurant_id,
                DeliveryZone.is_active.is_(True),
            )
            .order_by(DeliveryZone.id)
            .limit(1)
        )

        if zone_is_configured(zone) and not is_within_zone(zone, lat, lng):
            # Coords saqlanadi, lekin hudud tashqarida — admin ko'radi
            order.distance_km = distance_to_user(restaurant, zone, lat, lng)
            db.commit()
            return True, "out_of_zone"

        order.distance_km = distance_to_user(restaurant, zone, lat, lng)
        if restaurant is not None:
            order.delivery_fee = calc_delivery_fee(
                order.items_total,
                order.distance_km,
                free_from=restaurant.min_order,
                per_km=restaurant.delivery_fee,
            )
            order.total = order.items_total + order.delivery_fee
        db.commit()
        return True, None


def split_full_name(text: str) -> tuple[str, str]:
    """'Ali Valiyev Aliyevich' -> ('Ali', 'Valiyev Aliyevich'). Single word -> ('Ali', '')."""
    parts = text.strip().split()
    if not parts:
        return "", ""
    return parts[0], " ".join(parts[1:])
