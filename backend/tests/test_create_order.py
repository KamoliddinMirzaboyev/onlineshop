"""POST /api/orders — pul va ombor yo'li.

Bu eng muhim endpoint edi va test bilan qoplanmagan: zona tekshiruvi, ombor
zaxirasi, summa hisobi va xato yuz berganda zaxiraning qaytarilishi.
"""

import pytest
from fastapi import HTTPException

from app.core.security import create_access_token
from app.models import Category, DeliveryZone, Product, Restaurant, User
from app.models.enums import OrderStatus
from tests.conftest import auth

# Marg'ilon markazi va undan ~9 km narida turgan nuqta.
IN_ZONE = (40.4718, 71.7247)
FAR_AWAY = (40.5500, 71.7247)


@pytest.fixture
def customer(db_session):
    user = User(phone="+998901234500", first_name="Mijoz")
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def customer_token(customer):
    return create_access_token(subject=str(customer.id), role="user")


def _catalog(db_session, tenant, *, price=10_000, stock=10.0):
    store = db_session.get(Restaurant, tenant.restaurant_id)
    store.lat, store.lng = IN_ZONE
    store.free_delivery_from = 50_000
    store.delivery_fee = 2_000
    cat = Category(restaurant_id=store.id, name_uz="Kat", name_ru="Кат")
    db_session.add(cat)
    db_session.commit()
    product = Product(
        restaurant_id=store.id, category_id=cat.id,
        name_uz="Olma", name_ru="Яблоко", price=price, stock=stock, unit="kg",
    )
    db_session.add(product)
    db_session.commit()
    return store, product


def _zone(db_session, store, radius_km=5.0):
    zone = DeliveryZone(
        restaurant_id=store.id, name="Markaz", is_active=True,
        center_lat=IN_ZONE[0], center_lng=IN_ZONE[1], radius_km=radius_km,
    )
    db_session.add(zone)
    db_session.commit()
    return zone


def _payload(store, product, qty=2, coords=IN_ZONE):
    return {
        "restaurant_id": store.id,
        "items": [{"product_id": product.id, "quantity": qty}],
        "address_line": "Chilonzor 5-kvartal, 12-uy",
        "lat": coords[0], "lng": coords[1],
        "phone": "+998901234500",
        "payment_method": "cash",
    }


# ── Zona ─────────────────────────────────────────────────────────
def test_order_outside_zone_is_rejected(client, db_session, tenant_a, customer_token):
    store, product = _catalog(db_session, tenant_a)
    _zone(db_session, store)

    resp = client.post(
        "/api/orders", json=_payload(store, product, coords=FAR_AWAY),
        headers=auth(customer_token),
    )
    assert resp.status_code == 400
    assert "hududingizga" in resp.json()["detail"]

    # Rad etilgan buyurtma omborni kamaytirmaydi.
    db_session.expire_all()
    assert db_session.get(Product, product.id).stock == 10.0


