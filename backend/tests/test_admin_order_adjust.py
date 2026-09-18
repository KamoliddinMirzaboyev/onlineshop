"""Admin panel — buyurtma miqdorini tahrirlash: PATCH /api/admin/orders/{id}/adjust.
Kuryerning /courier/orders/{id}/adjust bilan bir xil (adjust_order_items) —
masalan tarozida 5 kg o'rniga 5.3 kg chiqqanda admin ham to'g'irlay olishi kerak.
"""
from tests.conftest import auth


def _product(db_session, tenant, *, price=10_000, stock=10.0):
    from app.models import Category, Product

    cat = Category(restaurant_id=tenant.restaurant_id, name_uz="Kat", name_ru="Кат")
    db_session.add(cat)
    db_session.commit()
    p = Product(
        restaurant_id=tenant.restaurant_id, category_id=cat.id,
        name_uz="Kartoshka", name_ru="Картошка",
        price=price, stock=stock, unit="kg", is_available=True,
    )
    db_session.add(p)
    db_session.commit()
    return p


def _manual_order(client, tenant, product, qty):
    resp = client.post(
        "/api/admin/orders",
        json={
            "items": [{"product_id": product.id, "quantity": qty}],
            "phone": "998901234567",
            "address_line": "Test manzil",
            "delivery_fee": 8000,
        },
        headers=auth(tenant.staff_token),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_admin_can_adjust_quantity_and_recalculates_totals(client, db_session, tenant_a):
    from app.models import Product

    p = _product(db_session, tenant_a, price=10_000, stock=10.0)
    order = _manual_order(client, tenant_a, p, qty=5)
    item_id = order["items"][0]["id"]

    resp = client.patch(
        f"/api/admin/orders/{order['id']}/adjust",
        json={"items": [{"order_item_id": item_id, "quantity": 5.3}]},
        headers=auth(tenant_a.staff_token),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["items"][0]["quantity"] == 5.3
    assert body["items_total"] == 53_000  # 5.3 * 10_000
    assert body["total"] == 53_000 + body["delivery_fee"]

    db_session.refresh(p)
    assert p.stock == 10.0 - 5.3  # qo'shimcha 0.3 kg zaxiradan yechildi


def test_admin_cannot_adjust_delivered_order(client, db_session, tenant_a):
    from app.models import Order
    from app.models.enums import OrderStatus

    p = _product(db_session, tenant_a, stock=10.0)
    order = _manual_order(client, tenant_a, p, qty=2)
    db_order = db_session.get(Order, order["id"])
    db_order.status = OrderStatus.delivered
    db_session.commit()

    item_id = order["items"][0]["id"]
    resp = client.patch(
        f"/api/admin/orders/{order['id']}/adjust",
        json={"items": [{"order_item_id": item_id, "quantity": 3}]},
        headers=auth(tenant_a.staff_token),
    )
    assert resp.status_code == 400
