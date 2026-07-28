# Barakali Bozor — TMA (Telegram Mini App)

React + TS + Tailwind + Vite. Runs inside Telegram as a Mini App.

## Dev

```bash
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:8000/api
npm run dev            # http://localhost:5173
```

In plain browser there is no Telegram context, so auth runs in fallback mode
(read-only). Real auth requires opening the app via the bot (`@allfoodsuzbot`),
which supplies `initData` for HMAC verification.

## Connecting to Telegram

Prod URL: **https://barakali-bozor.uz**

1. Deploy TMA to that domain (Vercel / DNS).
2. `TMA_URL=https://barakali-bozor.uz` in `backend/.env` (bot keyboard + CORS).
3. BotFather → Mini App / Menu Button URL = `https://barakali-bozor.uz`.

## Structure

- `src/telegram.ts` — Telegram WebApp SDK wrapper + browser fallback
- `src/api/` — typed REST client
- `src/store/` — zustand stores (auth, cart with persistence)
- `src/pages/` — Home, Restaurant, Cart, Checkout, Orders, OrderDetail, Profile
- `src/i18n.ts` — uz/ru translations
