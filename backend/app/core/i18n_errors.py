"""Mijozga ko'rinadigan API xato xabarlarini `Accept-Language` bo'yicha tarjima qilish.

Route/servislardagi `HTTPException` matnlari o'zgarishsiz qoladi (testlar, admin
panellar shunga tayanadi). Mobil ilova `Accept-Language: uz|ru` yuborsa, global
handler (`app.main`) xabarni shu yerdagi katalog bo'yicha almashtiradi.
Katalogda yo'q matn — o'zgarishsiz qaytadi.
"""
from __future__ import annotations

import re

SUPPORTED = ("uz", "ru")

# manba matn -> (uz, ru)
_EXACT: dict[str, tuple[str, str]] = {
    # ── Auth / sessiya ──
    "Missing bearer token": ("Avval tizimga kiring", "Сначала войдите в систему"),
    "Invalid token": ("Sessiya yaroqsiz. Qayta kiring", "Сессия недействительна. Войдите заново"),
    "Token bekor qilingan": ("Sessiya tugagan. Qayta kiring", "Сессия завершена. Войдите заново"),
    "User not found": ("Foydalanuvchi topilmadi", "Пользователь не найден"),
    "Akkauntingiz bloklangan": ("Akkauntingiz bloklangan", "Ваш аккаунт заблокирован"),
    "Invalid initData": ("Telegram orqali kirish tasdiqlanmadi", "Не удалось подтвердить вход через Telegram"),
    "SMS yuborib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.": (
        "SMS yuborib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.",
        "Не удалось отправить SMS. Попробуйте чуть позже.",
    ),
    "Kod noto'g'ri": ("Kod noto'g'ri", "Неверный код"),
    "Kod noto'g'ri yoki muddati o'tgan": ("Kod noto'g'ri yoki muddati o'tgan", "Неверный код или срок его действия истёк"),
    "Refresh token bekor qilingan": ("Sessiya tugagan. Qayta kiring", "Сессия завершена. Войдите заново"),
    "Yaroqsiz yoki muddati o'tgan refresh token": ("Sessiya tugagan. Qayta kiring", "Сессия завершена. Войдите заново"),
    "Yaroqsiz token subyekti": ("Sessiya yaroqsiz. Qayta kiring", "Сессия недействительна. Войдите заново"),
    "Foydalanuvchi topilmadi yoki bloklangan": ("Foydalanuvchi topilmadi yoki bloklangan", "Пользователь не найден или заблокирован"),
    "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring.": (
        "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring.",
        "Слишком много попыток. Попробуйте чуть позже.",
    ),
    # ── Profil ──
    "Telefon raqami noto'g'ri": ("Telefon raqami noto'g'ri", "Неверный номер телефона"),
    "Bu telefon allaqachon band": ("Bu telefon raqam allaqachon band", "Этот номер телефона уже занят"),
    "Bu telefon raqam allaqachon band": ("Bu telefon raqam allaqachon band", "Этот номер телефона уже занят"),
    "Faol buyurtmalaringiz mavjud. Avval buyurtma yakunlanishi kerak.": (
        "Faol buyurtmalaringiz mavjud. Avval buyurtma yakunlanishi kerak.",
        "У вас есть активные заказы. Дождитесь их завершения.",
    ),
    # ── Katalog / manzil ──
    "No store": ("Do'kon topilmadi", "Магазин не найден"),
    "No active stores found": ("Faol do'kon topilmadi", "Активных магазинов не найдено"),
    "Restaurant not found": ("Do'kon topilmadi", "Магазин не найден"),
    "Do'kon topilmadi": ("Do'kon topilmadi", "Магазин не найден"),
    "Address not found": ("Manzil topilmadi", "Адрес не найден"),
    "Manzil aniqlanmadi": ("Manzil aniqlanmadi", "Не удалось определить адрес"),
    # ── Yuklash ──
    "Faqat rasm fayllari (jpg, png, webp, gif)": ("Faqat rasm fayllari (jpg, png, webp, gif)", "Только изображения (jpg, png, webp, gif)"),
    "Fayl 8 MB dan katta": ("Fayl 8 MB dan katta", "Файл больше 8 МБ"),
    "Fayl bo'sh": ("Fayl bo'sh", "Файл пустой"),
    "Fayl haqiqiy rasm emas": ("Fayl haqiqiy rasm emas", "Файл не является изображением"),
    "Rasm o'qib bo'lmadi": ("Rasm o'qib bo'lmadi", "Не удалось прочитать изображение"),
    # ── Buyurtma ──
    "Order not found": ("Buyurtma topilmadi", "Заказ не найден"),
    "Kuryerga biriktirilgan buyurtmani faqat do'kon bekor qila oladi": (
        "Buyurtma qabul qilingan — uni faqat do'kon bekor qila oladi",
        "Заказ уже принят — отменить его может только магазин",
    ),
    "Buyurtmani bekor qilib bo'lmadi (holat o'zgargan)": (
        "Buyurtmani bekor qilib bo'lmadi — holati o'zgargan",
        "Не удалось отменить заказ — его статус изменился",
    ),
    "Buyurtma allaqachon tasdiqlangan — endi tahrirlab bo'lmaydi": (
        "Buyurtma allaqachon tasdiqlangan — endi tahrirlab bo'lmaydi",
        "Заказ уже подтверждён — изменить его нельзя",
    ),
    "Hozircha faqat naqd to'lov (cash) qabul qilinadi": (
        "Hozircha faqat naqd to'lov qabul qilinadi",
        "Пока принимается только оплата наличными",
    ),
    "Restaurant is closed": ("Do'kon hozir yopiq", "Магазин сейчас закрыт"),
    "Cart is empty": ("Savat bo'sh", "Корзина пуста"),
    "Yetkazib berish uchun joylashuvni yuboring": ("Yetkazib berish uchun joylashuvni yuboring", "Укажите местоположение для доставки"),
    "Telefon raqami majburiy": ("Telefon raqami majburiy", "Номер телефона обязателен"),
    "Kechirasiz, hozircha sizning hududingizga xizmat ko'rsata olmaymiz": (
        "Kechirasiz, hozircha sizning hududingizga xizmat ko'rsata olmaymiz",
        "К сожалению, в вашем районе доставка пока недоступна",
    ),
    "Could not generate order number": (
        "Buyurtma raqamini yaratib bo'lmadi. Qayta urinib ko'ring",
        "Не удалось создать номер заказа. Попробуйте ещё раз",
    ),
    "Miqdor manfiy bo'lishi mumkin emas": ("Miqdor manfiy bo'lishi mumkin emas", "Количество не может быть отрицательным"),
    "Buyurtmada kamida bitta mahsulot qolishi kerak": (
        "Buyurtmada kamida bitta mahsulot qolishi kerak",
        "В заказе должен остаться хотя бы один товар",
    ),
}

