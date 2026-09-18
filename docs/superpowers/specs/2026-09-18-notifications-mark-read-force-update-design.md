# Bildirishnomalar "hammasi o'qildi" tugmasi + majburiy yangilanish (force update)

Sana: 2026-09-18

## 1. Bildirishnomalar — "Barchasini o'qildi" tugmasi (mijoz_app)

**Joriy holat:** `mijoz_app/lib/pages/notifications_page.dart` `_load()` — sahifa ochilganda,
agar o'qilmagan xabar bo'lsa, avtomatik `notificationCenter.markAllRead()` + `POST
/notifications/read-all` chaqiradi. Ro'yxatdagi item'lar (`_items`) esa eski `isRead`
qiymati bilan render qilinadi — ko'k nuqta keyingi safar sahifa ochilmaguncha turib qoladi.

**O'zgarish:**
- Avtomatik mark-all-read `_load()`dan olib tashlanadi.
- `PageHeader`ga action tugma qo'shiladi, faqat `_items.any((n) => !n.isRead)` bo'lsa ko'rinadi.
- Bosilganda: `setState` bilan barcha item `isRead=true` (darhol vizual), so'ng
  `notificationCenter.markAllRead()` va `api.post('/notifications/read-all', {})`
  (best-effort — backend xato bersa ham UI orqaga qaytmaydi, faqat log).

**Backend o'zgarishi kerak emas** — `/notifications/read-all` allaqachon mavjud
(`backend/app/api/routes/notifications.py`).

## 2. Majburiy yangilanish (force update) — mijoz_app + kuryer, faqat Android

**Maqsad:** Play Market'da yangi versiya chiqqach, eski build ochilganda foydalanuvchi
yangilamaguncha ilovaga kira olmasin (bloklovchi, orqaga qaytarib bo'lmaydigan ekran).

**Backend:**
- Yangi model `AppVersion` (`backend/app/models/app_version.py`):
  `id`, `app` (str, unique — `"mijoz"` | `"kuryer"`), `min_version_code` (int, default 0),
  `store_url` (str, nullable), `updated_at`.
- Alembic migratsiya.
- `GET /app/version/{app}` — **public** (auth talab qilinmaydi) →
  `{"min_version_code": int, "store_url": str | null}`. Yozuv topilmasa
  `{"min_version_code": 0, "store_url": null}` (hech kim bloklanmaydi).
- `PUT /platform/app-version/{app}` — `require_platform_admin` (superadmin), body:
  `{"min_version_code": int, "store_url": str | null}`, upsert qiladi.

**Superadmin (`superadmin/src/pages/SettingsPage.tsx`):**
- Yangi bo'lim: "Ilova versiyasi" — 2 karta (Mijoz ilovasi, Kuryer ilovasi), har birida
  `min_version_code` raqam input + `store_url` matn input + Saqlash tugmasi.
- Sahifa ochilganda `GET /platform/app-version/mijoz` va `.../kuryer` bilan joriy qiymat
  yuklanadi (yozuv yo'q bo'lsa bo'sh/0 ko'rsatiladi).

**Mobile (mijoz_app va kuryer, bir xil pattern):**
- Yangi dependency: `package_info_plus` (^8.x) — ikkala `pubspec.yaml`ga.
- Boot vaqtida (mijoz_app: `_BootGate.initState` splash'dan keyin; kuryer: ekvivalent boot
  joyida) `GET /app/version/{app}` chaqiriladi.
- **Fail-open:** so'rov xato bersa (tarmoq yo'q, timeout, 5xx) — bloklanmaydi, oddiy oqim
  davom etadi.
- `PackageInfo.fromPlatform().buildNumber` (int) `min_version_code`dan kichik bo'lsa →
  `AppShell`/normal ekran o'rniga to'liq ekran `ForceUpdatePage` ko'rsatiladi:
  - `PopScope(canPop: false)` — orqaga tugma bilan chiqib bo'lmaydi.
  - Matn: "Yangi versiya chiqdi, davom etish uchun ilovani yangilang."
  - Tugma "Play Marketda yangilash" → `url_launcher` bilan `store_url` (bo'sh bo'lsa
    `https://play.google.com/store/apps/details?id=<applicationId>` fallback —
    mijoz: `uz.barakalibozor.mijoz`, kuryer: `uz.barakalibozor.kuryer`).
  - Login holati tekshirilmaydi — force-update auth'dan oldin ishlaydi.

**Qamrovdan tashqari:** iOS/App Store, "keyinroq eslat" (soft-update banner).

## Test

- Backend: `GET /app/version/{app}` yozuv bor/yo'q holatlari; `PUT
  /platform/app-version/{app}` faqat platform admin uchun ishlashi (`test_platform_routes.py`
  ga qo'shiladi).
- Mobile: qo'lda tekshirish (min_version_code'ni joriy build'dan katta qilib superadmin'da
  saqlab, ilova qayta ochilganda blok ekran chiqishini ko'rish; keyin 0'ga qaytarib normal
  ochilishini tekshirish).
