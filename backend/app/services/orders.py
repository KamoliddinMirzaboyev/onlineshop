import secrets
from collections import defaultdict
from math import ceil

from fastapi import HTTPException, status
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from sqlalchemy import select

from app.models import Address, DeliveryZone, Order, OrderItem, Product, Restaurant, User
from app.models.enums import OrderStatus, PaymentMethod, PaymentStatus
from app.schemas.order import OrderCreateIn
from app.services.geo import (
    distance_to_user,
    is_within_zone,
    reverse_geocode,
    zone_is_configured,
)

# Default: 50 000 so'mdan bepul yetkazish; undan kam — har km ga 2 000 so'm.
DEFAULT_FREE_DELIVERY_FROM = 50_000
DEFAULT_DELIVERY_PER_KM = 2_000

# Online to'lov gateway hali yo'q — faqat naqd (COD) qabul qilinadi.
ALLOWED_PAYMENT_METHODS = {PaymentMethod.cash}


def calc_delivery_fee(
    items_total: int,
    distance_km: float | None,
    free_from: int,
    per_km: int,
) -> int:
    """Yetkazish haqi: items_total >= free_from → 0; aks holda ceil(km) * per_km.

    free_from/per_km <= 0 bo'lsa default qiymatlar ishlatiladi (mavjud do'konlar
    0 saqlagan bo'lishi mumkin).
    """
    threshold = free_from if free_from > 0 else DEFAULT_FREE_DELIVERY_FROM
    rate = per_km if per_km > 0 else DEFAULT_DELIVERY_PER_KM
    if items_total >= threshold:
        return 0
    if distance_km is None or distance_km <= 0:
        # Masofa noma'lum — kamida 1 km deb hisoblaymiz.
        return rate
    return int(ceil(distance_km) * rate)


# Buyurtma holatlari grafi — faqat ruxsat etilgan o'tishlar.
_ALLOWED_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.pending: {OrderStatus.confirmed, OrderStatus.accepted, OrderStatus.cancelled},
    OrderStatus.confirmed: {OrderStatus.preparing, OrderStatus.accepted, OrderStatus.cancelled},
    OrderStatus.preparing: {OrderStatus.ready, OrderStatus.accepted, OrderStatus.cancelled},
    OrderStatus.ready: {OrderStatus.accepted, OrderStatus.delivering, OrderStatus.cancelled},
    OrderStatus.accepted: {OrderStatus.delivering, OrderStatus.cancelled},
    OrderStatus.delivering: {OrderStatus.delivered, OrderStatus.cancelled},
    OrderStatus.delivered: set(),
    OrderStatus.cancelled: set(),
}


def ensure_transition(current: OrderStatus, new: OrderStatus) -> None:
    """Noto'g'ri holat o'tishini 400 bilan rad etadi. Bir xil holat — no-op."""
    if new == current:
        return
    if new not in _ALLOWED_TRANSITIONS.get(current, set()):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Holatni '{current.value}' dan '{new.value}' ga o'zgartirib bo'lmaydi",
        )


def reserve_stock_atomic(
    db: Session, product_id: int, quantity: float, *, product_name: str = ""
) -> None:
    """Ombor zaxirasini atomik kamaytiradi. Yetarli bo'lmasa 400.

    Race-free: WHERE stock >= qty bilan bitta UPDATE.
    """
    if quantity <= 0:
        return
    result = db.execute(
        update(Product)
        .where(Product.id == product_id, Product.stock >= quantity)
        .values(stock=Product.stock - quantity)
    )
    if result.rowcount == 0:
        product = db.get(Product, product_id)
        name = product_name or (product.name_uz if product else str(product_id))
        left = product.stock if product else 0
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"'{name}' uchun ombor yetarli emas (qoldiq: {left:g})",
        )


def restore_stock_atomic(db: Session, product_id: int, quantity: float) -> None:
    """Bekor/adjust uchun zaxirani qaytaradi."""
    if quantity <= 0:
        return
    db.execute(
        update(Product)
        .where(Product.id == product_id)
        .values(stock=Product.stock + quantity)
    )


def restore_order_stock(db: Session, order: Order) -> None:
    """Buyurtma bekor qilinganda barcha item zaxirasini qaytaradi."""
    for it in order.items:
        restore_stock_atomic(db, it.product_id, it.quantity)


def mark_order_paid_if_cash(order: Order) -> None:
    """Naqd yetkazilganda to'lov holatini paid qiladi."""
    if (
        order.payment_method == PaymentMethod.cash
        and order.payment_status == PaymentStatus.unpaid
    ):
        order.payment_status = PaymentStatus.paid


def _generate_number() -> str:
    return "AF-" + secrets.token_hex(4).upper()


