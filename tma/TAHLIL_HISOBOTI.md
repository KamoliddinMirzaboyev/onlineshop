# TMA (Telegram Mini App) — Texnik Tahlil Hisoboti

**Soha:** Permissions · API integratsiyasi · Tokenlar · Bildirishnomalar
**Tahlil vaqti:** 2026-09-06
**Ilova:** `tma` (React 18 + Vite + zustand) — Telegram Mini App

---

## KIRISH — qisqacha holat

Telegram ichida ishlaydigan Mini App bo'lgani uchun:
- Push va OS permission kerak emas — brauzer/Telegram WebView ichida ishlaydi, FCM/iOS push ishlatilmaydi.
- Bildirishnoma Telegram bot orqali foydalanuvchiga boradi (Mini App'ga emas).
- Autentifikatsiya Telegram initData (imzo) orqali — parol yoki OTP yo'q.

Umumiy sifat mijoz_app'ga qaraganda ancha yuqori: timeout, 401-da avtomatik qayta-auth, xatolarni ishlov berish, joylashuvning batafsil oqimi bor. Quyida topilgan kamchiliklar.

---

## 1. TOKEN / AUTH

### 1.1. 401-da avtomatik qayta-auth
- `client.ts` dagi `tryReauth()` initData bilan `/auth/telegram` chaqirib yangi token oladi va so'rovni qayta yuboradi.
- `reauthInFlight` (parallel login bloklash) va `_retried` (sikl oldini olish) — to'g'ri ishlatilgan. Bu mijoz_app'dagi "token tugasa qayta OTP" muammosini hal qiladi.

### 1.2. Token localStorage'da — XSS xavfi
- JWT `localStorage` `af_token` kaliti ostida ochiq saqlanadi. Brauzer ilovalari uchun odatiy, lekin XSS xatosi bo'lsa token o'g'irlanishi mumkin. Eng yaxshisi: `httpOnly` + `Secure` cookie yoki token rotatsiyasi.

### 1.3. initData sessionStorage'da (ijobiy)
- Telegram initData sizib ketmasligi uchun bir necha kanal ishlatiladi: SDK, WebView initParams, o'z keshi, TG sessionStorage, URL. Redirect paytida ham yo'qolmaydi. Shu tufayli 401-da qayta-auth ishonchli.

---

## 2. API INTEGRATSIYASI

### 2.1. 15 soniyalik timeout bor
- `FETCH_TIMEOUT_MS = 15_000` — har so'rovga qo'llanadi. Bu mijoz_app'da yo'q edi, shu yerda to'g'ri qilingan.

### 2.2. 401 → qayta auth → so'rovni qayta yuborish
- `tryReauth()` muvaffaqiyatli bo'lsa so'rov yana yuboriladi. Yaxshi yechim.

### 2.3. BILDIRISHNOMALAR — TMA ichida yo'q
- `/notifications` endpointi TMA'da hech qayerda chaqirilmaydi. Bildirishnomalar sahifasi mavjud emas.
- Backend'da `Notification` modeli va `/notifications` API bor — lekin TMA uni ko'rsatmaydi.
- Foydalanuvchi buyurtma holatini faqat Telegram bot xabari orqali biladi; Mini App ichida bildirishnomalar ro'yxati yo'q.

### 2.4. Realtime yo'q — polling bor
- Buyurtmalar ro'yxati 15 soniyada, buyurtma detali 10 soniyada poll qilinadi. SSE/WebSocket ishlatilmaydi (backend'da SSE mavjud).

### 2.5. Xatoni ko'rsatish — server body'si chiqib qolishi mumkin
- `throw new Error('${res.status}: ${body}')` — server xato matni foydalanuvchiga chiqishi mumkin. Checkout'da `errorText()` uni parse qilib `detail` ni chiqaradi — yarim yechim.

### 2.6. Joylashuv va keshlash (ijobiy)
- Coords kesh: sessionStorage'da 3 daqiqa TTL + hot memory + watch multi-sample (eng aniq fix).
- Checkout'da force — eski joy yuborilmaydi. Yaxshi injenerlik.

---

## 3. PERMISSIONS / JOYLASHUV

### 3.1. Joylashuv — Telegram + brauzer gibrid
- `requestTelegramLocation`, `canOpenLocationSettings`, `openTelegramLocationSettings`, desktop fallback — bor.
- Accuracy chegaralari: 25/100/200 metr. Mijoz_app'dagidan yaxshiroq.

### 3.2. Ertaroq so'ralishi (premature)
- `main.tsx` da app ochilishi bilan `ensureLocationManager().then(() => getCoords())` — foydalanuvchi hali login bo'lmagan bo'lsa ham joylashuv prompti ochilishi mumkin. (Mijoz_app bilan bir xil kamchilik.)

---

## 4. KONFIG XAVFSIZLIGI

### 4.1. .env gitignore'da (ijobiy)
- Faqat `.env.example` commit qilingan, `.env` .gitignore'da. Yaxshi.

### 4.2. Mapbox token — ochiq pk token (eslatma)
- `VITE_MAPBOX_TOKEN=pk.eyJ1Ijoi...` client-tarafda turadi (satellite xarita).
- Public token bo'lgani uchun odatiy, lekin **domain-restrict** qilinmagan bo'lsa, kimdir bu tokenni boshqa saytda ishlatib Mapbox kvasini sarflashi mumkin (xarajat). Mapbox konsolida domain cheklash tavsiya.

---

## XULOSA (ustuvorlik tartibida)

| # | Muammo | Og'irlik | Tavsiya |
|---|--------|---------|--------|
| 1 | TMA ichida bildirishnomalar ro'yxati yo'q | O'rta | `/notifications` dan ro'yxat ko'rish sahifasi qo'shish |
| 2 | Realtime yo'q — polling (15s/10s) | O'rta | SSE / websocket-ga o'tish |
| 3 | Joylashuv login'dan avval so'raladi | O'rta | Faqat auth-dan keyin bir marta |
| 4 | JWT localStorage'da (XSS xavfi) | O'rta | `httpOnly` + `Secure` cookie / token rotatsiyasi |
| 5 | Xato matni server'dan chiqib qolishi | Past | Umumiy, yopiq xabar ko'rsatish |
| 6 | Mapbox token domain-restrict yo'q | Past | Mapbox konsolida cheklash |

**Yakuniy xulosa:** TMA texnik sifat jihatidan yuqori darajadagi, deyarli tayyor ilova (auth, timeout, 401-rauth, joylashuv oqimi juda batafsil). Yetishmayotgan asosiy qismlar: **TMA ichida bildirishnomalar sahifasi yo'q** (bildirishnoma faqat botga keladi) va **realtime o'rniga polling**. Shu ikkisini qo'shish — mijoz holatni jonli ko'rishi uchun eng muhim qadam.