from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session, selectinload
import asyncio
import json

from app.api.deps import get_current_admin
from app.core.security import create_access_token, decode_token
from app.core.config import settings
from app.core.db import get_db
from app.models import (
    AdminUser,
    DeliveryZone,
    Order,
    OrderItem,
    PushSubscription,
    Restaurant,
    User,
)
from app.models.enums import AdminRole, OrderStatus
from app.schemas.admin import PushSubscriptionIn
from app.schemas.courier import (
    CourierStats,
    DaySeries,
    EarningsDay,
    EarningsOut,
    OrderAdjustIn,
    RouteStartIn,
    StatBucket,
    LocationUpdateIn,
)
from app.schemas.order import OrderOut, OrderStatusUpdate
from app.services.eta import estimate_minutes
from app.services.geo import shop_origin
from app.services.notify import (
    notify_delivering_eta,
    notify_order_adjusted,
    notify_status_change,
)
from app.services.orders import (
    ensure_transition,
    mark_order_paid_if_cash,
    reserve_stock_atomic,
    restore_stock_atomic,
)
from app.services.receipt import render_receipt
from app.services.route_optimize import RouteStop, optimize_route
from app.services import webpush
from app.services.events import courier_events

router = APIRouter(prefix="/courier", tags=["courier"])

# Kuryer oqimi: "qabul qilish" (accepted) → "yetkazilmoqda" (delivering) →
# "yetkazdim" (/delivered) — kuryer bosishi bilanoq darhol 'delivered'.
# Ilgari mijoz tasdig'ini kutar edi, lekin mijozlar tugmani bosmasdan
# buyurtma abadiy "kutilmoqda"da qolib ketardi — shu sabab olib tashlandi.
COURIER_ALLOWED_STATUSES = {OrderStatus.accepted, OrderStatus.delivering}
COMPLETED_STATUSES = (OrderStatus.delivered, OrderStatus.cancelled)
# Kuryerga biriktirilgan, hali yakunlanmagan har qanday buyurtma "faol" sanaladi —
# admin kuryerni 'ready'dan oldin (confirmed/preparing) biriktirsa ham kuryer ko'radi.
# Aks holda push keladi-yu, ro'yxat bo'sh bo'lib qoladi.
ACTIVE_STATUSES = tuple(s for s in OrderStatus if s not in COMPLETED_STATUSES)

# Buyurtmalar va statistika mahalliy vaqt (Toshkent) bo'yicha guruhlanadi.
TASHKENT = ZoneInfo("Asia/Tashkent")


def get_current_courier(admin: AdminUser = Depends(get_current_admin)) -> AdminUser:
    if admin.role != AdminRole.courier:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Courier only")
    return admin


# SSE uchun qisqa muddatli ticket (daqiqa). To'liq JWT query string'da
# uzoq yashamasin — log/Referer orqali oqish xavfini kamaytiradi.
_SSE_TICKET_MINUTES = 5


def get_current_courier_ws(
    token: str = Query(...),
    db: Session = Depends(get_db),
) -> AdminUser:
    payload = decode_token(token)
    if not payload or payload.get("role") not in {r.value for r in AdminRole}:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    # Faqat qisqa muddatli purpose=sse ticket (to'liq JWT query'da taqiqlanadi).
    if payload.get("purpose") != "sse":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid stream token")
    admin = db.get(AdminUser, int(payload["sub"]))
    if not admin or not admin.is_active or admin.role != AdminRole.courier:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Courier not found")
    return admin


@router.get("/stream-ticket")
def courier_stream_ticket(courier: AdminUser = Depends(get_current_courier)):
    """SSE ulanishi uchun qisqa muddatli token (Authorization: Bearer bilan olinadi)."""
    token = create_access_token(
        subject=str(courier.id),
        role=courier.role.value,
        expires_minutes=_SSE_TICKET_MINUTES,
        purpose="sse",
    )
    return {"token": token, "expires_in": _SSE_TICKET_MINUTES * 60}


def _local_date(dt: datetime):
    """UTC (yoki naive) datetime ni Toshkent sanasiga aylantiradi."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(TASHKENT).date()


def _completion_time(order: Order) -> datetime:
    """Buyurtma yakunlangan vaqt — updated_at, bo'lmasa created_at."""
    return order.updated_at or order.created_at


