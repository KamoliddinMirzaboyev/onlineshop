from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_business
from app.core.cache import invalidate_restaurant_catalog
from app.core.db import get_db
from app.core.security import hash_password
from app.core.tz import tashkent_today_start_utc
from app.models import AdminUser, Business, Order, Product, Restaurant
from app.models.enums import AdminRole
from app.schemas.business import (
    BusinessReportsOut, BusinessStatsOut, StoreBreakdown, StoreCreateIn, ReportTotals,
    StoreWithStaffCreateIn,
)
from app.schemas.catalog import RestaurantOut
from app.services import analytics

# Tadbirkorning biznes bo'ylab amallari (bitta do'kondan yuqori daraja).
router = APIRouter(prefix="/business", tags=["business"])

_PERIOD_DAYS = {"today": 0, "week": 7, "month": 30}


def _period_start(period: str) -> datetime | None:
    """`all` uchun None (butun tarix), aks holda bugundan orqaga sanaladi."""
    if period == "all":
        return None
    days = _PERIOD_DAYS.get(period)
    if days is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "period: today|week|month|all")
    today = tashkent_today_start_utc()
    return today - timedelta(days=days)


def _own_store(rid: int, business: Business, db: Session) -> Restaurant:
    store = db.get(Restaurant, rid)
    if not store or store.business_id != business.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Store not found")
    return store


@router.get("/stores", response_model=list[RestaurantOut])
def list_stores(
    business: Business = Depends(get_current_business), db: Session = Depends(get_db)
):
    return db.scalars(
        select(Restaurant).where(Restaurant.business_id == business.id).order_by(Restaurant.id)
    ).all()


@router.post("/stores", response_model=RestaurantOut, status_code=201)
def create_store(
    data: StoreWithStaffCreateIn,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    """Do'kon + uni yurituvchi xodim akkauntini (do'kon superadmini) birga
    yaratadi. Login butun tizim bo'ylab yagona bo'lishi shart."""
    if db.scalar(select(AdminUser).where(AdminUser.username == data.staff_username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu login band")
    store = Restaurant(
        name=data.name,
        business_id=business.id,
        delivery_fee=2000,
        min_order=50_000,
    )
    db.add(store)
    db.flush()  # store.id kerak
    db.add(AdminUser(
        restaurant_id=store.id,
        username=data.staff_username,
        hashed_password=hash_password(data.staff_password),
        name=data.staff_name,
        phone=data.staff_phone,
        role=AdminRole.superadmin,
    ))
    db.commit()
    db.refresh(store)
    invalidate_restaurant_catalog(store.id)  # "catalog:restaurants:all" ham tozalanadi
    return store


@router.put("/stores/{rid}", response_model=RestaurantOut)
def update_store(
    rid: int,
    data: StoreCreateIn,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    store = _own_store(rid, business, db)
    # exclude_unset: frontend yubormagan maydonlar (masalan faqat {name}) schema
    # default'lari (delivery_fee=2000, min_order=50000, is_active=True, ...) bilan
    # qayta yozilib ketmasin — admin.update_store bilan bir xil pattern.
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(store, k, v)
    db.commit()
    db.refresh(store)
    invalidate_restaurant_catalog(store.id)
    return store


@router.delete("/stores/{rid}")
def delete_store(
    rid: int,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    """Do'konni o'chirish. Buyurtma tarixi bor do'konni butunlay o'chirib
    bo'lmaydi (cascade uning buyurtmalarini ham olib ketardi) — shuning
    o'rniga nofaol (is_active/is_open=False) qilinadi: mijozlarga va yangi
    buyurtmalarga ko'rinmay qoladi, tarix va hisobotlar saqlanadi."""
    store = _own_store(rid, business, db)
    has_orders = db.scalar(
        select(func.count(Order.id)).where(Order.restaurant_id == store.id)
    )
    if has_orders:
        store.is_active = False
        store.is_open = False
        db.commit()
        invalidate_restaurant_catalog(store.id)
        return {"archived": True}
    db.delete(store)
    db.commit()
    invalidate_restaurant_catalog(rid)
    return {"archived": False}


@router.get("/stats", response_model=BusinessStatsOut)
def business_stats(
    period: str = "month",
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    """Har bir do'kon kesimida va umumiy: buyurtma, aylanma, harajat, foyda."""
    start = _period_start(period)
    stores = db.scalars(
        select(Restaurant).where(Restaurant.business_id == business.id).order_by(Restaurant.id)
    ).all()

    breakdown: list[StoreBreakdown] = []
    for store in stores:
        orders, revenue, profit = analytics.agg(db, [store.id], start)
        breakdown.append(StoreBreakdown(
            restaurant_id=store.id, name=store.name,
            orders=orders, revenue=revenue, cost=revenue - profit, profit=profit,
        ))

    return BusinessStatsOut(
        total_orders=sum(s.orders for s in breakdown),
        total_revenue=sum(s.revenue for s in breakdown),
        total_cost=sum(s.cost for s in breakdown),
        total_profit=sum(s.profit for s in breakdown),
        stores=breakdown,
    )


@router.get("/reports", response_model=BusinessReportsOut)
def business_reports(
    period: str = "daily",
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    """Chart'lar uchun: biznes bo'ylab jamlangan vaqt qatorlari (kunlik/haftalik/
    oylik), top mahsulotlar va so'nggi 30 kun do'kon kesimi."""
    stores = db.scalars(
        select(Restaurant).where(Restaurant.business_id == business.id).order_by(Restaurant.id)
    ).all()
    ids = [s.id for s in stores]
    if not ids:
        return BusinessReportsOut(totals=ReportTotals(orders=0, revenue=0, profit=0))

    today = tashkent_today_start_utc()
    month_start = today - timedelta(days=30)
    breakdown: list[StoreBreakdown] = []
    for store in stores:
        orders, revenue, profit = analytics.agg(db, [store.id], month_start)
        product_count = db.scalar(
            select(func.count(Product.id)).where(Product.restaurant_id == store.id)
        ) or 0
        top = analytics.top_products(db, [store.id], limit=1)
        breakdown.append(StoreBreakdown(
            restaurant_id=store.id, name=store.name,
            orders=orders, revenue=revenue, cost=revenue - profit, profit=profit,
            product_count=product_count,
            top_product_name=top[0].name_uz if top else None,
        ))

    # Admin hisobot bilan bir xil diapazonlar.
    if period == "daily":
        start = today - timedelta(days=29)
        trunc = "day"
    elif period == "weekly":
        start = today - timedelta(weeks=12)
        trunc = "week"
    elif period == "monthly":
        start = today - timedelta(days=365)
        trunc = "month"
    else:
        start = today - timedelta(days=29)
        trunc = "day"

    o, r, p = analytics.agg(db, ids, start)
    return BusinessReportsOut(
        totals=ReportTotals(orders=o, revenue=r, profit=p),
        series=analytics.series(db, ids, trunc, start),
        top_products=analytics.top_products(db, ids, start=start, limit=20),
        stores=breakdown,
    )
