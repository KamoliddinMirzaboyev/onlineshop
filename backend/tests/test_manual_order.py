"""Admin panel — qo'lda (telefon) buyurtma: POST /api/admin/orders."""
from tests.conftest import auth


def _product(db_session, tenant, *, price=12_000, stock=10.0, available=True):
    from app.models import Category, Product

    cat = Category(restaurant_id=tenant.restaurant_id, name_uz="Kat", name_ru="Кат")
    db_session.add(cat)
    db_session.commit()
    p = Product(
        restaurant_id=tenant.restaurant_id, category_id=cat.id,
        name_uz="Olma", name_ru="Яблоко",
        price=price, stock=stock, unit="kg", is_available=available,
    )
    db_session.add(p)
    db_session.commit()
    return p


def test_manual_order_pending_and_visible_after_assign(client, db_session, tenant_a):
    from app.models import Order, User

    p = _product(db_session, tenant_a, price=10_000, stock=5)

    resp = client.post(
        "/api/admin/orders",
        json={
            "items": [{"product_id": p.id, "quantity": 2}],
            "phone": "998901234567",
            "address_line": "Chilonzor 5-kvartal 12-uy",
            "delivery_fee": 8000,
            "comment": "eshik oldida",
        },
        headers=auth(tenant_a.staff_token),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "pending"
    assert body["source"] == "manual"
    assert body["items_total"] == 20_000
    assert body["delivery_fee"] == 8000
    assert body["total"] == 28_000
    assert body["phone"] == "+998901234567"
    assert "Admin qo'shdi" in (body["comment"] or "")

    order = db_session.get(Order, body["id"])
    assert order.assigned_courier_id is None
    db_session.refresh(p)
    assert p.stock == 3  # 5 - 2 zaxiralandi

    user = db_session.query(User).filter_by(phone="+998901234567").one()
    assert user.telegram_id is None

    # Kuryerga ko'rinadi
    from app.core.security import create_access_token, hash_password
    from app.models import AdminUser
    from app.models.enums import AdminRole

    courier = AdminUser(
        username="c_manual", hashed_password=hash_password("pw"),
        role=AdminRole.courier, restaurant_id=tenant_a.restaurant_id,
    )
    db_session.add(courier)
    db_session.commit()
    ctok = create_access_token(subject=str(courier.id), role=AdminRole.courier.value)

    # Biriktirilmagan buyurtma hech bir kuryerga ko'rinmaydi.
    seen = client.get("/api/courier/orders", headers=auth(ctok)).json()
    assert body["id"] not in [o["id"] for o in seen]

    # Admin qabul qilib kuryer biriktirgach — o'sha kuryerga ko'rinadi.
    confirmed = client.patch(
        f"/api/admin/orders/{body['id']}",
        json={"status": "confirmed"},
        headers=auth(tenant_a.staff_token),
    )
    assert confirmed.status_code == 200, confirmed.text
    assigned = client.post(
        f"/api/admin/orders/{body['id']}/assign",
        json={"assigned_courier_id": courier.id},
        headers=auth(tenant_a.staff_token),
    )
    assert assigned.status_code == 200, assigned.text
    seen = client.get("/api/courier/orders", headers=auth(ctok)).json()
    assert body["id"] in [o["id"] for o in seen]

    # /admin/orders?source=manual — faqat qo'lda qo'shilganlar
    manual = client.get(
        "/api/admin/orders?source=manual", headers=auth(tenant_a.staff_token)
    ).json()
    assert [o["id"] for o in manual] == [body["id"]]
    assert all(o["source"] == "manual" for o in manual)


def test_manual_order_rejects_bad_phone(client, db_session, tenant_a):
    p = _product(db_session, tenant_a)
    resp = client.post(
        "/api/admin/orders",
        json={"items": [{"product_id": p.id, "quantity": 1}],
              "phone": "123", "address_line": "Test manzil 1"},
        headers=auth(tenant_a.staff_token),
    )
    assert resp.status_code == 422


def test_manual_order_reuses_user_by_phone(client, db_session, tenant_a):
    from app.models import Order

    p = _product(db_session, tenant_a, stock=20)
    payload = {
        "items": [{"product_id": p.id, "quantity": 1}],
        "phone": "998901112233",
        "address_line": "Yunusobod 19",
    }
    h = auth(tenant_a.staff_token)
    r1 = client.post("/api/admin/orders", json=payload, headers=h)
    r2 = client.post("/api/admin/orders", json=payload, headers=h)
    assert r1.status_code == 201 and r2.status_code == 201
    u1 = db_session.get(Order, r1.json()["id"]).user_id
    u2 = db_session.get(Order, r2.json()["id"]).user_id
    assert u1 == u2
