# PLAN.md — Barakali Bozor

> Loyihaning ish rejasi. Bu fayl loyiha bo'ylab ustuvor: yangi vazifa olishdan
> oldin shu yerga qarang, tugagan ishni shu yerda belgilang.
>
> Oxirgi to'liq audit: **2026-09-12**. Qamrov: `backend/` (10.6k qator),
> `tma/`, `admin/`, `businessman/`, `courier/`, `superadmin/`, `mijoz_app/`,
> `kuryer/`, prod server (Contabo, `169.58.57.205`).

---

## 1. Hozirgi holat

| Ko'rsatkich | Holat |
|---|---|
| Backend testlari | **185 ta, hammasi o'tadi** (audit oldidan 118 o'tar, 7 yiqilardi) |
| Web ilovalar | 5 tasi ham `tsc --noEmit` + `build` o'tadi |
| Flutter ilovalar | 2 tasi ham `analyze` + `test` + `build apk` o'tadi |
| Migratsiya | Alembic baseline bor, `alembic check` toza |
| CI | `.github/workflows/ci.yml` ishlayapti; **DEPLOY_* secrets hali qo'yilmagan** (deploy qadami o'tkazib yuboriladi) |
| Prod deploy | `ops/deploy.sh` bootstrap orqali ishlayapti, konteynerlar non-root |
| Store sahifalari | `/privacy`, `/terms`, `/account-deletion` — tayyor va ulangan |

Birinchi auditdagi 20 ta kamchilikdan **18 tasi yopildi**. Ochiq qolgani —
quyidagi 2 ta kritik masala (ataylab, SMS shlyuzi ulangandan keyin).

---

## 2. Bloklovchi — ishlab chiqarishga chiqishdan oldin

Bu uchtasi bajarilmaguncha real mijozlarga ochilmaydi.

### B-1. SMS shlyuzini ulash (KRITIK — kod tayyor, kalit kerak)

**Holat.** Real OTP oqimi **yozildi va testlangan**: tasodifiy 5 xonali kod
(`secrets`), Redis'da TTL 5 daqiqa, bir martalik, 5 ta urinish chegarasi,
`compare_digest` bilan solishtirish, Redis yo'q bo'lsa **fail-closed**.
Eskiz.uz integratsiyasi tayyor (token keshi, 401'da qayta login).

**Qolgani — faqat kalit.** `OTP_FAKE_MODE=true` ekan, telefon raqamini bilgan
har kim `11111` bilan o'sha hisobga kiradi. Bu ATAYLAB shunday: shlyuz
ulanmaguncha usiz hech kim ilovaga kira olmaydi.

**Ishga tushirish (shartnoma bo'lgach, 5 daqiqa):**
```bash
# /opt/allfoods/backend/.env
SMS_PROVIDER=eskiz
ESKIZ_EMAIL=...
ESKIZ_PASSWORD=...
ESKIZ_FROM=4546          # tasdiqlangan nom yoki qisqa raqam
OTP_FAKE_MODE=false
```
Boshqa hech narsa o'zgartirilmaydi. Har startda log yozadi: fake rejim
yoqiqmi, shlyuz sozlanganmi.

**Fayllar.** `backend/app/services/otp.py`, `backend/app/core/config.py`

**Tekshiruv.** `tests/test_otp_auth.py` — 20 ta test: kod tasodifiyligi,
bir martaliligi, urinish chegarasi, Redis yiqilganda kirish yopilishi,
SMS ketmasa kod qolib ketmasligi.

### B-2. Demo raqamlarni yopish (shlyuzdan keyin)

**Muammo.** `app/services/otp.py:23` dagi `DEMO_PHONES` — 3 ta raqam
(`+998901234567`, `+998900000000`, `+998990000000`) fake rejim o'chirilgandan
keyin ham `11111` bilan o'tadi.

**Ta'sir.** Bu raqamlardan biri real odamga tegsa (birinchisi — O'zbekistonda
tarqalgan "test" raqam), hisobi ochiq qoladi.

**Yechim.** App Store / Play Market tekshiruvi tugagach ro'yxatni bo'shating.
Kerak bo'lsa alohida sozlamaga chiqaring:
`demo_login_enabled: bool = False` va `if settings.demo_login_enabled and
phone in DEMO_PHONES`. Store review paytida faqat o'sha muddatga yoqiladi.

**Fayllar.** `backend/app/services/otp.py:23`

### B-3. Server deploy bootstrap'i yangilanmagan

**Muammo.** Serverdagi `/opt/allfoods/deploy.sh` — eski nusxa. U `Dockerfile`
ni ham, `alembic/` ni ham, `scripts/` ni ham ko'chirmaydi. Ya'ni Docker
qattiqlashtirish (non-root), Alembic qadami va tozalash skripti prod'ga
umuman yetib bormaydi.

**Ta'sir.** Hech narsa buzilmaydi, lekin qilingan ishning bir qismi
qo'llanmaydi.

**Yechim.** `ops/README.md` dagi bootstrap bloki bilan serverdagi faylni
almashtiring — u pull qilib, repodagi `ops/deploy.sh` ni bajaradi. Undan
keyin ham birinchi deploy'da `chown -R 10001:10001 uploads secrets`
avtomatik ishlaydi.

**Diqqat.** Birinchi deploy'da `alembic stamp head` bajariladi (mavjud sxema
baseline deb belgilanadi) — bu bir martalik va xavfsiz.

