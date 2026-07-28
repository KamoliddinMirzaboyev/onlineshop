"""Minimal bot i18n. Frontends carry their own translations."""

TEXTS = {
    "uz": {
        "start": (
            "👋 Assalomu alaykum, {name}!\n\n"
            "<b>Barakali Bozor</b> — eng mazali taomlar bir joyda.\n"
            "Biz vaqtingizni, asablaringizni va pulingizni tejaymiz.\n\n"
            "Buyurtma berish uchun pastdagi tugmani bosing 👇"
        ),
        "open_app": "🍽 Ilovani ochish",
        "start_shopping": "🛒 Xaridni boshlash",
        "start_shopping_prompt": "Xarid qilishni boshlash uchun tugmani bosing 👇",
        "menu": "📋 Menyu",
        "orders": "🧾 Buyurtmalarim",
        "profile": "👤 Profilim",
        "lang": "🌐 Til / Язык",
        "help": "ℹ️ Yordam",
        "phone_ask": "📱 Telefon raqamingizni yuboring",
        "send_phone": "📱 Raqamni yuborish",
        "phone_saved": "✅ Raqamingiz saqlandi.",
        "lang_choose": "Tilni tanlang / Выберите язык:",
        "lang_set": "✅ Til o'zbekchaga o'rnatildi.",
        "help_text": "Savollar bo'lsa @allfoods_support ga yozing.",
        "ask_name": "✍️ Ism va familiyangizni yuboring\n(masalan: Ali Valiyev)",
        "onboard_done": "✅ Tayyor, {name}! Ro'yxatdan o'tdingiz.\n\nBuyurtma berish uchun ilovani oching 👇",
        "phone_own": "❗️ Iltimos, o'zingizning raqamingizni yuboring.",
        "location_saved": "✅ Joylashuvingiz qabul qilindi.\nBuyurtma №{number} yetkaziladi.",
        "no_pending_order": "Faol buyurtma topilmadi.",
    },
    "ru": {
        "start": (
            "👋 Здравствуйте, {name}!\n\n"
            "<b>Barakali Bozor</b> — самые вкусные блюда в одном месте.\n"
            "Мы экономим ваше время, нервы и деньги.\n\n"
            "Нажмите кнопку ниже, чтобы заказать 👇"
        ),
        "open_app": "🍽 Открыть приложение",
        "start_shopping": "🛒 Начать покупки",
        "start_shopping_prompt": "Нажмите кнопку, чтобы начать покупки 👇",
        "menu": "📋 Меню",
        "orders": "🧾 Мои заказы",
        "profile": "👤 Мой профиль",
        "lang": "🌐 Til / Язык",
        "help": "ℹ️ Помощь",
        "phone_ask": "📱 Отправьте ваш номер телефона",
        "send_phone": "📱 Отправить номер",
        "phone_saved": "✅ Ваш номер сохранён.",
        "lang_choose": "Tilni tanlang / Выберите язык:",
        "lang_set": "✅ Язык установлен на русский.",
        "help_text": "По вопросам пишите @allfoods_support.",
        "ask_name": "✍️ Отправьте ваше имя и фамилию\n(например: Али Валиев)",
        "onboard_done": "✅ Готово, {name}! Вы зарегистрированы.\n\nОткройте приложение, чтобы сделать заказ 👇",
        "phone_own": "❗️ Пожалуйста, отправьте свой собственный номер.",
        "location_saved": "✅ Геолокация принята.\nЗаказ №{number} будет доставлен.",
        "no_pending_order": "Активный заказ не найден.",
    },
}


def t(lang: str, key: str, **kwargs) -> str:
    lang = lang if lang in TEXTS else "uz"
    text = TEXTS[lang].get(key, TEXTS["uz"].get(key, key))
    return text.format(**kwargs) if kwargs else text
