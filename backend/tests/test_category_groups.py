from tests.conftest import auth


def test_restaurant_detail_includes_category_groups(client, tenant_a, db_session):
    from app.models import Category, CategoryGroup

    group = CategoryGroup(restaurant_id=tenant_a.restaurant_id, name_uz="Meva", name_ru="Meva", sort_order=0)
    db_session.add(group)
    db_session.commit()

    top = Category(
        restaurant_id=tenant_a.restaurant_id, parent_id=None, group_id=group.id,
        name_uz="Mevalar", name_ru="Mevalar", sort_order=0,
    )
    db_session.add(top)
    db_session.commit()

    resp = client.get(f"/api/restaurants/{tenant_a.restaurant_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["category_groups"] == [
        {"id": group.id, "name_uz": "Meva", "name_ru": "Meva", "sort_order": 0}
    ]
    assert body["categories"][0]["group_id"] == group.id


def test_ungrouped_category_has_null_group_id(client, tenant_a, db_session):
    from app.models import Category

    top = Category(
        restaurant_id=tenant_a.restaurant_id, parent_id=None,
        name_uz="Sut", name_ru="Sut", sort_order=0,
    )
    db_session.add(top)
    db_session.commit()

    resp = client.get(f"/api/restaurants/{tenant_a.restaurant_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["category_groups"] == []
    assert body["categories"][0]["group_id"] is None


def _make_group(client, tenant, name="Meva va sabzavotlar"):
    return client.post(
        f"/api/admin/category-groups?restaurant_id={tenant.restaurant_id}",
        json={"name_uz": name, "name_ru": name, "sort_order": 0},
        headers=auth(tenant.business_token),
    )


def test_business_creates_category_group(client, tenant_a):
    resp = _make_group(client, tenant_a)
    assert resp.status_code == 201
    assert resp.json()["name_uz"] == "Meva va sabzavotlar"


def test_category_group_list_is_scoped(client, tenant_a, tenant_b):
    _make_group(client, tenant_a, "A guruh")
    _make_group(client, tenant_b, "B guruh")

    resp = client.get(
        f"/api/admin/category-groups?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 200
    names = [g["name_uz"] for g in resp.json()]
    assert names == ["A guruh"]


def test_business_cannot_update_other_stores_group(client, tenant_a, tenant_b):
    group_id = _make_group(client, tenant_b, "B guruh").json()["id"]
    resp = client.put(
        f"/api/admin/category-groups/{group_id}?restaurant_id={tenant_a.restaurant_id}",
        json={"name_uz": "O'g'irlangan", "name_ru": "O'g'irlangan", "sort_order": 0},
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 404


def test_delete_group_nulls_category_group_id(client, tenant_a, db_session):
    from app.models import Category

    group_id = _make_group(client, tenant_a).json()["id"]
    cat = Category(
        restaurant_id=tenant_a.restaurant_id, parent_id=None, group_id=group_id,
        name_uz="Mevalar", name_ru="Mevalar", sort_order=0,
    )
    db_session.add(cat)
    db_session.commit()
    cat_id = cat.id

    resp = client.delete(
        f"/api/admin/category-groups/{group_id}?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 204

    db_session.expire_all()
    refreshed = db_session.get(Category, cat_id)
    assert refreshed.group_id is None
