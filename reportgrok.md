# Barakali Bozor — To‘liq QA / Security / Architecture Audit

**Auditor:** Senior Q&A (20 yil)  
**Sana:** 2026-08-18  
**Obyekt:** `All Foods` monorepo (Claude orqali qurilgan marketplace)  
**Usul:** statik kod tahlili (backend, 5 ta web, 2 ta Flutter, Docker, spec, testlar). Exploit ishlatilmadi.  
**Muhim:** hisobotda **sirlar (token, parol, private key) qayta yozilmaydi**. Diskda real secret bor — darhol rotate qiling.

---

## 0. Qisqa xulosa

Bu ishlaydigan, production’ga chiqarilgan oziq-ovqat yetkazish platformasi. Ba’zi qismlar (HMAC, atomic courier claim, stock reserve, tenant scoping testlari, upload magic-byte) professional. Lekin Claude-generated “hammasi ishlaydi” qatlami ostida:

- **sirlar diskda** (Firebase SA, Android keystore, `.env`);
- **ikki xil production API host**;
- **oshxona oqimi o‘lik** — kuryer `pending` buyurtmani o‘zi oladi;
- **mijoz bekor qila olmaydi**, yetkazishni tasdiqlamaydi, kuryer summani oshirishi mumkin;
- **OTP yo‘q** — telefon orqali akkaunt o‘g‘irlash;
- **schema migratsiyasi yo‘q** (`initdb.py` + `ALTER IF NOT EXISTS`);
- **README 4 ta app** deb yozadi, aslida **7 ta klient**;
- **testlar tenant scoping’da yaxshi**, lekin auth/order/upload/E2E deyarli yo‘q; ba’zi testlar **sinadi**.

**Umumiy holat:** ishlab turgan MVP / early production. Pul, PII va Play Store riski yuqori. Avval secret rotate + pul/oqim qulflash, keyin UX.

| Daraja | Soni (taxminan) |
|--------|-----------------|
| CRITICAL | 9 |
| HIGH | 38 |
| MEDIUM | 52 |
| LOW / INFO | 40+ |
| Dizayn / UX | 18 |
| Spec drift | 12 |

---

## 1. Haqiqiy arxitektura (README yolg‘on)

README faqat 4 ta komponentni ko‘rsatadi. Diskda:

```
Telegram ──► TMA (React) ──────────────┐
Mijoz Flutter (mijoz_app) ─────────────┤
                                       ▼
Admin PWA  ── JWT+RBAC ──► FastAPI ──► PostgreSQL
Businessman PWA                        Redis (cache, ratelimit, SSE, bot FSM)
Superadmin PWA                         Uploads (lokal disk)
Courier PWA ── Web Push ───────────────┤
Kuryer Flutter ── FCM ─────────────────┘
                                       ▲
Bot (aiogram) ◄── order events ────────┘
```

| App | Path | Stack | README | Docker Compose | Prod host (kod) |
|-----|------|-------|--------|----------------|-----------------|
| API + Bot | `backend/` | FastAPI + aiogram | ha | ha | `api.barakali-bozor.uz` |
| TMA | `tma/` | React/Vite | ha | **dev server** | Vercel (root `vercel.json`) |
| Admin | `admin/` | React/Vite | ha | **dev server** | `admin.barakali-bozor.uz` |
| Courier PWA | `courier/` | React/Vite | ha | **dev server** | `kuryer.barakali-bozor.uz` |
| Businessman | `businessman/` | React/Vite | **yo‘q** | **yo‘q** | `tadbirkor.barakali-bozor.uz` |
| Superadmin | `superadmin/` | React/Vite | **yo‘q** | **yo‘q** | `PLATFORM_URL` bo‘sh |
| Kuryer APK | `kuryer/` | Flutter | **yo‘q** | yo‘q | `allfoodapi.webportfolio.uz` |
| Mijoz APK | `mijoz_app/` | Flutter | **yo‘q** | yo‘q | `allfoodapi.webportfolio.uz` |

**Ikki parallel API:** web `api.barakali-bozor.uz`, native `allfoodapi.webportfolio.uz`. Courier PWA SSE fallback ham eski hostga ketadi.

---

## 2. CRITICAL

### C1. Firebase service-account private key diskda + Docker image

- `backend/secrets/firebase-adminsdk.json` — jonli `private_key`, project `barakali-bozor-5972a`.
- `.gitignore` ushlaydi, lekin **`.dockerignore` yo‘q**. `backend/Dockerfile` `COPY . .` — `docker build` kalitni imagega soladi.
- **Ta’sir:** FCM spam, Firebase IAM, mijoz/kuryer push o‘g‘irlash.
- **Fix:** kalitni GCP’da **darhol rotate + disable**; `.dockerignore` (`secrets/`, `.env`, `venv/`, `uploads/`); creds faqat env/secret mount.

### C2. `.env` da `ENVIRONMENT=development` + prod URL

