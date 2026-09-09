"""Kuryer faqat o'z do'koni buyurtmalarini ko'rishi/olishi kerak (restaurant_id bo'yicha)."""
from tests.conftest import auth


def _make_courier(db_session, tenant, slug: str):
    from app.core.security import create_access_token, hash_password
    from app.models import AdminUser
    from app.models.enums import AdminRole

    courier = AdminUser(
        username=f"courier_{slug}", hashed_password=hash_password("pw"),
        role=AdminRole.courier, restaurant_id=tenant.restaurant_id,
    )
    db_session.add(courier)
    db_session.commit()
    token = create_access_token(subject=str(courier.id), role=AdminRole.courier.value)
    return courier, token


def _make_active_order(db_session, tenant, number: str):
    from app.models import Order, User
    from app.models.enums import OrderStatus, PaymentMethod, PaymentStatus

    user = User(telegram_id=abs(hash(number)) % 10**9, language="uz")
    db_session.add(user)
    db_session.commit()

    order = Order(
        user_id=user.id,
        restaurant_id=tenant.restaurant_id,
        number=number,
        status=OrderStatus.ready,
        payment_method=PaymentMethod.cash,
        payment_status=PaymentStatus.paid,
        items_total=10_000, delivery_fee=0, total=10_000,
        address_line="Test manzil",
    )
    db_session.add(order)
    db_session.commit()
    return order


def test_courier_orders_excludes_other_store(client, db_session, tenant_a, tenant_b):
    _, token_a = _make_courier(db_session, tenant_a, "a")
    order_b = _make_active_order(db_session, tenant_b, "ORD-B-1")

    resp = client.get("/api/courier/orders", headers=auth(token_a))
    assert resp.status_code == 200
    ids = [o["id"] for o in resp.json()]
    assert order_b.id not in ids


def test_courier_cannot_fetch_other_store_order(client, db_session, tenant_a, tenant_b):
    _, token_a = _make_courier(db_session, tenant_a, "a2")
    order_b = _make_active_order(db_session, tenant_b, "ORD-B-2")

    resp = client.get(f"/api/courier/orders/{order_b.id}", headers=auth(token_a))
    assert resp.status_code == 404


def test_courier_cannot_claim_order(client, db_session, tenant_a):
    """Kuryer buyurtmani o'zi qabul qilolmaydi — faqat admin biriktiradi."""
    _, token_a = _make_courier(db_session, tenant_a, "a3")
    order_a = _make_active_order(db_session, tenant_a, "ORD-A-3")

    resp = client.patch(
        f"/api/courier/orders/{order_a.id}", json={"status": "accepted"}, headers=auth(token_a)
    )
    assert resp.status_code == 400

    db_session.refresh(order_a)
    assert order_a.assigned_courier_id is None
