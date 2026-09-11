"""POST /api/orders/quote — ilova ko'rsatadigan summa serverniki bilan bir xil.

Mijoz ilovasi avval yetkazish haqini o'zi hisoblardi (min_order'ni "minimal
buyurtma", delivery_fee'ni qat'iy narx deb) — ekrandagi va yozilgan summa
farq qilardi. Endi yagona manba shu endpoint.
"""
from tests.conftest import auth


def _user_token(db_session):
    from app.core.security import create_access_token
    from app.models import User

    user = User(phone="+998901110011", first_name="Mijoz")
    db_session.add(user)
    db_session.commit()
    return create_access_token(subject=str(user.id), role="user")


def _product(db_session, tenant, *, price=10_000, stock=10.0, available=True, name="Olma"):
    from app.models import Category, Product

    cat = Category(restaurant_id=tenant.restaurant_id, name_uz="Kat", name_ru="Кат")
    db_session.add(cat)
    db_session.commit()
    p = Product(
        restaurant_id=tenant.restaurant_id, category_id=cat.id,
        name_uz=name, name_ru=name,
        price=price, stock=stock, unit="kg", is_available=available,
    )
    db_session.add(p)
    db_session.commit()
    return p


def _set_pricing(db_session, tenant, *, free_from: int, per_km: int, lat=41.3, lng=69.24):
    from app.models import Restaurant

    store = db_session.get(Restaurant, tenant.restaurant_id)
    store.min_order = free_from      # bepul yetkazish chegarasi
    store.delivery_fee = per_km      # 1 km narxi
    store.lat, store.lng = lat, lng
    db_session.commit()


def test_quote_matches_created_order_total(client, db_session, tenant_a):
    """Quote va haqiqiy buyurtma bir xil summa berishi shart."""
    token = _user_token(db_session)
    _set_pricing(db_session, tenant_a, free_from=50_000, per_km=2_000)
    p = _product(db_session, tenant_a, price=10_000, stock=10)
    # ~3.1 km uzoqlikdagi nuqta → ceil(3.1) * 2000 = 8000
    lat, lng = 41.328, 69.24

    quote = client.post(
        "/api/orders/quote",
        json={
            "restaurant_id": tenant_a.restaurant_id,
            "items": [{"product_id": p.id, "quantity": 2}],
            "lat": lat, "lng": lng,
        },
        headers=auth(token),
    )
    assert quote.status_code == 200, quote.text
    q = quote.json()
    assert q["items_total"] == 20_000
    assert q["free_delivery_from"] == 50_000
    assert q["delivery_fee_known"] is True
    assert q["issues"] == []

    created = client.post(
        "/api/orders",
        json={
            "restaurant_id": tenant_a.restaurant_id,
            "items": [{"product_id": p.id, "quantity": 2}],
            "address_line": "Chilonzor 5-kvartal 12-uy",
            "lat": lat, "lng": lng,
            "phone": "998901110011",
        },
        headers=auth(token),
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert (q["items_total"], q["delivery_fee"], q["total"]) == (
        body["items_total"], body["delivery_fee"], body["total"]
    )


def test_quote_free_delivery_above_threshold(client, db_session, tenant_a):
    token = _user_token(db_session)
    _set_pricing(db_session, tenant_a, free_from=50_000, per_km=2_000)
    p = _product(db_session, tenant_a, price=30_000, stock=10)

    resp = client.post(
        "/api/orders/quote",
        json={
            "restaurant_id": tenant_a.restaurant_id,
            "items": [{"product_id": p.id, "quantity": 2}],
            "lat": 41.4, "lng": 69.3,
        },
        headers=auth(token),
    )
    q = resp.json()
    assert q["items_total"] == 60_000
    assert q["delivery_fee"] == 0
    assert q["total"] == 60_000


def test_quote_without_coordinates_marks_fee_unknown(client, db_session, tenant_a):
    """Manzil tanlanmagan va summa chegaradan past — haq hali aniq emas."""
    token = _user_token(db_session)
    _set_pricing(db_session, tenant_a, free_from=50_000, per_km=2_000)
    p = _product(db_session, tenant_a, price=10_000, stock=10)

    resp = client.post(
        "/api/orders/quote",
        json={
            "restaurant_id": tenant_a.restaurant_id,
            "items": [{"product_id": p.id, "quantity": 1}],
        },
        headers=auth(token),
    )
    q = resp.json()
    assert q["delivery_fee_known"] is False
    assert q["distance_km"] is None


def test_quote_reports_out_of_stock_product_by_name(client, db_session, tenant_a):
    """stock=0 mahsulot — buyurtma bermasdan oldin aniq nomi bilan aytiladi."""
    token = _user_token(db_session)
    _set_pricing(db_session, tenant_a, free_from=50_000, per_km=2_000)
    ok = _product(db_session, tenant_a, price=10_000, stock=5, name="Olma")
    empty = _product(db_session, tenant_a, price=7_000, stock=0, name="Pomidor")

    resp = client.post(
        "/api/orders/quote",
        json={
            "restaurant_id": tenant_a.restaurant_id,
            "items": [
                {"product_id": ok.id, "quantity": 1},
                {"product_id": empty.id, "quantity": 2},
            ],
            "lat": 41.3, "lng": 69.24,
        },
        headers=auth(token),
    )
    q = resp.json()
    issues = {i["product_id"]: i for i in q["issues"]}
    assert empty.id in issues
    assert issues[empty.id]["reason"] == "out_of_stock"
    assert "Pomidor" in issues[empty.id]["message"]
    # Muammoli mahsulot summaga qo'shilmaydi.
    assert q["items_total"] == 10_000


def test_quote_reports_unavailable_product(client, db_session, tenant_a):
    token = _user_token(db_session)
    _set_pricing(db_session, tenant_a, free_from=50_000, per_km=2_000)
    p = _product(db_session, tenant_a, price=9_000, stock=5, available=False, name="Uzum")

    resp = client.post(
        "/api/orders/quote",
        json={
            "restaurant_id": tenant_a.restaurant_id,
            "items": [{"product_id": p.id, "quantity": 1}],
        },
        headers=auth(token),
    )
    q = resp.json()
    assert q["issues"][0]["reason"] == "unavailable"
    assert "Uzum" in q["issues"][0]["message"]


def test_order_error_names_the_product(client, db_session, tenant_a):
    """Buyurtma rad etilganda mijoz qaysi mahsulot ekanini bilishi shart."""
    token = _user_token(db_session)
    p = _product(db_session, tenant_a, price=10_000, stock=0, name="Pomidor")

    resp = client.post(
        "/api/orders",
        json={
            "restaurant_id": tenant_a.restaurant_id,
            "items": [{"product_id": p.id, "quantity": 1}],
            "address_line": "Chilonzor 5-kvartal 12-uy",
            "lat": 41.3, "lng": 69.24,
            "phone": "998901110011",
        },
        headers=auth(token),
    )
    assert resp.status_code == 400
    assert "Pomidor" in resp.json()["detail"]
