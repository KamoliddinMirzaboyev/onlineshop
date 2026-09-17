"""First-run onboarding: language -> phone -> full name, then the main menu.

Implemented as an aiogram FSM. Included BEFORE the main handlers router so
in-state messages (contact, name text, language pick) are captured here;
out-of-state messages fall through to app/bot/handlers.py.
"""

from aiogram import F, Router
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import Command, CommandObject, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    CallbackQuery, Contact, KeyboardButton, Message,
    ReplyKeyboardMarkup, ReplyKeyboardRemove,
)

from app.bot import arepo, repo
from app.bot.handlers import hide_shop_button, lang_kb, main_menu, show_shop_button, start_shopping_kb
from app.bot.i18n import t
from app.services import otp as otp_service

router = Router()


class Onboarding(StatesGroup):
    language = State()
    phone = State()
    name = State()
    login_phone = State()


def _phone_kb(lang: str) -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=t(lang, "send_phone"), request_contact=True)]],
        resize_keyboard=True,
        is_persistent=True,
    )


async def _delete(message: Message) -> None:
    """Delete a message, ignoring 'already gone / too old' errors."""
    try:
        await message.delete()
    except TelegramBadRequest:
        pass


async def _delete_id(bot, chat_id: int, message_id: int | None) -> None:
    if not message_id:
        return
    try:
        await bot.delete_message(chat_id, message_id)
    except TelegramBadRequest:
        pass


@router.message(Command("start"))
async def cmd_start(message: Message, command: CommandObject, state: FSMContext) -> None:
    if not message.from_user: return
    user = await arepo.get_or_create_user(
        message.from_user.id, message.from_user.first_name, message.from_user.username
    )
    if getattr(user, "is_blocked", False):
        await state.clear()
        await message.answer(t(user.language if getattr(user, "language", None) else "uz", "blocked"))
        return

    # Mobil ilovadan kod olish uchun kelgan bo'lsa (/start login yoki /start code)
    arg = (command.args or "").strip().lower()
    if arg in ("login", "code"):
        if user.phone:
            code = otp_service.create_telegram_login_code(
                user.phone,
                message.from_user.id,
                user.first_name,
                user.last_name,
            )
            await state.clear()
            await message.answer(
                f"🔐 <b>Barakali Bozor ilovasi uchun kirish kodingiz:</b>\n\n"
                f"<code>{code}</code>\n\n"
                f"<i>Ushbu 6 xonali kodni mobil ilovaga kiriting. Kod 5 daqiqa davomida amal qiladi.</i>\n\n"
                f"Yangi kod olish uchun /login bosing.",
                reply_markup=ReplyKeyboardRemove(),
            )
            return
        await hide_shop_button(message.bot, message.chat.id)
        await state.set_state(Onboarding.login_phone)
        await message.answer(
            "📱 <b>Barakali Bozor ilovasiga kirish uchun kodingizni olish</b>\n\n"
            "Iltimos, pastdagi «📱 Raqamni yuborish» tugmasini bosing 👇",
            reply_markup=_phone_kb(user.language or "uz"),
        )
        return

    if repo.is_onboarded(user):
        await state.clear()
        await show_shop_button(message.bot, message.chat.id)
        await message.answer(
            t(user.language, "start", name=user.first_name or ""),
            reply_markup=main_menu(user.language),
        )
        return

    # Ro'yxatdan o'tmagan: Mini App menyu tugmasi va eski klaviaturalar olib tashlanadi
    await hide_shop_button(message.bot, message.chat.id)
    await state.set_state(Onboarding.language)
    await message.answer("Barakali Bozor'ga xush kelibsiz!", reply_markup=ReplyKeyboardRemove())
    msg = await message.answer(t("uz", "lang_choose"), reply_markup=lang_kb())
    await state.update_data(prompt_id=msg.message_id)


