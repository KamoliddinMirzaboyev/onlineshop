from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload

from app.api.deps import (
    current_restaurant, get_current_staff_or_business, require_staff,
    require_store_admin_or_business,
)
from app.core.config import settings
from app.core.cache import invalidate_restaurant_catalog
from app.core.db import get_db
from app.models import (
    AdminUser, Business, Category, CategoryGroup, Order, OrderItem, Product,
    PushSubscription, Restaurant, SupplyRecord, User,
)
from app.models.enums import OrderStatus
from app.schemas.admin import (
    DashboardStats, NotificationEvent, PeriodPoint, PushSubscriptionIn, ReportsOut,
    StockUpdate, SupplyRecordIn, SupplyRecordOut, TopProduct,
)
from app.schemas.admin import AdminUserOut
from app.schemas.catalog import (
    CategoryGroupIn, CategoryGroupOut, CategoryIn, CategoryOut, ProductIn, ProductOut,
    RestaurantOut, StoreSettingsIn,
)
from app.schemas.admin import DeliveryZoneIn, DeliveryZoneOut
from app.models import DeliveryZone
from app.models.enums import AdminRole
from app.schemas.order import OrderOut, OrderStatusUpdate
from app.services import webpush
from app.services.notify import broadcast_post, notify_status_change
from app.services.orders import ensure_transition

# Autentifikatsiya poli: hech bir endpoint tokensiz ochilib qolmasligi uchun.
# Har bir endpoint ustiga o'z scoping/ruxsat dependency'sini qo'shadi.
router = APIRouter(
    prefix="/admin", tags=["admin"],
    dependencies=[Depends(get_current_staff_or_business)],
)


# ── Store ────────────────────────────────────────────────────────
@router.get("/store", response_model=RestaurantOut)
def get_store(store: Restaurant = Depends(current_restaurant)):
    return store