---

## 3. Ikkinchi audit natijalari

**Bu bo'limdagi hamma narsa bajarildi** (2026-09-12). Har band tarix uchun
qoldirilgan: muammo nima edi, nega muhim edi va qanday yopildi.

### Yuqori — yuk oshganda sinadigan joylar

#### Y-1. `GET /api/orders` cheklanmagan, har 15 soniyada so'raladi

> **BAJARILDI.** `limit` (standart 20, max 100) + `offset` + `active=true` (faqat yakunlanmagan buyurtmalar — polling shuni ishlatadi).

**Muammo.** `backend/app/api/routes/orders.py:69` — mijozning BARCHA
buyurtmalari, `limit` yo'q, har biriga `items` selectinload qilinadi.
`mijoz_app/lib/pages/orders_page.dart:12` uni har **15 soniyada** so'raydi,
`order_detail_page.dart:49` — har 10 soniyada.

**Ta'sir.** 300 buyurtmali doimiy mijoz ilovani ochiq qoldirsa, server har
15 soniyada 300 ta buyurtma + minglab item qatorini o'qib serializatsiya
qiladi. 100 shunday mijoz — backend tiz cho'kadi.

**Yechim.**
1. `limit: int = 20`, `offset: int = 0` (maksimum 100) qo'shing.
2. Ilovada "Ko'proq yuklash" yoki cheksiz skroll.
3. Polling o'rniga ro'yxat uchun faqat faol buyurtmalarni so'rang
   (`status_filter=active`), tarix esa faqat sahifa ochilganda.

**Fayllar.** `backend/app/api/routes/orders.py:68-76`,
`mijoz_app/lib/pages/orders_page.dart`, `tma/src/pages/OrdersPage.tsx`

**Tekshiruv.** Yangi test: 50 ta buyurtma yaratib, `/orders` 20 tadan
ortiq qaytarmasligini tasdiqlash.

#### Y-2. Ommaviy xabar (broadcast) miqyoslanmaydi

> **BAJARILDI.** Bitta `bulk_insert_mappings`, FCM tokenlar bitta `SELECT` bilan (`fcm.notify_users_bulk`), Telegram'ga 20 xabar/sekund chegarasi, natija jurnalga yoziladi. 5 000 mijozda 10 000 DB sessiya → 2 ta.

