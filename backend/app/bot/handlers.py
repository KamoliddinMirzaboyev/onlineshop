import asyncio
import logging

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramAPIError
from aiogram.filters import Command
from aiogram.types import (
    CallbackQuery, Contact, InlineKeyboardButton, InlineKeyboardMarkup,
    KeyboardButton, MenuButtonCommands, MenuButtonWebApp, Message, ReplyKeyboardMarkup,
    ReplyKeyboardRemove, WebAppInfo,
)
from aiogram.types import User as TgUser

from app.bot import arepo, repo
from app.bot.i18n import TEXTS, split_telegram_html, t
from app.core.config import settings
from app.models import User
from app.services import otp as otp_service
from app.services.notify import notify_location_update
from app.services.orders import refine_order_address

router = Router()


def main_menu(lang: str) -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=t(lang, "open_app"))],
            [KeyboardButton(text=t(lang, "orders"))],
            [
                KeyboardButton(text=t(lang, "lang")),
                KeyboardButton(text=t(lang, "help")),
            ],
            [KeyboardButton(text=t(lang, "contact_order"))],
            [KeyboardButton(text=t(lang, "offer"))],
        ],
        resize_keyboard=True,
    )


def _btn_texts(key: str) -> set[str]:
    """All localized variants of a menu button label, for reply-keyboard text matching."""
    return {TEXTS[l][key] for l in TEXTS if key in TEXTS[l]}


def start_shopping_kb(lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(
            text=t(lang, "start_shopping"),
            web_app=WebAppInfo(url=settings.tma_url),
        )]]
    )


async def show_shop_button(bot: Bot | None, chat_id: int) -> None:
    """"Sotib olish" menyu tugmasi — faqat shu chatga (onboarding'dan o'tganlar)."""
    if bot is None:
        return
    try:
        await bot.set_chat_menu_button(
            chat_id=chat_id,
            menu_button=MenuButtonWebApp(text="Sotib olish", web_app=WebAppInfo(url=settings.tma_url)),
        )
    except TelegramAPIError as e:
        logging.warning("menu button (chat %s) qo'yilmadi: %s", chat_id, e)


async def hide_shop_button(bot: Bot | None, chat_id: int) -> None:
    """"Sotib olish" menyu tugmasini tozalaydi — ro'yxatdan o'tmaganlarga Mini App ko'rinmasin."""
    if bot is None:
        return
    try:
        await bot.set_chat_menu_button(
            chat_id=chat_id,
            menu_button=MenuButtonCommands(),
        )
    except TelegramAPIError as e:
        logging.warning("menu button tozalash (chat %s) xato: %s", chat_id, e)


async def _require_onboarded(message: Message, tg: TgUser) -> User | None:
    """Onboarding'dan o'tmagan bo'lsa /start'ga yo'naltiradi va None qaytaradi."""
    user = await arepo.get_or_create_user(tg.id, tg.first_name, tg.username)
    if not repo.is_onboarded(user):
        await hide_shop_button(message.bot, message.chat.id)
        await message.answer(t(user.language, "need_onboarding"), reply_markup=ReplyKeyboardRemove())
        return None
    return user


def lang_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="🇺🇿 O'zbek", callback_data="setlang:uz"),
                InlineKeyboardButton(text="🇷🇺 Русский", callback_data="setlang:ru"),
            ]
        ]
    )


@router.message(Command("language"))
async def cmd_language(message: Message) -> None:
    if not message.from_user: return
    await message.answer(t("uz", "lang_choose"), reply_markup=lang_kb())


@router.message(Command("login", "code"))
async def cmd_login(message: Message) -> None:
    if not message.from_user: return
    user = await arepo.get_or_create_user(message.from_user.id, message.from_user.first_name, message.from_user.username)
    if getattr(user, "is_blocked", False):
        await message.answer(t(user.language or "uz", "blocked"))
        return
    if not user.phone:
        await message.answer(
            "📱 <b>Barakali Bozor ilovasi uchun kod olish</b>\n\n"
            "Iltimos, avval botda ro'yxatdan o'ting: /start bosing.",
            reply_markup=ReplyKeyboardRemove(),
        )
        return
    code = otp_service.create_telegram_login_code(
        user.phone,
        message.from_user.id,
        user.first_name,
        user.last_name,
    )
    await message.answer(
        f"🔐 <b>Barakali Bozor ilovasi uchun kirish kodingiz:</b>\n\n"
        f"<code>{code}</code>\n\n"
        f"<i>Ushbu 6 xonali kodni mobil ilovaga kiriting. Kod 5 daqiqa davomida amal qiladi.</i>\n\n"
        f"Yangi kod olish uchun /login bosing.",
    )


@router.callback_query(F.data.startswith("setlang:"))
async def cb_setlang(cb: CallbackQuery) -> None:
    if not cb.data or not cb.message or not cb.from_user: return
    from aiogram.types import Message
    if not isinstance(cb.message, Message): return
    lang = cb.data.split(":")[1]
    await arepo.set_lang(cb.from_user.id, lang)
    await cb.message.answer(t(lang, "lang_set"), reply_markup=main_menu(lang))
    await cb.answer()


@router.message(F.text.in_(_btn_texts("lang")))
async def on_lang_btn(message: Message) -> None:
    if not message.from_user: return
    await message.answer(t("uz", "lang_choose"), reply_markup=lang_kb())


# Eski klaviaturadagi «Profilim» tugmasi — olib tashlangan; menyuni yangilaymiz.
_OLD_PROFILE = {"👤 Profilim", "👤 Мой профиль"}


