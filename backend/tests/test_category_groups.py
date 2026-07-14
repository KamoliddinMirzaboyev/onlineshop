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
