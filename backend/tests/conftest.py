import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://allfoods:allfoods@localhost:5432/allfoods_test",
)


@pytest.fixture(scope="session")
def engine():
    from app.core.db import Base
    import app.models  # noqa: F401 — register all models on Base.metadata

    eng = create_engine(TEST_DATABASE_URL)
    # Drop first: a previous run killed mid-session (timeout, Ctrl-C) skips the
    # teardown drop_all below and leaves rows that collide with this run's fixtures.
    Base.metadata.drop_all(bind=eng)
    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)
    eng.dispose()


@pytest.fixture
def db_session(engine):
    from app.core.db import Base

    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.rollback()
    for table in reversed(Base.metadata.sorted_tables):
        session.execute(table.delete())
    session.commit()
    session.close()


@pytest.fixture
def client(db_session):
    from app.core.db import get_db
    from app.main import app

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


from dataclasses import dataclass


@dataclass
class Tenant:
    """One business + its store + a superadmin staff account, with tokens."""
    business_id: int
    business_token: str
    restaurant_id: int
    staff_id: int
    staff_token: str


def _make_tenant(db_session, slug: str) -> Tenant:
    from app.core.security import create_access_token, hash_password
    from app.models import AdminUser, Business, Restaurant
    from app.models.enums import AdminRole

    business = Business(
        name=f"Biznes {slug}", username=f"biz_{slug}", hashed_password=hash_password("pw"),
    )
    db_session.add(business)
    db_session.commit()

    restaurant = Restaurant(name=f"Do'kon {slug}", business_id=business.id)
    db_session.add(restaurant)
    db_session.commit()

    staff = AdminUser(
        username=f"staff_{slug}", hashed_password=hash_password("pw"),
        role=AdminRole.superadmin, restaurant_id=restaurant.id,
    )
    db_session.add(staff)
    db_session.commit()

    return Tenant(
        business_id=business.id,
        business_token=create_access_token(subject=str(business.id), role="businessman"),
        restaurant_id=restaurant.id,
        staff_id=staff.id,
        staff_token=create_access_token(subject=str(staff.id), role=AdminRole.superadmin.value),
    )


@pytest.fixture
def tenant_a(db_session) -> Tenant:
    return _make_tenant(db_session, "a")


@pytest.fixture
def tenant_b(db_session) -> Tenant:
    return _make_tenant(db_session, "b")


def auth(token: str) -> dict:
    """Authorization header helper for tests."""
    return {"Authorization": f"Bearer {token}"}


def make_order(db_session, tenant, total: int = 10_000):
    """A delivered order belonging to `tenant`'s store, from a fresh customer."""
    from app.models import Order, User
    from app.models.enums import OrderStatus, PaymentMethod, PaymentStatus

    user = User(telegram_id=abs(hash(f"{tenant.restaurant_id}-{total}")) % 10**9, language="uz")
    db_session.add(user)
    db_session.commit()

    order = Order(
        user_id=user.id,
        restaurant_id=tenant.restaurant_id,
        number=f"ORD-{tenant.restaurant_id}-{total}",
        status=OrderStatus.delivered,
        payment_method=PaymentMethod.cash,
        payment_status=PaymentStatus.paid,
        items_total=total, delivery_fee=0, total=total,
        address_line="Test manzil",
    )
    db_session.add(order)
    db_session.commit()
    return order
