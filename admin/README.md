# Barakali Bozor — Admin Panel

React + TS + Tailwind + Vite. Manages restaurants, menus, orders, couriers, zones, users.

## Dev

```bash
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:8000/api
npm run dev            # http://localhost:5174
```

## Login

Default superadmin is seeded from `backend/.env`:

- `FIRST_ADMIN_USERNAME` (default `admin`)
- `FIRST_ADMIN_PASSWORD` (default `admin12345`)

Change these before deploying.

## Pages

- **Dashboard** — today/total orders & revenue, pending count, users
- **Orders** — live board, status changes (notifies user via bot), courier assignment
- **Restaurants** — CRUD + open/closed toggle
- **Menu** — categories & products per restaurant (uz/ru)
- **Couriers** — CRUD
- **Zones** — delivery zones (fee, min order)
- **Users** — read-only list of Telegram users
