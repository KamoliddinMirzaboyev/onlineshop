"""Buyurtma/foyda agregatsiyasi — admin, business, platform panellari baravar
ishlatadi. Avval bu funksiyalar app/api/routes/admin.py'da edi va boshqa
router'lar (business.py, platform.py) ularni `from app.api.routes.admin import
_agg` deb import qilardi — bir route modulining xususiy funksiyasiga
bog'lanish edi (aylanma import xavfi, layering buzilgan)."""

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Order, OrderItem, Product
from app.models.enums import OrderStatus
from app.schemas.admin import PeriodPoint, TopProduct

# Profit = Σ (sotuv narxi − tannarx) × soni, faqat yetkazilgan buyurtmalar.
# Tannarx OrderItem.cost dan olinadi — sotuv vaqtidagi snapshot (Product.cost
# keyin o'zgarsa ham tarixiy foyda buzilmaydi).


def agg(db: Session, rids: list[int], start: datetime | None = None) -> tuple[int, int, int]:
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


def series(db: Session, rids: list[int], trunc: str, start: datetime) -> list[PeriodPoint]:
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
    out: list[PeriodPoint] = []
    for p, o, r, pf in rows:
        if p is None:
            continue
        # date_trunc ba'zan date, ba'zan datetime qaytaradi
        period_str = p.isoformat() if hasattr(p, "isoformat") else str(p)
        out.append(PeriodPoint(period=period_str, orders=int(o), revenue=int(r), profit=int(pf)))
    return out


def top_products(
    db: Session, rids: list[int], start: datetime | None = None, limit: int = 20
) -> list[TopProduct]:
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