- `backend/.env`: `ENVIRONMENT=development`, lekin `API_BASE_URL` / `TMA_URL` production domenlar.
- `main.py`: development → CORS `allow_origin_regex=".*"`, `/docs` ochiq, HSTS yo‘q, `_INSECURE_DEFAULTS` tekshiruvi ishlamaydi.
- **Ta’sir:** shu fayl prod containerda bo‘lsa — butun internet Origin, OpenAPI, zaif bootstrap himoyasi o‘chiq.
- **Fix:** prod hostda `ENVIRONMENT=production`. Deploy pipeline tekshirsin.

### C3. Android release keystore + ochiq parol

- `kuryer/android/key.properties` + `kuryer-release.jks` (ikki nusxa).
- `mijoz_app/android/key.properties` + `rasta-release.jks`.
- Gitignore bor, **diskda jonli**.
- **Ta’sir:** Play update imzolash, app impersonatsiya.
- **Fix:** upload key rotate; JKS ni barcha mashina/zip/chatdan o‘chirish; parol CI secret.

### C4. Release APK/AAB + mapping/symbols daraxtida

- `BB-Kuryer-v1.2.3.apk` (root)
- `Play Market/release/` — 1.2.0 / 1.2.1 / 1.2.3 AAB+APK + `mapping-1.2.0-4.txt` + `symbols/`
- `Play Market.zip`
- `*.apk` / `*.aab` `.gitignore`da **yo‘q**.
- **Ta’sir:** sideload, reverse-engineer, mapping orqali deobfuscation.
- **Fix:** gitignore + object storage; historydan olib tashlash.

### C5. Telefon register = bot akkauntini egallash (OTP yo‘q)

```86:105:backend/app/api/routes/auth.py
```

Bot orqali kontakt yuborgan userda `phone` bor, `password_hash` yo‘q. Hamma `POST /api/auth/register` bilan shu `user.id` ga JWT oladi (buyurtmalar, manzil, FCM).

- **Kim:** autentifikatsiyasiz + chek/admin doskadagi telefon.
- **Fix:** OTP yoki Telegram proof. “Claim” ni parol-reset qilish; sessiya bermaslik.

### C6. Play privacy URL 404

- Listing: `https://allfoodapi.webportfolio.uz/privacy` → `{"detail":"Not Found"}`.
- Fayl faqat `kuryer/store/play/privacy-policy.html`.
- **Ta’sir:** Play reject / takedown.
- **Fix:** HTML ni barqaror HTTPS’da joylash; Console ni yangilash.

### C7. Receipt SSRF — `httpx.get(product.image_url)`

```62:73:backend/app/services/receipt.py
```

`ProductIn.image_url` — ixtiyoriy string. Buyurtma/adjust chek chizganda backend shu URL’ga so‘rov yuboradi (`follow_redirects=True`).

- **Ta’sir:** IMDS / intranet / ichki servis.
- **Fix:** faqat `api_base_url` / `UPLOAD_DIR`; private IP blok; redirect cheklash.

### C8. JWT 7 kun, revoke yo‘q, bitta HS256 secret

- `access_token_expire_minutes = 60 * 24 * 7`.
- Parol/username o‘zgarsa ham eski token ishlaydi.
- Logout faqat klient.
- Token `localStorage` / `SharedPreferences` (shifrlangan emas).
- **Ta’sir:** o‘g‘irlangan admin/kuryer/business/platform token 7 kun.
- **Fix:** qisqa access + refresh; `token_version` bump; `flutter_secure_storage`; XSS audit.

### C9. Docker frontend = `npm run dev`

- `tma/Dockerfile`, `admin/Dockerfile`, `courier/Dockerfile`: `CMD npm run dev`.
- Compose shu image’larni ko‘taradi.
- **Ta’sir:** HMR, source map, bitta thread, production emas. Agar “prod” deb ishlatilsa — xavfsizlik + barqarorlik.
- **Fix:** multi-stage nginx **yoki** faqat Vercel; compose ni “local only” deb belgilash.

---

## 3. HIGH — xavfsizlik va pul

### H1. Kuryer savat miqdorini oshirishi mumkin (mijoz roziligisiz)

`PATCH /courier/orders/{id}/adjust` — mavjud qator `qty` **yuqoriga**. Yetkazish haqi qayta hisoblanmaydi. COD — mijoz yangi summani to‘laydi. Faqat keyin Telegram xabar.

- Faqat kamaytirish yoki mijoz tasdig‘i.

### H2. Oshxona oqimi o‘lik; kuryer `pending` ni o‘zi oladi

State graph: `pending → accepted` ruxsat. Admin faqat **bekor** qila oladi (`admin.py` 575–578). `confirmed` / `preparing` / `ready` yozilmaydi.

- Taom do‘kon tasdig‘isiz chiqadi.
- Spec (`2026-06-27-delivery-flow-design.md`) admin confirm + assign deydi.
- Unit test `test_transition_allows_pending_to_accepted` xavfli xatti-harakatni qotiradi.

**Fix:** claim faqat `ready` (yoki haqiqiy confirm).

### H3. Mijoz buyurtmani bekor qila olmaydi

`/api/orders` — faqat POST/GET. Cancel faqat admin. Kuryer ham cancel qila olmaydi (`COURIER_ALLOWED_STATUSES`).

