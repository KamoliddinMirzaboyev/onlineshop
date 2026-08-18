# Barakali Bozor / All Foods — To'liq QA Tahlil Hisoboti

**Hisobot turi:** Senior QA (Code Review / Bug / Arxitektura / Dizayn auditi)
**Sana:** 2026-08-18
**Sahifa/ko'lam:** Monorepo — `backend` (FastAPI + aiogram bot), 5 ta web PWA (`tma`, `admin`, `courier`, `businessman`, `superadmin` React/Vite), 2 ta Flutter ilova (`kuryer`, `mijoz_app`).

> Diqqat: ushbu hisobot kodni statik o'rganish asosida yozildi. Barcha xulosalar kodni o'qib,
> mantiq, holat-mashinasi, scoping, konfiguratsiya va xavfsizlik jihatlarini tekshirish orqali chiqarildi.
> Xatoliklar iloji boricha `fayl:qator` bilan bog'landi.

---

## Xulosa (Executive Summary)

Monorepo keng funksional ko'lamga ega va xavfsizlikka jiddiy e'tibor berilgan (Telegram initData
tekshiruvi, upload magic-byte tekshiruvi, prod default-secret himoyasi va h.k.). Biroq quyidagi tizimli
kamchiliklar mavjud:

| Toifa | Taxminiy mid ob |
|---|---|
| 🔴 Critical (data/lo'g'lik / xavfsizlik / buzilgan logika) | ~15 |
| 🟠 High | ~20 |
| 🟡 Medium | ~20 |
| 🔵 Low / Kod sifati | ~15 |
| Test qamrovi bo'shliqlari | 10+ |

**Eng muhim uchta topilma:**
1. **Buyurtma holat-mashinasining `confirmed/preparing/ready` holatlari hech qanday endpoint
   tomonidan yozilmaydi** — o'lik holatlar. (`app/services/orders.py:54-63` ruxsat beradi, lekin
   `admin.py` faqat `cancelled`ni, `courier.py` faqat `accepted`/`delivering`/`delivered`ni yozadi.)
2. **Vaqt mintaqasi chalkashligi** — admin/business/statistika `today`/kunlik chegaralarni UTC bo'yicha
   hisoblaydi, kuryer esa Toshkent (UTC+5) bilan guruhlaydi. `00:00–05:00` Toshkent vaqtida "bugungi"
   statistikalar noto'g'ri bucketga tushadi. (`admin.py:251-256` ↔ `courier.py:113-115`)
3. **Kuryer native APK (`kuryer`) backend URL qattiq hardcode qilingan va `.env`/konfiguratsiyadan
   farq qiladi** — `kuryer/lib/services/api.dart:24` (`https://allfoodapi.webportfolio.uz/api`) boshqa
   muhitga qaraydi, holbuki boshqa joyda `https://api.barakali-bozor.uz/api`.
---

## 1. 🔴 Critical — Tanqidiy muammolar

### C1. Buyurtma holatlari `confirmed / preparing / ready` erishib bo'lmaydigan (unreachable)
- **Manba:** `backend/app/services/orders.py:54-63` (`_ALLOWED_TRANSITIONS` bu holatlarga o'tishga
  ruxsat beradi); `admin.py:560-580` faqat `cancelled`ni yozadi; `courier.py:718` `COURIER_ALLOWED_STATUSES
  = {accepted, delivering}`, `delivered` alohida endpoint (`:828`).
- **Natija:** Restoranning "tasdiqlash / tayyorlash / tayyor" bosqichlari API orqali ishga tushmaydi.
  `courier_adjust_order` (satr 249) `preparing/ready`ga tayanadi — bu parcha amalda hech qachon
  qo'zg'almaydi. Mijozga "Buyurtma tayyorlanmoqda" xabari ham hech qachon yuborilmaydi.
- **Tavsiya:** Yo ushbu holatlarni olib tashlang, yo admin'ga `confirmed/preparing/ready` o'tishlarini
  qo'shing va frontend `OrdersPage` bilan moslang.

### C2. Statistika vaqt mintaqasi (timezone) nomuvofiqligi
- **Manba:** `admin.py:251-256`, `business.py:31`, `platform.py` — UTC; aksincha `courier.py:113-115`
  `Asia/Tashkent`.