# Dinamik qismli xabarlar: (regex, uz shablon, ru shablon)
_PATTERNS: list[tuple[re.Pattern[str], str, str]] = [
    (
        re.compile(r"^'(?P<name>.+)' uchun ombor yetarli emas \(qoldiq: (?P<left>.+)\)$"),
        "«{name}» omborda yetarli emas (qoldiq: {left})",
        "Товара «{name}» недостаточно на складе (остаток: {left})",
    ),
    (
        re.compile(r"^'(?P<name>.+)' hozir sotuvda yo'q — savatdan olib tashlang$"),
        "«{name}» hozir sotuvda yo'q — savatdan olib tashlang",
        "«{name}» сейчас нет в продаже — удалите из корзины",
    ),
    (
        re.compile(r"^'(?P<name>.+)' hozir sotuvda yo'q$"),
        "«{name}» hozir sotuvda yo'q",
        "«{name}» сейчас нет в продаже",
    ),
    (
        re.compile(r"^'(?P<name>.+)' hozir mavjud emas$"),
        "«{name}» hozir mavjud emas",
        "«{name}» сейчас недоступен",
    ),
]

# Pydantic (422) uchun umumiy xabar — inglizcha texnik matn o'rniga.
VALIDATION_MSG = {
    "uz": "Ma'lumotlar noto'g'ri kiritilgan. Tekshirib, qayta urinib ko'ring",
    "ru": "Данные введены неверно. Проверьте и попробуйте снова",
}


def pick_lang(accept_language: str | None) -> str | None:
    """`Accept-Language` dagi birinchi qo'llab-quvvatlanadigan til; header yo'q bo'lsa None."""
    if not accept_language:
        return None
    for part in accept_language.split(","):
        code = part.split(";")[0].strip().lower()[:2]
        if code in SUPPORTED:
            return code
    return None


def translate(message: str, lang: str | None) -> str:
    if lang not in SUPPORTED:
        return message
    idx = 0 if lang == "uz" else 1
    hit = _EXACT.get(message)
    if hit:
        return hit[idx]
    for rx, uz_tpl, ru_tpl in _PATTERNS:
        m = rx.match(message)
        if m:
            return (uz_tpl, ru_tpl)[idx].format(**m.groupdict())
    return message