### H4. “Yetkazildi” = bir tomonlama + naqd `paid`

Kuryer `/delivered` bosadi → `delivered` + `payment_status=paid`. Mijoz tasdig‘i olib tashlangan (kod izohi: “tugmani bosmasdi”).

- Soxta yetkazish + kuryer `delivery_fee` “daromadi”.
- Bepul yetkazishda `delivery_fee=0` → kuryer 0 so‘m.

### H5. Mahsulot CRUD katalog keshini invalidatsiya qilmaydi

`invalidate_restaurant_catalog` — store/kategoriya/guruhda bor; **`POST/PUT/DELETE /products` va `PATCH …/stock` da yo‘q**.

TTL 120s: eski narx/mavjudlik. TMA savat persist qilgan `product.price` bilan checkout ko‘rsatadi, server jonli narx oladi.

### H6. Business/platform store yozuvi ham keshni tozalamaydi

`PUT/DELETE /business/stores/{rid}`, `PATCH /platform/stores/{rid}/toggle`, `POST /business/stores` — invalidate yo‘q. Nofaol do‘kon ~2 daqiqa TMA’da turadi.

### H7. Admin chek — stored XSS

`admin/src/pages/OrdersPage.tsx` `doc.write` — `customer_name`, `phone`, `address_line`, `comment`, `name_uz` escape qilinmagan.

Mijoz izohi `<img onerror=…>` admin originida ishlaydi.

### H8. Admin/superadmin/businessman SW autentifikatsiyalangan API GET ni keshlaydi

`NetworkFirst` `/api/*`, 5s timeout, 24h TTL. Sevkin tarmoqda **kechagi buyurtmalar**. Logoutdan keyin kesh o‘qiladi.

Hech qachon auth API ni keshlamang.

### H9. Tarmoq xatosi = logout (admin, businessman, superadmin)

`loadMe` catch → token o‘chadi. 502 / wifi flip = sessiya yo‘qoladi. Courier PWA buni to‘g‘riroq qiladi (`failed` + retry).

### H10. Courier PWA `401` → `location.href = "/login"` (login yo‘li ham)

Login 401 ham redirect. `VITE_BASE=/courier/` da `https://host/login` (404). Admin/superadmin/businessman ham basename’ni e’tiborsiz.

### H11. Courier EventSource default host eskirgan

`courier/src/components/Layout.tsx`: fallback `https://allfoodapi.webportfolio.uz/api`. Qolgan web `api.barakali-bozor.uz`. SSE jim o‘ladi, poll “ba’zan jonli”.

### H12. Flutter ikkala app ham eski/boshqa API host

`kuryer/lib/services/api.dart` va `mijoz_app/lib/services/api.dart`: `https://allfoodapi.webportfolio.uz/api` **hardcoded**. Flavor/`--dart-define` yo‘q.

### H13. Rate-limit `X-Forwarded-For` ishonadi + fail-open

Klient `X-Forwarded-For: 1.2.3.4` yuborsa (proxy overwrite qilmasa) limit aylanadi. Redis o‘lsa — cheksiz login/order/geo.

Compose `8000:8000` → `0.0.0.0`. Login 10/min, order 20/min — akkaunt lockout yo‘q.

### H14. Production CORS: localhost + `*.barakali-bozor.uz`

`config.py` prod’da ham `localhost:3000/3001/5173–5177`. Regex har qanday subdomain.

Unutilgan subdomain XSS → credentialed CORS (Bearer JS da).

### H15. Telegram HTML injection

`notify.py` `parse_mode=HTML`. `address_line`, `phone`, `courier_name/phone` escape yo‘q. Admin broadcast / e’lon — xom HTML barcha mijozlarga.

### H16. Push global, store-scoped emas (admin)

`notify_admins` — `admin_user_id IS NULL` bo‘lgan **barcha** subscription. `admin.py` subscribe `admin_user_id` yozmaydi.

Do‘kon A buyurtmasi do‘kon B planshetiga tushadi.

### H17. Logout push’ni o‘chirmaydi

Admin, courier PWA, businessman — unsubscribe yo‘q. Umumiy planshet: oldingi user push olishda davom etadi.

### H18. Courier PWA uchta ogohlantirish

SW notification + `PushBridge` ovoz + Layout poll yangi ID → ovoz/OS/toast. Kuryer ilovani o‘chiradi.

### H19. GPS har fix’da POST (PWA) / butun sessiya high-accuracy (Flutter)

PWA `watchPosition` → har nuqta `/courier/location`. Flutter `LocationAccuracy.high`, pause’da to‘xtamaydi, 401 da ham GPS qoladi.

### H20. `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` e’lon qilingan, ishlatilmagan

Play restricted permission. Kodda so‘rov yo‘q.

### H21. iOS FCM/APNs ulanmagan (kuryer)

`GoogleService-Info.plist` yo‘q, `UIBackgroundModes` yo‘q, AppDelegate Firebase yo‘q. O‘ldirilgan iOS app yangi buyurtma olmaydi.

