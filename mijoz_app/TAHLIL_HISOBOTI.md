# Mijoz App — Texnik Tahlil Hisoboti (v1.0)

**Soha:** Permissions · API integratsiyasi · Tokenlar · Bildirishnomalar
**Tahlil vaqti:** 2026-09-06
**Ilova:** `mijoz_app` (Flutter) + `backend` (FastAPI)

---

## 🔴 1. BILDIRISHNOMALAR — EN ASOSIY MUAMMO

### 1.1. Mijozga push bildirishnoma UMUMAN yuborilmaydi
- App `FirebaseMessaging.getToken()` olib, uni `/auth/fcm-token` orqali `users.fcm_token` ga yozadi.
- Lekin backend **`User.fcm_token` ni hech qayerda ishlatmaydi**. `services/fcm.py` faqat **kuryer/admin** (`AdminUser`) uchun push yuboradi.
- Mijoz bildirishnomalari (`services/notify.py`) faqat **Telegram bot** orqali yuboriladi (`user_telegram_id` ga).
- **Natija:** "Bildirishnomani yoqing" onboarding ekran va FCM ro'yxatga olish — **o'lik funksiya**. Buyurtma holatidagi push hech qachon mijoz qurilmasiga tushmaydi.

### 1.2. FCM konfiguratsiya fayllari yo'q
- Kritik: `android/app/google-services.json` va `ios/Runner/GoogleService-Info.plist` **mavjud emas**.
- `android/app/build.gradle.kts` Google services plaginini **fayl mavjud bo'lsagina** qo'shadi (`if (file(...).exists())`). Shu sabab build ishlaydi, lekin Firebase/FCM amalda ulangan emas → `getToken()` xato qaytadi (catch bilan yutiladi).
- **Natija:** Play Market versiyasida push umuman yo'q.

### 1.3. FCM handlerlari yo'q
- Kodda `onMessage`, `getInitialMessage`, `onMessageOpenedApp`, `setBackgroundMessageHandler` **yo'q**. App yopiq/fonda ekan, push oqimi butunlay yo'q; bildirishnoma bosilganda mos sahifaga o'tish ham yo'q.

### 1.4. App ichidagi bildirishnomalar ham telefon foydalanuvchiga ko'rinmaydi
- `_record_notification` bildirishnomani `User.telegram_id` bo'yicha yozadi. Telefon (OTP) orqali kirgan, Telegram'ga ulanmagan mijozga **Notification qatorlari yozilmaydi** → "Bildirishnomalar" sahifasi bo'sh bo'ladi.

---

## 🔴 2. TOKENLAR / AUTENTIFIKATSIYA

### 2.1. Refresh token yo'q, 7 kunlik JWT
- `access_token_expire_minutes = 60 * 24 * 7` (7 kun). Refresh token mexanizmi mavjud emas.
- Token muddati tugagach app 401 oladi → token o'chirilib, foydalanuvchi qayta login (OTP) qilishga majbur. Fonda ishlatuvchi sessiya yo'qoladi.

### 2.2. Token xavfsiz saqlanmayapti
- Token **`SharedPreferences` da ochiq matn** saqlanadi (`af_mijoz_token`). Xavfsiz variant: `flutter_secure_storage` (Keychain/Keystore).

### 2.3. 401 bilan xavsiz oqim (ijobiy)
- 401 da token o'chirilib, savat tozalanadi va Auth sahifasiga yo'naltiriladi — bu to'g'ri. Faqat avtomatik yangilanish yo'q.

---

## 🟠 3. PERMISSIONS

### 3.1. Joylashuv ruxsati muddatidan oldin so'raladi (premature)
- `StoreProvider` ilova ildizida yaratiladi va `load()` **login'dan oldin ham** ishlaydi → foydalanuvchi hali kirishmagan bo'lsa ham tizim joylashuv ruxsati oynasini ko'rsatadi.
- Joylashuv **uch joyda** so'raladi: `StoreProvider`, onboarding (`LocationPermissionPage`), va `CheckoutPage._resolveLocation`. Ortiqcha / duplikativ so'rovlar.

