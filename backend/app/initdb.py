"""Create all tables. Idempotent. Used at container start.

For schema migrations in production prefer Alembic:
    alembic revision --autogenerate -m "msg"
    alembic upgrade head
"""

import secrets

from sqlalchemy import text

from app.core.db import Base, engine
from app.core.security import hash_password
import app.models  # noqa: F401  (register all models on Base.metadata)

# create_all yangi ustun qoʻshmaydi — mavjud products jadvaliga tannarx/stok
# ustunlarini idempotent ravishda qoʻshamiz (Postgres).
_PRODUCT_COLUMNS = (
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS cost INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS stock DOUBLE PRECISION NOT NULL DEFAULT 0",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold DOUBLE PRECISION NOT NULL DEFAULT 10",
    # Eski INTEGER ustunlar model Float bilan moslashsin.
    "ALTER TABLE products ALTER COLUMN stock TYPE DOUBLE PRECISION USING stock::double precision",
    "ALTER TABLE products ALTER COLUMN low_stock_threshold TYPE DOUBLE PRECISION USING low_stock_threshold::double precision",
)

# Kategoriyalarga rasm (kartochka foni) + subkategoriya uchun parent_id — idempotent.
# group_id — Title (category_groups) jadvali `create_all` bilan yangi yaratiladi,
# shuning uchun bu ALTER (keyinroq bajariladi) doim uni topa oladi.
_CATEGORY_COLUMNS = (
    "ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url VARCHAR(512)",
    "ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE",
    "ALTER TABLE categories ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES category_groups(id) ON DELETE SET NULL",
    "ALTER TABLE categories ADD COLUMN IF NOT EXISTS bg_color VARCHAR(16)",
    "ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE",
)

_CATEGORY_GROUP_COLUMNS = (
    "ALTER TABLE category_groups ADD COLUMN IF NOT EXISTS bg_color VARCHAR(16)",
)

# order_items.cost — sotuv vaqtidagi tannarx snapshot'i (foyda hisobi uchun).
# image_url — mahsulot rasmi snapshot'i (chek va panellarda ko'rsatish uchun).
_ORDER_ITEM_COLUMNS = (
    "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS image_url VARCHAR(512)",
    # o'lchov birligi snapshot (kg/dona/litr) + mahsulotga mijoz izohi
    "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit VARCHAR(32) NOT NULL DEFAULT 'dona'",
    "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS note TEXT",
    # quantity endi kasr bo'lishi mumkin (kg kabi o'lchovlar) — model Integer'dan Float'ga o'tdi.
    "ALTER TABLE order_items ALTER COLUMN quantity TYPE DOUBLE PRECISION",
)

# Yetkazish oqimi: kuryerga biriktirish, doira zona, kuryer push obunasi.
# courier_delivered_at — kuryer buyurtmani yakunlagan vaqt.
# distance_km/eta_minutes + accepted/delivering vaqt belgilari — masofa & ETA tahlili.
_ORDER_COLUMNS = (
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_courier_id INTEGER "
    "REFERENCES admin_users(id)",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_delivered_at TIMESTAMPTZ",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS distance_km DOUBLE PRECISION",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS eta_minutes INTEGER",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_accepted_at TIMESTAMPTZ",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivering_started_at TIMESTAMPTZ",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS route_group_id VARCHAR(36)",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS route_sequence INTEGER",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS route_leg_km DOUBLE PRECISION",
)
_ZONE_COLUMNS = (
    "ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS center_lat DOUBLE PRECISION",
    "ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS center_lng DOUBLE PRECISION",
    "ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS radius_km DOUBLE PRECISION",
)
_PUSH_COLUMNS = (
    "ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS admin_user_id INTEGER "
    "REFERENCES admin_users(id) ON DELETE CASCADE",
    # Admin-panel obunalarni do'konga bog'laydi — bo'lmasa har bir do'kon
    # boshqasining buyurtma push'larini ham olar edi (cross-tenant leak).
    "ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS restaurant_id INTEGER "
    "REFERENCES restaurants(id) ON DELETE CASCADE",
)
# Foydalanuvchini bloklash (admin paneldan) — buyurtma bera olmaydi.
# password_hash / fcm_token — mijoz app (telefon login + push); create_all
# mavjud jadvalga ustun qo'shmaydi, shuning uchun idempotent ALTER.
_USER_COLUMNS = (
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(255)",
)
# Xodim akkaunti: ism va telefon (do'kon yaratilganda tadbirkor kiritadi).
_ADMIN_USER_COLUMNS = (
    "ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS name VARCHAR(128)",
    "ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS phone VARCHAR(32)",
    "ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION",
    "ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION",
    "ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMPTZ",
    # Native kuryer APK push (Firebase Cloud Messaging).
    "ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(512)",
)
# Do'kon sozlamalari: manzil, ega, telefonlar (JSONB array), ijtimoiy tarmoq (JSONB obyekt).
_STORE_COLUMNS = (
    "ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS address VARCHAR(512)",
    "ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS owner_name VARCHAR(128)",
    "ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS phones JSONB NOT NULL DEFAULT '[]'",
    "ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS socials JSONB NOT NULL DEFAULT '{}'",
    # Do'kon joylashuvi (masofa/ETA origin).
    "ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION",
    "ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION",
)

