"""Mijoz xato xabarlari tili (`Accept-Language`) va buyurtmani bekor qilish."""
from app.core.i18n_errors import pick_lang, translate
from app.core.security import create_access_token
from app.models import Order, User
from app.models.enums import OrderStatus, PaymentMethod, PaymentStatus
from tests.conftest import auth


def _customer(db_session, tg_id: int) -> tuple[User, str]:
    user = User(telegram_id=tg_id, language="uz")
    db_session.add(user)
    db_session.commit()
    return user, create_access_token(subject=str(user.id), role="user")


def _order(db_session, user, tenant, status: OrderStatus, number: str) -> Order:
    order = Order(
        user_id=user.id, restaurant_id=tenant.restaurant_id, number=number,
        status=status, payment_method=PaymentMethod.cash,
        payment_status=PaymentStatus.unpaid,
        items_total=10_000, delivery_fee=0, total=10_000, address_line="Test manzil",
    )
    db_session.add(order)
    db_session.commit()
    return order


def test_translate_unit():
    assert pick_lang("ru-RU,ru;q=0.9,en;q=0.8") == "ru"
    assert pick_lang("en-US") is None and pick_lang(None) is None
    assert translate("Order not found", "ru") == "Заказ не найден"
    assert translate("Order not found", "uz") == "Buyurtma topilmadi"
    assert translate("Order not found", None) == "Order not found"
    # Kodlar va noma'lum matn o'zgarmaydi
    assert translate("OUT_OF_RANGE", "ru") == "OUT_OF_RANGE"
    assert "Olma" in translate("'Olma' uchun ombor yetarli emas (qoldiq: 2)", "ru")


def test_http_error_translated_by_accept_language(client, db_session):
    _, token = _customer(db_session, 700_001)
    url = "/api/orders/999999"
    ru = client.get(url, headers={**auth(token), "Accept-Language": "ru"})
    uz = client.get(url, headers={**auth(token), "Accept-Language": "uz"})
    plain = client.get(url, headers=auth(token))
    assert ru.status_code == uz.status_code == plain.status_code == 404
    assert ru.json()["detail"] == "Заказ не найден"
    assert uz.json()["detail"] == "Buyurtma topilmadi"
    assert plain.json()["detail"] == "Order not found"


def test_validation_error_localized_and_shape_kept(client, db_session):
    _, token = _customer(db_session, 700_002)
    r = client.patch(
        "/api/orders/1/items", json={"items": []},
        headers={**auth(token), "Accept-Language": "ru"},
    )
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert isinstance(detail, list) and "loc" in detail[0]
    assert "Данные введены неверно" in detail[0]["msg"]


def test_customer_cancels_pending_order(client, db_session, tenant_a):
    user, token = _customer(db_session, 700_003)
    order = _order(db_session, user, tenant_a, OrderStatus.pending, "CNL-1")
    r = client.post(f"/api/orders/{order.id}/cancel", headers=auth(token))
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"


def test_customer_cannot_cancel_confirmed_order(client, db_session, tenant_a):
    user, token = _customer(db_session, 700_004)
    order = _order(db_session, user, tenant_a, OrderStatus.confirmed, "CNL-2")
    r = client.post(
        f"/api/orders/{order.id}/cancel",
        headers={**auth(token), "Accept-Language": "ru"},
    )
    assert r.status_code == 400
    assert "магазин" in r.json()["detail"]
    db_session.refresh(order)
    assert order.status == OrderStatus.confirmed


def test_customer_cannot_cancel_others_order(client, db_session, tenant_a):
    owner, _ = _customer(db_session, 700_005)
    _, other_token = _customer(db_session, 700_006)
    order = _order(db_session, owner, tenant_a, OrderStatus.pending, "CNL-3")
    r = client.post(f"/api/orders/{order.id}/cancel", headers=auth(other_token))
    assert r.status_code == 404
