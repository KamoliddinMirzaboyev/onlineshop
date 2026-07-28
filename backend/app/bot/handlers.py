from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import (
    CallbackQuery, Contact, InlineKeyboardButton, InlineKeyboardMarkup,
    KeyboardButton, Message, ReplyKeyboardMarkup, ReplyKeyboardRemove, WebAppInfo,
)

from app.bot import repo
from app.bot.i18n import TEXTS, t
from app.core.config import settings
from app.services.notify import notify_location_update

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
    await message.answer(t("uz", "lang_choose"), reply_markup=lang_kb())


@router.callback_query(F.data.startswith("setlang:"))
async def cb_setlang(cb: CallbackQuery) -> None:
    lang = cb.data.split(":")[1]
    repo.set_lang(cb.from_user.id, lang)
    await cb.message.answer(t(lang, "lang_set"), reply_markup=main_menu(lang))
    await cb.answer()


@router.message(F.text.in_(_btn_texts("lang")))
async def on_lang_btn(message: Message) -> None:
    await message.answer(t("uz", "lang_choose"), reply_markup=lang_kb())


# Eski klaviaturadagi «Profilim» tugmasi — olib tashlangan; menyuni yangilaymiz.
_OLD_PROFILE = {"👤 Profilim", "👤 Мой профиль"}


@router.message(F.text.in_(_OLD_PROFILE))
async def on_old_profile_btn(message: Message) -> None:
    user = repo.get_or_create_user(message.from_user.id, message.from_user.first_name, message.from_user.username)
    await message.answer(
        t(user.language, "start", name=user.first_name or ""),
        reply_markup=main_menu(user.language),
    )


@router.message(F.text.in_(_btn_texts("help")))
async def on_help_btn(message: Message) -> None:
    user = repo.get_or_create_user(message.from_user.id, message.from_user.first_name, message.from_user.username)
    await message.answer(t(user.language, "help_text"), parse_mode="HTML")


@router.message(F.text.in_(_btn_texts("offer")))
async def on_offer_btn(message: Message) -> None:
    user = repo.get_or_create_user(message.from_user.id, message.from_user.first_name, message.from_user.username)
    # Oferta uzun — HTML parse_mode bilan yuboriladi.
    await message.answer(t(user.language, "offer_text"), parse_mode="HTML")


@router.message(F.text.in_(_btn_texts("open_app")))
async def on_open_app_btn(message: Message) -> None:
    user = repo.get_or_create_user(message.from_user.id, message.from_user.first_name, message.from_user.username)
    await message.answer(t(user.language, "start_shopping_prompt"), reply_markup=start_shopping_kb(user.language))


@router.message(F.text.in_(_btn_texts("orders")))
async def on_orders_btn(message: Message) -> None:
    user = repo.get_or_create_user(message.from_user.id, message.from_user.first_name, message.from_user.username)
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
    user = repo.get_or_create_user(message.from_user.id, message.from_user.first_name, message.from_user.username)
    kb = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=t(user.language, "send_phone"), request_contact=True)]],
        resize_keyboard=True, one_time_keyboard=True,
    )
    await message.answer(t(user.language, "phone_ask"), reply_markup=kb)


@router.message(F.contact)
async def on_contact(message: Message) -> None:
    contact: Contact = message.contact
    if contact.user_id == message.from_user.id:
        repo.set_phone(message.from_user.id, contact.phone_number)
        user = repo.get_or_create_user(message.from_user.id, message.from_user.first_name, message.from_user.username)
        await message.answer(t(user.language, "phone_saved"), reply_markup=main_menu(user.language))


@router.message(F.location)
async def on_location(message: Message) -> None:
    user = repo.get_or_create_user(message.from_user.id, message.from_user.first_name, message.from_user.username)
    order = repo.get_latest_pending_order(message.from_user.id)
    if not order:
        await message.answer(t(user.language, "no_pending_order"), reply_markup=ReplyKeyboardRemove())
        return
    lat = message.location.latitude
    lng = message.location.longitude
    repo.set_order_location(order.id, lat, lng)
    await message.answer(
        t(user.language, "location_saved", number=order.number),
        reply_markup=ReplyKeyboardRemove(),
    )
    notify_location_update(order.number, lat, lng)