### H22. Mijoz Flutter: logout yo‘q, buyurtma tarixi yo‘q, FCM o‘lik

- Token 401 gacha yashaydi.
- Checkout → Home, `GET /orders` chaqirilmaydi.
- `google-services.json` yo‘q; `POST_NOTIFICATIONS` yo‘q; login’dan keyin FCM sozlanmaydi.
- `allowBackup` default (kuryerda o‘chirilgan).

### H23. Mijoz/TMA default-store fallback zonani aylanadi

GPS yo‘q / tarmoq xato → `/restaurants/default` (birinchi faol do‘kon). `needsLocation` TMA’da **hardcoded `false`**.

Noto‘g‘ri do‘kon katalogi; checkout’da zona 400 yoki zona sozlanmagan bo‘lsa — noto‘g‘ri do‘konga buyurtma.

### H24. TMA yopiq do‘konni bloklamaydi

`is_open` tipda bor, UI ishlatmaydi. Katalog `is_open` filter qilmaydi. Fail faqat `POST /orders` 400.

### H25. TMA savatda stock/narx cap yo‘q

`Product` tipida `stock` yo‘q (backend `ProductOut` da bor). `+` cheksiz. Checkout jonli katalogni qayta olmaydi.

### H26. Staff parol reset: 4 belgi; create: min yo‘q

`PATCH /admin-users/{uid}/password` — 4. `_AdminUserCreateIn.password` — cheklov yo‘q.

### H27. Store superadmin boshqa `superadmin` yarata oladi

Rol ixtiyoriy. Store-scoped, lekin peer full-admin (cancel, stock, broadcast, parol reset).

### H28. `ProductIn.price` `ge=0` yo‘q; `CartItemIn.quantity` max yo‘q

Manfiy narx → manfiy COD. `qty=1e15` overflow.

### H29. Business `PUT /stores/{rid}` mass-assignment + defaultlar

`model_dump()` (`exclude_unset` emas). Faqat `{name}` yuborilsa `delivery_fee=2000`, `min_order=50000`, `is_active=True`, `phones=[]` qayta yoziladi.

Admin `update_store` to‘g‘ri `exclude_unset=True`.

### H30. `set_order_location` hisobni qayta yozadi + zona tashqarisini saqlaydi

Bot geo: `delivery_fee`/`total` qayta. `out_of_zone` ham **coords saqlanadi**. GPS spoof do‘kon yoniga → arzon yetkazish.

### H31. Uploads named volume yo‘q; image leak

Compose `./backend:/app`. Bind-mountsiz prod restart = rasmlar yo‘q. `.dockerignore` yo‘q → secrets image ichida.

### H32. Alembic revision yo‘q; har start `initdb + seed`

`alembic/versions/` yo‘q. `ALTER IF NOT EXISTS` + `SET NOT NULL` + enum `ADD VALUE`. Ikki replica parallel start — race. README “Alembic ishlating” — amalda yo‘q.

### H33. Backup yo‘q

`backups/` da bitta 2026-07-09 dump (gitignore). Cron/WAL/offsite/uploads backup yo‘q.

### H34. Redis parolsiz (default) + persist yo‘q

`REDIS_PASSWORD` bo‘lmasa auth yo‘q. Restart = cache + rate-limit + bot FSM. Pub/sub inject (SSE).

`docker-compose.local-test.yml`: Postgres `5433` va Redis `6380` **barcha interfeys**ga.

### H35. `/health` yolg‘on

`{"status":"ok"}` — PG/Redis tekshirmaydi. Compose’da backend/bot/frontend healthcheck yo‘q. CI (`.github/workflows`) yo‘q.

### H36. Kuryer Flutter 3 marta `/courier/orders` poll

Nav 8s + dashboard 12s + orders 20s. `IndexedStack` hammasi tirik. SSE `/stream-ticket` ishlatilmaydi.

### H37. 409 “boshqa kuryer oldi” yutiladi (Flutter)

Generic toast. Ikki qurilma accept — ikkinchisi tushunmaydi.

### H38. Hard delete user/store = buxgalteriya yo‘qolishi

`DELETE /platform/users/{uid}` — buyurtmalar + itemlar o‘chadi. `DELETE /platform/stores/{rid}?force=true` — tarix yo‘qoladi. Soft-delete/audit yo‘q.

---

## 4. MEDIUM — mantiq, multi-tenant, infra

### M1. `min_order` = bepul yetkazish chegarasi, min savat emas

Model izohi va `calc_delivery_fee` shunday. UI/i18n hali “Min. buyurtma”. Zona `fee` / `min_order` / `polygon` **ishlatilmaydi** (faqat doira).

### M2. Checkout delivery fee ≠ server

TMA haversine(`store.lat/lng`). Server `shop_origin` = store **yoki zona markazi**. Store coords yo‘q → UI 1 km, server 4 km.

Quote endpoint yo‘q.

### M3. Adjust fee qayta hisoblamaydi

Mahsulot tushsa ham pullik yetkazish qoladi; oshsa ham bepul qolishi mumkin.

### M4. ETA global, do‘kon kesimi emas

