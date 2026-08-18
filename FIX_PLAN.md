# Fix Plan — reportcline.md + reportgrok.md asosida

Manba: ikkala audit hisoboti birlashtirilib, dublikatlar olib tashlandi, ustuvorlik
bo'yicha tartiblandi. Qaror talab qilingan 4 punkt foydalanuvchi bilan hal qilindi.

## Qarorlar (foydalanuvchi tanladi)
- Oshxona flow: o'lik holatlar (confirmed/preparing/ready) state-machine'dan olib tashlandi. ✅
- Register-claim takeover: tezkor mitigatsiya qo'llandi. ✅
- Kuryer adjust: faqat kamaytirish + fee qayta hisoblash. ✅
- Mijoz cancel: qo'shildi. ✅

## Faza 1 — Backend (BAJARILDI)
- [x] Order state-machine: confirmed/preparing/ready olib tashlandi (services/orders.py)
- [x] Mijoz cancel: POST /api/orders/{id}/cancel (faqat pending, faqat egasi)
- [x] Courier adjust: faqat kamaytirish, fee/total qayta hisoblanadi (courier.py)
- [x] Register claim: telegram_id bog'langan userni /register bilan egallab bo'lmaydi;
      /auth/set-password qo'shildi (Telegram orqali kirgan user parol o'rnatishi uchun)
- [x] CORS: prod'da localhost originlar olib tashlandi (config.py — real bug edi)
- [x] Push notify_admins: restaurant_id scoping (cross-tenant leak — do'kon A push'i
      do'kon B planshetiga tushardi). Model+initdb+webpush.py+3 chaqiruv joyi tuzatildi.
- [x] Rate-limit: X-Forwarded-For — endi OXIRGI qiymat olinadi (birinchisi soxta bo'lishi mumkin)
- [x] deps.py: `int(sub)` xato bo'lsa 500 emas — 401 (`_sub_id` helper)
- [x] Login timing-safe: user/username topilmasa ham bcrypt ishlaydi (enumeration mitigation) —
      auth/admin_auth/business_auth/platform_auth barchasida
- [x] Receipt SSRF: image_url endi faqat public IP'ga (ichki tarmoq/localhost bloklanadi),
      redirect o'chirildi (receipt.py)
- [x] Telegram HTML injection: notify.py — address/phone/courier nomi html.escape
- [x] Catalog cache invalidation: product CRUD/stock (admin.py) + business/platform
      store yozuvlarida ham (avval yo'q edi — 2 daqiqagacha eski narx/holat ko'rinardi)
- [x] Product delete: FK IntegrityError endi 500 emas — 409 aniq xabar bilan
- [x] Timezone: admin/business "bugun/hafta/oy" statistikasi endi Tashkent (UTC+5) —
      yangi app/core/tz.py, kuryer bilan bir xil hisoblanadi
- [x] Upload decompression bomb: Pillow MAX_IMAGE_PIXELS=25MP (images.py)
- [x] business.update_store: exclude_unset=True (mass-assignment/reset bug tuzatildi)
- [x] Schema validatorlar: ProductIn.price/cost/stock ge=0, CartItemIn.quantity le=10000,
      LocationUpdateIn/OptionalLocationIn lat/lng ge/le, admin parol min 6 belgi (4 emas)
- [x] Courier o'chirilganda accepted/delivering buyurtmalar endi pending'ga qaytadi
      (avval "osilib" qolardi — hech kim qayta ololmasdi)
- [x] Arxitektura: _agg/_series/_top_products admin.py'dan app/services/analytics.py'ga
      ko'chirildi — business.py/platform.py endi boshqa routerning xususiy funksiyasini
      import qilmaydi
- [x] Tekshirilib false-positive chiqqanlar: notify_location_update import (mavjud edi),
      route_sequence NULLS LAST (allaqachon bor edi), cash-payment "race" (WHERE atomik,
      real race yo'q)

**Tekshiruv:** barcha o'zgargan .py fayllar `py_compile` + to'liq `app.main` import qilindi
(113 route, xatosiz). DB-siz unit testlar (20 ta: order transitions, delivery fee, i18n,
route optimize) — barchasi PASS. To'liq test suite (104 ta) collect bo'ladi, xatosiz —
grok hisobotidagi "Courier import ImportError" hozir yo'q. **DB talab qiladigan ~84 test
bu sandbox'da ishga tushirilmadi** (na Docker daemon, na local Postgres bor edi) — deploy
oldidan `docker compose -f docker-compose.local-test.yml up -d && pytest` bilan tasdiqlang.

## Faza 2 — Web frontend (QISMAN)
- [x] admin OrdersPage.tsx — chek doc.write() endi barcha mijoz/kuryer matnini escape
      qiladi (stored XSS yopildi: manzil/izoh/ism/telefon)
- [ ] SW (admin/superadmin/businessman) — /api/* NetworkFirst kesh
- [ ] Network xato = logout bug (loadMe catch)
- [ ] Courier PWA 401 redirect + eski SSE host
- [ ] TMA: is_open (yopiq do'kon) UI/checkout blok, live fee quote

## Faza 3 — Flutter va infra (BAJARILMADI)
- [ ] kuryer/mijoz_app API host hardcoded
- [ ] .gitignore/.dockerignore (*.apk, *.aab, Play Market/release/, secrets image ichida)

## Foydalanuvchi qo'lda qilishi kerak (kod muammosi emas)
- Firebase SA key, BOT_TOKEN, SECRET_KEY, Android keystore — rotate (memory: pending-secret-rotation)
- Play Console privacy URL/listing
- To'liq SMS OTP, to'liq oshxona UI — foydalanuvchi hozircha kerak emas dedi
- CI/CD, backup cron, observability

## Faza 4 — Low/UX/i18n (40+ ta) — teginilmadi, alohida so'rov kerak