@router.message(F.text.in_(_OLD_PROFILE))
async def on_old_profile_btn(message: Message) -> None:
    if not message.from_user: return
    user = await arepo.get_or_create_user(message.from_user.id, message.from_user.first_name, message.from_user.username)
    await message.answer(
        t(user.language, "start", name=user.first_name or ""),
        reply_markup=main_menu(user.language),
    )


@router.message(F.text.in_(_btn_texts("help")))
async def on_help_btn(message: Message) -> None:
    if not message.from_user: return
    user = await arepo.get_or_create_user(message.from_user.id, message.from_user.first_name, message.from_user.username)
    await message.answer(t(user.language, "help_text"), parse_mode="HTML")


@router.message(F.text.in_(_btn_texts("contact_order")))
async def on_contact_order_btn(message: Message) -> None:
    if not message.from_user: return
    user = await arepo.get_or_create_user(message.from_user.id, message.from_user.first_name, message.from_user.username)
    restaurant = await arepo.get_contact_restaurant()
    if not restaurant:
        await message.answer(t(user.language, "contact_none_set"))
        return
    phones = (restaurant.phones or [])[:2]
    telegram = (restaurant.socials or {}).get("telegram", "").lstrip("@")
    if not phones and not telegram:
        await message.answer(t(user.language, "contact_none_set"))
        return
    lines = [t(user.language, "contact_header")]
    lines.extend(f"📞 {p}" for p in phones)
    if telegram:
        lines.append(f"✈️ @{telegram}")
    await message.answer("\n".join(lines))


@router.message(F.text.in_(_btn_texts("offer")))
async def on_offer_btn(message: Message) -> None:
    if not message.from_user: return
    user = await arepo.get_or_create_user(message.from_user.id, message.from_user.first_name, message.from_user.username)
    chunks = split_telegram_html(t(user.language, "offer_text"))
    total = len(chunks)
    for i, chunk in enumerate(chunks, start=1):
        prefix = t(user.language, "offer_chunk", n=i, total=total) + "\n\n" if total > 1 else ""
        await message.answer(prefix + chunk)


@router.message(F.text.in_(_btn_texts("open_app")))
async def on_open_app_btn(message: Message) -> None:
    if not message.from_user: return
    user = await _require_onboarded(message, message.from_user)
    if user is None: return
    await message.answer(t(user.language, "start_shopping_prompt"), reply_markup=start_shopping_kb(user.language))


@router.message(F.text.in_(_btn_texts("orders")))
async def on_orders_btn(message: Message) -> None:
    if not message.from_user: return
    user = await _require_onboarded(message, message.from_user)
    if user is None: return
    # order history lives in the Mini App
    kb = InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(
            text=t(user.language, "open_app"),
            web_app=WebAppInfo(url=f"{settings.tma_url}/orders"),
        )]]
    )
    await message.answer(t(user.language, "orders"), reply_markup=kb)


@router.message(Command("phone"))
async def cmd_phone(message: Message) -> None:
    if not message.from_user: return
    user = await arepo.get_or_create_user(message.from_user.id, message.from_user.first_name, message.from_user.username)
    kb = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=t(user.language, "send_phone"), request_contact=True)]],
        resize_keyboard=True, one_time_keyboard=True,
    )
    await message.answer(t(user.language, "phone_ask"), reply_markup=kb)


@router.message(F.contact)
async def on_contact(message: Message) -> None:
    if not message.from_user: return
    if not message.contact: return
    contact = message.contact
    user = await arepo.get_or_create_user(
        message.from_user.id, message.from_user.first_name, message.from_user.username
    )
    if contact.user_id != message.from_user.id:
        await message.answer(t(user.language, "phone_own"))
        return
    ok = await arepo.set_phone(message.from_user.id, contact.phone_number)
    if not ok:
        await message.answer(t(user.language, "phone_taken"), reply_markup=main_menu(user.language))
        return
    user = await arepo.get_or_create_user(
        message.from_user.id, message.from_user.first_name, message.from_user.username
    )
    if repo.is_onboarded(user):
        await show_shop_button(message.bot, message.chat.id)
    await message.answer(t(user.language, "phone_saved"), reply_markup=main_menu(user.language))


@router.message(F.location)
async def on_location(message: Message) -> None:
    if not message.from_user: return
    user = await arepo.get_or_create_user(message.from_user.id, message.from_user.first_name, message.from_user.username)
    order = await arepo.get_latest_pending_order(message.from_user.id)
    if not order:
        await message.answer(t(user.language, "no_pending_order"), reply_markup=ReplyKeyboardRemove())
        return
    if not message.location: return
    lat = message.location.latitude
    lng = message.location.longitude
    ok, err = await arepo.set_order_location(order.id, lat, lng)
    # Aniq manzil (mahalla/ko'cha/uy) fonda yoziladi — javob kutib turmaydi.
    asyncio.create_task(asyncio.to_thread(refine_order_address, order.id))
    if not ok:
        await message.answer(t(user.language, "no_pending_order"), reply_markup=ReplyKeyboardRemove())
        return
    if err == "out_of_zone":
        await message.answer(
            t(user.language, "location_out_of_zone", number=order.number),
            reply_markup=ReplyKeyboardRemove(),
        )
    else:
        await message.answer(
            t(user.language, "location_saved", number=order.number),
            reply_markup=ReplyKeyboardRemove(),
        )
    notify_location_update(order.number, lat, lng)