- **Natija:** "Kunlik" statistika Toshkentdan 5 soat oldinga siljigan; `00:00–05:00` Toshkent vaqtida
  yangi buyurtmalar "kechagi kun"ga tushadi — hisobot xatosi.
- **Tavsiya:** Butun backendda yagona Tashkent-tz-strategiyasi.

### C3. Native kuryer ilovasi noto'g'ri backend-ga qaraydi
- **Manba:** `kuryer/lib/services/api.dart:24` — `_base` hardcode; `kuryer/.env` va `.env.example` esa
  `https://api.barakali-bozor.uz/api`.
- **Natija:** APK boshqa (eski/staging) muhitga ulangan — yangi kuryer buyurtma ko'rmasligi mumkin.
  `backend/.env.example` da `EXTRA_CORS_ORIGINS=https://allfoodapi.webportfolio.uz` bu mustaqil muhit
  hali ko'chmaganini ko'rsatadi.
- **Tavsiya:** API URL'ni konfiguratsiya (`--dart-define`/build env) orqali oling.

### C4. Rate-limiter `X-Forwarded-For` birinchi qiymatiga ishonib soxtalashtiriladi (brute-force)
- **Manba:** `app/core/ratelimit.py:12-26`.
- **Natija:** Klient `X-Forwarded-For`ni o'zgartira olsa, login/etc ratе-limit chetlab o'tiladi.
- **Tavsiya:** Trusted-proxy bo'lmagan headerlarni tushirish; `X-Real-IP`/egasi IP ro'yxati.

### C5. Decompression bomb — upload rasm o'lchami (pixel) tekshirilmaydi
- **Manba:** `uploads.py:61-75` (faqat 8MB baytcheklov), `images.py:70-81` `im.load()`.
- **Natija:** 8MB kichik fayl juda katta piksel rastriga dekodlanib (100k×100k) server xotirasini
  to'ldirishi (DoS) mumkin.
- **Tavsiya:** `im.width*im.height` chegarasi (20MP) + Pillow `MAX_IMAGE_PIXELS`.

### C6. Cash to'lov holati mutatsiyasi atomik UPDATEdan oldin bajariladi
- **Manba:** `courier.py:853` (`mark_order_paid_if_cash`) → `:864` `payment_status=order.payment_status`.
- **Natija:** Ikki worker/event parallel bo'lsa eskirgan (stale) to'lov holati yozilishi mumkin; onlayn
  to'lov kelganda xavf.
- **Tavsiya:** To'lovni bir atomic `UPDATE ... WHERE status=delivering` ichida belgilang.

### C7. Mijoz o'z buyurtmasini bekor qila olmaydi
- **Manba:** `app/api/routes/orders.py` — faqat POST/GET; `/orders/{id}/cancel` yo'q.
- **Natija:** Xato buyurtmani mijoz o'zi bekor qilolmaydi.
---

## 2. 🟠 High — Yuqori muammolar

### H1. Router yozishlari orasida xususiy (underscore) helper import qilinadi (arxitektura)
- **Manba:** `business.py:128` `from app.api.routes.admin import _agg`, `business.py:160` `_series,
  _top_products`; `platform.py:240` `_agg`, `business.py` `_period_start`.
- **Natija:** Route modullari bir-birining "private" funksiyalariga bog'lanadi — siklcha import xavfi,
  parchalanish, refaktorga to'sqinlik.
- **Tavsiya:** Agregatsiyani `app/services/analytics.py`ga ko'chiring.

### H2. Redis ishlamaganda barcha himoya "fail-open" bo'lib qoladi
- **Manba:** `ratelimit.py`, `cache.py`, `events.py`, `fcm.py`, `webpush.py` — `except: pass`.
- **Natija:** Redis tushsa login rate-limit, keshlash va eng muhimi **courier real-time eventlari**
  yo'qoladi — courier yangi buyurtmani SSE orqali ko'rmaydi (faqat pushga tayanadi).
- **Tavsiya:** Kuryer stream uchun fail-closed yoki ogohlantirish/log.