`eta.py` barcha tenant `delivered` qatorlaridan o‘rganadi. Bir do‘kon boshqasini zaharlaydi.

### M5. Marshrut haversine, OSRM default bo‘sh

Spec: OSRM yo‘q = haversine. Real yo‘l km emas. Koordinatasiz stop oxiriga.

### M6. Tadbirkor delivery zone qo‘ya olmaydi

Zone endpoint `require_staff` → businessman 401. Test `test_businessman_blocked_from_delivery_zone` buni qotiradi. Zona faqat do‘kon xodimida.

### M7. `/admin/users` va `/admin/supplies` `limit` qisilmagan

Platform 200 ga qisadi; admin yo‘q. To‘liq mijoz dump / DoS.

### M8. SSE `restaurant_id` yo‘q event = broadcast

`if data.get("restaurant_id") and …` — bo‘sh payload barcha kuryerga. Redis ochiq bo‘lsa inject.

### M9. Adjust vs cancel race

Adjust order qatorini lock qilmaydi. Cancel restore + adjust yozuvi → stock drift / bekor qilingan order o‘zgaradi.

### M10. Stock overwrite atomik emas

`p.stock = data.stock` vs `reserve_stock_atomic`. Supply `int(quantity)` — 2.5 kg → 2. Delete supply `max(0, stock - int(qty))`.

`StockUpdate.stock` `ge=0` yo‘q.

### M11. Mahsulot o‘chirish — FK

`OrderItem.product_id` `ondelete` yo‘q. Tarixli mahsulot DELETE → 500. Cache ham tozalanmaydi.

### M12. initData replay 24 soat

`max_age_seconds=86400`. O‘g‘irlangan initData bir kun JWT beradi. 5–15 daqiqa + nonce.

### M13. `int(payload["sub"])` 500

Noto‘g‘ri `sub` → `ValueError`, 401 emas.

### M14. Admin telefon login normalize qilinmaydi

Saqlash xom; login `phone == username` aniq moslik. `+998…` vs `90…` ishlamaydi.

### M15. `normalize_phone` 10–15 raqam catch-all

Har qanday “xalqaro” raqam `+{digits}`. OTP yo‘qligi bilan birga.

### M16. Username/telefon enumeratsiyasi

Register: `"Phone number already registered"`. Timing: user yo‘qida `verify_password` chaqirilmaydi.

### M17. Public `/api/geo/reverse` (60/min)

Auth yo‘q. Nominatim/proxy. XFF spoof bilan kvota yoqish.

`/restaurants` ham authsiz — kutilgan, lekin `owner_name`, `phones`, `stock` ochiq.

### M18. `ProductOut.stock` ochiq (TMA tipi e’tiborsiz)

Raqobatchi omborni scrape qiladi. TMA tipi `stock` ni o‘qimaydi — ikki tomon ham noto‘g‘ri.

### M19. Catalog `ilike(%q%)` — index ishlamaydi

SQLi emas (parameterized), katta katalogda DoS.

### M20. `/restaurants/nearest` origin yo‘q do‘konlarda birinchisini qaytaradi

Zona sozlanmagan = zona tekshiruvi skip.

### M21. Kuryer GPS schema chegarasiz

`LocationUpdateIn` `ge=-90` yo‘q. Axlat GPS depot/ETA buzadi.

### M22. Dashboard vs series pul nomuvofiqligi

`_agg` revenue = `Order.total` (yetkazish bilan). `_series` = faqat item. Foyda yetkazish xarajatini ayirmaydi. Vaqt: admin UTC midnight, kuryer Toshkent.

### M23. Reyting o‘lik

`Restaurant.rating` default 0, hech qayerda yangilanmaydi. `order_by(rating.desc())` ma’nosiz. Sharh yo‘q.

### M24. Saqlangan manzillar checkout’da ishlatilmaydi

TMA Profile CRUD; checkout faqat GPS + matn. `address_id` yuborilmaydi. Address API “o‘lik” feature.

### M25. Checkout zaif GPS’ni ham qabul qiladi

`accuracyM > 50` bo‘lsa ham “eng yaxshisi” yuboriladi. Yuzlab metr xato pin.

### M26. Order poll `visibilityState` yo‘q

TMA detail 10s, list 15s; admin 15s + bell 30s. Background WebView polling.

### M27. TMA `user-scalable=no`

WCAG zoom; iOS klaviatura muammolari.

### M28. Hardcoded prod API fallback (barcha web)

`VITE_API_URL ?? "https://api.barakali-bozor.uz/api"` — `.env`siz lokal build prod’ga uriladi.

### M29. `EXTRA_CORS_ORIGINS=https://allfoodapi.webportfolio.uz`

Bu API host, brauzer Origin emas. CORS’ga foydasiz.

### M30. `PLATFORM_URL` bo‘sh

Superadmin faqat subdomain regex orqali.

### M31. Bind-mount `./backend:/app`

macOS `venv/` Linux containerni yopishi mumkin. Secrets ham mount.

### M32. `initdb` `admin_users.restaurant_id SET NOT NULL`

0 restaurant + legacy admin → start crash.

