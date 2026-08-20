from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_platform_admin
from app.core.cache import invalidate_restaurant_catalog
from app.core.db import get_db
from app.core.security import hash_password
from sqlalchemy import delete as sqla_delete

from app.models import Announcement, Business, Order, OrderItem, Restaurant, User
from app.schemas.admin import AnnouncementIn, AnnouncementOut
from app.schemas.catalog import RestaurantOut
from app.schemas.business import (
    BusinessBreakdown,
    BusinessCreateIn,
    BusinessOut,
    BusinessRow,
    PlatformStatsOut,
    PlatformStoreRow,
)
from app.services import analytics
from app.services.announcements import broadcast

# Butun platforma ustidan boshqaruv — faqat platform superadmin.
router = APIRouter(
    prefix="/platform", tags=["platform"],
    dependencies=[Depends(require_platform_admin)],
)


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


class UserBlockIn(BaseModel):
    blocked: bool


# ── Users — butun platformadagi mijozlar ─────────────────────────
@router.get("/users")
def list_users(db: Session = Depends(get_db), limit: int = 100, offset: int = 0):
    """Barcha bot foydalanuvchilari. /admin/users'dan farqli — do'konga cheklanmagan."""
    limit = max(1, min(limit, 200))
    rows = db.scalars(
        select(User).order_by(User.created_at.desc()).limit(limit).offset(max(0, offset))
    ).all()
    return [_user_dict(u) for u in rows]


# ── Users — bloklash / o'chirish (platforma darajasidagi amal) ───
@router.patch("/users/{uid}/block")
def set_user_blocked(uid: int, data: UserBlockIn, db: Session = Depends(get_db)):
    user = db.get(User, uid)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    user.is_blocked = data.blocked
    db.commit()
    db.refresh(user)
    return _user_dict(user)


@router.delete("/users/{uid}", status_code=204)
def delete_user(uid: int, db: Session = Depends(get_db)):
    """Hard delete: foydalanuvchi + buyurtmalari + adreslari butunlay o'chadi.

    Order.user_id da ondelete yo'q, shuning uchun buyurtma satrlari va
    buyurtmalarni qo'lda o'chiramiz; adreslar User cascade orqali ketadi.
    """
    user = db.get(User, uid)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    order_ids = db.scalars(select(Order.id).where(Order.user_id == uid)).all()
    if order_ids:
        db.execute(sqla_delete(OrderItem).where(OrderItem.order_id.in_(order_ids)))
        db.execute(sqla_delete(Order).where(Order.id.in_(order_ids)))
    db.delete(user)  # addresses cascade via relationship
    db.commit()


# ── Businesses (tadbirkorlar) ────────────────────────────────────
@router.get("/businesses", response_model=list[BusinessRow])
def list_businesses(db: Session = Depends(get_db)):
    rows = db.execute(
        select(Business, func.count(Restaurant.id))
        .outerjoin(Restaurant, Restaurant.business_id == Business.id)
        .group_by(Business.id)
        .order_by(Business.created_at.desc())
    ).all()
    return [
        BusinessRow(**BusinessOut.model_validate(b).model_dump(), stores_count=n)
        for b, n in rows
    ]