@router.get("/stream")
async def courier_stream(
    courier: AdminUser = Depends(get_current_courier_ws),
):
    """Kuryer ilovasi ochiqligida real-time bildirishnomalar va pinglar olish uchu SSE endpointi.
    Redis Pub/Sub orqali barcha gunicorn worker'lari bo'ylab ishlaydi.
    Kuryer faqat o'z restoraniga tegishli eventlarni oladi.
    """
    async def event_generator():
        ps = courier_events.subscribe()
        loop = asyncio.get_event_loop()
        try:
            while True:
                # Redis PubSub — blocking, thread pool'da o'qiymiz
                msg = await loop.run_in_executor(None, ps.get_message, timeout=30.0)
                if msg and msg["type"] == "message":
                    data = json.loads(msg["data"])
                    # Faqat o'z restorani eventlarini filtrlaymiz
                    if data.get("restaurant_id") and data["restaurant_id"] != courier.restaurant_id:
                        continue
                    yield f"data: {msg['data']}\n\n"
                else:
                    # Keep-alive ping (SSE ulanishini tirik saqlash)
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            courier_events.unsubscribe(ps)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/location", status_code=status.HTTP_204_NO_CONTENT)
def update_location(
    data: LocationUpdateIn,
    courier: AdminUser = Depends(get_current_courier),
    db: Session = Depends(get_db),
):
    """Kuryerning joriy manzili yangilanadi. Mijoz kuzatib turishi uchun."""
    courier.lat = data.lat
    courier.lng = data.lng
    courier.last_location_update = datetime.now(timezone.utc)
    db.commit()
    # Faol buyurtmasi bor mijozlarga joylashuv event (SSE/Redis).
    courier_events.publish({
        "type": "courier_location",
        "restaurant_id": courier.restaurant_id,
        "courier_id": courier.id,
        "lat": data.lat,
        "lng": data.lng,
    })
    return None


@router.get("/orders", response_model=list[OrderOut])
def courier_orders(
    courier: AdminUser = Depends(get_current_courier),
    db: Session = Depends(get_db),
):
    """Faol buyurtmalar: menga biriktirilgan YOKI hali hech kimga biriktirilmagan
    (yangi) buyurtmalar. Kuryer "qabul qilish" bosib o'ziga oladi (admin tasdig'isiz)."""
    stmt = (
        select(Order)
        .where(
            Order.status.in_(ACTIVE_STATUSES),
            Order.restaurant_id == courier.restaurant_id,
            or_(
                Order.assigned_courier_id == courier.id,
                Order.assigned_courier_id.is_(None),
            ),
        )
        # Marshrut tartibi (delivering) birinchi, keyin qabul/yangi.
        .order_by(
            Order.route_sequence.asc().nulls_last(),
            Order.created_at.asc(),
        )
        .options(selectinload(Order.items), selectinload(Order.assigned_courier))
    )
    return db.scalars(stmt).all()