### M33. `FIRST_PLATFORM_*` `.env`da yo‘q

Seed parol < 8 bo‘lsa skip. Superadmin PWA login bo‘lmasligi mumkin.

### M34. `local.properties` ignore qilinmagan

Boshqa mashinada Flutter build buziladi.

### M35. Firebase Android API key diskda

`google-services.json` gitignore, lekin workspace’da. SHA/package restrict bo‘lmasa abuse.

### M36. Home widget manzilni launcher’da ko‘rsatadi

`№… · addressLine`. Lock-screen / umumiy telefon. Privacy widget haqida yozmaydi.

### M37. Privacy vs Data Safety ziddiyat

Policy 13+, `DATA_SAFETY.txt` 18+. Analytics “ixtiyoriy” deb yozilgan — SDK’da Analytics yo‘q.

### M38. Mijoz package `uz.rasta.mijoz`, UI “Barakali Bozor”

White-label qoldiq. Play listing/privacy shu package uchun yo‘q.

### M39. Mijoz iOS Always-location string

Kod one-shot when-in-use. App Store overclaim.

### M40. FCM tap deep-link yo‘q

Kuryer: “deep-link keyinroq.” App ochiladi, buyurtma emas.

### M41. Session restore rol tekshirmaydi

Courier PWA/Flutter login’da `role==courier`; `loadMe` har qanday admin. Manager token → 403 loop.

### M42. `fullScreenIntent: true` ruxsatsiz

Android 14+ heads-up ishlamasligi; ruxsat qo‘shilsa Play restricted.

### M43. HTTP timeout yo‘q (admin, superadmin, businessman, courier, ikkala Flutter)

TMA 15s. Qolganlari osilib qoladi; double-submit.

### M44. Bot `MemoryStorage` fallback

Redis fail → multi-instance onboarding desync.

### M45. `paid → refunded` faqat flag

Gateway yo‘qida OK; keyinroq Payme/Click qo‘shilsa haqiqiy refund yo‘q.

### M46. Ikkita broadcast kanali

Admin `PostPage` → `/admin/broadcast` (do‘kon mijozlari). Superadmin `/platform/announcements` (barcha bot user). Spec: e’lon admin’dan chiqsin — hozir aralash.

### M47. `notify_courier_assigned` chaqirilmaydi

Admin assign o‘lik; funksiya dead.

### M48. Ikki kuryer implementatsiyasi (PWA + Flutter)

Feature drift. README PWA ni “asosiy” deydi; Play’da Flutter.

### M49. Vercel + Docker aralash

Root `vercel.json` faqat TMA. Admin/courier/businessman/superadmin alohida project — repo’da wiring yo‘q. API Vercel’da emas.

### M50. Postgres DSN parol escape qilinmaydi

Maxsus belgi DSN ni buzadi.

### M51. `get_db` exception’da aniq rollback yo‘q

`close()` rollback qiladi — odatda OK, lekin aniq emas.

### M52. `expire_on_commit=False`

BackgroundTasks uchun. Noto‘g‘ri qayta ishlatilsa stale object.

---

## 5. LOW / INFO

### Kod / o‘lik

- `decrement_stock_atomic` no-op
- `OrderAssignIn`, `OrderStatusUpdate.assigned_courier_id` ignore
- `DeliveryZone.polygon/fee/min_order`
- Legacy `couriers` jadvali (`initdb` hali ALTER qiladi), model yo‘q
- Admin `PushButton.tsx` import qilinmagan
- TMA `theme.ts` faqat eski `af_theme` o‘chiradi
- `api.restaurants()` TMA’da ishlatilmaydi
- `test_script.kts` = `println("hello")`
- `backend/fix_db.py`, `backend/test_receipt.py` ad-hoc
- `courier/docs/superpowers/` eski planlar
- `bblogo.png` gitignore, diskda

### UX / i18n

- TMA `App.tsx` `"Retry"` inglizcha
- Ko‘p `lang === "uz" ? …` dict’da emas
- `ErrorState` doim `"Xatolik / Ошибка"`
- RU `products_n: "товаров"` (1 uchun noto‘g‘ri)
- Search empty = `empty_category`
- Til persist qilinmaydi (faqat Telegram lang)
- Admin nav: `"Dashboard"` + `"Buyurtmalar"`
- Admin loading `"…"`
- Store owner UI’da **“Superadmin”** — platform Super Admin bilan chalkash
- Courier splash 1700ms majburiy (web + Flutter)
- Kuryer profile `v1.2.0`, pubspec `1.2.3+7`
- Order detail Payme/Click/Uzum label (checkout faqat cash)
- TMA 3-ustun mahsulot; Home 5-col grid — zich
- kg mahsulot: `add()` doim +1 (kasr yo‘q)
- Cart tab race (zustand persist last-write-wins)

### A11y

- Cart/trash `aria-label` yo‘q
- Receipt overlay focus trap yo‘q
- Bottom nav `aria-current` zaif
- `window.confirm` PWA’da yomon

### Test / hujjat

