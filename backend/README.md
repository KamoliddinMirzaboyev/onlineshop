# Barakali Bozor — Backend (API + Bot)

FastAPI + aiogram + SQLAlchemy + PostgreSQL + Redis.

## Run (local, without Docker)

Python **3.12** (prod image ham shu versiyada; 3.13+ da `psycopg` g'ildiragi yo'q).

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt  # requirements.txt + pytest
cp .env.example .env                 # BOT_TOKEN va h.k. (lokalda POSTGRES_HOST=localhost)

python -m app.initdb                 # jadvallarni yaratish
python -m app.seed                   # default do'kon + superadmin
uvicorn app.main:app --reload        # API: http://localhost:8000/docs

python -m app.bot.run                # bot (alohida terminal)
```

## Testlar

Testlar **haqiqiy Postgres** talab qiladi (sxemada JSONB, native enum, DO blok
bor — SQLite mos kelmaydi). Redis shart emas: kesh va rate-limit usiz ham
ishlaydi (fail-open).

```bash
# Postgres (Docker bo'lsa)
docker compose -f ../docker-compose.local-test.yml up -d postgres
export TEST_DATABASE_URL=postgresql+psycopg://allfoods:allfoods@localhost:5433/allfoods_test

# yoki host'dagi Postgres bilan (standart URL localhost:5432/allfoods_test)
createdb allfoods_test

pytest -q
```

CI (`.github/workflows/ci.yml`) har push'da shularni ishga tushiradi:
`pytest`, `alembic check`, 5 ta React ilovaning `tsc --noEmit` + `build`i,
2 ta Flutter ilovaning `analyze` + `test`i. Hammasi o'tgach main'da deploy.

## Migratsiya (Alembic)

Sxema tarixi `alembic/versions/` da. Baseline — mavjud ishlab turgan sxema.
Modelni o'zgartirgandan keyin **albatta** migratsiya yarating:

```bash
alembic revision --autogenerate -m "nima o'zgardi"
alembic upgrade head
alembic check            # modellar va migratsiyalar mos — CI ham shuni tekshiradi
```

`app/initdb.py` dagi qo'lda `ALTER TABLE ... IF NOT EXISTS` ro'yxati eski
deploy'lar uchun qoldirilgan (idempotent). Yangi o'zgarishlarni u yerga emas,
Alembic'ga yozing.

## Xizmat skriptlari

```bash
python -m scripts.cleanup_uploads            # yetim rasmlarni ko'rsatadi
python -m scripts.cleanup_uploads --delete   # o'chiradi (oyiga bir marta)
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