@router.put("/store", response_model=RestaurantOut)
def update_store(
    data: StoreSettingsIn,
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    for k, v in data.model_dump().items():
        setattr(store, k, v)
    db.commit()
    db.refresh(store)
    return store


# ── Delivery zone (yetkazish hududi, doira) — faqat do'kon xodimi ─
@router.get("/delivery-zone", response_model=DeliveryZoneOut | None)
def get_delivery_zone(
    _: AdminUser = Depends(require_staff),
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    return db.scalar(
        select(DeliveryZone)
        .where(DeliveryZone.restaurant_id == store.id)
        .order_by(DeliveryZone.id)
        .limit(1)
    )


@router.put("/delivery-zone", response_model=DeliveryZoneOut)
def set_delivery_zone(
    data: DeliveryZoneIn,
    _: AdminUser = Depends(require_staff),
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    zone = db.scalar(
        select(DeliveryZone)
        .where(DeliveryZone.restaurant_id == store.id)
        .order_by(DeliveryZone.id)
        .limit(1)
    )
    if zone:
        for k, v in data.model_dump().items():
            setattr(zone, k, v)
    else:
        zone = DeliveryZone(**data.model_dump(), restaurant_id=store.id)
        db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


# ── Courier accounts (biriktirish uchun) — faqat do'kon xodimi ───
@router.get("/courier-accounts", response_model=list[AdminUserOut])
def list_courier_accounts(
    _: AdminUser = Depends(require_staff),
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(AdminUser)
        .where(
            AdminUser.role == AdminRole.courier,
            AdminUser.is_active.is_(True),
            AdminUser.restaurant_id == store.id,
        )
        .order_by(AdminUser.username)
    ).all()


# ── Web Push (bildirishnoma) ─────────────────────────────────────
@router.get("/push/public-key")
def push_public_key(_: AdminUser = Depends(require_staff)):
    return {"public_key": settings.vapid_public_key}


@router.post("/push/subscribe", status_code=201)
def push_subscribe(
    data: PushSubscriptionIn,
    _: AdminUser = Depends(require_staff),
    db: Session = Depends(get_db),
):
    sub = db.scalar(select(PushSubscription).where(PushSubscription.endpoint == data.endpoint))
    if sub:
        sub.p256dh = data.keys.p256dh
        sub.auth = data.keys.auth
    else:
        db.add(PushSubscription(endpoint=data.endpoint, p256dh=data.keys.p256dh, auth=data.keys.auth))
    db.commit()
    return {"ok": True}


@router.post("/push/test")
def push_test(_: AdminUser = Depends(require_staff)):
    webpush.notify_admins("Barakali Bozor", "Bildirishnoma ishlayapti ✅", "/")
    return {"ok": True}


# ── Aggregation helpers ──────────────────────────────────────────
# Profit = Σ (sotuv narxi − tannarx) × soni, faqat yetkazilgan buyurtmalar.
# Tannarx OrderItem.cost dan olinadi — sotuv vaqtidagi snapshot (Product.cost
# keyin o'zgarsa ham tarixiy foyda buzilmaydi).
def _agg(db: Session, rids: list[int], start: datetime | None = None) -> tuple[int, int, int]:
    delivered = OrderStatus.delivered
    cond = [Order.status == delivered, Order.restaurant_id.in_(rids)]
    if start is not None:
        cond.append(Order.created_at >= start)

    orders = db.scalar(select(func.count(Order.id)).where(*cond)) or 0
    revenue = db.scalar(
        select(func.coalesce(func.sum(Order.total), 0)).where(*cond)
    ) or 0
    profit = db.scalar(
        select(
            func.coalesce(
                func.sum((OrderItem.price - OrderItem.cost) * OrderItem.quantity), 0
            )
        )
        .select_from(Order)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(*cond)
    ) or 0
    return int(orders), int(revenue), int(profit)


def _series(db: Session, rids: list[int], trunc: str, start: datetime) -> list[PeriodPoint]:
    delivered = OrderStatus.delivered
    period = func.date_trunc(trunc, Order.created_at)
    rows = db.execute(
        select(
            period.label("p"),
            func.count(func.distinct(Order.id)),
            func.coalesce(func.sum(OrderItem.price * OrderItem.quantity), 0),
            func.coalesce(
                func.sum((OrderItem.price - OrderItem.cost) * OrderItem.quantity), 0
            ),
        )
        .select_from(Order)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(
            Order.status == delivered,
            Order.created_at >= start,
            Order.restaurant_id.in_(rids),
        )
        .group_by(period)
        .order_by(period)
    ).all()
    return [
        PeriodPoint(period=p.isoformat(), orders=o, revenue=int(r), profit=int(pf))
        for p, o, r, pf in rows
    ]


def _top_products(db: Session, rids: list[int], start: datetime | None = None, limit: int = 20) -> list[TopProduct]:
    delivered = OrderStatus.delivered
    cond = [Order.status == delivered, Order.restaurant_id.in_(rids)]
    if start is not None:
        cond.append(Order.created_at >= start)
        
    rows = db.execute(
        select(
            Product.id,
            Product.name_uz,
            Product.image_url,
            func.coalesce(func.sum(OrderItem.quantity), 0).label("qty"),
            func.coalesce(func.sum(OrderItem.price * OrderItem.quantity), 0).label("rev"),
            func.coalesce(
                func.sum((OrderItem.price - OrderItem.cost) * OrderItem.quantity), 0
            ).label("prof"),
        )
        .select_from(OrderItem)
        .join(Order, Order.id == OrderItem.order_id)
        .join(Product, Product.id == OrderItem.product_id)
        .where(*cond)
        .group_by(Product.id, Product.name_uz, Product.image_url)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(limit)
    ).all()
    return [
        TopProduct(
            product_id=pid, name_uz=name, image_url=img,
            quantity=float(qty), revenue=int(rev), profit=int(prof),
        )
        for pid, name, img, qty, rev, prof in rows
    ]


# ── Dashboard ────────────────────────────────────────────────────
@router.get("/stats", response_model=DashboardStats)
def stats(store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)):
    rid = store.id
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week = today - timedelta(days=7)
    month = today - timedelta(days=30)

    o_today, r_today, p_today = _agg(db, [rid], today)
    o_week, r_week, p_week = _agg(db, [rid], week)
    o_month, r_month, p_month = _agg(db, [rid], month)
    o_total, r_total, p_total = _agg(db, [rid], None)

    pending_orders = db.scalar(
        select(func.count(Order.id)).where(
            Order.status == OrderStatus.pending, Order.restaurant_id == rid
        )
    ) or 0
    users_total = db.scalar(
        select(func.count(func.distinct(Order.user_id))).where(Order.restaurant_id == rid)
    ) or 0
    products_total = db.scalar(
        select(func.count(Product.id)).where(Product.restaurant_id == rid)
    ) or 0
    low_stock_count = db.scalar(
        select(func.count(Product.id)).where(
            Product.stock <= Product.low_stock_threshold, Product.restaurant_id == rid
        )
    ) or 0

    return DashboardStats(
        orders_today=o_today, revenue_today=r_today, profit_today=p_today,
        orders_week=o_week, revenue_week=r_week, profit_week=p_week,
        orders_month=o_month, revenue_month=r_month, profit_month=p_month,
        orders_total=o_total, revenue_total=r_total, profit_total=p_total,
        pending_orders=pending_orders,
        users_total=users_total,
        products_total=products_total,
        low_stock_count=low_stock_count,
        top_products=_top_products(db, [rid], limit=5),
    )


# ── Reports (hisobot) ────────────────────────────────────────────
@router.get("/reports", response_model=ReportsOut)
def reports(period: str = "daily", store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)):
    rid = store.id
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    if period == "daily":
        start = today # Bugun
        trunc = "hour"
    elif period == "weekly":
        start = today - timedelta(days=7) # Oxirgi 7 kun
        trunc = "day"
    elif period == "monthly":
        start = today - timedelta(days=30) # Oxirgi 30 kun
        trunc = "day"
    else:
        start = today - timedelta(days=30)
        trunc = "day"

    o, r, p = _agg(db, [rid], start)
    return ReportsOut(
        totals={"orders": o, "revenue": r, "profit": p},
        series=_series(db, [rid], trunc, start),
        top_products=_top_products(db, [rid], start=start, limit=20),
    )


# ── Titles (category_groups) — bosh sahifada kategoriyalarni sarlavha ostida
# guruhlash uchun. Faqat top-level kategoriya yaratishda tanlanadi.
@router.get("/restaurants/{rid}/category-groups", response_model=list[CategoryGroupOut])
def list_category_groups(
    rid: int, store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)
):
    if rid != store.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your store")
    return db.scalars(
        select(CategoryGroup).where(CategoryGroup.restaurant_id == rid).order_by(CategoryGroup.sort_order)
    ).all()