- Backend ~100 funksiya: tenant yaxshi; HMAC/order/upload fayl/SSE/FCM yo‘q
- `test_admin_scoping` `Courier` + `/admin/couriers` — **ImportError**
- `test_store_with_orders_cannot_be_deleted` 409 kutadi, impl 200 archive
- TMA/admin/businessman/superadmin test yo‘q
- `courier/src/test/` format/cache/actions
- `kuryer/test/format_test.dart` only
- `mijoz_app/test/` bo‘sh
- E2E yo‘q; pytest real Postgres talab qiladi

### Ijobiy (risk scoring)

- Telegram HMAC `compare_digest` + `auth_date` + `user.id`
- Courier claim atomik `assigned_courier_id IS NULL`
- Stock `WHERE stock >= qty`
- Cancel atomik, double-cancel shishmaydi
- Online to‘lov rad etiladi (faqat cash)
- Upload: magic-byte, SVG yo‘q, WebP re-encode, random nom
- Prod default secret abort (faqat `ENVIRONMENT=production` da)
- SSE ticket 5 daqiqa `purpose=sse`
- Tenant scoping testlari kuchli
- Kuryer: HTTPS only, `allowBackup=false`, background location yo‘q
- Kontakt bind `contact.user_id == from_user.id`

---

## 6. Dizayn / mahsulot

1. **Rol nomlari chalkash.** Do‘kon `superadmin` ≠ platform Super Admin. Support: “superadmin bizneslarni ko‘rmayapti”.
2. **Oshxona UI yo‘q.** `confirmed/preparing/ready` mavjud, yozilmaydi. TMA 8 holatni 3 bosqichga siqadi (`pending` = “Tasdiqlandi”).
3. **Mijoz nazorati yo‘q.** Bekor, yetkazish tasdig‘i, summa o‘zgarishi — yo‘q.
4. **To‘lov “gateway-ready” yolg‘on.** Enum + label; webhook yo‘q.
5. **Bitta savat = bitta do‘kon.** Almashtirish savatni jim tozalaydi.
6. **Marketplace, lekin TMA bitta “nearest/default”.** Ro‘yxatdan tanlash yo‘q (`api.restaurants` o‘lik).
7. **Manzil kitobi o‘lik.**
8. **Reyting/sharh yo‘q.**
9. **Kuryer maoshi = `delivery_fee`.** Bepul yetkazishda 0. Ish haqi spec out-of-scope.
10. **Mijoz Flutter yarim qurilgan.** Auth + katalog + checkout; tracking/logout/push yo‘q. TMA to‘liqroq.
11. **Ikki brend.** `uz.rasta.mijoz` vs Barakali Bozor.
12. **Home kategoriya kartalari** murakkab scale/translate — kichik ekranda kesilishi mumkin.
13. **Admin vs businessman** deyarli bir xil UI (copy-paste). Zona businessman’da yo‘q.
14. **Qorong‘u tema yo‘q** (Telegram theme qisman).
15. **Offline.** PWA API kesh xavfli; Flutter offline queue yo‘q.
16. **Kuryer “real time” listing** — aslida poll. SSE PWA’da bor, Flutter’da yo‘q.
17. **Oferta TMA’da bor**, mijoz app’da yo‘q.
18. **Closed/empty/error** TMA’da qisman; yopiq do‘kon banner yo‘q.

---

## 7. Spec vs implementatsiya

| Spec | Holat |
|------|--------|
| Multi-tenant 1a/1b | Backend asosan bor |
| Businessman 2a | Bor; `Courier` model **yo‘q** |
| Reports 2026-07-10 | `GET /business/reports` bor |
| Superadmin 3 | Bor |
| Category groups 2026-07-14 | Bor |
| Multi-stop 2026-08-04 | Bor; OSRM o‘chiq |
| Elon admin’dan | Endi platform + admin Post |
| Admin user block/delete olib tashlansin | Admin read-only — OK |
| Store DELETE 409 | Archive 200 |
| Delivery flow admin confirm+assign | **Buzilgan** — kuryer self-claim |
| Payme/Click | Yo‘q |
| Alembic | Spec ham initdb tanlagan; README zid |
| Salary | Yo‘q |

---

## 8. Test teshiklari (yuqori risk)

Yozilmagan / sinadigan:

1. `verify_telegram_init_data` (valid/expired/tampered)
2. `POST /auth/register` phone-claim takeover
3. `POST /orders` zona, stock race, fee snapshot, address IDOR
4. Courier adjust yuqoriga + fee freeze
5. Ikki token claim → bitta 409
6. Cancel vs adjust concurrency
7. JWT `purpose=sse` oddiy API’da rad
8. Upload SVG / polyglot / oversize
9. Rate-limit + XFF spoof
10. Receipt `httpx.get` `127.0.0.1` ga **ketmasin**
11. Parol o‘zgarsa eski JWT
12. Product CRUD cache invalidation
13. Mijoz boshqa odam orderini GET
14. `Courier` import — hozir **sinadi**
15. Store delete 409 vs archive
16. Frontend/E2E/CI

---

## 9. Fayl/modul xarita (asosiy muammo joylari)

