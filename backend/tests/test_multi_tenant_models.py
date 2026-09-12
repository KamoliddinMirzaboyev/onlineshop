import pytest
from sqlalchemy.exc import IntegrityError

from app.models import AdminUser, Business, PlatformAdmin, Restaurant
from app.models.enums import AdminRole


def test_business_requires_unique_username(db_session):
    db_session.add(Business(
        name="Test Biznes", username="biz1", hashed_password="x",
    ))
    db_session.commit()

    db_session.add(Business(
        name="Boshqa Biznes", username="biz1", hashed_password="y",
    ))
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_platform_admin_requires_unique_username(db_session):
    db_session.add(PlatformAdmin(username="platform1", hashed_password="x"))
    db_session.commit()

    db_session.add(PlatformAdmin(username="platform1", hashed_password="y"))
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_restaurant_requires_business_id(db_session):
    db_session.add(Restaurant(name="Do'kon 2"))
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_admin_user_requires_restaurant_id(db_session):
    business = Business(name="Biznes", username="biz2", hashed_password="x")
    db_session.add(business)
    db_session.commit()
    restaurant = Restaurant(name="Do'kon 3", business_id=business.id)
    db_session.add(restaurant)
    db_session.commit()

    db_session.add(AdminUser(username="staff1", hashed_password="x", role=AdminRole.manager))
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_delivery_zone_requires_restaurant_id(db_session, tenant_a):
    from app.models import DeliveryZone

    db_session.add(DeliveryZone(name="Zona"))
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_courier_account_requires_restaurant_id(db_session, tenant_a):
    from app.core.security import hash_password
    from app.models import AdminUser
    from app.models.enums import AdminRole

    db_session.add(AdminUser(
        username="kuryer", hashed_password=hash_password("pw"), role=AdminRole.courier,
    ))
    with pytest.raises(IntegrityError):
        db_session.commit()
