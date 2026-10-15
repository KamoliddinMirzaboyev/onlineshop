# Barakali Bozor (mijoz) — Google Play yuklash

**Package:** `uz.barakalibozor.mijoz`
**Versiya:** 1.1.0 (versionCode **2**) — Play'dagi oxirgi versionCode'dan katta bo‘lishi shart; kerak bo‘lsa `pubspec.yaml`dagi `+2` ni oshiring.
**AAB:** `store/play/release/BB-Mijoz-1.1.0-2.aab` (`./store/play/build-release.sh` yaratadi)

## Tayyor materiallar (bu papkada)
| Fayl | Console'dagi joyi |
|---|---|
| `listing-uz.txt`, `listing-ru.txt` | Store listing → nom, qisqa va to‘liq tavsif (uz-UZ asosiy, ru-RU qo‘shimcha til) |
| `screenshots/uz/01…08.png`, `screenshots/ru/01…08.png` | Phone screenshots (1080×1920, 8 ta, har til uchun) |
| `graphics/feature-graphic-uz|ru-1024x500.png` | Feature graphic |
| `graphics/icon-512.png` | App icon (512×512) |
| `DATA_SAFETY.txt` | App content → Data safety, Reviewer access |

Maxfiylik: https://www.barakali-bozor.uz/privacy · Hisobni o‘chirish: https://www.barakali-bozor.uz/account-deletion · Shartlar: https://www.barakali-bozor.uz/terms

## 1. Imzolash (bir marta)
1. `cp android/key.properties.example android/key.properties`
2. `storePassword`, `keyPassword`, `keyAlias`, `storeFile` ni to‘ldiring (keystore'ni **yo‘qotmang va gitga qo‘shmang**).
3. Agar bu ilova Play'da avval boshqa upload key bilan ro‘yxatdan o‘tgan bo‘lsa — o‘sha keystore'dan foydalaning, aks holda yuklash rad etiladi.
4. `key.properties` bo‘lmasa `bundleRelease` ataylab to‘xtaydi (debug kalit bilan AAB chiqmasligi uchun).

## 2. Build
```
cd mijoz_app && ./store/play/build-release.sh
```
`build/symbols` papkasini saqlang (obfuskatsiya qilingan crash'larni o‘qish uchun).

## 3. Console
1. Play Console → Barakali Bozor → Production (yoki avval Internal testing) → Create new release
2. `BB-Mijoz-1.1.0-2.aab` ni yuklang
3. Release notes: `listing-uz.txt` / `listing-ru.txt` oxiridagi "Yangilanish eslatmalari"
4. Store listing: ikki til matnlari, screenshotlar, feature graphic, icon
5. App content: Privacy policy URL, Data safety (`DATA_SAFETY.txt`), Content rating, Target audience, Ads = No, **App access (demo kirish)**
6. Review → Start rollout

## 4. Release'dan oldin tekshiruv
- [ ] CI yashil (backend testlari, alembic check, flutter analyze/test), PR `main`ga merge qilingan va backend deploy bo‘lgan (`alembic upgrade head`)
- [ ] Superadmin → Ilova versiyasi: `min_version_code` = 0; yangi build Play'da tasdiqlangach `latest_version_code` = 2
- [ ] versionCode oldingisidan katta
- [ ] Demo kirish yoqilgan (review uchun) va review tugagach o‘chiriladi
- [ ] Support email/telefon Console'dagi "Contact details"da to‘ldirilgan
- [ ] Screenshotlardagi ma’lumotlar (ism, telefon, buyurtmalar) namunaviy — real mijoz ma’lumoti emas