@router.post("/category-groups", response_model=CategoryGroupOut, status_code=201)
def create_category_group(
    data: CategoryGroupIn,
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    g = CategoryGroup(**data.model_dump(), restaurant_id=store.id)
    db.add(g)
    db.commit()
    db.refresh(g)
    invalidate_restaurant_catalog(store.id)
    return g


@router.put("/category-groups/{gid}", response_model=CategoryGroupOut)
def update_category_group(
    gid: int,
    data: CategoryGroupIn,
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    g = db.get(CategoryGroup, gid)
    if not g or g.restaurant_id != store.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    for k, v in data.model_dump().items():
        setattr(g, k, v)
    db.commit()
    db.refresh(g)
    invalidate_restaurant_catalog(store.id)
    return g


@router.delete("/category-groups/{gid}", status_code=204)
def delete_category_group(
    gid: int, store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)
):
    g = db.get(CategoryGroup, gid)
    if g and g.restaurant_id == store.id:
        db.delete(g)  # categories.group_id SET NULL (ondelete) — kategoriyalar o'chmaydi
        db.commit()
        invalidate_restaurant_catalog(store.id)


# ── Categories ───────────────────────────────────────────────────
@router.get("/restaurants/{rid}/categories", response_model=list[CategoryOut])
def list_categories(
    rid: int, store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)
):
    if rid != store.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your store")
    return db.scalars(
        select(Category).where(Category.restaurant_id == rid).order_by(Category.sort_order)
    ).all()


def _check_parent(db: Session, parent_id: int | None, restaurant_id: int) -> None:
    if parent_id is None:
        return
    parent = db.get(Category, parent_id)
    if not parent or parent.parent_id is not None or parent.restaurant_id != restaurant_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "faqat 2 daraja — subkategoriya ichida subkategoriya bo'lmaydi",
        )


def _check_group(db: Session, group_id: int | None, restaurant_id: int) -> None:
    if group_id is None:
        return
    group = db.get(CategoryGroup, group_id)
    if not group or group.restaurant_id != restaurant_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Title topilmadi")