**Muammo.** `backend/app/services/notify.py:162` — `broadcast_post` har bir
mijoz uchun ketma-ket:
- `_record_and_push` → **yangi DB sessiya** ochadi, `Notification` yozadi, commit qiladi
- `fcm.notify_user` (`services/fcm.py:270`) → **yana bir DB sessiya** (token o'qish)
- 1 ta Telegram HTTP POST (timeout 5–10 s) + 1 ta FCM HTTP

**Ta'sir.** 5 000 mijozda: 10 000 DB sessiya, 10 000 HTTP so'rov, ketma-ket.
Soatlab davom etadi. Telegram sekundiga ~30 xabar chegarasidan oshib 429
qaytaradi (qayta urinish yo'q — xabar yo'qoladi). Hammasi `BackgroundTask`
ichida: worker qayta ishga tushsa, yuborish yarmida uziladi va davom
ettirilmaydi.

**Yechim (bosqichma-bosqich).**
1. **Tez yechim:** bitta sessiya ochib barcha `Notification` qatorlarini
   `bulk_insert_mappings` bilan yozing; FCM tokenlarni bitta `SELECT` bilan
   oling; Telegram yuborishga `asyncio` + semaphore (25/sek) qo'ying.
2. **To'g'ri yechim:** yuborishni navbatga oling (Redis list yoki
   `arq`/`dramatiq`), holatini `Announcement` jadvalida saqlang (`sent`,
   `failed`, `pending`), qayta urinish bilan. Shunda worker restart
   xabarni yo'qotmaydi.

**Fayllar.** `backend/app/services/notify.py:162-178`,
`backend/app/services/fcm.py:270-290`, `backend/app/api/routes/admin.py:877`

#### Y-3. Bot event loop'i sinxron DB va tashqi HTTP bilan bloklanadi

> **BAJARILDI.** `app/bot/arepo.py` — har bir DB funksiyasi `asyncio.to_thread` ichida; 25 ta chaqiruv o'tkazildi. `set_order_location` endi faqat keshdagi manzilni oladi, aniqlashtirish fonda (`refine_order_address`). `tests/test_bot_async.py` yangi DB funksiyasi o'ralmay qolsa yiqiladi.

**Muammo.** `app/bot/middleware.py:27` har bir xabar/callback uchun
`repo.get_user()` — sinxron SQLAlchemy chaqiruvi — `async def` ichida,
`to_thread`siz. Handlerlarning hammasi ham shunday
(`app/bot/handlers.py`: `repo.get_or_create_user` va h.k.).

Eng yomoni: `app/bot/repo.py:133` — `set_order_location()` ichida
`reverse_geocode(lat, lng)` chaqiriladi. Bu 3 ta tashqi API (Nominatim 6 s +
BigDataCloud 5 s + Photon 5 s). Mijoz botga joylashuv yuborsa, **butun bot
16 soniyagacha muzlaydi** — shu paytda hech kim hech narsa qila olmaydi.

**Ta'sir.** Bot bitta event loop'da ishlaydi. 50 ta faol mijozda javob
kechikishi sekundlarga chiqadi; joylashuv yuborilganda bot "o'ladi".

**Yechim.**
1. Darhol: `repo.*` chaqiruvlarini `await asyncio.to_thread(repo.x, ...)`
   bilan o'rang (kichik diff, katta ta'sir).