@router.get("/orders/{order_id}", response_model=OrderOut)
def courier_order(
    order_id: int,
    courier: AdminUser = Depends(get_current_courier),
    db: Session = Depends(get_db),
):
    order = db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items), selectinload(Order.assigned_courier))
    )
    # O'z do'konidan, o'ziniki yoki hali biriktirilmagan buyurtmani ko'rishi mumkin.
    if (
        not order
        or order.restaurant_id != courier.restaurant_id
        or order.assigned_courier_id not in (None, courier.id)
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return order


@router.patch("/orders/{order_id}/adjust", response_model=OrderOut)
def courier_adjust_order(
    order_id: int,
    data: OrderAdjustIn,
    background: BackgroundTasks,
    courier: AdminUser = Depends(get_current_courier),
    db: Session = Depends(get_db),
):
    order = db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items))
    )
    if (
        not order
        or order.assigned_courier_id != courier.id
        or order.restaurant_id != courier.restaurant_id
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")

    if order.status not in (OrderStatus.accepted, OrderStatus.preparing, OrderStatus.ready):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Can only adjust order before delivering starts",
        )

    adjust_map = {item.order_item_id: item.quantity for item in data.items}

    # Oldindan yakuniy miqdorlarni hisoblab, bo'sh buyurtmani va omborni tekshiramiz.
    planned: list[tuple[OrderItem, float]] = []
    changed = False
    for item in order.items:
        new_qty = adjust_map[item.id] if item.id in adjust_map else item.quantity
        if new_qty < 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Miqdor manfiy bo'lishi mumkin emas")
        if abs(new_qty - item.quantity) > 1e-9:
            changed = True
        planned.append((item, new_qty))

    remaining = [(item, q) for item, q in planned if q > 0]
    if not remaining:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Buyurtmada kamida bitta mahsulot qolishi kerak",
        )

    for item, new_qty in planned:
        delta = new_qty - item.quantity
        if delta > 0:
            reserve_stock_atomic(db, item.product_id, delta, product_name=item.name_uz)
        elif delta < 0:
            restore_stock_atomic(db, item.product_id, -delta)
        item.quantity = new_qty

    order.items = [item for item, _q in remaining]
    new_items_total = sum(item.price * item.quantity for item in order.items)
    order.items_total = int(round(new_items_total))
    # Yetkazish haqi o'zgarmaydi (masofa/chegara buyurtma paytida hisoblangan).
    order.total = order.items_total + order.delivery_fee

    customer = db.get(User, order.user_id)
    user_tg = customer.telegram_id if customer else None
    user_lang = (customer.language if customer else None) or "uz"

    db.commit()
    db.refresh(order)
    # items relationship commitdan keyin ham kerak (chek)
    order = db.scalar(
        select(Order)
        .where(Order.id == order.id)
        .options(selectinload(Order.items))
    ) or order

    # Haqiqiy o'zgarish bo'lsa — mijozga yangi chek (3 kg → 3.5 kg va h.k.)
    if changed and user_tg:
        receipt_png = None
        try:
            receipt_png = render_receipt(order)
        except Exception:
            receipt_png = None
        background.add_task(
            notify_order_adjusted,
            order,
            user_tg,
            user_lang,
            receipt_png,
        )

    courier_events.publish({"type": "orders_updated", "restaurant_id": order.restaurant_id})
    return order


def _depot_for_courier(db: Session, courier: AdminUser) -> tuple[float, float] | None:
    """Do'kon origin: restaurant.lat/lng yoki zona markazi."""
    restaurant = db.get(Restaurant, courier.restaurant_id) if courier.restaurant_id else None
    zone = None
    if courier.restaurant_id:
        zone = db.scalar(
            select(DeliveryZone).where(
                DeliveryZone.restaurant_id == courier.restaurant_id,
                DeliveryZone.is_active.is_(True),
            )
        )
    return shop_origin(restaurant, zone)


def _load_accepted_orders(
    db: Session,
    courier: AdminUser,
    order_ids: list[int] | None,
) -> list[Order]:
    stmt = (
        select(Order)
        .where(
            Order.assigned_courier_id == courier.id,
            Order.restaurant_id == courier.restaurant_id,
            Order.status == OrderStatus.accepted,
        )
        .options(selectinload(Order.items), selectinload(Order.assigned_courier))
        .order_by(Order.created_at.asc())
    )
    orders = list(db.scalars(stmt).all())
    if order_ids:
        want = set(order_ids)
        orders = [o for o in orders if o.id in want]
        missing = want - {o.id for o in orders}
        if missing:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Ba'zi buyurtmalar accepted emas yoki sizga biriktirilmagan",
            )
    if not orders:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Yo'lga chiqish uchun accepted buyurtma yo'q",
        )
    if len(orders) > 8:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Bir reysda max 8 ta buyurtma — avval ba'zilarini yetkazing",
        )
    return orders


