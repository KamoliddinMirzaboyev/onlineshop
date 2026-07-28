"""Minimal bot i18n. Frontends carry their own translations."""

from app.bot.offer_text import SUPPORT_HANDLE, offer_for

SUPPORT_USERNAME = "MrMirzaboyev"

TEXTS = {
    "uz": {
        "start": (
            "👋 Assalomu alaykum, {name}!\n\n"
            "<b>Barakali Bozor</b> — eng mazali taomlar bir joyda.\n"
            "Biz vaqtingizni, asablaringizni va pulingizni tejaymiz.\n\n"
            "Buyurtma berish orqali siz <b>ommaviy oferta</b> shartlariga rozilik bildirasiz.\n"
            "Ism, telefon va manzilni <b>to'g'ri</b> kiriting.\n\n"
            "Buyurtma berish uchun pastdagi tugmani bosing 👇"
        ),
        "open_app": "🍽 Ilovani ochish",
        "start_shopping": "🛒 Xaridni boshlash",
        "start_shopping_prompt": (
            "Xarid qilishni boshlash uchun tugmani bosing 👇\n\n"
            "📍 Joylashuvingiz (lokatsiya) yoqiqligiga ishonch hosil qiling — "
            "yaqin do'kon va yetkazish shu orqali aniqlanadi."
        ),
        "menu": "📋 Menyu",
        "orders": "🧾 Buyurtmalarim",
        "lang": "🌐 Til / Язык",
        "help": "ℹ️ Yordam",
        "offer": "📄 Ommaviy oferta",
        "phone_ask": "📱 Telefon raqamingizni yuboring",
        "send_phone": "📱 Raqamni yuborish",
        "phone_saved": "✅ Raqamingiz saqlandi.",
        "lang_choose": "Tilni tanlang / Выберите язык:",
        "lang_set": "✅ Til o'zbekchaga o'rnatildi.",
        "help_text": (
            "ℹ️ <b>Yordam va qo'llab-quvvatlash</b>\n\n"
            f"Savollar, buyurtma holati yoki shikoyatlar bo'yicha yozing:\n"
            f"👉 {SUPPORT_HANDLE}\n\n"
            "Iltimos, xabaringizda buyurtma raqami (bo'lsa) va qisqa tushuntirishni yozing.\n"
            "Ish vaqti: 09:00–22:00 (Toshkent).\n\n"
            "📄 To'liq shartlar — «Ommaviy oferta» tugmasi."
        ),
        "ask_name": (
            "✍️ Ism va familiyangizni yuboring\n"
            "(masalan: Ali Valiyev)\n\n"
            "⚠️ Ism to'g'ri yozilishi kerak — yetkazish va bog'lanish uchun."
        ),
        "onboard_done": (
            "✅ Tayyor, {name}! Ro'yxatdan o'tdingiz.\n\n"
            "Xizmatdan foydalanish orqali siz ommaviy oferta shartlariga rozilik bildirasiz.\n"
            "Buyurtmada ism, telefon va manzilni to'g'ri kiriting.\n\n"
            "Buyurtma berish uchun ilovani oching 👇"
        ),
        "phone_own": "❗️ Iltimos, o'zingizning raqamingizni yuboring.",
        "location_saved": "✅ Joylashuvingiz qabul qilindi.\nBuyurtma №{number} yetkaziladi.",
        "no_pending_order": "Faol buyurtma topilmadi.",
        "blocked": f"⛔️ Akkauntingiz bloklangan.\nQo'llab-quvvatlash: {SUPPORT_HANDLE}",
        "offer_chunk": "📄 Ommaviy oferta ({n}/{total})",
    },
    "ru": {
        "start": (
            "👋 Здравствуйте, {name}!\n\n"
            "<b>Barakali Bozor</b> — самые вкусные блюда в одном месте.\n"
            "Мы экономим ваше время, нервы и деньги.\n\n"
            "Оформляя заказ, вы принимаете условия <b>публичной оферты</b>.\n"
            "Указывайте <b>верные</b> имя, телефон и адрес.\n\n"
            "Нажмите кнопку ниже, чтобы заказать 👇"
        ),
        "open_app": "🍽 Открыть приложение",
        "start_shopping": "🛒 Начать покупки",
        "start_shopping_prompt": (
            "Нажмите кнопку, чтобы начать покупки 👇\n\n"
            "📍 Убедитесь, что геолокация (локация) включена — "
            "ближайший магазин и доставка определяются по ней."
        ),
        "menu": "📋 Меню",
        "orders": "🧾 Мои заказы",
        "lang": "🌐 Til / Язык",
        "help": "ℹ️ Помощь",
        "offer": "📄 Публичная оферта",
        "phone_ask": "📱 Отправьте ваш номер телефона",
        "send_phone": "📱 Отправить номер",
        "phone_saved": "✅ Ваш номер сохранён.",
        "lang_choose": "Tilni tanlang / Выберите язык:",
        "lang_set": "✅ Язык установлен на русский.",
        "help_text": (
            "ℹ️ <b>Помощь и поддержка</b>\n\n"
            f"По вопросам, статусу заказа или жалобам пишите:\n"
            f"👉 {SUPPORT_HANDLE}\n\n"
            "Укажите номер заказа (если есть) и краткое описание.\n"
            "Время работы: 09:00–22:00 (Ташкент).\n\n"
            "📄 Полные условия — кнопка «Публичная оферта»."
        ),
        "ask_name": (
            "✍️ Отправьте ваше имя и фамилию\n"
            "(например: Али Валиев)\n\n"
            "⚠️ Имя должно быть указано верно — для доставки и связи."
        ),
        "onboard_done": (
            "✅ Готово, {name}! Вы зарегистрированы.\n\n"
            "Пользуясь сервисом, вы принимаете условия публичной оферты.\n"
            "В заказе указывайте верные имя, телефон и адрес.\n\n"
            "Откройте приложение, чтобы сделать заказ 👇"
        ),
        "phone_own": "❗️ Пожалуйста, отправьте свой собственный номер.",
        "location_saved": "✅ Геолокация принята.\nЗаказ №{number} будет доставлен.",
        "no_pending_order": "Активный заказ не найден.",
        "blocked": f"⛔️ Ваш аккаунт заблокирован.\nПоддержка: {SUPPORT_HANDLE}",
        "offer_chunk": "📄 Публичная оферта ({n}/{total})",
    },
}


def t(lang: str, key: str, **kwargs) -> str:
    if key == "offer_text":
        return offer_for(lang if lang in TEXTS else "uz")
    lang = lang if lang in TEXTS else "uz"
    text = TEXTS[lang].get(key, TEXTS["uz"].get(key, key))
    return text.format(**kwargs) if kwargs else text


def split_telegram_html(text: str, limit: int = 3500) -> list[str]:
    """Uzun HTML matnni Telegram limitidan kichik bo'laklarga bo'ladi."""
    if len(text) <= limit:
        return [text]
    parts: list[str] = []
    rest = text
    while rest:
        if len(rest) <= limit:
            parts.append(rest)
            break
        cut = rest.rfind("\n\n", 0, limit)
        if cut < limit // 3:
            cut = rest.rfind("\n", 0, limit)
        if cut < limit // 3:
            cut = limit
        parts.append(rest[:cut].rstrip())
        rest = rest[cut:].lstrip()
    return parts
