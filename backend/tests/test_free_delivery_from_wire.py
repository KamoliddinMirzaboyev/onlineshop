"""`min_order` → `free_delivery_from` nomi almashdi, wire mos qoladi.

Chiqarilgan APK'lar va eski panel build'lari hali `min_order` kalitini
o'qiydi/yuboradi — shuning uchun javobda ikkala nom ham bor va kirishda
ikkalasi ham qabul qilinadi.
"""

from tests.conftest import auth


def test_response_carries_both_names(client, tenant_a, db_session):
    from app.models import Restaurant

    store = db_session.get(Restaurant, tenant_a.restaurant_id)
    store.free_delivery_from = 70_000
    db_session.commit()

    body = client.get("/api/admin/store", headers=auth(tenant_a.staff_token)).json()
    assert body["free_delivery_from"] == 70_000
    assert body["min_order"] == 70_000  # eski mijozlar uchun


def test_legacy_min_order_input_is_accepted(client, tenant_a, db_session):
    from app.models import Restaurant

    resp = client.put(
        "/api/admin/store",
        json={"name": "Do'kon", "min_order": 33_000},
        headers=auth(tenant_a.staff_token),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["free_delivery_from"] == 33_000
    db_session.expire_all()
    assert db_session.get(Restaurant, tenant_a.restaurant_id).free_delivery_from == 33_000


def test_new_name_input_is_accepted(client, tenant_a):
    resp = client.put(
        "/api/admin/store",
        json={"name": "Do'kon", "free_delivery_from": 44_000},
        headers=auth(tenant_a.staff_token),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["free_delivery_from"] == 44_000
    assert resp.json()["min_order"] == 44_000
