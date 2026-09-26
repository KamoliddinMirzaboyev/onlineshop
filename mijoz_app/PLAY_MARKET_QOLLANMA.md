# Mijoz Ilovasini Google Play Marketga Chiqarish Bo'yicha To'liq Qo'llanma

Ushbu qo'llanma **Barakali Bozor (`uz.barakalibozor.mijoz`)** mijoz ilovasini Google Play Console orqali Play Marketga muvaffaqiyatli chiqarish uchun bosqichma-bosqich yo'riqnomadir.

---

## 1. Asosiy Talablar va Ma'lumotlar

| Parametr | Qiymat |
| :--- | :--- |
| **Ilova nomi** | Barakali Bozor |
| **Package name (Application ID)** | `uz.barakalibozor.mijoz` |
| **Target SDK** | Android 14/15 (API 34+) |
| **Min SDK** | Android 5.0 (API 21) |
| **16 KB Page Size** | Qo'llab-quvvatlanadi (`useLegacyPackaging = false`) |
| **Maxfiylik siyosati (Privacy Policy URL)** | `https://www.barakali-bozor.uz/privacy` |
| **Akkaunt o'chirish (Account Deletion URL)** | `https://www.barakali-bozor.uz/account-deletion` |

---

## 2. Release Keystore Yaratish va Sozlash

Google Play'ga yuklanadigan ilova (`.aab`) rasmiy raqamli kalit bilan imzolanishi shart.

### 2.1. Yangi Keystore yaratish
Terminalda quyidagi buyruqni bajaring (parollarni eslab qoling!):
```bash
keytool -genkey -v -keystore ~/upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias upload
```
*Sizdan ism, tashkilot va parol so'raladi. Parolni albatta xavfsiz joyda saqlang.*

### 2.2. `key.properties` faylini yaratish
`mijoz_app/android/key.properties.example` dan nusxa olib, `android/key.properties` yarating:
```bash
cp mijoz_app/android/key.properties.example mijoz_app/android/key.properties
```

Ichiga o'zingiz kiritgan ma'lumotlarni yozing:
```properties
storePassword=SIZNING_KEYSTORE_PAROLINGIZ
keyPassword=SIZNING_KEY_PAROLINGIZ
keyAlias=upload
storeFile=/Users/kamoliddin/upload-keystore.jks
```
*(Eslatma: `key.properties` va `.jks` fayllari `.gitignore` ga kiritilgan, git'ga tushmaydi).*

---

## 3. Firebase (`google-services.json`) Faylini Olish

Push bildirishnomalar (FCM) va Crashlytics ishlashi uchun:
1. [Firebase Console](https://console.firebase.google.com/) ga kiring.
2. Barakali Bozor loyihangizni oching.
3. Yangi Android ilova qo'shing:
   - Package name: `uz.barakalibozor.mijoz`
   - App nickname: `Barakali Bozor Mijoz`
   - SHA-1 barmoq izi (yuqoridagi keystore'dan: `keytool -list -v -keystore ~/upload-keystore.jks`).
4. **`google-services.json`** faylini yuklab oling.
5. Ushbu faylni quyidagi manzilga joylashtiring:
   ```
   mijoz_app/android/app/google-services.json
   ```

---

## 4. Production App Bundle (.aab) Qurish

Terminalda quyidagi buyruqlarni bajaring:

```bash
cd mijoz_app

# Keshni tozalash va kutubxonalarni yangilash
flutter clean
flutter pub get

# Production release AAB faylini yaratish
flutter build appbundle --release
```

Tayyor bo'lgan fayl manzili:
```
mijoz_app/build/app/outputs/bundle/release/app-release.aab
```
Aynan shu `.aab` fayli Google Play Console'ga yuklanadi.

---

## 5. Google Play Console Ma'lumotlarini To'ldirish

Play Console'da yangi ilova yaratayotganda quyidagi bo'limlarni to'ldiring:

### 5.1. Do'kon sahifasi grafikalari (Store Listing)
- **App Icon (Piktogramma):** 512x512 px PNG. Loyihada tayyor:
  `mijoz_app/assets/icon/icon_store_512.png`
- **Feature Graphic (Banner):** 1024x500 px JPEG/PNG.
- **Skrinshotlar:** Kamida 4 dona telefon skrinshoti (masalan: Asosiy sahifa, Kategoriya/mahsulotlar, Savatcha, Buyurtma kuzatuvi).

### 5.2. Data Safety (Ma'lumotlar xavfsizligi deklaratsiyasi)
Google Play quyidagi ma'lumotlar qanday ishlatilishini so'raydi:
1. **Location (Joylashuv):**
   - *Turi:* Approximate location & Precise location.
   - *Maqsad:* App functionality (Mijozga eng yaqin filialni aniqlash va yetkazib berish vaqtini hisoblash).
2. **Personal info (Shaxsiy ma'lumotlar):**
   - *Turi:* Ism va Telefon raqami.
   - *Maqsad:* App functionality & Account management (Buyurtmani rasmiylashtirish va kuryer bilan aloqa).
3. **Device or other IDs:**
   - *Turi:* FCM Push Token.
   - *Maqsad:* App functionality (Buyurtma holati haqida xabar berish).

### 5.3. Akkauntni o'chirish (Account Deletion Requirement)
Google Play Store talabiga ko'ra:
- Ilova ichida: Profil -> "Hisobni o'chirish" tugmasi mavjud.
- Web havola talab qilinganda: `https://www.barakali-bozor.uz/account-deletion` ko'rsatiladi.

### 5.4. Versiya oshirish tartibi (Keyingi yangilanishlar uchun)
Har safar yangi versiya chiqarganingizda `mijoz_app/pubspec.yaml` dagi versiya raqamini oshiring:
```yaml
# 1.0.0+1 -> 1.0.1+2
version: 1.0.1+2
```
va qaytadan `flutter build appbundle --release` qiling.
