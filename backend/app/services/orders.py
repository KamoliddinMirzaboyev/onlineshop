import logging
import secrets
from collections import defaultdict
from math import ceil

from fastapi import HTTPException, status
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from sqlalchemy import select

from app.core.db import SessionLocal
from app.core.phone import normalize_phone
from app.models import Address, DeliveryZone, Order, OrderItem, Product, Restaurant, User
from app.models.enums import OrderStatus, PaymentMethod, PaymentStatus
from app.schemas.order import OrderCreateIn
from app.services.geo import (
    cached_reverse_geocode,
    distance_to_user,
    is_weak_address_line,
    is_within_zone,
    reverse_geocode,
    zone_is_configured,
)

logger = logging.getLogger(__name__)

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
# Oqim: pending → admin qabul qiladi (confirmed) → admin kuryer biriktiradi
# (accepted) → kuryer yo'lga chiqadi (delivering) → delivered.
# preparing/ready ishlatilmaydi. accepted→delivered: admin qo'lda yakunlash.
_ALLOWED_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.pending: {OrderStatus.confirmed, OrderStatus.cancelled},
    OrderStatus.confirmed: {OrderStatus.accepted, OrderStatus.cancelled},
    OrderStatus.accepted: {OrderStatus.delivering, OrderStatus.delivered, OrderStatus.cancelled},
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


def _active_zone(db: Session, restaurant_id: int) -> DeliveryZone | None:
    return db.scalar(
        select(DeliveryZone)
        .where(DeliveryZone.restaurant_id == restaurant_id, DeliveryZone.is_active.is_(True))
        .order_by(DeliveryZone.id)
        .limit(1)
    )


