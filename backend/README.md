# Barakali Bozor — Backend (API + Bot)

FastAPI + aiogram + SQLAlchemy + PostgreSQL + Redis.

## Run (local, without Docker)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                # set BOT_TOKEN etc. (POSTGRES_HOST=localhost for local)

python -m app.initdb                # create tables
python -m app.seed                  # sample data + superadmin
uvicorn app.main:app --reload       # API at http://localhost:8000/docs

python -m app.bot.run               # bot (separate terminal)
```

## Layout

- `app/core/` — config, db, redis, security (JWT + Telegram initData HMAC)
- `app/models/` — SQLAlchemy models
- `app/schemas/` — Pydantic request/response models
- `app/api/routes/` — auth, catalog, addresses, orders, admin_auth, admin
- `app/services/` — order creation, Telegram notifications
- `app/bot/` — aiogram bot (start, language, phone, Mini App launch)
- `app/initdb.py` — create tables  ·  `app/seed.py` — sample data

## Auth model

- **Users**: Telegram Mini App sends `initData`; backend verifies HMAC
  (`POST /api/auth/telegram`) and returns a JWT with role `user`.
- **Admins**: username/password (`POST /api/admin/auth/login`) → JWT with
  role `superadmin|manager|courier`. All `/api/admin/*` routes require it.

## Payments

Cash-on-delivery is implemented. `PaymentMethod`/`PaymentStatus` enums and the
order flow leave gateway integration (Payme/Click/Uzum) as drop-in:
add a webhook route + set `payment_status=paid`.

## Migrations

`initdb` uses `create_all` for first boot. For schema changes use Alembic:

```bash
alembic revision --autogenerate -m "change"
alembic upgrade head
```