def _start_route_for_orders(
    db: Session,
    courier: AdminUser,
    orders: list[Order],
    background: BackgroundTasks,
) -> tuple[str, float, list[Order]]:
    """Accepted → delivering + optimal route_sequence. Notify har bir mijozga."""
    depot = _depot_for_courier(db, courier)
    stops = [RouteStop(order_id=o.id, lat=o.lat, lng=o.lng) for o in orders]
    optimized = optimize_route(depot, stops)

    by_id = {o.id: o for o in orders}
    now = datetime.now(timezone.utc)
    cumulative_km = 0.0
    started: list[Order] = []

    for seq, (oid, leg) in enumerate(
        zip(optimized.order_ids, optimized.leg_km), start=1
    ):
        order = by_id[oid]
        ensure_transition(order.status, OrderStatus.delivering)
        cumulative_km += leg
        eta = estimate_minutes(db, cumulative_km if cumulative_km > 0 else order.distance_km)

        transitioned = db.execute(
            update(Order)
            .where(Order.id == order.id, Order.status == OrderStatus.accepted)
            .values(
                status=OrderStatus.delivering,
                delivering_started_at=now,
                eta_minutes=eta,
                route_group_id=optimized.route_group_id,
                route_sequence=seq,
                route_leg_km=leg,
            )
        )
        if transitioned.rowcount == 0:
            db.rollback()
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Buyurtma №{order.number} holati o'zgargan — qayta urinib ko'ring",
            )
        order.status = OrderStatus.delivering
        order.delivering_started_at = now
        order.eta_minutes = eta
        order.route_group_id = optimized.route_group_id
        order.route_sequence = seq
        order.route_leg_km = leg
        started.append(order)

    db.commit()

    # Refresh + notifications
    result: list[Order] = []
    for order in started:
        full = db.scalar(
            select(Order)
            .where(Order.id == order.id)
            .options(selectinload(Order.items), selectinload(Order.assigned_courier))
        ) or order
        result.append(full)
        customer = db.get(User, full.user_id)
        user_tg = customer.telegram_id if customer else None
        user_lang = (customer.language if customer else None) or "uz"
        if user_tg:
            receipt_png = None
            try:
                receipt_png = render_receipt(full)
            except Exception:
                receipt_png = None
            background.add_task(
                notify_delivering_eta,
                full,
                user_tg,
                full.eta_minutes,
                full.distance_km,
                courier.name,
                courier.phone,
                user_lang,
                receipt_png,
            )

    if result:
        courier_events.publish(
            {"type": "orders_updated", "restaurant_id": result[0].restaurant_id}
        )
    return optimized.route_group_id, optimized.total_km, result


@router.post("/route/start")
def courier_start_route(
    data: RouteStartIn,
    background: BackgroundTasks,
    courier: AdminUser = Depends(get_current_courier),
    db: Session = Depends(get_db),
):
    """Yig'ilgan (accepted) buyurtmalarni optimal marshrut tartibida yo'lga chiqaradi.

    Ombor → eng qisqa stop ketma-ketligi (TSP). Har bir buyurtmaga
    route_sequence, route_group_id, ETA beriladi.
    """
    orders = _load_accepted_orders(db, courier, data.order_ids)
    group_id, total_km, started = _start_route_for_orders(db, courier, orders, background)
    return {
        "route_group_id": group_id,
        "total_distance_km": total_km,
        "orders": [OrderOut.model_validate(o) for o in started],
    }


