"""Bootstrap the superadmin and a single default store. Idempotent.

No mock catalog — categories and products are added from the admin panel.
"""

from sqlalchemy import select

from app.core.config import settings
from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import AdminUser, Business, PlatformAdmin, Restaurant
from app.models.enums import AdminRole

DEFAULT_STORE_NAME = "Do'kon"


def seed() -> None:
    with SessionLocal() as db:
        # ── single default store (business_id comes from the default Business
        # row that initdb.py always creates before seed.py runs) ──
        restaurant = db.scalar(select(Restaurant).limit(1))
        if not restaurant:
            business = db.scalar(select(Business).order_by(Business.id).limit(1))
            if business is None:
                raise ValueError("Default business not found")
            restaurant = Restaurant(
                name=DEFAULT_STORE_NAME,
                is_active=True, is_open=True,
                delivery_fee=2000, min_order=50_000,
                business_id=business.id,
            )
            db.add(restaurant)
            db.commit()
            db.refresh(restaurant)
            print(f"Created default store '{DEFAULT_STORE_NAME}'.")

        # ── bootstrap superadmin ──
        if not db.scalar(select(AdminUser).where(AdminUser.username == settings.first_admin_username)):
            db.add(AdminUser(
                username=settings.first_admin_username,
                hashed_password=hash_password(settings.first_admin_password),
                role=AdminRole.superadmin,
                restaurant_id=restaurant.id,
            ))
            db.commit()
            print(f"Created superadmin '{settings.first_admin_username}'.")

        # ── bootstrap platform superadmin (bizning akkaunt) ──
        if not db.scalar(
            select(PlatformAdmin).where(
                PlatformAdmin.username == settings.first_platform_username
            )
        ):
            db.add(PlatformAdmin(
                username=settings.first_platform_username,
                hashed_password=hash_password(settings.first_platform_password),
            ))
            db.commit()
            print(f"Created platform admin '{settings.first_platform_username}'.")


if __name__ == "__main__":
    seed()