@router.post("/businesses", response_model=BusinessOut, status_code=201)
def create_business(data: BusinessCreateIn, db: Session = Depends(get_db)):
    if db.scalar(select(Business).where(Business.username == data.username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already taken")
    b = Business(
        name=data.name,
        username=data.username,
        phone=data.phone,
        hashed_password=hash_password(data.password),
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return b


@router.patch("/businesses/{bid}/toggle", response_model=BusinessOut)
def toggle_business(bid: int, db: Session = Depends(get_db)):
    b = db.get(Business, bid)
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Business not found")
    b.is_active = not b.is_active
    db.commit()
    db.refresh(b)
    return b


@router.delete("/businesses/{bid}", status_code=204)
def delete_business(bid: int, db: Session = Depends(get_db)):
    """Do'koni bor biznes o'chirilmaydi (409) — cascade uning do'konlarini,
    mahsulotlarini va xodimlarini ham olib ketardi."""
    b = db.get(Business, bid)
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Business not found")
    stores = db.scalar(
        select(func.count(Restaurant.id)).where(Restaurant.business_id == bid)
    )
    if stores:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Do'koni bor biznesni o'chirib bo'lmaydi"
        )
    db.delete(b)
    db.commit()


# ── Stores (do'konlar) — barcha bizneslar kesimida ───────────────
@router.get("/stores", response_model=list[PlatformStoreRow])
def list_stores(db: Session = Depends(get_db)):
    rows = db.execute(
        select(Restaurant, Business.name)
        .join(Business, Business.id == Restaurant.business_id)
        .order_by(Restaurant.created_at.desc())
    ).all()
    return [
        PlatformStoreRow(
            **RestaurantOut.model_validate(store).model_dump(),
            business_id=store.business_id,
            business_name=business_name,
            created_at=store.created_at,
        )
        for store, business_name in rows
    ]


class StoreBusinessIn(BaseModel):
    business_id: int


@router.patch("/stores/{rid}/business", response_model=PlatformStoreRow)
def reassign_store(rid: int, data: StoreBusinessIn, db: Session = Depends(get_db)):
    """Do'konni boshqa tadbirkorga biriktiradi — masalan, multi-tenant
    o'tishda barcha eski do'konlar bitta placeholder biznesga tushib qolgan
    holatni to'g'irlash uchun."""
    store = db.get(Restaurant, rid)
    if not store:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Store not found")
    business = db.get(Business, data.business_id)
    if not business:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Business not found")
    store.business_id = business.id
    db.commit()
    db.refresh(store)
    invalidate_restaurant_catalog(store.id)
    return PlatformStoreRow(
        **RestaurantOut.model_validate(store).model_dump(),
        business_id=store.business_id,
        business_name=business.name,
        created_at=store.created_at,
    )


@router.patch("/stores/{rid}/toggle", response_model=PlatformStoreRow)
def toggle_store(rid: int, db: Session = Depends(get_db)):
    """Buyurtma tarixi borligi sababli o'chirib bo'lmaydigan do'kon uchun
    muqobil: faolsizlantirish — mijozlarga ko'rinmay qoladi, tarix saqlanadi."""
    store = db.get(Restaurant, rid)
    if not store:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Store not found")
    store.is_active = not store.is_active
    db.commit()
    db.refresh(store)
    invalidate_restaurant_catalog(store.id)
    business = db.get(Business, store.business_id)
    return PlatformStoreRow(
        **RestaurantOut.model_validate(store).model_dump(),
        business_id=store.business_id,
        business_name=business.name if business else "—",
        created_at=store.created_at,
    )


@router.delete("/stores/{rid}", status_code=204)
def delete_store(rid: int, force: bool = False, db: Session = Depends(get_db)):
    """Buyurtma tarixi bor do'konni oddiy holda o'chirib bo'lmaydi (409).

    `force=true` — tasdiqlangan to'liq o'chirish: buyurtmalari (va ular bilan
    birga order_items'i) ham qaytarib bo'lmas tarzda o'chadi. Frontend buni
    faqat ikki bosqichli (nomi + "o'chirish" so'zi) tasdiqdan keyin yuboradi."""
    store = db.get(Restaurant, rid)
    if not store:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Store not found")
    order_ids = db.scalars(select(Order.id).where(Order.restaurant_id == rid)).all()
    if order_ids and not force:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Buyurtma tarixi bor do'konni o'chirib bo'lmaydi"
        )
    if order_ids:
        db.execute(sqla_delete(OrderItem).where(OrderItem.order_id.in_(order_ids)))
        db.execute(sqla_delete(Order).where(Order.id.in_(order_ids)))
    db.delete(store)
    db.commit()
    invalidate_restaurant_catalog(rid)


# ── Platform-wide stats ──────────────────────────────────────────
@router.get("/stats", response_model=PlatformStatsOut)
def platform_stats(period: str = "month", db: Session = Depends(get_db)):
    """Butun platforma kesimida: nechta biznes/do'kon/mijoz, va har bir biznes
    bo'yicha buyurtma / aylanma / harajat / foyda."""
    from app.api.routes.business import _period_start

    start = _period_start(period)

    businesses = db.scalars(select(Business).order_by(Business.id)).all()
    breakdown: list[BusinessBreakdown] = []
    for b in businesses:
        stores = db.scalars(
            select(Restaurant).where(Restaurant.business_id == b.id)
        ).all()
        orders = revenue = profit = 0
        for store in stores:
            o, r, p = analytics.agg(db, [store.id], start)
            orders += o
            revenue += r
            profit += p
        breakdown.append(BusinessBreakdown(
            business_id=b.id, name=b.name, stores=len(stores),
            orders=orders, revenue=revenue, cost=revenue - profit, profit=profit,
        ))

    return PlatformStatsOut(
        businesses_total=len(businesses),
        stores_total=db.scalar(select(func.count(Restaurant.id))) or 0,
        customers_total=db.scalar(select(func.count(User.id))) or 0,
        total_orders=sum(x.orders for x in breakdown),
        total_revenue=sum(x.revenue for x in breakdown),
        total_cost=sum(x.cost for x in breakdown),
        total_profit=sum(x.profit for x in breakdown),
        businesses=breakdown,
    )


# ── Announcements (Elon) — barcha bot foydalanuvchilariga tarqatish ─
@router.get("/announcements", response_model=list[AnnouncementOut])
def list_announcements(db: Session = Depends(get_db)):
    return db.scalars(select(Announcement).order_by(Announcement.created_at.desc())).all()


@router.post("/announcements", response_model=AnnouncementOut, status_code=201)
def create_announcement(
    data: AnnouncementIn, background: BackgroundTasks, db: Session = Depends(get_db)
):
    ann = Announcement(**data.model_dump())
    db.add(ann)
    db.commit()
    db.refresh(ann)
    background.add_task(broadcast, ann.id)
    return ann


@router.post("/announcements/{aid}/resend", response_model=AnnouncementOut, status_code=201)
def resend_announcement(
    aid: int, background: BackgroundTasks, db: Session = Depends(get_db)
):
    original = db.get(Announcement, aid)
    if not original:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Announcement not found")
    ann = Announcement(
        text=original.text, image_url=original.image_url, button_text=original.button_text,
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    background.add_task(broadcast, ann.id)
    return ann