@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(
    data: CategoryIn,
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    _check_parent(db, data.parent_id, store.id)
    _check_group(db, data.group_id, store.id)
    c = Category(**data.model_dump(), restaurant_id=store.id)
    db.add(c)
    db.commit()
    db.refresh(c)
    invalidate_restaurant_catalog(store.id)
    return c


@router.put("/categories/{cid}", response_model=CategoryOut)
def update_category(
    cid: int,
    data: CategoryIn,
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    c = db.get(Category, cid)
    if not c or c.restaurant_id != store.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    _check_parent(db, data.parent_id, store.id)
    _check_group(db, data.group_id, store.id)
    for k, v in data.model_dump().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    invalidate_restaurant_catalog(store.id)
    return c


@router.delete("/categories/{cid}", status_code=204)
def delete_category(
    cid: int, store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)
):
    c = db.get(Category, cid)
    if c and c.restaurant_id == store.id:
        db.delete(c)
        db.commit()
        invalidate_restaurant_catalog(store.id)


# ── Products ─────────────────────────────────────────────────────
@router.get("/restaurants/{rid}/products", response_model=list[ProductOut])
def list_products(
    rid: int, store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)
):
    if rid != store.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your store")
    return db.scalars(
        select(Product).where(Product.restaurant_id == rid).order_by(Product.sort_order)
    ).all()


def _check_subcategory(db: Session, category_id: int, restaurant_id: int) -> None:
    category = db.get(Category, category_id)
    if not category or category.parent_id is None or category.restaurant_id != restaurant_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Mahsulot faqat subkategoriyaga biriktirilishi mumkin",
        )