@router.patch("/orders/{order_id}", response_model=OrderOut)
def courier_update_order(
    order_id: int,
    data: OrderStatusUpdate,
    background: BackgroundTasks,
    courier: AdminUser = Depends(get_current_courier),
    db: Session = Depends(get_db),
):
    if data.status not in COURIER_ALLOWED_STATUSES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Courier can only set: {[s.value for s in COURIER_ALLOWED_STATUSES]}",
        )
    order = db.get(Order, order_id)
    if not order or order.restaurant_id != courier.restaurant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")

    # User ma'lumotini commitdan oldin o'qiymiz (lazy-load/detached xavfisiz).
    customer = db.get(User, order.user_id)
    user_tg = customer.telegram_id if customer else None
    user_lang = (customer.language if customer else None) or "uz"

    now = datetime.now(timezone.utc)
    is_accept = data.status == OrderStatus.accepted

    # Egalik: "qabul qilish"da biriktirilmagan buyurtmani o'ziga oladi (claim).
    # Boshqa amallar (delivering) faqat o'z buyurtmasida.
    if order.assigned_courier_id is None:
        if not is_accept:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
        # Atomik claim — ikki kuryer bir vaqtda bossa, faqat biri oladi.
        claimed = db.execute(
            update(Order)
            .where(
                Order.id == order.id,
                Order.restaurant_id == courier.restaurant_id,
                Order.assigned_courier_id.is_(None),
            )
            .values(assigned_courier_id=courier.id)
        )
        if claimed.rowcount == 0:
            db.rollback()
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Buyurtmani boshqa kuryer qabul qildi"
            )
        order.assigned_courier_id = courier.id
    elif order.assigned_courier_id != courier.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")

    # Yetkazish: shu kuryerning BARCHA accepted buyurtmalarini optimal marshrut bilan
    # birga yo'lga chiqaradi (bitta-bitta emas — yoqilg'i tejam).
    if data.status == OrderStatus.delivering:
        if order.assigned_courier_id != courier.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
        # Faqat accepted → delivering; barcha accepted lar bir reysda optimal tartibda.
        ensure_transition(order.status, OrderStatus.delivering)
        if order.status != OrderStatus.accepted:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Faqat 'qabul qilingan' buyurtmani yo'lga chiqarish mumkin",
            )
        accepted = _load_accepted_orders(db, courier, None)
        if order.id not in {o.id for o in accepted}:
            raise HTTPException(status.HTTP_409_CONFLICT, "Buyurtma holati o'zgargan")
        _group, _km, started = _start_route_for_orders(db, courier, accepted, background)
        for o in started:
            if o.id == order_id:
                return o
        return started[0]

    ensure_transition(order.status, data.status)
    prev_status = order.status

    notify_accept = False
    if is_accept and order.courier_accepted_at is None:
        order.courier_accepted_at = now
        notify_accept = True

    # Atomik holat o'tishi — concurrent update yo'qotilmasin.
    transitioned = db.execute(
        update(Order)
        .where(Order.id == order.id, Order.status == prev_status)
        .values(
            status=data.status,
            assigned_courier_id=order.assigned_courier_id,
            courier_accepted_at=order.courier_accepted_at,
        )
    )
    if transitioned.rowcount == 0 and prev_status != data.status:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Buyurtma holati o'zgargan")
    order.status = data.status
    db.commit()
    db.refresh(order)

    # "Qabul qilindi" — mijoz tilida + kuryer ismi/telefon + admin push.
    if notify_accept and user_tg:
        background.add_task(
            notify_status_change,
            order,
            user_tg,
            user_lang,
            courier.name,
            courier.phone,
        )
        background.add_task(
            webpush.notify_admins,
            f"✅ Buyurtma qabul qilindi № {order.number}",
            f"{order.total:,} so'm · {order.address_line}",
            url="/orders",
            tag=f"accepted-{order.id}",
        )
    courier_events.publish({"type": "orders_updated", "restaurant_id": order.restaurant_id})
    return order

@router.post("/orders/{order_id}/delivered", response_model=OrderOut)
def courier_mark_delivered(
    order_id: int,
    background: BackgroundTasks,
    courier: AdminUser = Depends(get_current_courier),
    db: Session = Depends(get_db),
):
    """Kuryer yetkazdi — buyurtma darhol 'delivered' bo'ladi."""
    order = db.get(Order, order_id)
    if not order or order.assigned_courier_id != courier.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if order.status == OrderStatus.delivered:
        return order  # idempotent
    if order.status != OrderStatus.delivering:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Faqat 'yetkazilmoqda' holatidagi buyurtmani yakunlash mumkin",
        )
    customer = db.get(User, order.user_id)
    user_tg = customer.telegram_id if customer else None
    user_lang = (customer.language if customer else None) or "uz"
    ensure_transition(order.status, OrderStatus.delivered)
    now = datetime.now(timezone.utc)
    # Atomik: faqat delivering → delivered (double-deliver no-op).
    mark_order_paid_if_cash(order)
    transitioned = db.execute(
        update(Order)
        .where(
            Order.id == order.id,
            Order.status == OrderStatus.delivering,
            Order.assigned_courier_id == courier.id,
        )
        .values(
            status=OrderStatus.delivered,
            courier_delivered_at=now,
            payment_status=order.payment_status,
        )
    )
    if transitioned.rowcount == 0:
        db.rollback()
        db.refresh(order)
        if order.status == OrderStatus.delivered:
            return order
        raise HTTPException(status.HTTP_409_CONFLICT, "Buyurtma holati o'zgargan")
    order.status = OrderStatus.delivered
    order.courier_delivered_at = now
    db.commit()
    db.refresh(order)
    courier_events.publish({"type": "orders_updated", "restaurant_id": order.restaurant_id})
    if user_tg:
        background.add_task(
            notify_status_change,
            order,
            user_tg,
            user_lang,
            courier.name,
            courier.phone,
        )
    background.add_task(
        webpush.notify_admins,
        f"🎉 Buyurtma yetkazildi № {order.number}",
        f"{order.total:,} so'm · {order.address_line}",
        url="/orders",
        tag=f"delivered-{order.id}",
    )
    return order


