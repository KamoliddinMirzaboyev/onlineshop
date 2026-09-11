# Barakali Bozor — loyiha auditi

**Sana:** 2026-09-11
**Qamrov:** `backend` (FastAPI, ~10k qator), `mijoz_app` (Flutter, ~8.2k qator), `admin`/`businessman`/`courier`/`superadmin`/`tma` (React), `kuryer` (Flutter), deploy konfiguratsiyasi.
**Mezon:** faqat **real foydalanishda muammo tug'diradigan** narsalar. Stil/format nuqsonlari kiritilmagan.

---

## Qisqa xulosa

> **Yangilanish (2026-09-11):** K2, K3, K4 **tuzatildi** — quyida "✅ TUZATILDI"
> deb belgilangan. K1 (soxta SMS kod) hali ochiq — u tashqi SMS shlyuzi
> shartnomasini talab qiladi.

| Daraja | Soni | Mazmuni |
|---|---|---|
| 🔴 Kritik | 4 (3 tasi tuzatildi) | Hozir pul/xavfsizlik/buyurtma yo'qotadi |
| 🟠 Yuqori | 7 | Mijoz tez-tez uchraydigan buzilish |
| 🟡 O'rta | 8 | Ma'lum sharoitda buziladi yoki o'sish bilan buziladi |
| 🔵 Past | 5 | Texnik qarz, kelajakda og'riq |

Eng muhim uchtasi: **soxta SMS kod (istalgan raqamga kirish mumkin)**, **mijoz ilovasi bilan serverning yetkazish narxi mantiqi mos emas**, **ombor qoldig'i 0 bo'lgan mahsulot buyurtmani boshi berk ko'chaga olib boradi**.

---

## 🔴 KRITIK

### K1. SMS tasdiqlash soxta — istalgan telefon raqamiga kirish mumkin

**Fayl:** `backend/app/services/otp.py:29-34`

```python
def verify_otp(phone: str, code: str) -> bool:
    c = code.strip()
    p = phone.strip()
    if p in DEMO_PHONES and c == FAKE_CODE:
        return True
    return c == FAKE_CODE          # ← istalgan raqam, kod "11111" bo'lsa kifoya
```

**Real oqibat:** Kim bo'lmasin `+998XXXXXXXXX` raqamini kiritib, `11111` kodini terib **istalgan mijoz akkauntiga kiradi** — uning buyurtmalar tarixi, telefon raqami, manzillari, saqlangan manzillarini ko'radi va uning nomidan buyurtma beradi. Admin qo'lda yaratgan "telefon mijoz"lar ham (`orders.py:308`) shu raqam bo'yicha ochiladi.

Ilova allaqachon Play Market'da (`Play Market/release`, `BB-Kuryer-v1.2.3.apk` mavjud) — ya'ni bu teshik ishlab turgan tizimda.

