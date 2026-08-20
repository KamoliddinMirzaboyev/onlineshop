from tests.conftest import auth, make_order


def test_stores_list_only_shows_own_stores(client, tenant_a, tenant_b):
    resp = client.get("/api/business/stores", headers=auth(tenant_a.business_token))
    assert resp.status_code == 200
    ids = [s["id"] for s in resp.json()]
    assert ids == [tenant_a.restaurant_id]


def _store_payload(name: str, username: str) -> dict:
    return {
        "name": name,
        "staff_name": "Ali Valiyev",
        "staff_phone": "+998901112233",
        "staff_username": username,
        "staff_password": "secret123",
    }


def test_business_creates_store(client, tenant_a):
    resp = client.post(
        "/api/business/stores",
        json=_store_payload("Ikkinchi do'kon", "store2_admin"),
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "Ikkinchi do'kon"

    listed = client.get("/api/business/stores", headers=auth(tenant_a.business_token))
    assert len(listed.json()) == 2


def test_create_store_provisions_staff_login(client, tenant_a):
    created = client.post(
        "/api/business/stores",
        json=_store_payload("Uchinchi do'kon", "store3_admin"),
        headers=auth(tenant_a.business_token),
    ).json()

    # Yaratilgan xodim o'z login/paroli bilan admin panelga kira oladi.
    login = client.post(
        "/api/admin/auth/login",
        json={"username": "store3_admin", "password": "secret123"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    # Va u aynan shu yangi do'konga bog'langan (superadmin).
    me = client.get("/api/admin/auth/me", headers=auth(token)).json()
    assert me["restaurant_id"] == created["id"]
    assert me["role"] == "superadmin"


def test_create_store_rejects_duplicate_username(client, tenant_a):
    # tenant_a fixture'i allaqachon `staff_a` loginini yaratadi.
    resp = client.post(
        "/api/business/stores",
        json=_store_payload("To'rtinchi do'kon", "staff_a"),
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 409


def test_business_cannot_update_other_store(client, tenant_a, tenant_b):
    resp = client.put(
        f"/api/business/stores/{tenant_b.restaurant_id}",
        json={"name": "O'g'irlangan"},
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 404


def test_store_with_orders_cannot_be_deleted(client, db_session, tenant_a):
    make_order(db_session, tenant_a, total=5_000)
    resp = client.delete(
        f"/api/business/stores/{tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 409


def test_empty_store_can_be_deleted(client, tenant_a):
    created = client.post(
        "/api/business/stores",
        json=_store_payload("Bo'sh do'kon", "empty_store_admin"),
        headers=auth(tenant_a.business_token),
    ).json()
    resp = client.delete(
        f"/api/business/stores/{created['id']}", headers=auth(tenant_a.business_token)
    )
    assert resp.status_code == 204


def test_business_stats_breaks_down_by_store(client, db_session, tenant_a, tenant_b):
    make_order(db_session, tenant_a, total=5_000)
    make_order(db_session, tenant_b, total=7_000)

    resp = client.get(
        "/api/business/stats?period=all", headers=auth(tenant_a.business_token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_revenue"] == 5_000  # tenant B's 7_000 must not leak in
    assert len(body["stores"]) == 1
    assert body["stores"][0]["restaurant_id"] == tenant_a.restaurant_id
    assert body["stores"][0]["revenue"] == 5_000


def test_staff_token_rejected_by_business_router(client, tenant_a):
    resp = client.get("/api/business/stores", headers=auth(tenant_a.staff_token))
    assert resp.status_code == 401


def test_business_hard_deletes_delivered_order_and_stats_drop(client, db_session, tenant_a):
    from app.models import Order
    from app.services.analytics import agg

    order = make_order(db_session, tenant_a, total=12_000)
    n, rev, _ = agg(db_session, [tenant_a.restaurant_id])
    assert n == 1
    assert rev == 12_000

    resp = client.delete(
        f"/api/admin/orders/{order.id}?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 204
    db_session.expire_all()
    assert db_session.get(Order, order.id) is None
    n2, rev2, _ = agg(db_session, [tenant_a.restaurant_id])
    assert n2 == 0
    assert rev2 == 0


def test_business_hard_deletes_pending_order(client, db_session, tenant_a):
    from app.models import Order, User
    from app.models.enums import OrderStatus, PaymentMethod, PaymentStatus

    user = User(telegram_id=9_001_001, language="uz")
    db_session.add(user)
    db_session.commit()
    order = Order(
        user_id=user.id,
        restaurant_id=tenant_a.restaurant_id,
        number="ORD-PENDING-DEL",
        status=OrderStatus.pending,
        payment_method=PaymentMethod.cash,
        payment_status=PaymentStatus.unpaid,
        items_total=3_000,
        delivery_fee=0,
        total=3_000,
        address_line="Test",
    )
    db_session.add(order)
    db_session.commit()

    resp = client.delete(
        f"/api/admin/orders/{order.id}?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 204
    db_session.expire_all()
    assert db_session.get(Order, order.id) is None


def test_business_cannot_delete_other_store_order(client, db_session, tenant_a, tenant_b):
    order = make_order(db_session, tenant_b, total=4_000)
    resp = client.delete(
        f"/api/admin/orders/{order.id}?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 404