@router.get("/history", response_model=list[OrderOut])
def courier_history(
    courier: AdminUser = Depends(get_current_courier),
    db: Session = Depends(get_db),
    status_filter: str | None = Query(default=None, alias="status"),
    days: int | None = Query(default=None, ge=1, le=365),
    limit: int = Query(default=50, ge=1, le=200),
):
    """Menga biriktirilgan yakunlangan buyurtmalar, yangidan eskiga."""
    if status_filter in ("delivered", "cancelled"):
        statuses = [OrderStatus(status_filter)]
    else:
        statuses = list(COMPLETED_STATUSES)

    stmt = select(Order).where(
        Order.status.in_(statuses),
        Order.assigned_courier_id == courier.id,
    )
    if days:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        stmt = stmt.where(Order.updated_at >= since)
    stmt = (
        stmt.order_by(Order.updated_at.desc())
        .limit(limit)
        .options(selectinload(Order.items), selectinload(Order.assigned_courier))
    )
    return db.scalars(stmt).all()


@router.get("/stats", response_model=CourierStats)
def courier_stats(
    courier: AdminUser = Depends(get_current_courier),
    db: Session = Depends(get_db),
):
    """Bosh sahifa uchun: bugun/hafta/oy yig'indilari + 7 kunlik grafik."""
    now = datetime.now(TASHKENT)
    today = now.date()
    week_start = today - timedelta(days=today.weekday())   # dushanba
    month_start = today.replace(day=1)
    series_start = today - timedelta(days=6)
    range_start = min(month_start, series_start)
    range_start_utc = datetime(
        range_start.year, range_start.month, range_start.day, tzinfo=TASHKENT
    ).astimezone(timezone.utc)

    completed = db.scalars(
        select(Order)
        .where(Order.status.in_(COMPLETED_STATUSES))
        .where(Order.assigned_courier_id == courier.id)
        .where(Order.updated_at >= range_start_utc)
    ).all()

    today_b = StatBucket()
    week_b = StatBucket()
    month_b = StatBucket()
    series_map = {
        series_start + timedelta(days=i): DaySeries(date=series_start + timedelta(days=i))
        for i in range(7)
    }

    for o in completed:
        d = _local_date(_completion_time(o))
        delivered = o.status == OrderStatus.delivered
        fee = o.delivery_fee if delivered else 0
        for bucket, start in ((today_b, today), (week_b, week_start), (month_b, month_start)):
            if d >= start:
                if delivered:
                    bucket.delivered += 1
                    bucket.earnings += fee
                else:
                    bucket.cancelled += 1
        if d in series_map and delivered:
            series_map[d].delivered += 1
            series_map[d].earnings += fee

    active_total = len(
        db.scalars(
            select(Order.id).where(
                Order.status.in_(ACTIVE_STATUSES),
                Order.assigned_courier_id == courier.id,
            )
        ).all()
    )

    return CourierStats(
        today=today_b,
        week=week_b,
        month=month_b,
        active=active_total,
        series=[series_map[k] for k in sorted(series_map)],
    )