def quote_order(
    db: Session,
    restaurant_id: int,
    items: list,
    lat: float | None,
    lng: float | None,
) -> dict:
    """Buyurtma bermasdan yakuniy summani hisoblaydi — `create_order` bilan
    AYNAN bir xil mantiq (calc_delivery_fee + distance_to_user).

    Mijoz ilovasi narxni o'zi hisoblamasin: ekranda ko'rsatilgan summa bilan
    haqiqiy yozilgan summa farq qilmasligi uchun yagona manba shu funksiya.
    Ombor zaxiralanmaydi — faqat o'qiydi.
    """
    restaurant = db.get(Restaurant, restaurant_id)
    if not restaurant or not restaurant.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Do'kon topilmadi")

    qty_by_product: dict[int, float] = defaultdict(float)
    for ci in items:
        qty_by_product[ci.product_id] += ci.quantity

    items_total = 0
    issues: list[dict] = []
    for product_id, qty in qty_by_product.items():
        product = db.get(Product, product_id)
        if not product or product.restaurant_id != restaurant.id or not product.is_available:
            name = product.name_uz if product else f"#{product_id}"
            issues.append({
                "product_id": product_id,
                "name_uz": name,
                "reason": "unavailable",
                "available_stock": 0,
                "price": product.price if product else 0,
                "message": f"'{name}' hozir sotuvda yo'q",
            })
            continue
        if product.stock < qty:
            issues.append({
                "product_id": product_id,
                "name_uz": product.name_uz,
                "reason": "out_of_stock",
                "available_stock": product.stock,
                "price": product.price,
                "message": (
                    f"'{product.name_uz}' tugagan"
                    if product.stock <= 0
                    else f"'{product.name_uz}' uchun {product.stock:g} {product.unit} qoldi"
                ),
            })
            continue
        items_total += int(round(product.price * qty))

    zone = _active_zone(db, restaurant.id)
    distance_km = distance_to_user(restaurant, zone, lat, lng)
    delivery_fee = calc_delivery_fee(
        items_total,
        distance_km,
        free_from=restaurant.free_delivery_from,
        per_km=restaurant.delivery_fee,
    )
    free_from = restaurant.free_delivery_from if restaurant.free_delivery_from > 0 else DEFAULT_FREE_DELIVERY_FROM
    # Bepul chegaradan o'tgan bo'lsa haq 0 — koordinatasiz ham aniq.
    # Aks holda masofa kerak: koordinata yo'q bo'lsa summa taxminiy.
    fee_known = items_total >= free_from or distance_km is not None

    return {
        "items_total": items_total,
        "delivery_fee": delivery_fee,
        "total": items_total + delivery_fee,
        "free_delivery_from": free_from,
        "delivery_fee_known": fee_known,
        "distance_km": distance_km,
        "is_open": restaurant.is_open,
        "issues": issues,
    }


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
    address_line = (data.address_line or "").strip() or None
    lat, lng = data.lat, data.lng
    if data.address_id:
        addr = db.get(Address, data.address_id)
        if not addr or addr.user_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Address not found")
        address_line, lat, lng = addr.address_line, addr.lat, addr.lng
        address_line = (address_line or "").strip() or None
    if lat is not None and lng is not None and is_weak_address_line(address_line):
        # Zaif/koordinata-only matn — serverda aniqlashtiramiz. TASHQI SO'ROV
        # BU YERDA QILINMAYDI: 3 ta geocode manbasi eng yomon holatda ~16 soniya
        # oladi va mijoz shuncha kutardi. Keshda tayyor javob bo'lsa darhol
        # olamiz, bo'lmasa koordinata yoziladi va `refine_order_address()`
        # fonda (BackgroundTasks) aniq manzilga almashtiradi.
        cached_line = cached_reverse_geocode(lat, lng)
        if cached_line:
            address_line = cached_line
        elif not address_line:
            address_line = f"📍 {lat:.5f}, {lng:.5f}"
    # Foydalanuvchi matn yozgan bo'lsa (zaif emas) — aniq matn saqlanadi.
    if not address_line:
        if lat is None or lng is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Yetkazib berish uchun joylashuvni yuboring",
            )
        address_line = reverse_geocode(lat, lng) or f"📍 {lat:.5f}, {lng:.5f}"

    phone = normalize_phone(data.phone) or normalize_phone(user.phone)
    if not phone:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Telefon raqami majburiy",
        )

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
                "Kechirasiz, hozircha sizning hududingizga xizmat ko'rsata olmaymiz",
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

    try:
        for product_id, qty in qty_by_product.items():
            product = db.get(Product, product_id)
            if not product or product.restaurant_id != restaurant.id or not product.is_available:
                # Mijozga aynan qaysi mahsulot ekanini aytamiz — "Product 42
                # unavailable" bilan u savatni tuzata olmaydi.
                name = product.name_uz if product else f"#{product_id}"
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"'{name}' hozir sotuvda yo'q — savatdan olib tashlang",
                )
            reserve_stock_atomic(db, product_id, qty, product_name=product.name_uz)

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
            free_from=restaurant.free_delivery_from,
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
                phone=phone,
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
                # Rollback zaxirani ham bekor qildi — qaytadan band qilamiz.
                for product_id, qty in qty_by_product.items():
                    product = db.get(Product, product_id)
                    name = product.name_uz if product else str(product_id)
                    reserve_stock_atomic(db, product_id, qty, product_name=name)
                continue
            db.refresh(order)
            return order

        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Could not generate order number"
        )
    except BaseException:
        # Zaxira hali commit qilinmagan (yagona commit — buyurtma yaratilganda),
        # shuning uchun rollback uni to'liq bekor qiladi. Avval bu yerda faqat
        # HTTPException ushlanardi: DB uzilishi yoki boshqa kutilmagan xatoda
        # sessiya ochiq qolib ketardi. Endi har qanday xatoda tozalanadi.
        try:
            db.rollback()
        except Exception:  # noqa: BLE001 — asl xato muhimroq
            logger.exception("Buyurtma xatosidan keyin rollback ishlamadi")
        raise


def _get_or_create_phone_user(db: Session, phone: str) -> User:
    """Telefon buyurtma uchun mijoz: shu raqamli user bo'lsa — o'sha (mavjud
    ilova mijozi ham bo'lishi mumkin), aks holda telegram_id'siz yangi qator.
    Alohida commit — buyurtma raqami to'qnashuvida rollback bo'lsa ham yo'qolmaydi."""
    user = db.scalar(select(User).where(User.phone == phone))
    if user:
        return user
    user = User(phone=phone, first_name="Telefon mijoz", language="uz")
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # parallel so'rov shu raqamni yaratib ulgurdi
        db.rollback()
        user = db.scalar(select(User).where(User.phone == phone))
        if not user:
            raise
    db.refresh(user)
    return user