2. `set_order_location` ni ikkiga bo'ling: koordinata + zona tekshiruvini
   darhol saqlang, `reverse_geocode` ni keyin fon vazifasi sifatida bajaring
   (backend'da allaqachon shunday — `refine_order_address`).
3. O'rta muddatda: bot uchun `AsyncSession` (SQLAlchemy async) ga o'ting.

**Fayllar.** `backend/app/bot/middleware.py`, `backend/app/bot/handlers.py`,
`backend/app/bot/repo.py:120-166`

#### Y-4. Web kuryer PWA joylashuvni filtr'siz yuboradi

> **BAJARILDI.** 15 m + 10 s filtri (Flutter'dagi `distanceFilter: 15` bilan bir xil).

**Muammo.** `courier/src/location.ts:11` — `watchPosition` bilan
`enableHighAccuracy: true`, lekin masofa filtri yo'q. Har bir GPS fire →
`POST /courier/location` → `AdminUser` UPDATE + commit + Redis publish
(`backend/app/api/routes/courier.py:162`).

**Ta'sir.** Mashinada ketayotgan kuryer sekundiga bir necha marta yuboradi.
10 kuryer = sekundiga o'nlab yozuv tranzaksiyasi va SSE event'i. Telefon
batareyasi ham tez tugaydi.

**Diqqat.** Flutter `kuryer` ilovasida bu to'g'ri qilingan:
`kuryer/lib/services/location.dart:82` — `distanceFilter: 15`. Web versiya
orqada qolgan.

**Yechim.** `location.ts` da oxirgi yuborilgan nuqtani eslab qoling; yangi
nuqta undan **15 m** dan yaqin bo'lsa yoki oxirgi yuborishdan **10 soniya**
o'tmagan bo'lsa — yubormang.

**Fayllar.** `courier/src/location.ts`

---

### O'rta — tuzatilishi kerak, lekin shoshilinch emas

#### O-1. Buyurtmani hard-delete qilish, audit jurnalisiz

> **OCHIQ** — soft-delete katta o'zgarish, alohida rejalashtiriladi.

`backend/app/api/routes/admin.py:753` — tadbirkor yoki do'kon superadmini
istalgan buyurtmani butunlay o'chiradi. Aylanma, foyda, kuryer statistikasi
shu qatordan hisoblanadi — o'chgandan keyin hech qayerda izi qolmaydi.

**Yechim.** `deleted_at` bilan soft-delete'ga o'ting yoki kim/qachon/nimani
o'chirganini yozadigan `audit_log` jadvali qo'shing. Hisobotlar
`deleted_at IS NULL` bo'yicha filtrlansin.

#### O-2. admin va businessman bitta ulkan JS chunk yuboradi

> **BAJARILDI.** Og'ir sahifalar `React.lazy`: admin 1.8 MB → **276 KB** boshlang'ich chunk, businessman → 280 KB (Hisobotlar alohida yuklanadi).

`admin/dist` — **2.1 MB**, ichida bitta 1.8 MB `index-*.js` (xlsx-js-style +
jspdf + recharts + leaflet hammasi birga). `businessman` — 1.9 MB. TMA to'g'ri
qilingan: `React.lazy` bilan bo'lingan (eng katta chunk 219 KB).

**Ta'sir.** Mobil internetda admin paneli birinchi ochilishida 5–15 soniya.

**Yechim.** TMA'dagi naqshni ko'chiring: `React.lazy` bilan sahifalarni
bo'ling; `xlsx`/`jspdf` ni faqat "Eksport" bosilganda `await import()` qiling
(ular faqat shu tugma uchun kerak); `leaflet` ni faqat xarita sahifasida.

**Fayllar.** `admin/src/App.tsx`, `businessman/src/App.tsx`, eksport
funksiyalari.

#### O-3. React panellarda ErrorBoundary yo'q

> **BAJARILDI.** 4 ta panelga qo'shildi — xato matni bilan, qayta yuklash tugmasi.

`tma/src/components/ErrorBoundary.tsx` bor, `admin`/`businessman`/`courier`/
`superadmin` da yo'q. Bitta komponentdagi render xatosi butun sahifani oq
ekranga aylantiradi va foydalanuvchi nima bo'lganini bilmaydi.

**Yechim.** TMA'dagi komponentni ko'chiring, har bir `App.tsx` ni o'rang.

#### O-4. Boshqa cheklanmagan ro'yxatlar

> **BAJARILDI.** `/admin/products`, `/admin/admin-users`, `/platform/announcements` — `limit`/`offset` qo'shildi.

| Endpoint | Fayl |
|---|---|
| `GET /admin/products` | `admin.py:439` |
| `GET /admin/admin-users` | `admin.py:978` |
| `GET /platform/businesses`, `/stores`, `/announcements` | `platform.py:93,153,280` |
| `GET /addresses` | `addresses.py:14` |
| `GET /restaurants` | `catalog.py:30` |

Hozircha kichik, lekin katalog kattalashsa `/admin/products` birinchi
bo'lib og'irlashadi. `limit`/`offset` qo'shing (`admin_orders` dagi naqsh).

#### O-5. Polling javoblarida ETag / 304 yo'q

> **OCHIQ** — Y-1 dan keyin javoblar ancha kichrayди; ETag keyingi bosqichda.

`/orders`, `/admin/orders`, `/courier/orders` har 10–15 soniyada to'liq JSON
qaytaradi, hatto hech narsa o'zgarmagan bo'lsa ham. `ETag` +
`If-None-Match` bilan o'zgarmagan javob 304 bo'lib, trafik va
serializatsiya vaqti keskin kamayadi.

#### O-6. OTP kodi va telefon raqami jurnalga yoziladi

> **BAJARILDI.** `mask_phone()` — `+99890***4567`; kod faqat fake rejimda (u ham WARNING bilan).

`backend/app/services/otp.py:37` — `logger.info("OTP (fake) %s -> %s", phone,
code)`. Docker loglari saqlanadi va ular orqali kirish mumkin.

**Yechim.** Raqamni niqoblang (`+99890****567`), kodni umuman yozmang
(kerak bo'lsa faqat `DEBUG` darajada, prod'da o'chiq).

#### O-7. `users.password_hash` — o'lik ustun

> **BAJARILDI.** Model, `initdb` va Alembic migratsiyasi (`3a7f68c8181a`).

`backend/app/models/user.py:29`. Hech qayerda o'qilmaydi ham, yozilmaydi ham
(mijozlar Telegram yoki OTP bilan kiradi, parol yo'q). Alembic migratsiyasi
bilan o'chiring.

#### O-8. Klaviatura va skrinreader qo'llab-quvvatlashi zaif

> **OCHIQ** — alohida o'tish talab qiladi.

300+ tugmaga jami 22 ta `aria-label`. Ko'p tugmalar faqat ikonka
(`<button><Trash2/></button>`) — skrinreader "tugma" deydi, xolos. Fokus
holati (`:focus-visible`) hech qayerda aniqlanmagan.

**Yechim.** Faqat ikonkali har bir tugmaga `aria-label`; global CSS'da
`:focus-visible` uchun ko'rinadigan halqa.

#### O-9. Telegram yuborish xatolari jim yutiladi

> **BAJARILDI.** `_send*` endi `bool` qaytaradi va xatoni jurnalga yozadi (403 — mijoz botni bloklagan — INFO, qolgani WARNING).

`notify.py` dagi `_send`, `_send_photo`, `_send_photo_url`, `_ask_location`
— hammasi `except Exception: pass`. Xabar yetib bormasa hech kim bilmaydi.

**Yechim.** Kamida `logger.warning` bilan yozing; javob kodi 429 bo'lsa
`retry_after` ni hurmat qilib qayta urinish.

#### O-10. Zona sozlamalaridagi "Narx" va "Min. buyurtma" hech narsa qilmaydi

> **BAJARILDI.** Maydonlar model, sxema, admin UI va bazadan olib tashlandi.

`admin/src/pages/DeliveryZonePage.tsx:69,88` — admin yetkazish hududi uchun
`fee` va `min_order` kiritadi, ular `delivery_zones` jadvaliga yoziladi ham.
Lekin backend yetkazish haqini **faqat do'kon** darajasidagi qiymatlardan
hisoblaydi (`calc_delivery_fee(..., free_from=restaurant.free_delivery_from,
per_km=restaurant.delivery_fee)`) — zona maydonlari hech qayerda o'qilmaydi.

**Ta'sir.** Admin narxni o'zgartiradi, saqlaydi, hech narsa o'zgarmaydi va
sababini tushunmaydi. Bu `min_order` nomidagi chalkashlikning aynan
takrorlanishi.

**Yechim.** Ikkitadan birini tanlang: (a) maydonlarni admin formasidan va
sxemadan olib tashlang (`polygon` kabi), yoki (b) zona qiymati bo'lsa u
do'kon qiymatidan ustun bo'lsin deb `calc_delivery_fee` ga ulang. Tavsiya:
(a) — hozir bitta do'kon, bitta zona.

**Fayllar.** `admin/src/pages/DeliveryZonePage.tsx`,
`backend/app/schemas/admin.py:8-13`, `backend/app/models/order.py:36-38`

#### O-11. `edit_pending_order` faqat `HTTPException` da rollback qiladi

> **BAJARILDI.** `except BaseException` — `create_order` bilan bir xil.

`backend/app/services/orders.py:628` — `create_order` da bu tuzatildi, bu
yerda qolgan. Amalda `get_db` sessiyani yopganda rollback bo'ladi, shuning
uchun xavf past, lekin izchillik uchun `except BaseException` ga o'tkazing.

---

### Past — qulaylik va tozalik

- **P-1.** ~~`tma/tsconfig.tsbuildinfo` git'da kuzatilyapti~~ — **bajarildi**
  (`.gitignore` ga `*.tsbuildinfo`).
- **P-2.** Bot FSM Redis bo'lmasa `MemoryStorage` ga tushadi
  (`bot/run.py:18`) — restart'da yarim qolgan onboarding yo'qoladi. Prod'da
  Redis bor, lekin bu holat ogohlantirishsiz o'tadi; `ENVIRONMENT=production`
  da xato tashlasin.
- **P-3.** `docker-compose.yml` (lokal) hali `min_order` davridagi izohlarni
  saqlaydi — yangilansin.
- **P-4.** `ACCESS_TOKEN_EXPIRE_MINUTES` hozir **12 soat** (`config.py`).
  Vaqtinchalik: dala'dagi eski kuryer APK'sida (v1.2.3) refresh yo'q edi,
  1 soat qo'yilsa kuryer smena o'rtasida chiqib ketardi. Refresh qo'shilgan
  yangi APK Play Market'ga chiqib, kuryerlar yangilangach **60** ga
  tushiriladi.

---

## 4. Qabul qilingan qarorlar (qayta muhokama qilinmaydi)

| Qaror | Sabab |
|---|---|
| Kuryer ilovasi **ikkalasi ham qoladi** (web PWA + Flutter APK) | Foydalanuvchi qarori. Yangi funksiya ikkalasiga ham yozilishi kerakligi esda tutilsin. |
| `mijoz_app` va `kuryer` uchun **umumiy Dart paket yaratilmaydi** | 2 ta iste'molchi uchun bog'lanish foydadan ko'p ish: paketdagi o'zgarish ikkinchi ilovani jim buzishi mumkin. Uchinchi ilova paydo bo'lsa qayta ko'riladi. |
| `min_order` wire nomi **saqlanadi** | Chiqarilgan APK'lar shu kalitni o'qiydi. Server ikkala nomni ham yuboradi; eski nom keyingi major relizda olib tashlanadi. |
| Onlayn to'lov (Click/Payme) **hozircha yo'q** | Integratsiya tayyor emas. Checkout'dagi tile'lar commentga olingan, backend faqat `cash` qabul qiladi (`ALLOWED_PAYMENT_METHODS`). |

---

## 5. Keyingi ishlar

**Ishga tushirishdan oldin**
1. Eskiz.uz shartnomasi → `.env` ga kalitlar → `OTP_FAKE_MODE=false` (B-1)
2. Store tekshiruvi tugagach `DEMO_LOGIN_ENABLED=false` (B-2)
3. GitHub secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` —
   qo'yilmaguncha CI deploy qadamini o'tkazib yuboradi
4. Play Console: Data Safety formasi (`/privacy` va `/account-deletion`
   havolalari bilan), App Store Connect: Privacy Nutrition Labels
5. Yangi kuryer APK chiqib, kuryerlar yangilangach
   `ACCESS_TOKEN_EXPIRE_MINUTES=60` (hozir 720 — P-4)

**Keyingi bosqich**
6. O-1 audit jurnali / soft-delete — moliyaviy tarix izsiz o'chmasin
7. O-5 ETag / 304 — polling trafigini kamaytirish
8. O-8 klaviatura va skrinreader
9. P-2, P-3

---

## 6. Tayyor deb hisoblash mezoni

Har bir vazifa uchun:

```bash
# Backend
cd backend
source .venv/bin/activate
pytest -q                    # 166+ test, hammasi o'tadi
alembic check                # modellar va migratsiyalar mos

# Web (har biri uchun)
npx tsc --noEmit && npm run build && npm audit --omit=dev

# Flutter (har biri uchun)
flutter analyze && flutter test
```

Qoidalar:
- Sxema o'zgarsa — **albatta** Alembic migratsiyasi (`initdb.py` ga yangi
  `ALTER` yozilmaydi, u faqat eski deploy'lar uchun).
- Xulq o'zgarsa — o'sha xulqni tekshiradigan test.
- Wire (JSON) nomi o'zgarsa — eski nom kamida bitta reliz davomida saqlanadi.

---

## 7. Foydali buyruqlar

```bash
# Lokal Postgres (Docker yo'q bo'lsa)
brew services start postgresql@16
createdb allfoods_test

# Yetim rasmlarni tozalash (oyiga bir marta, serverda)
docker compose -f docker-compose.prod.yml exec api python -m scripts.cleanup_uploads
docker compose -f docker-compose.prod.yml exec api python -m scripts.cleanup_uploads --delete

# Deploy (CI o'zi qiladi; qo'lda kerak bo'lsa)
ssh root@169.58.57.205 'bash /opt/allfoods/deploy.sh'
```