def create_order(db: Session, user: User, data: OrderCreateIn) -> Order:
    if user.is_blocked:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Akkauntingiz bloklangan")
    if data.payment_method not in ALLOWED_PAYMENT_METHODS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Hozircha faqat naqd to'lov (cash) qabul qilinadi",
        )
    restaurant = db.get(Restaurant, data.restaurant_id)
    if not restaurant or not restaurant.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Restaurant not found")
    if not restaurant.is_open:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Restaurant is closed")
    if not data.items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cart is empty")

    # resolve delivery target
    address_line = data.address_line
    lat, lng = data.lat, data.lng
    if data.address_id:
        addr = db.get(Address, data.address_id)
        if not addr or addr.user_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Address not found")
        address_line, lat, lng = addr.address_line, addr.lat, addr.lng
    if not address_line:
        if lat is None or lng is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Yetkazib berish uchun joylashuvni yuboring",
            )
        address_line = reverse_geocode(lat, lng) or f"📍 {lat:.5f}, {lng:.5f}"

    zone = db.scalar(
        select(DeliveryZone)
        .where(DeliveryZone.restaurant_id == restaurant.id, DeliveryZone.is_active.is_(True))
        .order_by(DeliveryZone.id)
        .limit(1)
    )
    if zone_is_configured(zone):
        if lat is None or lng is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Yetkazib berish uchun joylashuvni yuboring",
            )
        if not is_within_zone(zone, lat, lng):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Manzil yetkazib berish hududidan tashqarida",
            )

    # Bir xil product_id bir necha marta kelsa — yig'ib tekshiramiz/zaxiralaymiz.
    qty_by_product: dict[int, float] = defaultdict(float)
    notes_by_product: dict[int, str | None] = {}
    for ci in data.items:
        qty_by_product[ci.product_id] += ci.quantity
        if ci.note:
            notes_by_product[ci.product_id] = ci.note

    items_total = 0
    order_items: list[OrderItem] = []
    reserved: list[tuple[int, float]] = []

    try:
        for product_id, qty in qty_by_product.items():
            product = db.get(Product, product_id)
            if not product or product.restaurant_id != restaurant.id or not product.is_available:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, f"Product {product_id} unavailable"
                )
            reserve_stock_atomic(db, product_id, qty, product_name=product.name_uz)
            reserved.append((product_id, qty))

            line = product.price * qty
            items_total += int(round(line))
            order_items.append(
                OrderItem(
                    product_id=product.id,
                    name_uz=product.name_uz,
                    name_ru=product.name_ru,
                    image_url=product.image_url,
                    price=product.price,
                    cost=product.cost,
                    quantity=qty,
                    unit=product.unit,
                    note=notes_by_product.get(product_id),
                )
            )

        distance_km = distance_to_user(restaurant, zone, lat, lng)
        delivery_fee = calc_delivery_fee(
            items_total,
            distance_km,
            free_from=restaurant.min_order,
            per_km=restaurant.delivery_fee,
        )

        for _attempt in range(5):
            order = Order(
                number=_generate_number(),
                user_id=user.id,
                restaurant_id=restaurant.id,
                status=OrderStatus.pending,
                payment_method=data.payment_method,
                payment_status=PaymentStatus.unpaid,
                items_total=items_total,
                delivery_fee=delivery_fee,
                total=items_total + delivery_fee,
                address_line=address_line,
                lat=lat,
                lng=lng,
                phone=data.phone or user.phone,
                comment=data.comment,
                distance_km=distance_km,
                items=[
                    OrderItem(
                        product_id=oi.product_id,
                        name_uz=oi.name_uz,
                        name_ru=oi.name_ru,
                        image_url=oi.image_url,
                        price=oi.price,
                        cost=oi.cost,
                        quantity=oi.quantity,
                        unit=oi.unit,
                        note=oi.note,
                    )
                    for oi in order_items
                ],
            )
            db.add(order)
            try:
                db.commit()
            except IntegrityError:
                db.rollback()
                # Stock reserved before commit was rolled back — re-reserve.
                reserved.clear()
                for product_id, qty in qty_by_product.items():
                    product = db.get(Product, product_id)
                    name = product.name_uz if product else str(product_id)
                    reserve_stock_atomic(db, product_id, qty, product_name=name)
                    reserved.append((product_id, qty))
                continue
            db.refresh(order)
            return order

        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Could not generate order number"
        )
    except HTTPException:
        # Zaxirani qaytarish (xato yoki raqam generatsiyasi muvaffaqiyatsiz).
        for product_id, qty in reserved:
            restore_stock_atomic(db, product_id, qty)
        try:
            db.commit()
        except Exception:  # noqa: BLE001
            db.rollback()
        raise


def cancel_order(db: Session, order: Order) -> Order:
    """Buyurtmani bekor qiladi, zaxirani qaytaradi, to'lovni refunded belgilaydi."""
    ensure_transition(order.status, OrderStatus.cancelled)
    if order.status == OrderStatus.cancelled:
        return order

    # items yuklangan bo'lishi shart
    if not order.items:
        order = db.scalar(
            select(Order)
            .where(Order.id == order.id)
            .options(selectinload(Order.items))
        ) or order

    restore_order_stock(db, order)
    if order.payment_status == PaymentStatus.paid:
        order.payment_status = PaymentStatus.refunded
    order.status = OrderStatus.cancelled
    db.commit()
    db.refresh(order)
    return order


# Eski importlar uchun alias — delivered da endi stock qayta olinmaydi.
def decrement_stock_atomic(db: Session, order: Order) -> None:
    """Deprecated: stock buyurtma yaratilganda zaxiralanadi.

    Mavjud chaqiruvlar buzilmasin deb no-op qoldirilgan.
    """
    del db, order