**Yechim:** Eskiz.uz (yoki Play Mobile) shlyuzini `send_otp()` ichiga ulash; kodni Redis'ga `otp:{phone}` kaliti bilan TTL 120s va 5 urinish limiti bilan saqlash; `verify_otp` faqat shu kalitni tekshirsin. Demo raqamlar (Apple review) alohida `DEMO_PHONES` ro'yxatida qolsin — lekin faqat **o'sha ro'yxatdagi** raqamlar uchun. Kod tuzilishi allaqachon to'g'ri (chaqiruvchi kod o'zgarmaydi), faqat ichi almashtiriladi.

---

### K2. Mijoz ilovasi va server yetkazish narxini boshqacha hisoblaydi — ✅ TUZATILDI

> **Bajarildi:** serverga `POST /api/orders/quote` qo'shildi
> (`app/services/orders.py:quote_order`) — `create_order` bilan **aynan bir xil**
> `calc_delivery_fee` + `distance_to_user` ishlatadi. Ilova endi narxni o'zi
> hisoblamaydi: checkout summani shu endpointdan oladi
> (`mijoz_app/lib/models/quote.dart`, `checkout_page.dart:_refreshQuote`).
> `min_order` bo'yicha "minimal buyurtma" bloki olib tashlandi (server bunday
> qoida qo'ymaydi), qat'iy `50000` esa `store.minOrder` bilan almashtirildi.
> Manzil hali tanlanmaganda "Manzilga qarab" deb ko'rsatiladi — soxta raqam emas.
> Bundan tashqari: joylashuv olinmasa endi shahar markazi koordinatasi
> (`41.311081, 69.240562`) yuborilmaydi — u masofani va zona tekshiruvini
> yolg'on qilardi.
> Testlar: `backend/tests/test_order_quote.py` (quote va haqiqiy buyurtma
> summasi bir xilligini tekshiradi), `mijoz_app/test/cart_quote_test.dart`.

**Fayllar:**
- Server: `backend/app/models/restaurant.py:32-34`, `backend/app/services/orders.py:32-50, 239-244`
- Mijoz: `mijoz_app/lib/pages/cart_page.dart:19, 95-121, 264, 282, 288-335`, `mijoz_app/lib/pages/checkout_page.dart:138-141, 212-213`

**Server semantikasi:**
- `min_order` = **bepul yetkazish chegarasi** (default 50 000)
- `delivery_fee` = **1 km uchun narx** (default 2 000)
- Haqiqiy hisob: `items_total >= min_order → 0`, aks holda `ceil(km) × delivery_fee`

**Mijoz ilovasi semantikasi:**
- `min_order` = **minimal buyurtma summasi** deb qabul qilinadi va undan kam savat **butunlay bloklanadi** (`cart_page.dart:312`, `checkout_page.dart:138`)
- `delivery_fee` = **qat'iy yetkazish narxi** deb ko'rsatiladi: `total = savat + 2 000` (`checkout_page.dart:213`)
- "Bepul yetkazishgacha yana X" progressi **50000 raqamini qo'lda yozib qo'ygan** (`cart_page.dart:104, 118`) — `store.minOrder` emas

**Real oqibat (ikki yo'nalishda ham noto'g'ri):**

1. **Hozirgi default sozlamada:** mijoz 50 000 dan kam buyurtma **umuman bera olmaydi** — server bunday cheklovni bilmaydi, bu faqat ilovadagi soxta qoida. Bozor uchun 50 000 chegara juda katta — mijozlarning katta qismi shu yerda ketib qoladi.
2. **Do'kon `min_order`ni 0 qilsa** (ya'ni "yetkazish har doim pullik"): ilova ekranda "2 000 so'm" ko'rsatadi, server esa 5 km uchun **10 000 so'm** yozadi. Mijoz eshik oldida boshqa summa eshitadi → nizо, bekor qilingan buyurtma.
3. Bir ekranda bir vaqtda "Yetkazib berish bepul!" bannerи va "Yetkazib berish: 2 000 so'm" qatori turadi — bir-biriga zid.

**Yechim (tavsiya etilgan tartibda):**
- Serverga `POST /orders/quote` (yoki `GET /restaurants/{id}/quote?lat&lng&items_total`) endpointi qo'shing — `calc_delivery_fee` xuddi o'sha funksiyani chaqirsin. Ilova checkout'da shu javobni ko'rsatsin. Narx mantiqi **bitta joyda** qolsin.
- Vaqtinchalik tez yechim: ilovadagi qat'iy `50000`ni `store.minOrder`ga almashtiring, `min_order`ni "minimal buyurtma" deb bloklashni olib tashlang, `delivery_fee`ni "≈ km uchun" deb belgilang yoki checkout'da "yakuniy narx tasdiqlashda aniqlanadi" deb yozing.
- Maydon nomlarini aniqlashtiring: `free_delivery_from` va `delivery_fee_per_km` — hozirgi nomlar chalg'ituvchi va aynan shu xatoni keltirib chiqargan.

---

### K3. Ombor qoldig'i 0 bo'lgan mahsulot — buyurtma boshi berk ko'chada — ✅ TUZATILDI

> **Bajarildi (4 qatlamda):**
> 1. Ilova endi `stock`ni o'qiydi (`Product.stock`, `inStock`, `maxQuantity`) —
>    qoldiqsiz mahsulot kartada "Tugagan" bo'lib chiqadi va savatga tushmaydi.
> 2. `CartProvider.add` va stepper qoldiqdan oshirmaydi — yagona chegara
>    `Product.maxQuantity` da (sotuvdan olingani uchun ham 0 qaytaradi).
> 3. `CartProvider.syncWithCatalog` — katalog yangilanganda savat solishtiriladi:
>    tugagan/olib tashlangan mahsulot chiqariladi, miqdor qoldiqqa qisqaradi,
>    narx yangilanadi va mijozga toast orqali aytiladi. Bu **Y3** ni ham yopadi.
> 4. Checkout serverdan `issues` ro'yxatini oladi va buyurtmadan **oldin**
>    aniq nomi bilan ko'rsatadi; server xatosi endi `userFriendlyMessage` bilan
>    to'liq chiqadi. Serverdagi `"Product 42 unavailable"` ham o'zbekcha, nom
>    bilan yoziladigan bo'ldi.
>
> Qolgan tavsiya: admin panelda yangi mahsulot uchun qoldiqni majburiy maydon
> qilish (`ProductsPage.tsx:375` dagi `stock: 0` default) — hozircha tegilmadi.

**Fayllar:** `backend/app/models/restaurant.py:103` (`stock` default `0.0`), `admin/src/pages/ProductsPage.tsx:375` (yangi mahsulot `stock: 0`), `backend/app/services/orders.py:78-99`, `mijoz_app` (`stock` **umuman ishlatilmaydi**), `mijoz_app/lib/pages/checkout_page.dart:145-152`

**Zanjir:**
1. Admin yangi mahsulot qo'shadi, "Qoldiq" maydonini to'ldirmaydi → `stock = 0`, lekin `is_available = true`.
2. Katalog API `stock`ni chiqaradi (`schemas/catalog.py:16`), ammo **mijoz ilovasi uni o'qimaydi ham, ko'rsatmaydi ham** — mahsulot oddiy sotuvdagi mahsulotdek ko'rinadi.
3. Mijoz savatga soladi, manzil kiritadi, "Buyurtma berish" bosadi.
4. Server `reserve_stock_atomic` da rad etadi: `"'Pomidor' uchun ombor yetarli emas (qoldiq: 0)"` — **aniq va foydali xabar**.
5. Ilova bu xabarni **tashlab yuboradi** va o'rniga `"Buyurtma berib bo'lmadi. Qayta urinib ko'ring."` deb yozadi.
6. Mijoz qayta urinadi. Yana xato. Yana. Buyurtma yo'qoladi, sabab hech kimga ma'lum emas.

**Real oqibat:** Har bir "qoldiq kiritilmagan" mahsulot — jim yo'qotilgan buyurtma. Do'kon buni statistikada ham ko'rmaydi (buyurtma yaratilmagan).

**Yechim (3 ta, hammasi kerak):**
1. `mijoz_app/lib/pages/checkout_page.dart:147` — server xabarini ko'rsating. `ApiException.userFriendlyMessage` allaqachon yozilgan (`api.dart:14-28`), faqat ishlatilmayapti:
   ```dart
   final msg = e is ApiException ? e.userFriendlyMessage : 'Buyurtma berib bo\'lmadi...';
   ```
2. Ilovada `stock`ni o'qing: `stock <= 0` bo'lsa kartada "Tugagan" belgisi (`ProductCard` da `isAvailable` uchun allaqachon shunday overlay bor), savatga qo'shish tugmasi o'chiq.
3. Serverda: katalogdan `stock <= 0` mahsulotlarni chiqarmang **yoki** admin panelda yangi mahsulot uchun qoldiqni majburiy maydon qiling (`ProductsPage.tsx:375` dagi `stock: 0` default'ini olib tashlang).

---

### K4. Mijoz ilovasi token yangilashda foydalanuvchini tizimdan chiqarib yuboradi — ✅ TUZATILDI

> **Bajarildi:** `bool _isRefreshing` o'rniga `Future<bool>? _refreshFuture` —
> parallel so'rovlar endi bitta refreshni **kutadi**, darhol `false` olib
> tokenlarni o'chirmaydi (`mijoz_app/lib/services/api.dart`). Tarmoq uzilishida
> ham tokenlar o'chirilmaydi.

**Fayl:** `mijoz_app/lib/services/api.dart:97-125, 150-163`

```dart
Future<bool> _tryRefreshToken() async {
    if (_isRefreshing || ...) return false;   // ← parallel so'rov darhol "false" oladi
```
```dart
if (res.statusCode == 401) {
  if (!isRetry && ...) { final refreshed = await _tryRefreshToken();
    if (refreshed) return _request(..., isRetry: true); }
  await setTokens(access: null, refresh: null);   // ← tokenlar o'chiriladi
  onUnauthorized?.call();                          // ← login sahifasiga otiladi
```

**Real oqibat:** Access token 7 kun yashaydi (`config.py:23`), refresh — 30 kun. Bir haftadan keyin ilova ochilganda bir vaqtda bir nechta so'rov ketadi (do'kon katalogi + buyurtmalar polling + bildirishnomalar). Birinchisi 401 olib refresh boshlaydi; qolganlari `_isRefreshing == true` sababli darhol `false` oladi va **tokenlarni o'chirib, foydalanuvchini login ekraniga tashlaydi** — refresh aslida muvaffaqiyatli bo'lgan bo'lsa ham. Mijoz "ilova o'zi chiqib ketdi, yana SMS kod kutish kerak" deydi.

**Yechim:** Refreshni bitta `Future` bilan almashtiring, parallel so'rovlar **shu Future'ni kutsin**:
```dart
Future<bool>? _refreshFuture;
Future<bool> _tryRefreshToken() => _refreshFuture ??= _doRefresh()
    .whenComplete(() => _refreshFuture = null);
```

---

## 🟠 YUQORI

### Y1. Mijoz ilovasiga push bildirishnoma kelmaydi (Android 8+)

**Fayllar:** `backend/app/services/fcm.py:72-76` (`channel_id="courier_orders"`), `mijoz_app/android/app/src/main/AndroidManifest.xml` (kanal e'lon qilinmagan), `mijoz_app/lib/main.dart:97-113`

Server **barcha** push'larni — kuryerga ham, mijozga ham (`notify_user`, `fcm.py:194`) — `channel_id="courier_orders"` bilan yuboradi. Mijoz ilovasi bu kanalni yaratmaydi (`flutter_local_notifications` yo'q, `AndroidNotificationChannel` yo'q) va manifestда `com.google.firebase.messaging.default_notification_channel_id` meta-data ham yo'q.

**Real oqibat:** Android 8+ da mavjud bo'lmagan kanalga kelgan bildirishnoma **ko'rsatilmaydi**. Ilova ochiq turganda toast ishlaydi (`main.dart:83-87`), lekin ilova yopiq/fonda bo'lganda — "buyurtmangiz qabul qilindi/yo'lga chiqdi" xabarlari mijozga umuman yetib bormaydi. Bu butun buyurtma oqimining asosiy aloqa kanali.

**Yechim:** `fcm.py` da `notify_user` uchun alohida kanal (`"orders"`) bering va mijoz ilovasida shu kanalni yarating; yoki manifestga default kanal meta-data qo'shib, ilovada o'sha kanalni yarating. Tekshirish: ilovani yopib, admin paneldan buyurtma holatini o'zgartiring.

### Y2. Do'kon ish vaqti yo'q — faqat qo'lda tugma

**Fayl:** `backend/app/models/restaurant.py:36` (`is_open` — oddiy boolean)

Jadval/ish vaqti (hafta kunlari, ochilish-yopilish soati) modeli **umuman yo'q**. Do'kon har kuni ertalab qo'lda "ochish", kechqurun "yopish" tugmasini bosishi kerak.

**Real oqibat:** Kechqurun yopishni unutishsa — tunda buyurtmalar tushadi, hech kim yetkazmaydi, ertalab bekor qilinadi. Mijoz uchun bu "ilova ishlamaydi" degani.

**Yechim:** `restaurants` ga `work_hours` (JSONB: `{"mon": ["09:00","21:00"], ...}`) qo'shing; `is_open` — qo'lda majburiy yopish uchun override sifatida qolsin. Hisob `Asia/Tashkent` bo'yicha (`core/tz.py` allaqachon bor).

### Y3. Savat eski narxlarni cheksiz saqlaydi — ✅ TUZATILDI (K3 bilan birga)

> `CartProvider.syncWithCatalog` + `main.dart` dagi
> `ChangeNotifierProxyProvider<StoreProvider, CartProvider>` — katalog har
> yuklanganda savat yangi narx/qoldiq bilan solishtiriladi.

<details><summary>Asl tavsif</summary>

**Fayl:** `mijoz_app/lib/services/cart.dart:19-27, 47-64`

Savat mahsulotning **to'liq nusxasini** (narxi bilan) qurilmada saqlaydi va ilova ochilganda katalog bilan **hech qachon solishtirilmaydi**.

**Real oqibat:** Mijoz 3 kun oldin savatga solgan; do'kon narxni oshirgan. Ilova eski narxni ko'rsatadi, server yangi narx bo'yicha yozadi (`orders.py:222` — `product.price` DB'dan olinadi). Mijoz boshqa summa to'laydi. Mahsulot o'chirilgan/nofaol bo'lsa — butun buyurtma K3 dagi boshi berk ko'chaga tushadi.

**Yechim:** Ilova ochilganda/katalog yuklanganda savatni katalog bilan solishtiring: narx o'zgargan bo'lsa yangilang va "narx yangilandi" deb belgilang; yo'q bo'lgan mahsulotni savatdan olib tashlab, mijozga ayting.

</details>

### Y4. Buyurtma takrorlanishi (idempotentlik yo'q)

**Fayllar:** `mijoz_app/lib/services/api.dart:134` (15s timeout), `backend/app/api/routes/orders.py:21-40`

Buyurtma POST'i 15 soniyada timeout bo'ladi. Sekin tarmoqda server buyurtmani **yaratib ulgurgan**, lekin javob yetib kelmagan bo'lishi mumkin → ilova xato ko'rsatadi → mijoz yana bosadi → **ikkita bir xil buyurtma**. Rate limit 20/min buni to'xtatmaydi.

**Yechim:** Ilova har bir checkout uchun `client_order_id` (UUID) generatsiya qilsin; server `orders` da unique bo'lsin va takroriy so'rovda mavjud buyurtmani qaytarsin.

### Y5. Kategoriyani o'chirish 500 xatosi beradi

**Fayllar:** `backend/app/api/routes/admin.py:427-434`, `backend/app/models/order.py:130` (`order_items.product_id` — `ondelete` yo'q)

`delete_product` `IntegrityError`ni ushlab, tushunarli 409 qaytaradi (`admin.py:497-506`) — yaxshi. Lekin `delete_category` bunday himoyasiz: ichida buyurtma tarixida ishlatilgan mahsulot bo'lsa, cascade `order_items` FK'ga urilib **ushlanmagan `IntegrityError` → 500** beradi.

**Real oqibat:** Admin kategoriyani o'chira olmaydi, ekranda tushunarsiz "Server xatosi". Sessiya rollback bo'lmagani uchun keyingi so'rovlar ham buzilishi mumkin.

**Yechim:** `delete_product` dagi `try/except IntegrityError` naqshini `delete_category` va `delete_category_group` ga ham qo'llang.

### Y6. Buyurtmalar ro'yxati sahifalanmagan

**Fayl:** `backend/app/api/routes/orders.py:43-50`

`GET /orders` foydalanuvchining **barcha** buyurtmalarini `items` bilan birga qaytaradi. Mijoz ilovasi buni har 15 soniyada so'raydi (`orders_page.dart`).

**Real oqibat:** Doimiy mijozda 1 yildan keyin har 15 soniyada yuzlab buyurtma + ularning barcha mahsulotlari yuklanadi — mobil internet sarfi, batareya, sekin ekran.

**Yechim:** `limit`/`offset` (yoki cursor) qo'shing, ilova 20 tadan yuklasin; polling o'rniga faqat faol buyurtmani kuzating.

### Y7. CORS hammaga ochiq (production'da ham)

**Fayl:** `backend/app/main.py:75-83`

```python
# ponytail: vaqtincha hammaga ochiq (dasturlash bosqichi) — kechga prod
app.add_middleware(CORSMiddleware, allow_origin_regex=".*", allow_credentials=True, ...)
```

`config.py:90-125` da to'g'ri whitelist yozilgan, lekin **ishlatilmayapti**. Izohdagi "kechga qaytariladi" bajarilmagan.

**Real oqibat:** Istalgan sayt brauzerdan API'ga so'rov yuborib javobini o'qiy oladi. Hozircha token'lar `localStorage`da bo'lgani uchun to'g'ridan-to'g'ri o'g'irlash yo'q, lekin XSS yoki kelajakda cookie-auth qo'shilsa — bu to'g'ridan-to'g'ri teshik. Shuningdek API'ni brauzerdan skraping/abuse qilish osonlashadi.

**Yechim:** `allow_origins=settings.cors_origins` ga qaytaring (kod tayyor); development uchun `if settings.environment != "production"` sharti bilan wildcard qoldiring.

---

## 🟡 O'RTA

### O1. Kilogramm bilan sotib bo'lmaydi
`mijoz_app/lib/services/cart.dart:8` — `quantity` **int**. Server `Float` qabul qiladi (`models/order.py:136`), admin panelda default birlik `"kg"` (`ProductsPage.tsx:375`). Ya'ni bozor uchun eng tabiiy holat — 0.5 kg go'sht, 1.5 kg olma — mijoz ilovasidan **imkonsiz**. Yechim: savatda `double` miqdor + `unit` ga qarab qadam (kg uchun 0.1/0.5).

### O2. Migratsiya tizimi yo'q
`backend/alembic/versions/` — **0 ta migratsiya**. Sxema `create_all` + `initdb.py` ichidagi qo'lda yozilgan `ALTER TABLE ... IF NOT EXISTS` satrlari bilan boshqariladi (`initdb.py:17-35`). Yangi ustun qo'shilganda `initdb.py`ga qo'lda ALTER yozish esdan chiqsa — deploy'dan keyin production `column does not exist` bilan yiqiladi. Orqaga qaytarish yo'li yo'q. Yechim: mavjud sxemadan boshlang'ich alembic revision yarating va bundan keyin faqat alembic.

### O3. Yuklangan rasmlar hech qachon o'chmaydi
`backend/app/api/routes/uploads.py:74-75` — fayl diskка yoziladi; mahsulot/banner o'chirilganda rasm qoladi. Oylar davomida disk to'ladi. Yechim: o'chirishda faylni ham o'chirish yoki davriy "yetim rasmlar" tozalagichi.

### O4. Yuklashda fayl to'liq xotiraga o'qiladi
`uploads.py:61-63` — `await file.read()` **avval** to'liq o'qiydi, **keyin** 8 MB tekshiradi. Autentifikatsiyalangan do'kon akkaunti 1 GB fayl yuborsa worker xotirasi to'ladi. Yechim: `file.size` yoki `Content-Length` bo'yicha oldindan rad etish / bo'laklab o'qish.

### O5. Katalog keshi 2 daqiqa — `stock` uchun invalidatsiya yo'q
`backend/app/api/routes/catalog.py:26`. Admin yozuvlari keshni tozalaydi (`invalidate_restaurant_catalog` — yaxshi), lekin **buyurtma orqali kamaygan qoldiq** keshni tozalamaydi (`orders.py:87`). Oxirgi 1 dona mahsulot sotilgandan keyin 2 daqiqa davomida boshqa mijozlarга "bor" bo'lib ko'rinadi → K3 dagi xato. (Izoh: `catalog.py:21-24` dagi "invalidatsiya yo'q" izohi eskirgan — admin tomonida bor.)

### O6. Rate limit IP bo'yicha, telefon bo'yicha emas
`backend/app/core/ratelimit.py:32-52` — `otp_request` 5/min **IP**ga. Bitta IP ortidagi butun mobil operator NAT'i bir-birini bloklaydi (O'zbekistonda keng tarqalgan), ayni paytda bir hujumchi IP almashtirib istalgan raqamga SMS yog'diradi. K1 tuzatilgandan keyin bu real pul sarfiga aylanadi (har SMS pullik). Yechim: telefon raqami bo'yicha ham limit (`otp:{phone}` — 1 daqiqada 1, kuniga 10).

### O7. Backend porti tashqariga ochiq
`docker-compose.yml:48-49` — `"8000:8000"` (postgres/redis esa to'g'ri `127.0.0.1:` bilan bog'langan). Agar production shu compose bilan ishlayotgan bo'lsa, API reverse-proxy'ni (TLS, WAF) chetlab o'tib to'g'ridan-to'g'ri ochiq, va `X-Forwarded-For` soxtalashtirib rate-limitni chetlab o'tish mumkin (`ratelimit.py:21-25` oxirgi qiymatni oladi — to'g'ridan-to'g'ri ulanuvchi butun headerni boshqaradi). Yechim: `127.0.0.1:8000:8000`.

### O8. Mijoz ilovasida test yo'q
`mijoz_app/test/` — **bo'sh**. Backend'da 114 ta test bor (20 fayl) — yaxshi. Lekin pul hisobi (K2), savat mantiqi (Y3), token yangilash (K4) — hammasi ilovada va test bilan qoplanmagan. Kamida `CartProvider` va narx hisobi uchun widget/unit testlar.

---

## 🔵 PAST / TEXNIK QARZ

- **P1.** `mijoz_app/lib/pages/auth_page.dart:78` — har qanday xato (tarmoq yo'q, server 500) `"SMS kod noto'g'ri"` deb ko'rsatiladi. Mijoz kodni qayta-qayta kiritadi, aslida internet yo'q.
- **P2.** `backend/app/api/routes/auth.py:139-157` — refresh token rotatsiyasi bor, lekin eskisi bekor qilinmaydi (blacklist yo'q): o'g'irlangan refresh token 30 kun ishlaydi. `/auth/refresh` da rate limit ham yo'q.
- **P3.** Bitta foydalanuvchi = bitta `fcm_token` (`models/user.py`). Ikkinchi qurilmadan kirilsa birinchisi jim qoladi.
- **P4.** `backend/app/api/routes/catalog.py:143-164` — `get_nearest_store` barcha faol do'konlarni yuklab, har biri uchun alohida zona so'rovi yuboradi (N+1). Hozir 1 do'kon — muammo yo'q; 50 do'konda sezilarli.
- **P5.** SSE (`courier.py:128-159`) har bir ulangan klient uchun asyncio default thread pool'idan **doimiy bitta thread** band qiladi (`run_in_executor(None, ...)`). Har bir worker'da taxminan 32 ta parallel SSE klientidan keyin yangi ulanishlar kutib qoladi. Hozirgi kuryer soni uchun muammo emas, o'sish rejasi bo'lsa — `redis.asyncio` ga o'ting.

---

## Yaxshi qilingan joylar (buzmang)

- **Ombor zaxirasi race-free:** `orders.py:78-99` — `WHERE stock >= qty` bilan bitta atomik UPDATE. To'g'ri yondashuv.
- **Buyurtma holati grafi:** `orders.py:57-75` + har bir o'tishda atomik `UPDATE ... WHERE status = ...` guard (`courier.py:808-825`) — ikki marta "yetkazdim" bosilishi xavfsiz.
- **Narx/nom snapshot'i:** `OrderItem` mahsulot nomi, narxi, tannarxi, rasmini saqlaydi — keyinchalik katalog o'zgarsa ham buyurtma tarixi buzilmaydi.
- **Rasm yuklash xavfsizligi:** magic-byte tekshiruvi, SVG taqiqlangan, tasodifiy fayl nomi, WebP optimizatsiya (`uploads.py`).
- **Prod'da zaif kalitlar bilan ishga tushishni taqiqlash:** `main.py:47-70`.
- **Sirlar repozitoriyda yo'q:** `.gitignore` to'liq (`.env`, `*.jks`, `google-services.json`, `*firebase-adminsdk*.json`, `backups/`, `*.apk`) — tekshirildi, hech qanday sir commit qilinmagan.
- **Toshkent vaqti markazlashtirilgan:** `core/tz.py` — statistikadagi kun chegarasi muammosi hal qilingan.

---

## Tavsiya etilgan tartib

| # | Ish | Holat |
|---|---|---|
| 1 | **K1** — haqiqiy SMS shlyuzi (Eskiz.uz) | ⏳ **Qoldi — eng muhimi** |
| 2 | **K3** — `stock` + aniq xato xabari | ✅ Tuzatildi |
| 3 | **K4** — refresh Future bilan almashtirish | ✅ Tuzatildi |
| 4 | **Y1** — FCM kanalini to'g'rilash | ⏳ Qoldi (1-2 soat) |
| 5 | **K2** — narx mantiqini bitta joyga yig'ish (`/orders/quote`) | ✅ Tuzatildi |
| 6 | **Y3** — savat sinxronizatsiyasi | ✅ Tuzatildi (K3 bilan) |
| 7 | **Y5, O7, Y7** — kichik, aniq tuzatishlar | ⏳ har biri < 1 soat |
| 8 | **Y2** — ish vaqti jadvali | ⏳ yarim kun |
| 9 | **Y4, Y6** — idempotentlik, sahifalash | ⏳ 1 kun |
| 10 | **O2** — alembic'ga o'tish | ⏳ yarim kun |

Endi eng muhimi **K1** (soxta SMS kod) va **Y1** (mijozga push kelmasligi).

---

## Tuzatishlarni tekshirish

```bash
# Backend (Postgres kerak — docker compose up postgres)
cd backend && pytest tests/test_order_quote.py tests/test_delivery_fee.py -q

# Mijoz ilovasi
cd mijoz_app && flutter test && flutter analyze
```

Oxirgi ishga tushirishda: `flutter test` — 11/11 o'tdi, `flutter analyze` — toza,
release APK muvaffaqiyatli build bo'ldi va emulyatorda crashsiz ochildi.
`test_order_quote.py` Postgres bo'lmagani uchun bu mashinada ishga tushirilmadi
(DB-siz testlar — 11/11 o'tdi).