# Native PG enum'ga yangi qiymat qo'shish ('accepted'). create_all enum'ni
# o'zgartirmaydi; ADD VALUE alohida AUTOCOMMIT'da bajariladi (transaction ichida
# ishlamasligi mumkin). IF NOT EXISTS — idempotent.
_ENUM_VALUES = (
    "ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'accepted' AFTER 'ready'",
)


def _ensure_default_business(conn) -> int:
    """At least one Business must exist before restaurants.business_id can be
    backfilled. Its login is a random, unusable placeholder password — the
    businessman PWA (a later project) is what lets someone set a real one."""
    row = conn.execute(text("SELECT id FROM businesses ORDER BY id LIMIT 1")).first()
    if row:
        return row[0]
    placeholder_hash = hash_password(secrets.token_urlsafe(32))
    result = conn.execute(
        text(
            "INSERT INTO businesses (name, username, hashed_password, is_active, created_at) "
            "VALUES (:name, :username, :hash, TRUE, now()) RETURNING id"
        ),
        {"name": "Asosiy biznes", "username": "default_business", "hash": placeholder_hash},
    )
    return result.scalar_one()


def main(engine=engine) -> None:
    Base.metadata.create_all(bind=engine)
    # Enum qiymatlari — har birini alohida AUTOCOMMIT bilan (xato bo'lsa o'tkazib yuboramiz,
    # masalan jadval hali yo'q bo'lsa create_all uni endigina yaratgan bo'ladi).
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        for stmt in _ENUM_VALUES:
            try:
                conn.execute(text(stmt))
            except Exception as e:  # noqa: BLE001
                print(f"enum value skip: {e}")
    with engine.begin() as conn:
        for stmt in (
            *_PRODUCT_COLUMNS,
            *_CATEGORY_COLUMNS,
            *_CATEGORY_GROUP_COLUMNS,
            *_ORDER_ITEM_COLUMNS,
            *_ORDER_COLUMNS,
            *_ZONE_COLUMNS,
            *_PUSH_COLUMNS,
            *_USER_COLUMNS,
            *_ADMIN_USER_COLUMNS,
            *_STORE_COLUMNS,
        ):
            conn.execute(text(stmt))

        # Multi-tenant foundation: businesses/restaurants/admin_users backfill.
        business_id = _ensure_default_business(conn)
        conn.execute(text(
            "ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS business_id INTEGER "
            "REFERENCES businesses(id) ON DELETE CASCADE"
        ))
        conn.execute(
            text("UPDATE restaurants SET business_id = :bid WHERE business_id IS NULL"),
            {"bid": business_id},
        )
        conn.execute(text("ALTER TABLE restaurants ALTER COLUMN business_id SET NOT NULL"))

        conn.execute(text(
            "ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS restaurant_id INTEGER "
            "REFERENCES restaurants(id) ON DELETE CASCADE"
        ))
        first_restaurant = conn.execute(
            text("SELECT id FROM restaurants ORDER BY id LIMIT 1")
        ).first()
        if first_restaurant:
            conn.execute(
                text("UPDATE admin_users SET restaurant_id = :rid WHERE restaurant_id IS NULL"),
                {"rid": first_restaurant[0]},
            )
        conn.execute(text("ALTER TABLE admin_users ALTER COLUMN restaurant_id SET NOT NULL"))

        # delivery_zones / couriers — cross-tenant izolyatsiya uchun do'konga bog'lash.
        # couriers — legacy jadval (modeli yo'q, faqat eski bazalarda bor);
        # toza bazada create_all uni yaratmaydi, shuning uchun mavjudligini tekshiramiz.
        for table in ("delivery_zones", "couriers"):
            if conn.execute(text("SELECT to_regclass(:t)"), {"t": table}).scalar() is None:
                continue
            conn.execute(text(
                f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS restaurant_id INTEGER "
                "REFERENCES restaurants(id) ON DELETE CASCADE"
            ))
            if first_restaurant:
                conn.execute(
                    text(f"UPDATE {table} SET restaurant_id = :rid WHERE restaurant_id IS NULL"),
                    {"rid": first_restaurant[0]},
                )
            conn.execute(text(f"ALTER TABLE {table} ALTER COLUMN restaurant_id SET NOT NULL"))

        # Phone unique (NULL ruxsat — faqat telegram userlar). Dublikatlarni
        # eng kichik id saqlab, qolganlarini NULL qilamiz (keyin index).
        try:
            conn.execute(text(
                """
                UPDATE users u SET phone = NULL
                WHERE u.phone IS NOT NULL AND u.phone <> ''
                  AND u.id NOT IN (
                    SELECT MIN(id) FROM users
                    WHERE phone IS NOT NULL AND phone <> ''
                    GROUP BY phone
                  )
                """
            ))
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_phone_not_null "
                "ON users (phone) WHERE phone IS NOT NULL AND phone <> ''"
            ))
        except Exception as e:  # noqa: BLE001
            print(f"phone unique index skip: {e}")
    print("Tables created / verified.")


if __name__ == "__main__":
    main()