@router.message(StateFilter(Onboarding.login_phone), F.contact)
async def onboard_login_phone(message: Message, state: FSMContext) -> None:
    if not message.from_user or not message.contact: return
    contact = message.contact
    if contact.user_id != message.from_user.id:
        user = await arepo.get_or_create_user(message.from_user.id, None, None)
        await message.answer(t(user.language or "uz", "phone_own"))
        return
    ok = await arepo.set_phone(message.from_user.id, contact.phone_number)
    user = await arepo.get_or_create_user(message.from_user.id, None, None)
    if not ok:
        await message.answer(t(user.language or "uz", "phone_taken"), reply_markup=_phone_kb(user.language or "uz"))
        return
    await state.clear()
    code = otp_service.create_telegram_login_code(
        contact.phone_number,
        message.from_user.id,
        user.first_name or message.from_user.first_name,
        user.last_name or message.from_user.last_name,
    )
    await message.answer(
        f"🔐 <b>Barakali Bozor ilovasi uchun kirish kodingiz:</b>\n\n"
        f"<code>{code}</code>\n\n"
        f"<i>Ushbu 6 xonali kodni mobil ilovaga kiriting. Kod 5 daqiqa davomida amal qiladi.</i>\n\n"
        f"Yangi kod olish uchun /login bosing.",
        reply_markup=ReplyKeyboardRemove(),
    )


@router.message(StateFilter(Onboarding.login_phone))
async def onboard_login_phone_hint(message: Message) -> None:
    if not message.from_user: return
    user = await arepo.get_or_create_user(message.from_user.id, None, None)
    await message.answer(
        "📱 Kod olish uchun pastdagi «📱 Raqamni yuborish» tugmasini bosing 👇",
        reply_markup=_phone_kb(user.language or "uz"),
    )


@router.callback_query(StateFilter(Onboarding.language), F.data.startswith("setlang:"))
async def onboard_lang(cb: CallbackQuery, state: FSMContext) -> None:
    if not cb.data or not cb.message or not cb.from_user: return
    if not isinstance(cb.message, Message): return
    lang = cb.data.split(":")[1]
    await arepo.set_lang(cb.from_user.id, lang)
    # the language prompt is the message this inline button is attached to
    await _delete(cb.message)
    await state.set_state(Onboarding.phone)
    msg = await cb.message.answer(t(lang, "phone_ask"), reply_markup=_phone_kb(lang))
    await state.update_data(prompt_id=msg.message_id)
    await cb.answer()


@router.message(StateFilter(Onboarding.phone), F.contact)
async def onboard_phone(message: Message, state: FSMContext) -> None:
    if not message.from_user or not message.contact: return
    contact = message.contact
    if contact.user_id != message.from_user.id:
        user = await arepo.get_or_create_user(message.from_user.id, None, None)
        await message.answer(t(user.language, "phone_own"))
        return
    ok = await arepo.set_phone(message.from_user.id, contact.phone_number)
    user = await arepo.get_or_create_user(message.from_user.id, None, None)
    if not ok:
        await message.answer(t(user.language, "phone_taken"), reply_markup=_phone_kb(user.language))
        return
    data = await state.get_data()
    await _delete_id(message.bot, message.chat.id, data.get("prompt_id"))  # phone prompt
    await _delete(message)  # user's shared contact
    await state.set_state(Onboarding.name)
    msg = await message.answer(t(user.language, "ask_name"), reply_markup=ReplyKeyboardRemove())
    await state.update_data(prompt_id=msg.message_id)


@router.message(StateFilter(Onboarding.phone))
async def onboard_phone_hint(message: Message, state: FSMContext) -> None:
    """Matn yoki boshqa xabar — raqam faqat tugma orqali qabul qilinadi (Telegram
    tasdiqlagan kontakt), shuni aniq tushuntiramiz."""
    if not message.from_user:
        return
    user = await arepo.get_or_create_user(message.from_user.id, None, None)
    await message.answer(t(user.language, "phone_use_button"), reply_markup=_phone_kb(user.language))


@router.message(StateFilter(Onboarding.name), F.text)
async def onboard_name(message: Message, state: FSMContext) -> None:
    if not message.from_user or not message.text: return
    first, last = repo.split_full_name(message.text)
    if not first:
        user = await arepo.get_or_create_user(message.from_user.id, None, None)
        await message.answer(t(user.language, "ask_name"))
        return
    await arepo.set_name(message.from_user.id, first, last)
    data = await state.get_data()
    await _delete_id(message.bot, message.chat.id, data.get("prompt_id"))  # name prompt
    await _delete(message)  # user's name reply
    await state.clear()
    user = await arepo.get_or_create_user(message.from_user.id, None, None)
    await show_shop_button(message.bot, message.chat.id)
    await message.answer(
        t(user.language, "onboard_done", name=first),
        reply_markup=main_menu(user.language),
    )
    await message.answer(t(user.language, "start_shopping_prompt"), reply_markup=start_shopping_kb(user.language))
