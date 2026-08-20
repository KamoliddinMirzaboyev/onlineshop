"""Buyurtma/foyda agregatsiyasi — admin, business, platform panellari baravar
ishlatadi. Avval bu funksiyalar app/api/routes/admin.py'da edi va boshqa
router'lar (business.py, platform.py) ularni `from app.api.routes.admin import
_agg` deb import qilardi — bir route modulining xususiy funksiyasiga
bog'lanish edi (aylanma import xavfi, layering buzilgan)."""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.tz import TASHKENT, tashkent_today_start_utc
from app.models import Order, OrderItem, Product
from app.models.enums import OrderStatus
from app.schemas.admin import PeriodPoint, TopProduct

# Profit = Σ (sotuv narxi − tannarx) × soni, faqat yetkazilgan buyurtmalar.
# Tannarx OrderItem.cost dan olinadi — sotuv vaqtidagi snapshot (Product.cost
# keyin o'zgarsa ham tarixiy foyda buzilmaydi).


def parse_report_period(
    period: str = "30days",
    start_date: str | None = None,
    end_date: str | None = None,
) -> tuple[datetime | None, datetime | None, str]:
    """Hisobot davri parametrlarini (start, end, trunc) aniqlash.
    Barcha vaqt chegaralari Toshkent (UTC+5) vaqti asosida UTC formatiga o'tkaziladi."""
    today = tashkent_today_start_utc()
    now_local = datetime.now(timezone.utc).astimezone(TASHKENT)

    # Ixtiyoriy sana oralig'i (custom)
    if period == "custom" and start_date:
        try:
            s_dt = datetime.strptime(start_date, "%Y-%m-%d")
            s_local = datetime(s_dt.year, s_dt.month, s_dt.day, 0, 0, 0, tzinfo=TASHKENT)
            start = s_local.astimezone(timezone.utc)
        except ValueError:
            start = today - timedelta(days=29)

        if end_date:
            try:
                e_dt = datetime.strptime(end_date, "%Y-%m-%d")
                e_local = datetime(e_dt.year, e_dt.month, e_dt.day, 23, 59, 59, 999999, tzinfo=TASHKENT)
                end = e_local.astimezone(timezone.utc)
            except ValueError:
                end = None
        else:
            end = None

        diff_days = ((end or datetime.now(timezone.utc)) - (start or today)).days
        if diff_days <= 2:
            trunc = "hour"
        elif diff_days <= 60:
            trunc = "day"
        else:
            trunc = "month"
        return start, end, trunc

    if period == "today":
        # Faqat bugun (00:00 dan hozirgacha)
        start = today
        end = None
        trunc = "hour"
    elif period == "yesterday":
        # Kecha (00:00 dan 23:59:59 gacha)
        start = today - timedelta(days=1)
        end = today - timedelta(microseconds=1)
        trunc = "hour"
    elif period in ("7days", "weekly"):
        # Oxirgi 7 kun (bugun bilan birga 7 kun)
        start = today - timedelta(days=6)
        end = None
        trunc = "day"
    elif period == "this_month":
        # Shu oyning 1-kunidan bugungacha
        m_start_local = datetime(now_local.year, now_local.month, 1, 0, 0, 0, tzinfo=TASHKENT)
        start = m_start_local.astimezone(timezone.utc)
        end = None
        trunc = "day"
    elif period in ("30days", "monthly", "daily"):
        # Oxirgi 30 kun
        start = today - timedelta(days=29)
        end = None
        trunc = "day"
    elif period in ("this_year", "yearly"):
        # Joriy yil 1-yanvardan bugungacha
        y_start_local = datetime(now_local.year, 1, 1, 0, 0, 0, tzinfo=TASHKENT)
        start = y_start_local.astimezone(timezone.utc)
        end = None
        trunc = "month"
    elif period == "all":
        # Barcha davr
        start = None
        end = None
        trunc = "month"
    else:
        # Default: oxirgi 30 kun
        start = today - timedelta(days=29)
        end = None
        trunc = "day"

    return start, end, trunc


def agg(
    db: Session,
    rids: list[int],
    start: datetime | None = None,
    end: datetime | None = None,
) -> tuple[int, int, int]:
    delivered = OrderStatus.delivered
    cond = [Order.status == delivered, Order.restaurant_id.in_(rids)]
    if start is not None:
        cond.append(Order.created_at >= start)
    if end is not None:
        cond.append(Order.created_at <= end)

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


def series(
    db: Session,
    rids: list[int],
    trunc: str,
    start: datetime | None = None,
    end: datetime | None = None,
) -> list[PeriodPoint]:
    delivered = OrderStatus.delivered
    period = func.date_trunc(trunc, Order.created_at)
    cond = [Order.status == delivered, Order.restaurant_id.in_(rids)]
    if start is not None:
        cond.append(Order.created_at >= start)
    if end is not None:
        cond.append(Order.created_at <= end)

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
        .where(*cond)
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
    db: Session,
    rids: list[int],
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = 20,
) -> list[TopProduct]:
    delivered = OrderStatus.delivered
    cond = [Order.status == delivered, Order.restaurant_id.in_(rids)]
    if start is not None:
        cond.append(Order.created_at >= start)
    if end is not None:
        cond.append(Order.created_at <= end)

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