### 3.2. Android manifest (to'g'ri)
- `INTERNET`, `ACCESS_FINE/COARSE_LOCATION`, `POST_NOTIFICATIONS` — kerakli barchasi bor. 👍

### 3.3. iOS (yaxshi, lekin push capability tekshirilsin)
- `NSLocationWhenInUseUsageDescription` + `AlwaysAndWhenInUse` mavjud. Lekin push uchun `aps-environment`/Remote-notifications capability'si Xcode'da yoqilganini tekshirish kerak.

---

## 🟡 4. API INTEGRATSIYASI

### 4.1. Tarmoq timeout'i yo'q
- `api.dart` `_request` da **timeout belgilanmagan**. Internet sekin/yo'q bo'lsa so'rov cheksiz osilib qolishi mumkin → spinner tushmaydi.

### 4.2. Qo'pol xato xabarlari foydalanuvchiga chiqadi
- `ApiException` serverning to'liq body (xato matni) ni oladi va `checkout_page` da `Xatolik: $e` shaklida snackbar'da ko'rsatiladi — ichki ma'lumot sizib chiqadi.

### 4.3. Poll — realtime yo'q
- Buyurtmalar 15 sek, buyurtma detali 10 sek poll qilinadi — batareya/trafik qimmat. Backend'da SSE/websoket allaqachon bor (TMA/kuryer uchun) — undan foydalanish yaxshi bo'lar edi.
- Push ishlamagani uchun holatlar faqat shu poll orqali ko'rinadi.

### 4.4. Retry / backoff yo'q
- 5xx / tarmoq xatosida qayta urinish (backoff) yo'q. Foydalanuvchi shunchaki "Xatolik" ko'rib qoladi.

### 4.5. Kesh kod izohlarida nusxalash xatosi
- `cache.dart` / `api.dart` izohlarida "courier sees", "returning courier" — mijoz ilovasiga noto'g'ri nusxalangan. Kosmetik, lekin chalg'itadi.

### 4.6. API qamrovi (xulosa)
- Katalog `/restaurants/*` himoyalanmagan (login'siz ochiq); buyurtmalar `/orders` auth bilan. Umumiy qamrov to'g'ri.

---

## ✅ UMUMIY XULOSA (ustuvorlik tartibida)

| # | Muammo | Og'irlik | Tavsiya |
|---|--------|---------|--------|
| 1 | google-services.json / GoogleService-Info.plist yo'q → Firebase ulanmagan | 🔴 Kritik | Firebase proyekt sozlab, ikkala faylni qo'shish |
| 2 | FCM mijozga push yuborilmaydi (faqat kuryer/admin) | 🔴 Kritik | `fcm.py` ga `notify_user()` qo'shish; buyurtma holatida `User.fcm_token` ga yuborish |
| 3 | FCM handlerlar yo'q (onMessage / onBackgroundMessage) | 🔴 Kritik | Handlerlarni qo'shish; bosilganda OrderDetail sahifasiga o'tish |
| 4 | Telegram'ga ulanmagan mijozga Notification yozilmaydi | 🔴 Yuqori | Telefon (phone) bo'yicha ham Notification yozish |
| 5 | Refresh token yo'q; SharedPreferences'da xavfsizsiz token | 🟠 O'rta | Secure storage + refresh/auto-login |
| 6 | Joylashuv login'dan oldin so'raladi | 🟠 O'rta | Faqat login'dan keyin, bir marta so'rash |
| 7 | Tarmoq timeout/retry yo'q | 🟠 O'rta | http timeout va qayta urinish (backoff) |
| 8 | "Xatolik: $e" — ichki ma'lumot chiqadi | 🟡 Past | Yopiq, umumiy xabar ko'rsatish |
| 9 | 15s/10s poll realtime o'rniga | 🟡 Past | SSE/websocket-ga o'tish |

**Yakuniy xulosa:** Buyurtma/do'kon oqimi to'g'ri, auth tizimi xavfsiz. Lekin **push bildirishnoma qismi amalda ishlamayapti** — Firebase sozlanmagan va mijozning fcm-tokeni serverda bo'sh qolmoqda. Eng muhim birinchi qadam: Firebase'ni sozlash + `User` ga FCM push qo'shish.