def test_order_inside_zone_is_accepted(client, db_session, tenant_a, customer_token):
    store, product = _catalog(db_session, tenant_a)
    _zone(db_session, store)

    resp = client.post(
        "/api/orders", json=_payload(store, product), headers=auth(customer_token)
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["status"] == OrderStatus.pending.value


def test_zone_without_radius_does_not_block(client, db_session, tenant_a, customer_token):
    """Zona sozlanmagan do'kon hamma joyga yetkazadi (cheklov qo'yilmagan)."""
    store, product = _catalog(db_session, tenant_a)
    db_session.add(DeliveryZone(
        restaurant_id=store.id, name="Sozlanmagan", is_active=True,
    ))
    db_session.commit()

    resp = client.post(
        "/api/orders", json=_payload(store, product, coords=FAR_AWAY),
        headers=auth(customer_token),
    )
    assert resp.status_code == 201, resp.text


# ── Summa ────────────────────────────────────────────────────────
def test_totals_are_computed_by_server(client, db_session, tenant_a, customer_token):
    store, product = _catalog(db_session, tenant_a, price=10_000)
    _zone(db_session, store)

    body = client.post(
        "/api/orders", json=_payload(store, product, qty=2), headers=auth(customer_token)
    ).json()
    assert body["items_total"] == 20_000
    # 50 000 dan kam → masofa bo'yicha haq (do'kon = zona markazi, 0 km → 1 km narxi)
    assert body["delivery_fee"] == 2_000
    assert body["total"] == 22_000


def test_delivery_is_free_above_threshold(client, db_session, tenant_a, customer_token):
    store, product = _catalog(db_session, tenant_a, price=30_000, stock=10)
    _zone(db_session, store)

    body = client.post(
        "/api/orders", json=_payload(store, product, qty=2), headers=auth(customer_token)
    ).json()
    assert body["items_total"] == 60_000
    assert body["delivery_fee"] == 0
    assert body["total"] == 60_000


# ── Ombor ────────────────────────────────────────────────────────
def test_stock_is_reserved(client, db_session, tenant_a, customer_token):
    store, product = _catalog(db_session, tenant_a, stock=5)
    _zone(db_session, store)

    client.post("/api/orders", json=_payload(store, product, qty=2),
                headers=auth(customer_token))
    db_session.expire_all()
    assert db_session.get(Product, product.id).stock == 3.0


def test_order_beyond_stock_is_rejected(client, db_session, tenant_a, customer_token):
    store, product = _catalog(db_session, tenant_a, stock=1)
    _zone(db_session, store)

    resp = client.post("/api/orders", json=_payload(store, product, qty=5),
                       headers=auth(customer_token))
    assert resp.status_code == 400
    assert "ombor" in resp.json()["detail"].lower()
    db_session.expire_all()
    assert db_session.get(Product, product.id).stock == 1.0


def test_stock_is_restored_when_second_item_fails(
    client, db_session, tenant_a, customer_token
):
    """Ko'p mahsulotli savatda oxirgisi yiqilsa — birinchisining zaxirasi qaytadi."""
    store, ok_product = _catalog(db_session, tenant_a, stock=10)
    short = Product(
        restaurant_id=store.id, category_id=ok_product.category_id,
        name_uz="Nok", name_ru="Груша", price=5_000, stock=1, unit="kg",
    )
    db_session.add(short)
    db_session.commit()
    _zone(db_session, store)

    payload = _payload(store, ok_product, qty=2)
    payload["items"].append({"product_id": short.id, "quantity": 9})

    resp = client.post("/api/orders", json=payload, headers=auth(customer_token))
    assert resp.status_code == 400
    db_session.expire_all()
    assert db_session.get(Product, ok_product.id).stock == 10.0
    assert db_session.get(Product, short.id).stock == 1.0


def test_stock_is_restored_on_unexpected_error(
    client, db_session, tenant_a, customer_token, monkeypatch
):
    """Kutilmagan xato (HTTPException emas) ham omborni kamaytirib qoldirmaydi.

    Avval `except HTTPException` edi — DB uzilishida zaxira kamaygancha qolib,
    mahsulot "yo'qolardi".
    """
    from app.services import orders as orders_service

    store, product = _catalog(db_session, tenant_a, stock=7)
    _zone(db_session, store)

    def boom(*_args, **_kwargs):
        raise RuntimeError("DB uzildi")

    monkeypatch.setattr(orders_service, "_generate_number", boom)

    with pytest.raises(RuntimeError):
        client.post("/api/orders", json=_payload(store, product, qty=3),
                    headers=auth(customer_token))

    db_session.expire_all()
    assert db_session.get(Product, product.id).stock == 7.0


# ── Boshqa cheklovlar ────────────────────────────────────────────
def test_closed_store_rejects_order(client, db_session, tenant_a, customer_token):
    store, product = _catalog(db_session, tenant_a)
    store.is_open = False
    db_session.commit()

    resp = client.post("/api/orders", json=_payload(store, product),
                       headers=auth(customer_token))
    assert resp.status_code == 400


def test_only_cash_is_accepted(client, db_session, tenant_a, customer_token):
    store, product = _catalog(db_session, tenant_a)
    payload = _payload(store, product)
    payload["payment_method"] = "card"

    resp = client.post("/api/orders", json=payload, headers=auth(customer_token))
    assert resp.status_code in (400, 422)


def test_unavailable_product_names_itself(client, db_session, tenant_a, customer_token):
    store, product = _catalog(db_session, tenant_a)
    product.is_available = False
    db_session.commit()

    resp = client.post("/api/orders", json=_payload(store, product),
                       headers=auth(customer_token))
    assert resp.status_code == 400
    assert "Olma" in resp.json()["detail"]


def test_blocked_user_cannot_order(client, db_session, tenant_a, customer, customer_token):
    store, product = _catalog(db_session, tenant_a)
    customer.is_blocked = True
    db_session.commit()

    resp = client.post("/api/orders", json=_payload(store, product),
                       headers=auth(customer_token))
    assert resp.status_code == 403


def test_order_does_not_wait_for_external_geocode(
    client, db_session, tenant_a, customer_token, monkeypatch
):
    """So'rov yo'lida tashqi geocode chaqirilmaydi — u fonda bajariladi."""
    from app.services import orders as orders_service

    store, product = _catalog(db_session, tenant_a)
    _zone(db_session, store)

    def fail(*_a, **_k):
        raise AssertionError("reverse_geocode so'rov yo'lida chaqirildi")

    monkeypatch.setattr(orders_service, "reverse_geocode", fail)

    payload = _payload(store, product)
    payload["address_line"] = ""  # zaif manzil — avval shu yerda geocode bo'lardi

    resp = client.post("/api/orders", json=payload, headers=auth(customer_token))
    assert resp.status_code == 201, resp.text
    assert resp.json()["address_line"].startswith("📍")