def create_manual_order(
    db: Session, restaurant: Restaurant, data, admin_name: str | None = None
) -> Order:
    """Admin panel orqali qo'lda (telefon) buyurtma — pending, source='manual'.
    Zona/koordinata tekshiruvi yo'q (admin ishonchli), yetkazish narxi admin
    kiritgan qiymat. Kuryerlar odatdagidek ko'radi/bildirishnoma oladi."""
    if not data.items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cart is empty")

    phone = normalize_phone(data.phone)
    if not phone:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Telefon raqami noto'g'ri")
    user = _get_or_create_phone_user(db, phone)

    qty_by_product: dict[int, float] = defaultdict(float)
    notes_by_product: dict[int, str | None] = {}
    for ci in data.items:
        qty_by_product[ci.product_id] += ci.quantity
        if ci.note:
            notes_by_product[ci.product_id] = ci.note

    items_total = 0
    order_items: list[OrderItem] = []
    try:
        for product_id, qty in qty_by_product.items():
            product = db.get(Product, product_id)
            if (
                not product
                or product.restaurant_id != restaurant.id
                or not product.is_available
            ):
                name = product.name_uz if product else f"#{product_id}"
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, f"'{name}' hozir sotuvda yo'q"
                )
            reserve_stock_atomic(db, product_id, qty, product_name=product.name_uz)
            items_total += int(round(product.price * qty))
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

        delivery_fee = max(0, int(data.delivery_fee or 0))
        comment = (data.comment or "").strip() or None
        tag = f"☎️ Admin qo'shdi ({admin_name})" if admin_name else "☎️ Admin qo'shdi"
        comment = f"{tag}\n{comment}" if comment else tag

        for _attempt in range(5):
            order = Order(
                number=_generate_number(),
                user_id=user.id,
                restaurant_id=restaurant.id,
                status=OrderStatus.pending,
                payment_method=PaymentMethod.cash,
                payment_status=PaymentStatus.unpaid,
                items_total=items_total,
                delivery_fee=delivery_fee,
                total=items_total + delivery_fee,
                address_line=data.address_line.strip(),
                phone=phone,
                comment=comment,
                source="manual",
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
                for product_id, qty in qty_by_product.items():
                    p = db.get(Product, product_id)
                    reserve_stock_atomic(
                        db, product_id, qty,
                        product_name=p.name_uz if p else str(product_id),
                    )
                continue
            db.refresh(order)
            return order

        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Could not generate order number"
        )
    except BaseException:
        # Zaxira commit qilinmagan — rollback uni bekor qiladi (create_order bilan bir xil).
        try:
            db.rollback()
        except Exception:  # noqa: BLE001 — asl xato muhimroq
            logger.exception("Qo'lda buyurtma xatosidan keyin rollback ishlamadi")
        raise