@router.get("/earnings", response_model=EarningsOut)
def courier_earnings(
    courier: AdminUser = Depends(get_current_courier),
    db: Session = Depends(get_db),
    days: int = Query(default=30, ge=1, le=90),
):
    """Kunlik daromad (yetkazilgan buyurtmalar delivery_fee yig'indisi)."""
    now = datetime.now(TASHKENT)
    today = now.date()
    start = today - timedelta(days=days - 1)
    start_utc = datetime(
        start.year, start.month, start.day, tzinfo=TASHKENT
    ).astimezone(timezone.utc)

    delivered = db.scalars(
        select(Order)
        .where(Order.status == OrderStatus.delivered)
        .where(Order.assigned_courier_id == courier.id)
        .where(Order.updated_at >= start_utc)
    ).all()

    series_map = {
        start + timedelta(days=i): EarningsDay(date=start + timedelta(days=i))
        for i in range(days)
    }
    total_delivered = 0
    total_earnings = 0
    for o in delivered:
        d = _local_date(_completion_time(o))
        if d in series_map:
            series_map[d].delivered += 1
            series_map[d].earnings += o.delivery_fee
            total_delivered += 1
            total_earnings += o.delivery_fee

    return EarningsOut(
        days=days,
        total_delivered=total_delivered,
        total_earnings=total_earnings,
        series=[series_map[k] for k in sorted(series_map)],
    )


# ── Web Push (kuryer PWA) + FCM (native APK) ─────────────────────
@router.get("/push/public-key")
def courier_push_public_key(_: AdminUser = Depends(get_current_courier)):
    return {"public_key": settings.vapid_public_key}


@router.post("/push/subscribe", status_code=201)
def courier_push_subscribe(
    data: PushSubscriptionIn,
    courier: AdminUser = Depends(get_current_courier),
    db: Session = Depends(get_db),
):
    sub = db.scalar(select(PushSubscription).where(PushSubscription.endpoint == data.endpoint))
    if sub:
        sub.p256dh = data.keys.p256dh
        sub.auth = data.keys.auth
        sub.admin_user_id = courier.id
    else:
        db.add(PushSubscription(
            endpoint=data.endpoint,
            p256dh=data.keys.p256dh,
            auth=data.keys.auth,
            admin_user_id=courier.id,
        ))
    db.commit()
    return {"ok": True}


class FcmTokenIn(BaseModel):
    fcm_token: str = Field(min_length=10, max_length=512)


@router.post("/push/fcm-token", status_code=200)
def courier_fcm_token(
    data: FcmTokenIn,
    courier: AdminUser = Depends(get_current_courier),
    db: Session = Depends(get_db),
):
    """Native kuryer APK FCM tokenini saqlash (login/resume)."""
    token = data.fcm_token.strip()
    # Bir token faqat bitta kuryerga bog'lansin (qurilma boshqa akkauntga o'tganda).
    db.execute(
        update(AdminUser)
        .where(AdminUser.fcm_token == token, AdminUser.id != courier.id)
        .values(fcm_token=None)
    )
    row = db.get(AdminUser, courier.id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Courier topilmadi")
    row.fcm_token = token
    db.commit()
    return {"ok": True}


@router.delete("/push/fcm-token", status_code=200)
def courier_fcm_token_clear(
    courier: AdminUser = Depends(get_current_courier),
    db: Session = Depends(get_db),
):
    """Logout: shu akkaunt FCM tokenini o'chirish."""
    row = db.get(AdminUser, courier.id)
    if row:
        row.fcm_token = None
        db.commit()
    return {"ok": True}


@router.post("/push/test")
def courier_push_test(
    courier: AdminUser = Depends(get_current_courier),
    db: Session = Depends(get_db),
):
    """Kuryer o'z qurilmasiga test bildirishnoma (Web Push + FCM)."""
    from app.services import fcm

    webpush.notify_courier(
        courier.id,
        "BB Kuryer",
        "Bildirishnoma ishlayapti ✅",
        url="/courier/orders",
        tag="push-test",
    )
    fcm.notify_courier(
        courier.id,
        "BB Kuryer",
        "Bildirishnoma ishlayapti ✅",
        url="/orders",
        tag="push-test",
    )
    row = db.get(AdminUser, courier.id)
    return {
        "ok": True,
        "vapid_configured": bool(settings.vapid_private_key),
        "fcm_configured": fcm.configured(),
        "has_fcm_token": bool(row.fcm_token if row else None),
    }