| Joy | Muammo |
|-----|--------|
| `backend/app/main.py` | CORS, health, uploads mount, env guard |
| `backend/app/core/config.py` | JWT 7d, localhost CORS, default secret |
| `backend/app/core/security.py` | initData 24h |
| `backend/app/core/ratelimit.py` | XFF + fail-open |
| `backend/app/api/deps.py` | `int(sub)` 500 |
| `backend/app/api/routes/auth.py` | claim takeover, OTP yo‘q |
| `backend/app/api/routes/orders.py` | mijoz cancel yo‘q |
| `backend/app/services/orders.py` | pending→accepted, float pul |
| `backend/app/api/routes/courier.py` | adjust↑, deliver=paid, SSE filter |
| `backend/app/api/routes/admin.py` | product cache, zaif parol, users limit, push unscoped |
| `backend/app/api/routes/business.py` | mass-assign, archive vs 409 |
| `backend/app/api/routes/catalog.py` | default fallback, `is_open` filter yo‘q |
| `backend/app/services/receipt.py` | SSRF |
| `backend/app/services/notify.py` | HTML escape yo‘q |
| `backend/app/initdb.py` | migratsiya o‘rniga ALTER sho‘rva |
| `backend/Dockerfile` | `.dockerignore` yo‘q |
| `docker-compose.yml` | dev frontend, 0.0.0.0:8000, seed har start |
| `tma/src/store/cart.ts` | persist stale price |
| `tma/src/hooks/useStore.ts` | `needsLocation: false` |
| `tma/src/pages/CheckoutPage.tsx` | lokal fee, stock/open yo‘q |
| `admin/src/pages/OrdersPage.tsx` | XSS chek |
| `admin/src/sw.ts` | API cache |
| `courier/src/components/Layout.tsx` | noto‘g‘ri SSE host, triple alert |
| `kuryer/lib/services/api.dart` | hardcoded host, timeout yo‘q |
| `mijoz_app/` | yarim mahsulot |

---

## 10. Darhol qilish tartibi (2 hafta)

### Kun 0–1 — rotate va yopish

1. BotFather token revoke; `SECRET_KEY` rotate (barcha sessiya o‘ladi).
2. Firebase SA key disable + yangi; VAPID juftlik.
3. Admin/platform parollar.
4. Android upload keystore rotate.
5. `.dockerignore` + `.gitignore` (`*.apk`, `*.aab`, `Play Market/release/`, `local.properties`).
6. Privacy HTML ni jonli URL’ga.
7. Prod `ENVIRONMENT=production`.

### Hafta 1 — pul va identitet

8. Register-claim o‘chirish; OTP.
9. Adjust faqat `qty↓`; fee checkout’da muzlatish.
10. `pending` claim taqiqlash (yoki haqiqiy kitchen).
11. Receipt URL allowlist; Telegram `html.escape`.
12. XFF trusted-proxy; Redis `requirepass`.
13. JWT qisqartirish + parol’da revoke.
14. Product/stock/business/platform yozuvida cache invalidate.

### Hafta 2 — klient va infra

15. Courier 401 basename; SSE host birlashtirish.
16. Admin chek escape; SW API cache o‘chirish.
17. TMA: live quote, `is_open`, stock/narx refresh.
18. Push unsubscribe + dedupe; admin push store-scope.
19. Flutter: bitta API host, timeout, 409, bitta poller.
20. Mijoz: logout, buyurtmalar, zona fallback o‘chirish.
21. Alembic yoki initdb ni rasman tanlash; seed ni prod start’dan ajratish.
22. Uploads volume/S3; `/health` DB+Redis; backup cron; CI (pytest + tsc).
23. Sinadigan testlarni tuzatish; C5/H1/H2 uchun yangi test.

---

## 11. Qolgan qarz (keyinroq)

- Payme/Click haqiqiy integratsiya (webhook + idempotency + refund).
- Mijoz cancel + yetkazish tasdig‘i.
- Bitta kuryer klienti (PWA yoki Flutter).
- README 7 ta app.
- Rol nomini “Do‘kon egasi”.
- Reyting/sharh yoki `rating` maydonini olib tashlash.
- Observability (Sentry, request-id, JSON log).
- Certificate pinning (native).
- CSP (web).
- E2E (buyurtma → claim → deliver).

---

## 12. Auditor izohi

Kod “AI yozgan production”ning klassik izi: ayrim joylarda ehtiyotkor (HMAC, atomic claim, magic-byte), lekin tizim sifatida:

- **sirlar** working tree’da;
- **ikki haqiqat** (README vs disk, web API vs Flutter API, spec vs state machine);
- **pul oqimi** kuryer ixtiyorida;
- **testlar** tenant’ni qamrab oladi, pul/auth’ni emas;
- **mijoz Flutter** TMA’dan orqada — Play’ga chiqarish xavfli.

Bu “bir nechta bug” emas. Avval **rotate + pul qulflash**, keyin feature.

---

*Hisobot statik tahlil. Jonli pentest, Play Console, prod DB, git history (`git log --all -- secrets`) alohida. Secretlar shu faylga yozilmadi.*