### H3. JWT muddati barcha rollar uchun 7 kun, revoke/iss/aud/jti yo'q
- **Manba:** `config.py:23`, `security.py` token payload `{sub, role, exp}`.
- **Natija:** Tajovuzgar token olsa 7 kun to'liq huquq; parol o'zgarsa eski token ishlayveradi.
- **Tavsiya:** Qisqaroq muddat + refresh + `jti` revoke (password o'zgarishida).

### H4. `decode_token` `sub` int konversiyasi validation-siz
- **Manba:** `deps.py:26` `int(payload["sub"])` — non-int bo'lsa `ValueError` → 500.
- **Tavsiya:** 401 qaytaring.

### H5. Catalog kesh 120s — stock buyurtmada kamayadi, lekin kesh invalidatsiya qilinmaydi
- **Manba:** `catalog.py:25` `CACHE_TTL=120`; `orders.py` `invalidate_restaurant_catalog` chaqirmaydi.
- **Natija:** Mijoz 2 daqiqagacha sotilgan mahsulotni "bor" deb ko'rib, buyurtma qilganda 400 oladi.
- **Tavsiya:** Buyurtma yaratilganda ham keshni tozalang.

### H7. Hard delete (`platform.delete_user`) audit/so'rov yo'qotadi
- **Manba:** `platform.py:71-86` — user+buyurtmalar+order_items `DELETE`.
- **Natija:** Moliya/statistika tarixi yo'qoladi; courier ETA namunalari buziladi; audit qoldiqlarsiz.
- **Tavsiya:** Soft-delete/anonymize.

### H8. `business.update_store` `model_dump()` (exclude_unset=None) — frontal to'liq emasligida maydonlarni o'chirishi mumkin
- **Manba:** `business.py:90` `model_dump()` vs `admin.py:60` `exclude_unset=True`.
- **Natija:** Bir maydon yuborilsa qolganlar default ustiga yoziladi (masalan lat/lng yo'qoladi).
- **Tavsiya:** `exclude_unset=True`.

### H9. `create_store` hardcode `delivery_fee=2000, min_order=50_000` — schema maydonlari e'tiborsiz
- **Manba:** `business.py:61-66`.
- **Tavsiya:** Frontend yuborgan qiymatlarni qabul qiling yoki schema'dan olib tashlang.

### H11. `courier_stream` (SSE) boshlang'ich snapshot bermaydi
- **Manba:** `courier.py:130-160`.
- **Natija:** Ulanish paytida avvalgi holat yo'q — frontend `GET /courier/orders`ga tayanisalamaydi
  (agar buni qilmasa eskirgan ro'yxat). Har bir ulanishga bitta blocking thread.
- **Tavsiya:** Ulanishda initial snapshot yuborish; o'rniga WebSocket yoki shared reconnection.

### H12. `courier_location` faqat courier kanalida — mijoz kuzatuvi yetkazilmaydi
- **Manba:** `courier.py:150` publish `courier:events`; mijoz TMA bu kanalni eshitmaydi.
- **Natija:** Buyurtma kuzatuvi (live location) funksiyasi amalda ishlamaydi.
- **Tavsiya:** Mijoz uchun alohida kanal/sub-toifa.

### H13. Bot `on_location` — mijozga lokatsiya bildirishnomasi emas, operator chat'iga yuboriladi
- **Manba:** `bot/handlers.py:189` → `notify.py:210` `notify_location_update` faqat
  `settings.orders_chat_id` (operator guruhi) ga Google Maps linkini yuboradi. Mijozning o'zi lokatsiya
  jo'natganda hech qanday tasdiq/izoh emas, faqat operatorga yoziladi.
- **Natija:** "Joylashuv yetib bordi / manzil saqlandi" xabari mijozga beriladi (`location_saved`),
  lekin ordrega koordinata `repo.set_order_location` orqali yetadi; operator chat'idagi link ham
  foydalidir. Asosiy funksiya bor — lekin mijozga keyingi bosqich (kuryer qabuli) to'g'risida
  link/qo'shimcha ma'lumot yo'q. Loyiha kutilgan "mijoz kuzatuvi" (H12) bilan bog'liq bo'shliq.
- **Tavsiya:** `orders_chat_id` sozlanmasa `notify_location_update` hech narsa qilmaydi — mijozga
  lokatsiya qabul qilingani haqida yakuniy tasdiq qo'shish va kuryer holatini kuzatish tavsiya qilinadi.

### H15. `Order.number` generatsiyasi `secrets.token_hex(4)` — 32-bit kolliziya yuzasi
- **Manba:** `orders.py:126`. Yuqori QPS da 5 retry bilan 503 xavfi. `yil+seq` yaxshiroq.

### H17. Courier delete'da `delivering` buyurtmalar "logibsiz tiqilib" qoladi
- **Manba:** `admin.py:895-900` — `assigned_courier_id=None`, ammo `status=delivering` bo'lgan buyurtma
  `assigned IS NULL` bo'lsa ham boshqa courier uni qabul qila olmaydi (status allowing emas).
- **Tavsiya:** delete'da action bo'lmagan buyurtmalarni `accepted/pending`ga qaytaring.

### H18. Kuryerga `delivered` bir vaqtda ikki xil da'vo — CAS tartibi (concurrent) uchun qayta ishlanishi
- `courier_mark_delivered` atomic WHERE yaxshi; lekin `mark_order_paid_if_cash` mutatsiyasi atomik
  update tashqarisida (C6 ga qarang).

### H19. `admin` route'da `rid` param keraksiz bo'lib qolgan (nomlash / scoping chalkash)
- `admin.py` `/restaurants/{rid}/categories|products` — admin uchun `current_restaurant` o'zi aniqlaydi,
  `rid` esa ortiqcha. Noto'g'ri yuborilsa 403. Nomlash va API sirti noto'g'ri.

### H20. `route_sequence ASC` da `NULL` yangi buyurtmalarning tartibi aniqlanmagan
- **Manba:** `courier.py` `order_by(Order.route_sequence.asc)`. `NULLS` tartibi PG'da aniqlanmagan —
  `NULLS LAST` kiriting.
---

## 3. 🟡 Medium — O'rta daraja muammolar

### M1. `_agg` foydani `(price - cost) * qty` bilan hisoblaydi — `delivery_fee` kirmaydi
- **Manba:** `admin.py:188-200` (`_series`). Revenue/profit yetkazish haqini o'z ichiga olmaydi.
- **Tavsiya:** Delivery fee ni revenue/profitga hisoblang yoki alohida ko'rsating.

### M2. `min_order` nomi chalkash — "bepul yetkazish chegarasi" sifatida ishlatilmoqda
- **Manba:** `restaurant.py:33-34` izohi; `orders.py:239` `free_from=restaurant.min_order`.
- **Tavsiya:** `free_delivery_from` deb qayta nomlang.

### M3. `courier_adjust_order` — miqdor o'zgarganda `delivery_fee` qayta hisoblanmaydi
- **Manba:** `courier.py:302-305`. `items_total` `free_from`dan pastga tushsa ham fee o'zgarmaydi.
- **Tavsiya:** Adjust paytida fee qayta hisoblash yoki oldindan ogohlantirish.

### M4. `refunded` holati amalda hech qachon yuz bermaydi
- `mark_order_paid_if_cash` faqat `delivered`da `paid` qiladi; `delivered`ni cancel qilib bo'lmaydi,
  shuning uchun `cancel_order` `refunded` yozmaydi (faqat paid → refunded yo'li hech qachon bo'lmaydi).
- **Tavsiya:** Kerakli senariyni aniqlang (masalan delivering vaqtida refund kelishi).

### M5. `admin.list_users` — `order_count`/`total_spent` faqat delivered, ro'yxatga hamma order kiradi
- **Manba:** `admin.py:622-650`. Faqat cancelled bo'lgan mijoz "0 buyurtma" bo'lib ko'rinishi mumkin.

### M6. `mijoz_app` test papkasi bo'sh; `kuryer` faqat `format_test.dart` — mobil testlar deyarli yo'q

### M7. `tma`, `admin`, `businessman`, `superadmin` PWA'lari uchun test umuman yo'q
- Faqat `courier/src/test/*` (3 ta) bor.

### M8. `businessman/rewrite_reports.py` — `src` ichida Python kodgen skripti (noto'g'ri joyda)

### M9. `tma` CheckoutPage magic-raqamlar backend default bilan takrorlanadi (drift)
- **Manba:** `CheckoutPage.tsx:21-22` `DEFAULT_FREE_FROM=50_000`, `DEFAULT_PER_KM=2_000` ↔
  `orders.py:25-26`.

### M10. `tma` savat localStorage'da to'liq product saqlaydi — narx/rasm eskirishi mumkin
- **Manba:** `tma/src/store/cart.ts` `persist`.
- **Tavsiya:** Savatda faqat id+qty saqlang; narxni joriy API dan oling.

### M11. Checkoutda ko'rsatilgan summa va server final summa turli distance manbasidan farqlanishi mumkin
- Server haqiqiy GPS-dan hisoblaydi; frontend kesh/lokatsiya farqi tufayli tafovut bo'lishi mumkin.
- **Tavsiya:** UX da "yakuniy summa server aniq hisoblaydi" deb yozing.

### M16. `webpush.notify_admins` barcha `admin_user_id IS NULL` subscriptionlarga yuboradi (bazor)

### M17. `courier.push/subscribe` — faqat courier; admin/manager PWA lar o'z pushini olmaydi (agar frontend
  bu endpointdan foydalansa). Yagona endpoint, rol aniqlanmagan.

### M20. `reverse_geocode_parts` sequential 2-3 tashqi HTTP call — buyurtma kechikishi mumkin
- **Manba:** `geo.py:373-382`. Har biri 5s timeout; sekin holatda buyurtma yaratish kechikadi.
- **Tavsiya:** Kichik TTL kesh + parallel (rate-limitga e'tibor).

### M21. `uploads` fayllari hech qachon tozalanmaydi (orphan uploads → disk to'lishi)
- Har upload yangi nom; o'chirilgan mahsulot rasmlari diskda qoladi. Retention/cleanup yo'q.
---

## 4. 🔵 Low / Kod sifati & kichik zaifliklar

### L1. Ortiqcha/dead kod
- `services/orders.py` ikki marta `from sqlalchemy import select` (satr 7 va 10) — ortiqcha.
- `services/orders.py:348` `decrement_stock_atomic` deprecated no-op alias — tekshirib olib tashlang.
- `app/services/events.py` `_CourierEvents` backward-compat wrapper — soddalashtirsa bo'ladi.

### L2. Kod takrorlanishi (DRY)
- `_user_dict` uch joyda duplikatsiyalangan: `admin.py:605`, `platform.py:31`.
- Fee hisob-kitob backend (Python), `tma` (TS) va Flutter'da uch marta yozilgan.

### L3. Noyob (unique) konstraint yetishmovchiligi
- `AdminUser.phone` unique emas — login telefonda `db.scalar(or_(username, phone))` bir nechta mos
  kelsa noaniqlik (race).

### L4. `Settings` `extra="ignore"` — `.env` dagi noto'g'ri nomlar jim o'tadi
- Tipografik xato bo'lsa ogohlantirish yo'q. `extra="forbid"` yordam beradi.

### L5. Alembic migrationlar deyarli ishlatilmayapti
- `alembic/versions` yo'q; `initdb.create_all` + `fix_db.py`. Production schema evolyutsiyasi xavfli.

### L7. `businessman/.env.vercel` — real muhit secretlari; `.gitignore` `.env.*`ni istisno qiladi,
  lekin `.env.vercel` commit'ga tushmasligini tekshiring.

### L8. Root `vercel.json` faqat `tma` build qiladi — boshqa app'lar alohida proyektlarda; SPA rewrite
  barchasini `index.html`ga yo'naltiradi.

### L9. `courier` PWA va `kuryer` Flutter — bir funksiyaning ikki implementatsiyasi (parallel qatlam).

### L10. Root `.env` default `POSTGRES_PASSWORD=allfoods` — zaif default, prod'da almashtirilishi
  kutilgan, ogohlantirish yo'q.

### L11. `initdb`/`seed` va `main.py` prod guard — yaxshi amaliyot (kredit berish kerak).

### L12. `notify.broadcast_post` caption limit 1024 — rasm bilan matn uzun bo'lsa fallback yaxshi.

---

## 5. Test qamrovi bo'shliqlari

**Kuchli tomonlar:** backend `tests/` (~18 fayl): admin_scoping, multi_tenant, order_transitions,
route_optimize, delivery_fee, upload_access, notify_i18n va h.k.

**Bo'shliqlar:**
1. **Holat-mashinasi `confirmed/preparing/ready` unreachable ekani testda ochilmaydi** (C1) — test yozing.
2. **Timezone bucket testi yo'q** (C2).
3. **`delivered` + cash payment CAS / concurrency testi yo'q** (C6).
4. **Flutter testlar deyarli yo'q** — `kuryer` faqat `format_test.dart`; `mijoz_app` bo'sh.
5. **Frontend PWA testlari yo'q** (`tma/admin/businessman/superadmin`); faqat `courier` 3 test.
6. **Bot (aiogram) handler testlari yo'q** — `on_location`/`notify_location_update` va i18n oqimlari
   uchun test yo'q.
7. **Rate-limit spoofing (XFF) testi yo'q** (C4).
8. **Courier route piarflow (adjust/start/deliver) integration testi yo'q.**
9. **SSE/Redis workerlararo test yo'q.**
10. **`courier` `routeFlow.ts` (offerNextStop) uchun test yo'q.**

**Ishga tushirish:** backend testlari `TEST_DATABASE_URL` (postgres) talab qiladi — CI'da DB kerak.

---

## 6. Arxitektura mulohazalari

1. **Monorepo ichida shared-package yo'q** — 5 ta React app kodni ko'chirib olgan (store/api/types/UI).
   → `packages/` (pnpm/turbo) yoki hech bo'lmasa shared utils.
2. **`min_order`/`delivery_fee` semantikasi** — boshdan aniqlash (M2).
3. **Yetkazish narxi hisob-kitobi 3 nusxada** (backend, tma, Flutter) — yagona formula.
4. **Real-time ikki kanal (courier, customer)** — bitta tizim + sub-toifa konsolidatsiya (H12).
5. **DB `DateTime(timezone=True)`** UTC — "today" hisoblash tz-ga bog'liq (C2).
6. **Flutter dual app + PWA qatlami** uch karra dissync qilib turadi (L9).

---

## 7. Dizayn / UX mulohazalari

1. **Faqat cash** — onlayn to'lov (Payme/Click/Uzum) kutilgan UX.
2. **Mijoz cancel imkoniyati yo'q** (C7).
3. **"Manzil hududdan tashqarida"** — backend 400; frontend oldindan zona cheklovini qilmaydi.
4. **`is_open` faqat order paytida tekshiriladi** — mijoz yopiq do'konni katalogda ko'radi.
5. **Courier route dialog PWA (`window.confirm`) va Flutter'da turlicha** — birlashtirish.
6. **i18n aralash** — ba'zi matnlar hardcode (uz/ru) kod ichida, `_STATUS_TEXT`dan farq qiladi.

---

## 8. Repo gigiyenasi / Ops

1. **Katta binarlar:** `BB-Kuryer-v1.2.3.apk` (46MB), `Play Market.zip` (66MB) + `Play Market/` (287MB),
   `bblogo.png` (4.8MB), `bblogobg.png` (504KB) — klon ulkan; artefaktlarni Release/storage'ga ko'chiring.
2. **`test_script.kts` (`println("hello")`)** — root'da val qoldig'i, o'chiring.
3. **`.claude/worktrees/tma-redesign-category-groups`** — ishchi tree changelar bilan; `git status`
   "untracked content" ko'rsatyapti — tozalang.
4. **`kuryer/store/`, `admin/public/privacy-kuryer.html`, `tma/public/privacy-kuryer.html`** — untracked
   qoldiq fayllar.
5. **Har app'da `dist/`, `node_modules`, `.vercel`, `tsconfig.tsbuildinfo`** — gitignore qoplagan (yaxshi).

---

## 9. Tavsiyalar / Yo'l xaritasi

1. **Darhol (1 hafta):**
   - C1 holat-mashinasi (write yo'li yoki olib tashlash).
   - C2 timezone (today/period → Tashkent).
   - C3 native kuryer API URL konfiguratsiya.
   - H12/H13 mijoz lokatsiya/real-time kuzatuv (operator chat'idan tashqari mijozga ham).
   - C5 decompression bomb chegarasi.
2. **Qisqa muddat (2-4 hafta):**
   - C7 mijoz cancel; H17 courier delete tiqilib qolish.
   - C4 rate-limit trusted-proxy; H3 JWT refresh/revoke.
   - H1/H2 analytics service + courier stream fail-closed.
   - H5 kesh invalidatsiya; H7 soft-delete.
3. **O'rta muddat (1-2 oy):**
   - Shared package refactor; test qamrovi + CI (pytest+vitest+flutter test).
   - Alembic migrations; yagona real-time tizim; uploads retention (S3).

---

*Hisobot to'liq statik tahlil asosida yozildi — ba'zi runtime/Live topilmalar (SSE initial snapshot,
CDN header, bot i18n holati) deployment'da amaliy tekshirilishi tavsiya etiladi.*
- **Tavsiya:** User roli uchun bezak (accepted bo'lmagan) bekor qilish endpointi.