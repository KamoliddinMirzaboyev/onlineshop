from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session, selectinload
import asyncio
import json

from app.api.deps import get_current_admin
from app.core.security import create_access_token, decode_token
from app.core.config import settings
from app.core.db import get_db
from app.models import AdminUser, Order, OrderItem, PushSubscription, User
from app.models.enums import AdminRole, OrderStatus
from app.schemas.admin import PushSubscriptionIn
from app.schemas.courier import (
    CourierStats,
    DaySeries,
    EarningsDay,
    EarningsOut,
    OrderAdjustIn,
    StatBucket,
    LocationUpdateIn,
)
from app.schemas.order import OrderOut, OrderStatusUpdate
from app.services.eta import estimate_minutes
from app.services.notify import (
    notify_delivering_eta,
    notify_status_change,
)
from app.services.orders import (
    ensure_transition,
    mark_order_paid_if_cash,
    reserve_stock_atomic,
    restore_stock_atomic,
)
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
    # Faqat purpose=sse ticket yoki (orqaga moslik) oddiy kuryer token.
    purpose = payload.get("purpose")
    if purpose is not None and purpose != "sse":
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
        .order_by(Order.created_at.asc())
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
    for item in order.items:
        new_qty = adjust_map[item.id] if item.id in adjust_map else item.quantity
        if new_qty < 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Miqdor manfiy bo'lishi mumkin emas")
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

    db.commit()
    db.refresh(order)
    return order


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

    ensure_transition(order.status, data.status)

    notify_accept = False
    if is_accept and order.courier_accepted_at is None:
        order.courier_accepted_at = now
        notify_accept = True

    notify_eta = False
    if data.status == OrderStatus.delivering and order.delivering_started_at is None:
        order.delivering_started_at = now
        # Taxminiy yetkazib berish vaqti — masofa + o'rganilgan min/km asosida.
        order.eta_minutes = estimate_minutes(db, order.distance_km)
        notify_eta = True

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
    # "Yetkazilmoqda" — mijoz tilida masofa + ETA + kuryer.
    if notify_eta and user_tg:
        background.add_task(
            notify_delivering_eta,
            order,
            user_tg,
            order.eta_minutes,
            order.distance_km,
            courier.name,
            courier.phone,
            user_lang,
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
    order.courier_delivered_at = datetime.now(timezone.utc)
    # Stock buyurtma yaratilganda zaxiralangan — qayta kamaytirilmaydi.
    mark_order_paid_if_cash(order)
    order.status = OrderStatus.delivered
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


# ── Web Push (kuryer ilovasi) ────────────────────────────────────
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


@router.post("/push/test")
def courier_push_test(courier: AdminUser = Depends(get_current_courier)):
    """Kuryer o'z qurilmasiga test bildirishnoma yuboradi."""
    webpush.notify_courier(
        courier.id,
        "BB Kuryer",
        "Bildirishnoma ishlayapti ✅",
        url="/orders",
        tag="push-test",
    )
    return {"ok": True, "vapid_configured": bool(settings.vapid_private_key)}
