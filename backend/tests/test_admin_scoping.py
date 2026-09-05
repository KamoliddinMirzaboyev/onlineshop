from tests.conftest import auth


def test_business_reads_own_store(client, tenant_a):
    resp = client.get(
        f"/api/admin/store?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == tenant_a.restaurant_id


def test_business_cannot_read_other_store(client, tenant_a, tenant_b):
    resp = client.get(
        f"/api/admin/store?restaurant_id={tenant_b.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 403


def test_staff_reads_own_store_without_param(client, tenant_a):
    resp = client.get("/api/admin/store", headers=auth(tenant_a.staff_token))
    assert resp.status_code == 200
    assert resp.json()["id"] == tenant_a.restaurant_id


def test_business_without_restaurant_id_gets_400(client, tenant_a):
    resp = client.get("/api/admin/store", headers=auth(tenant_a.business_token))
    assert resp.status_code == 400


def test_stats_scoped_to_store(client, tenant_a):
    resp = client.get(
        f"/api/admin/stats?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 200
    assert resp.json()["orders_total"] == 0


def _make_category(client, tenant, name="Ichimliklar"):
    return client.post(
        f"/api/admin/categories?restaurant_id={tenant.restaurant_id}",
        json={"name_uz": name, "name_ru": name, "parent_id": None, "sort_order": 0},
        headers=auth(tenant.business_token),
    )


def test_business_creates_category_in_own_store(client, tenant_a):
    resp = _make_category(client, tenant_a)
    assert resp.status_code == 201


def test_category_list_is_scoped(client, tenant_a, tenant_b):
    _make_category(client, tenant_a, "A kategoriya")
    _make_category(client, tenant_b, "B kategoriya")

    resp = client.get(
        f"/api/admin/restaurants/{tenant_a.restaurant_id}/categories"
        f"?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 200
    names = [c["name_uz"] for c in resp.json()]
    assert names == ["A kategoriya"]


def test_business_cannot_list_other_stores_categories(client, tenant_a, tenant_b):
    resp = client.get(
        f"/api/admin/restaurants/{tenant_b.restaurant_id}/categories?restaurant_id={tenant_b.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 403


def test_business_cannot_edit_other_stores_product(client, tenant_a, tenant_b):
    # Tenant B creates a category + product in their own store.
    cat = _make_category(client, tenant_b, "B kat").json()
    sub = client.post(
        f"/api/admin/categories?restaurant_id={tenant_b.restaurant_id}",
        json={"name_uz": "B sub", "name_ru": "B sub", "parent_id": cat["id"], "sort_order": 0},
        headers=auth(tenant_b.business_token),
    ).json()
    prod = client.post(
        f"/api/admin/products?restaurant_id={tenant_b.restaurant_id}",
        json={
            "category_id": sub["id"], "name_uz": "B mahsulot", "name_ru": "B mahsulot",
            "price": 1000, "cost": 500, "stock": 10, "unit": "dona",
            "low_stock_threshold": 2, "is_available": True, "sort_order": 0,
        },
        headers=auth(tenant_b.business_token),
    ).json()

    # Tenant A tries to change its price, scoped to their own store.
    resp = client.put(
        f"/api/admin/products/{prod['id']}?restaurant_id={tenant_a.restaurant_id}",
        json={
            "category_id": sub["id"], "name_uz": "O'g'irlangan", "name_ru": "O'g'irlangan",
            "price": 1, "cost": 1, "stock": 1, "unit": "dona",
            "low_stock_threshold": 1, "is_available": True, "sort_order": 0,
        },
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 404


def test_business_cannot_change_other_stores_stock(client, tenant_a, tenant_b):
    cat = _make_category(client, tenant_b, "B kat2").json()
    sub = client.post(
        f"/api/admin/categories?restaurant_id={tenant_b.restaurant_id}",
        json={"name_uz": "B sub2", "name_ru": "B sub2", "parent_id": cat["id"], "sort_order": 0},
        headers=auth(tenant_b.business_token),
    ).json()
    prod = client.post(
        f"/api/admin/products?restaurant_id={tenant_b.restaurant_id}",
        json={
            "category_id": sub["id"], "name_uz": "B mahsulot2", "name_ru": "B mahsulot2",
            "price": 1000, "cost": 500, "stock": 10, "unit": "dona",
            "low_stock_threshold": 2, "is_available": True, "sort_order": 0,
        },
        headers=auth(tenant_b.business_token),
    ).json()

    resp = client.patch(
        f"/api/admin/products/{prod['id']}/stock?restaurant_id={tenant_a.restaurant_id}",
        json={"stock": 999},
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 404


from tests.conftest import make_order


def test_orders_list_is_scoped(client, db_session, tenant_a, tenant_b):
    make_order(db_session, tenant_a, total=5_000)
    make_order(db_session, tenant_b, total=7_000)

    resp = client.get(
        f"/api/admin/orders?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 200
    totals = [o["total"] for o in resp.json()]
    assert totals == [5_000]


def test_notifications_are_scoped(client, db_session, tenant_a, tenant_b):
    make_order(db_session, tenant_a, total=5_000)
    make_order(db_session, tenant_b, total=7_000)

    resp = client.get(
        f"/api/admin/notifications?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 200
    assert all(e["total"] == 5_000 for e in resp.json())


def test_business_cannot_cancel_other_stores_order(client, db_session, tenant_a, tenant_b):
    order_b = make_order(db_session, tenant_b, total=7_000)

    resp = client.patch(
        f"/api/admin/orders/{order_b.id}?restaurant_id={tenant_a.restaurant_id}",
        json={"status": "cancelled"},
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 404


# require_staff resolves via get_current_admin, which rejects a non-admin-role
# ("businessman") token with 401 before role is even checked — so a businessman
# is blocked with 401, not 403. Either way: no data, which is the point.
def test_businessman_blocked_from_delivery_zone(client, tenant_a):
    resp = client.get(
        f"/api/admin/delivery-zone?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 401


def test_businessman_blocked_from_couriers(client, tenant_a):
    resp = client.get(
        f"/api/admin/couriers?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 401


def test_staff_courier_list_is_scoped(client, db_session, tenant_a, tenant_b):
    from app.models import Courier

    db_session.add(Courier(name="A kuryer", restaurant_id=tenant_a.restaurant_id))
    db_session.add(Courier(name="B kuryer", restaurant_id=tenant_b.restaurant_id))
    db_session.commit()

    resp = client.get("/api/admin/couriers", headers=auth(tenant_a.staff_token))
    assert resp.status_code == 200
    assert [c["name"] for c in resp.json()] == ["A kuryer"]


def test_staff_delivery_zone_is_scoped(client, db_session, tenant_a, tenant_b):
    from app.models import DeliveryZone

    db_session.add(DeliveryZone(name="B zona", restaurant_id=tenant_b.restaurant_id))
    db_session.commit()

    # Tenant A has no zone of their own — must get null, not tenant B's.
    resp = client.get("/api/admin/delivery-zone", headers=auth(tenant_a.staff_token))
    assert resp.status_code == 200
    assert resp.json() is None


def test_users_list_only_shows_store_customers(client, db_session, tenant_a, tenant_b):
    order_a = make_order(db_session, tenant_a, total=5_000)
    make_order(db_session, tenant_b, total=7_000)

    resp = client.get(
        f"/api/admin/users?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 200
    ids = [u["id"] for u in resp.json()]
    assert ids == [order_a.user_id]


def test_users_list_filter_all_includes_non_orderers(client, db_session, tenant_a):
    from app.models import User

    order_a = make_order(db_session, tenant_a, total=5_000)
    lurker = User(telegram_id=999_999_001, language="uz")
    db_session.add(lurker)
    db_session.commit()

    resp = client.get(
        f"/api/admin/users?restaurant_id={tenant_a.restaurant_id}&filter=all",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 200
    ids = {u["id"] for u in resp.json()}
    assert ids == {order_a.user_id, lurker.id}


def test_users_list_filter_not_ordered_excludes_orderers(client, db_session, tenant_a):
    from app.models import User

    order_a = make_order(db_session, tenant_a, total=5_000)
    lurker = User(telegram_id=999_999_002, language="uz")
    db_session.add(lurker)
    db_session.commit()

    resp = client.get(
        f"/api/admin/users?restaurant_id={tenant_a.restaurant_id}&filter=not_ordered",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 200
    ids = {u["id"] for u in resp.json()}
    assert ids == {lurker.id}
    assert order_a.user_id not in ids


def test_admin_users_list_is_scoped(client, tenant_a, tenant_b):
    resp = client.get(
        f"/api/admin/admin-users?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 200
    usernames = [u["username"] for u in resp.json()]
    assert "staff_a" in usernames
    assert "staff_b" not in usernames


def test_business_creates_staff_in_own_store(client, db_session, tenant_a):
    resp = client.post(
        f"/api/admin/admin-users?restaurant_id={tenant_a.restaurant_id}",
        json={"username": "yangi_manager", "password": "pw123456", "role": "manager"},
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 201
    assert resp.json()["restaurant_id"] == tenant_a.restaurant_id


def test_business_cannot_delete_other_stores_staff(client, tenant_a, tenant_b):
    resp = client.delete(
        f"/api/admin/admin-users/{tenant_b.staff_id}?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 404