@router.post("/products", response_model=ProductOut, status_code=201)
def create_product(
    data: ProductIn,
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    _check_subcategory(db, data.category_id, store.id)
    p = Product(**data.model_dump(), restaurant_id=store.id)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.put("/products/{pid}", response_model=ProductOut)
def update_product(
    pid: int,
    data: ProductIn,
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    p = db.get(Product, pid)
    if not p or p.restaurant_id != store.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    _check_subcategory(db, data.category_id, store.id)
    for k, v in data.model_dump().items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/products/{pid}", status_code=204)
def delete_product(
    pid: int, store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)
):
    p = db.get(Product, pid)
    if p and p.restaurant_id == store.id:
        db.delete(p)
        db.commit()


# ── Warehouse / stock (ombor) ────────────────────────────────────
@router.patch("/products/{pid}/stock", response_model=ProductOut)
def update_stock(
    pid: int,
    data: StockUpdate,
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    p = db.get(Product, pid)
    if not p or p.restaurant_id != store.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    p.stock = data.stock
    if data.low_stock_threshold is not None:
        p.low_stock_threshold = data.low_stock_threshold
    db.commit()
    db.refresh(p)
    return p


# ── Orders board ─────────────────────────────────────────────────
@router.get("/orders", response_model=list[OrderOut])
def admin_orders(
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
    status_filter: OrderStatus | None = None,
    limit: int = 100,
    offset: int = 0,
):
    limit = max(1, min(limit, 200))
    stmt = (
        select(Order)
        .where(Order.restaurant_id == store.id)
        .order_by(Order.created_at.desc())
        .options(selectinload(Order.items), selectinload(Order.assigned_courier))
    )
    if status_filter:
        stmt = stmt.where(Order.status == status_filter)
    stmt = stmt.limit(limit).offset(max(0, offset))
    return db.scalars(stmt).all()


@router.patch("/orders/{order_id}", response_model=OrderOut)
def update_order_status(
    order_id: int,
    data: OrderStatusUpdate,
    background: BackgroundTasks,
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    """Admin faqat kuzatib boradi va buyurtmani bekor qila oladi — qabul qilish
    va kuryer biriktirish kuryerning o'zi tomonidan amalga oshiriladi."""
    order = db.get(Order, order_id)
    if not order or order.restaurant_id != store.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if data.status != OrderStatus.cancelled:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Admin faqat buyurtmani bekor qila oladi",
        )

    ensure_transition(order.status, data.status)
    order.status = data.status

    db.commit()
    db.refresh(order)
    user_tg = order.user.telegram_id if order.user else None
    user_lang = (order.user.language if order.user else None) or "uz"
    if user_tg:
        background.add_task(notify_status_change, order, user_tg, user_lang)
    return order


@router.get("/delivery-stats")
def delivery_analytics(
    store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)
):
    """Yetkazib berish o'rtachalari: namuna soni, o'rtacha masofa/vaqt, min/km (ETA o'rganish)."""
    from app.services.eta import delivery_stats

    return delivery_stats(db, restaurant_id=store.id)


def _user_dict(u: User) -> dict:
    return {
        "id": u.id,
        "telegram_id": u.telegram_id,
        "username": u.username,
        "first_name": u.first_name,
        "phone": u.phone,
        "language": u.language,
        "is_blocked": u.is_blocked,
        "created_at": u.created_at,
    }


# ── Users (read-only list) — do'kon mijozlari ───────────────────
@router.get("/users")
def list_users(
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
    limit: int = 100,
    offset: int = 0,
):
    """Faqat shu do'kondan buyurtma bergan mijozlar."""
    delivered = OrderStatus.delivered
    
    rows = db.execute(
        select(
            User,
            func.count(Order.id).label("order_count"),
            func.coalesce(func.sum(Order.total), 0).label("total_spent")
        )
        .outerjoin(Order, (Order.user_id == User.id) & (Order.restaurant_id == store.id) & (Order.status == delivered))
        .where(User.id.in_(select(Order.user_id).where(Order.restaurant_id == store.id)))
        .group_by(User.id)
        .order_by(User.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    
    return [
        {
            **_user_dict(u),
            "order_count": int(count),
            "total_spent": int(spent)
        }
        for u, count, spent in rows
    ]


# ── Post — botga mijozlarga xabar yuborish (rasm/matn/ikkalasi) ─
class _BroadcastIn(BaseModel):
    text: str = ""
    image_url: str | None = None


@router.post("/broadcast")
def broadcast(
    data: _BroadcastIn,
    background: BackgroundTasks,
    _principal = Depends(require_store_admin_or_business),
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    text = data.text.strip()
    if not text and not data.image_url:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Matn yoki rasm kerak")

    telegram_ids = db.scalars(
        select(User.telegram_id)
        .where(User.id.in_(select(Order.user_id).where(Order.restaurant_id == store.id)))
        .where(~User.is_blocked)
    ).all()

    background.add_task(broadcast_post, list(telegram_ids), text, data.image_url)
    return {"sent_to": len(telegram_ids)}


# ── Supply records (yetkazib beruvchilar) ────────────────────────
def _supply_out(s: SupplyRecord) -> SupplyRecordOut:
    d = SupplyRecordOut.model_validate(s)
    d.product_name = s.product.name_uz if s.product else ""
    d.restaurant_id = s.product.restaurant_id if s.product else 0
    return d


@router.get("/supplies", response_model=list[SupplyRecordOut])
def list_supplies(
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
    product_id: int | None = None,
    limit: int = 100,
):
    stmt = (
        select(SupplyRecord)
        .join(Product, Product.id == SupplyRecord.product_id)
        .where(Product.restaurant_id == store.id)
        .options(selectinload(SupplyRecord.product))
        .order_by(SupplyRecord.supply_date.desc(), SupplyRecord.created_at.desc())
        .limit(limit)
    )
    if product_id:
        stmt = stmt.where(SupplyRecord.product_id == product_id)
    return [_supply_out(s) for s in db.scalars(stmt).all()]


@router.post("/supplies", response_model=SupplyRecordOut, status_code=201)
def create_supply(
    data: SupplyRecordIn,
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    prod = db.get(Product, data.product_id)
    if not prod or prod.restaurant_id != store.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    total = int(data.quantity * data.cost_per_unit)
    s = SupplyRecord(**data.model_dump(), total_cost=total)
    db.add(s)
    prod.stock += int(data.quantity)
    db.commit()
    db.refresh(s)
    db.refresh(s, ["product"])
    return _supply_out(s)


@router.delete("/supplies/{sid}", status_code=204)
def delete_supply(
    sid: int, store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)
):
    s = db.get(SupplyRecord, sid)
    if not s:
        return
    prod = db.get(Product, s.product_id)
    if not prod or prod.restaurant_id != store.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    prod.stock = max(0, prod.stock - int(s.quantity))
    db.delete(s)
    db.commit()





# ── Admin users (kuryer akkauntlarini boshqarish) ───────────────
from app.core.security import hash_password  # noqa: E402
from app.models.enums import AdminRole  # noqa: E402


class _AdminUserCreateIn(BaseModel):
    username: str
    password: str
    name: str | None = None
    phone: str | None = None
    role: AdminRole = AdminRole.courier


@router.get("/admin-users", response_model=list[AdminUserOut])
def list_admin_users(
    principal = Depends(require_store_admin_or_business),
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    stmt = select(AdminUser).where(AdminUser.restaurant_id == store.id)
    if isinstance(principal, AdminUser):
        stmt = stmt.where(AdminUser.id != principal.id)
    return db.scalars(stmt.order_by(AdminUser.created_at.desc())).all()


@router.post("/admin-users", response_model=AdminUserOut, status_code=201)
def create_admin_user(
    data: _AdminUserCreateIn,
    _principal = Depends(require_store_admin_or_business),
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    if db.scalar(select(AdminUser).where(AdminUser.username == data.username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already taken")
    # Telefon orqali login qilish uchun raqam boshqa xodimda takrorlanmasligi kerak
    # (aks holda login'da qaysi xodim ekani noaniq bo'lib qoladi).
    if data.phone and db.scalar(select(AdminUser).where(AdminUser.phone == data.phone)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu telefon raqam allaqachon band")
    u = AdminUser(
        username=data.username,
        hashed_password=hash_password(data.password),
        name=data.name,
        phone=data.phone,
        role=data.role,
        restaurant_id=store.id,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@router.patch("/admin-users/{uid}/toggle", response_model=AdminUserOut)
def toggle_admin_user(
    uid: int,
    _principal = Depends(require_store_admin_or_business),
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    u = db.get(AdminUser, uid)
    if not u or u.restaurant_id != store.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    u.is_active = not u.is_active
    db.commit()
    db.refresh(u)
    return u


class _PasswordUpdateIn(BaseModel):
    password: str


@router.patch("/admin-users/{uid}/password", response_model=AdminUserOut)
def update_admin_user_password(
    uid: int,
    data: _PasswordUpdateIn,
    _principal = Depends(require_store_admin_or_business),
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    u = db.get(AdminUser, uid)
    if not u or u.restaurant_id != store.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    u.hashed_password = hash_password(data.password)
    db.commit()
    db.refresh(u)
    return u


@router.delete("/admin-users/{uid}", status_code=204)
def delete_admin_user(
    uid: int,
    principal = Depends(require_store_admin_or_business),
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    u = db.get(AdminUser, uid)
    if not u or u.restaurant_id != store.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    if isinstance(principal, AdminUser) and u.id == principal.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "O'zingizni o'chira olmaysiz")
    if u.role == AdminRole.courier:
        db.execute(
            update(Order)
            .where(Order.courier_id == uid)
            .values(courier_id=None)
        )
    db.delete(u)
    db.commit()


# ── Notifications (bildirishnoma) — recent order activity, derived from
# the orders table directly (no separate notification log to maintain) ──
@router.get("/notifications", response_model=list[NotificationEvent])
def list_notifications(
    store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)
):
    orders = db.scalars(
        select(Order)
        .where(Order.restaurant_id == store.id)
        .order_by(Order.created_at.desc())
        .limit(50)
    ).all()

    events: list[NotificationEvent] = []
    for o in orders:
        events.append(NotificationEvent(
            type="new", order_id=o.id, order_number=o.number,
            total=o.total, address_line=o.address_line, at=o.created_at,
        ))
        if o.courier_accepted_at:
            events.append(NotificationEvent(
                type="accepted", order_id=o.id, order_number=o.number,
                total=o.total, address_line=o.address_line, at=o.courier_accepted_at,
            ))
        if o.courier_delivered_at:
            events.append(NotificationEvent(
                type="delivered", order_id=o.id, order_number=o.number,
                total=o.total, address_line=o.address_line, at=o.courier_delivered_at,
            ))

    events.sort(key=lambda e: e.at, reverse=True)
    return events[:30]