def edit_pending_order(db: Session, order: Order, new_items: list) -> Order:
    """Mijoz o'z buyurtmasini do'kon tasdiqlagunча tahrirlaydi: mahsulot
    qo'shish/o'chirish, miqdorni o'zgartirish. Ombor zaxirasi delta bo'yicha
    to'g'rilanadi, yetkazish haqi va total qayta hisoblanadi. Butun ish bitta
    tranzaksiyada — xato bo'lsa rollback hammasini (zaxira ham) qaytaradi."""
    if order.status != OrderStatus.pending:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Buyurtma allaqachon tasdiqlangan — endi tahrirlab bo'lmaydi",
        )
    restaurant = db.get(Restaurant, order.restaurant_id)
    if not restaurant or not restaurant.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Do'kon topilmadi")

    want: dict[int, float] = defaultdict(float)
    note_by: dict[int, str | None] = {}
    for ci in new_items:
        want[ci.product_id] += ci.quantity
        if ci.note:
            note_by[ci.product_id] = ci.note

    current = {it.product_id: it for it in order.items}
    products: dict[int, Product] = {}
    for pid in want:
        p = db.get(Product, pid)
        if not p or p.restaurant_id != restaurant.id or not p.is_available:
            name = current[pid].name_uz if pid in current else str(pid)
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"'{name}' hozir mavjud emas")
        products[pid] = p

    # Atomik guard: shu paytгacha boshqa tranzaksiya confirmed qilgan bo'lsa —
    # 0 qator (va qator qulfi olinadi, parallel confirm biz commit qilgунча kutadi).
    if db.execute(
        update(Order)
        .where(Order.id == order.id, Order.status == OrderStatus.pending)
        .values(status=OrderStatus.pending)
    ).rowcount == 0:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Buyurtma allaqachon tasdiqlangan — endi tahrirlab bo'lmaydi",
        )

    try:
        for pid, new_qty in want.items():
            old_qty = current[pid].quantity if pid in current else 0.0
            delta = new_qty - old_qty
            if delta > 1e-9:
                reserve_stock_atomic(db, pid, delta, product_name=products[pid].name_uz)
            elif delta < -1e-9:
                restore_stock_atomic(db, pid, -delta)
        for pid, it in current.items():
            if pid not in want:
                restore_stock_atomic(db, pid, it.quantity)

        keep: list[OrderItem] = []
        for pid, new_qty in want.items():
            if pid in current:
                it = current[pid]
                it.quantity = new_qty
                if pid in note_by:
                    it.note = note_by[pid]
                keep.append(it)
            else:
                p = products[pid]
                keep.append(
                    OrderItem(
                        product_id=p.id,
                        name_uz=p.name_uz,
                        name_ru=p.name_ru,
                        image_url=p.image_url,
                        price=p.price,
                        cost=p.cost,
                        quantity=new_qty,
                        unit=p.unit,
                        note=note_by.get(pid),
                    )
                )
        order.items = keep  # orphan (o'chirilgan) item'lar cascade bilan o'chadi

        items_total = int(round(sum(it.price * it.quantity for it in order.items)))
        order.items_total = items_total
        order.delivery_fee = calc_delivery_fee(
            items_total,
            order.distance_km,
            free_from=restaurant.free_delivery_from,
            per_km=restaurant.delivery_fee,
        )
        order.total = items_total + order.delivery_fee
        db.commit()
        db.refresh(order)
        return order
    except HTTPException:
        db.rollback()  # zaxira UPDATE'lari ham shu tranzaksiyada — bekor bo'ladi
        raise


def cancel_order(db: Session, order: Order) -> Order:
    """Buyurtmani bekor qiladi, zaxirani qaytaradi (atomik — double-cancel stock shishmaydi)."""
    if order.status == OrderStatus.cancelled:
        return order
    ensure_transition(order.status, OrderStatus.cancelled)

    # Atomik: faqat bir marta cancelled bo'ladi (concurrent cancel → bitta stock restore).
    result = db.execute(
        update(Order)
        .where(
            Order.id == order.id,
            Order.status.notin_((OrderStatus.cancelled, OrderStatus.delivered)),
        )
        .values(status=OrderStatus.cancelled)
    )
    if result.rowcount == 0:
        db.refresh(order)
        if order.status == OrderStatus.cancelled:
            return order
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Buyurtmani bekor qilib bo'lmadi (holat o'zgargan)",
        )

    order = db.scalar(
        select(Order)
        .where(Order.id == order.id)
        .options(selectinload(Order.items))
    ) or order

    restore_order_stock(db, order)
    if order.payment_status == PaymentStatus.paid:
        order.payment_status = PaymentStatus.refunded
    # status allaqachon UPDATE bilan cancelled
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


def refine_order_address(order_id: int) -> None:
    """Buyurtma manzilini fonda aniqlashtiradi (BackgroundTasks).

    `create_order` mijozni kutkazmaslik uchun tashqi geocode'ni chaqirmaydi —
    manzil koordinata ko'rinishida yozilishi mumkin. Bu yerda (javob mijozga
    ketgandan keyin) haqiqiy mahalla/ko'cha topiladi va yozuv yangilanadi.
    Kuryer buyurtmani ko'rgunga qadar ulguradi.
    """
    with SessionLocal() as db:
        order = db.get(Order, order_id)
        if order is None or order.lat is None or order.lng is None:
            return
        if not is_weak_address_line(order.address_line):
            return
        try:
            line = reverse_geocode(order.lat, order.lng)
        except Exception:  # noqa: BLE001 — manzil aniqlanmasa buyurtma buzilmaydi
            logger.exception("Manzilni aniqlashtirib bo'lmadi: order=%s", order_id)
            return
        if not line:
            return
        # Oraliqda kuryer/admin manzilni qo'lda yozgan bo'lishi mumkin.
        db.refresh(order)
        if is_weak_address_line(order.address_line):
            order.address_line = line
            db.commit()
