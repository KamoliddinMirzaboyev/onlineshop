# Barakali Bozor — Telegram Food Delivery Platform

Marketplace-style food delivery system (Uzbekistan).

## Components

| App | Stack | Path |
|-----|-------|------|
| **Backend API + Bot** | FastAPI + aiogram + SQLAlchemy + PostgreSQL + Redis | `backend/` |
| **TMA** (Telegram Mini App) | React + TS + Tailwind + Vite | `tma/` |
| **Admin panel** | React + TS + Tailwind + Vite | `admin/` |
| **Courier app** (PWA) | React + TS + Tailwind + Vite | `courier/` |
| **Businessman panel** | React + TS + Tailwind + Vite | `businessman/` |
| **Superadmin panel** | React + TS + Tailwind + Vite | `superadmin/` |
| **Mijoz ilovasi** | Flutter | `mijoz_app/` |
| **Kuryer ilovasi** | Flutter | `kuryer/` |

## Features

- Multi-restaurant marketplace (restaurants, categories, products)
- Telegram Mini App ordering flow: browse → cart → checkout → track
- Cash-on-delivery payment (gateway-ready architecture for Payme/Click/Uzum)
- Couriers & delivery zones
- Bilingual: O'zbek (uz) + Rus (ru)
- Telegram `initData` auth (HMAC verification) + JWT
- Admin RBAC, orders board, menu management, analytics

## Quick start

```bash
cp .env.example .env                  # postgres creds (docker-compose interpolation)
cp backend/.env.example backend/.env  # BOT_TOKEN, secrets, DB, Redis, admin
cp tma/.env.example tma/.env          # VITE_API_URL
cp admin/.env.example admin/.env      # VITE_API_URL
cp courier/.env.example courier/.env  # VITE_API_URL
docker compose up --build             # postgres, redis, backend, bot, tma, admin, courier
```

Each app owns its own `.env`. The root `.env` holds only the `POSTGRES_*`
credentials docker-compose interpolates into the `postgres` service.

- Backend API → http://localhost:8000  (docs at `/docs`)
- TMA → http://localhost:5173
- Admin → http://localhost:3000
- Courier → http://localhost:3001

## Local dev (without Docker)

See `backend/README.md`, `tma/README.md`, `admin/README.md`.

## CI / deploy

- `.github/workflows/ci.yml` — har push/PR'da: backend testlari (Postgres +
  Redis servislari bilan), `alembic check`, 5 ta React ilova uchun
  `tsc --noEmit` + `build`, 2 ta Flutter ilova uchun `analyze` + `test`.
- `main`ga push'da hammasi o'tgach SSH orqali serverdagi
  `/opt/allfoods/deploy.sh` chaqiriladi — u repodagi `ops/deploy.sh` ni
  bajaradi (api + bot konteynerlari). Batafsil: `ops/README.md`.
- Web panellar va TMA Vercel'da — o'sha push'da o'zi quriladi.

## Architecture

```
Telegram client
   │  initData
   ▼
TMA (React) ──REST──► Backend API (FastAPI) ──► PostgreSQL
   ▲                       │  └── Redis (cache, sessions)
   │                       ▼
Bot (aiogram) ◄── order events / notifications
   ▲
Admin (React) ──REST──► Backend API (admin routes, JWT+RBAC)
   ▲
Courier (React PWA) ──REST──► Backend API (courier routes, JWT) + Web Push
```
