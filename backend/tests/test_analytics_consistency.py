"""Dashboard raqamlari o'zaro mos bo'lishi kerak.

"Aylanma" kartochkasi (`totals`) va grafik (`series`) bir xil davrda bir xil
summani ko'rsatishi shart — avval biri `Order.total` (yetkazish bilan),
ikkinchisi `OrderItem` summasini (yetkazishsiz) hisoblardi.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.models import Category, Order, OrderItem, Product, User
from app.models.enums import OrderStatus
from app.services.analytics import agg, series, top_products


@pytest.fixture
def sold(db_session, tenant_a):
    cat = Category(restaurant_id=tenant_a.restaurant_id, name_uz="K", name_ru="К")
    db_session.add(cat)
    user = User(phone="+998900002211", first_name="M")
    db_session.add(user)
    db_session.commit()
    product = Product(
        restaurant_id=tenant_a.restaurant_id, category_id=cat.id,
        name_uz="Olma", name_ru="Яблоко", price=10_000, cost=6_000, unit="kg",
    )
    db_session.add(product)
    db_session.commit()

    now = datetime.now(timezone.utc)
    for i, (qty, fee) in enumerate([(2, 2_000), (3, 0), (1, 4_000)]):
        items_total = 10_000 * qty
        db_session.add(Order(
            number=f"AN-{i}", user_id=user.id, restaurant_id=tenant_a.restaurant_id,
            status=OrderStatus.delivered,
            items_total=items_total, delivery_fee=fee, total=items_total + fee,
            address_line="Manzil", phone="+998900002211",
            created_at=now - timedelta(hours=i),
            items=[OrderItem(
                product_id=product.id, name_uz="Olma", name_ru="Яблоко",
                price=10_000, cost=6_000, quantity=qty, unit="kg",
            )],
        ))
    db_session.commit()
    return tenant_a.restaurant_id


def test_series_revenue_matches_agg(db_session, sold):
    orders, revenue, profit = agg(db_session, [sold])
    points = series(db_session, [sold], "day")

    assert orders == 3
    assert revenue == 60_000 + 6_000          # mahsulot + yetkazish
    assert sum(p.orders for p in points) == orders
    assert sum(p.revenue for p in points) == revenue
    assert sum(p.profit for p in points) == profit


def test_profit_excludes_delivery_fee(db_session, sold):
    _o, _r, profit = agg(db_session, [sold])
    # (10000 − 6000) × (2+3+1) = 24 000
    assert profit == 24_000


def test_series_does_not_multiply_by_item_count(db_session, sold, tenant_a):
    """Ko'p mahsulotli buyurtma aylanmani ko'paytirib yubormasin."""
    from app.models import Category, Product

    cat = db_session.query(Category).filter_by(restaurant_id=sold).first()
    extra = Product(
        restaurant_id=sold, category_id=cat.id,
        name_uz="Nok", name_ru="Груша", price=5_000, cost=3_000, unit="kg",
    )
    db_session.add(extra)
    db_session.commit()

    order = db_session.query(Order).filter_by(number="AN-0").one()
    order.items.append(OrderItem(
        product_id=extra.id, name_uz="Nok", name_ru="Груша",
        price=5_000, cost=3_000, quantity=1, unit="kg",
    ))
    order.items_total += 5_000
    order.total += 5_000
    db_session.commit()

    _o, revenue, _p = agg(db_session, [sold])
    points = series(db_session, [sold], "day")
    assert sum(p.revenue for p in points) == revenue
    assert sum(p.orders for p in points) == 3   # buyurtma soni item soniga bog'liq emas


def test_top_products_ranks_by_quantity(db_session, sold):
    rows = top_products(db_session, [sold])
    assert rows and rows[0].name_uz == "Olma"
    assert rows[0].quantity == 6.0
