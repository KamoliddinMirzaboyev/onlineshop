"""First-run onboarding: language -> phone -> full name, then the main menu.

Implemented as an aiogram FSM. Included BEFORE the main handlers router so
in-state messages (contact, name text, language pick) are captured here;
out-of-state messages fall through to app/bot/handlers.py.
"""

from aiogram import F, Router
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import Command, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    CallbackQuery, Contact, KeyboardButton, Message,
    ReplyKeyboardMarkup, ReplyKeyboardRemove,
)

from app.bot import repo
from app.bot.handlers import lang_kb, main_menu, start_shopping_kb
from app.bot.i18n import t

router = Router()


class Onboarding(StatesGroup):
    language = State()
    phone = State()
    name = State()


def _phone_kb(lang: str) -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=t(lang, "send_phone"), request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
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
async def cmd_start(message: Message, state: FSMContext) -> None:
    if not message.from_user: return
    user = repo.get_or_create_user(
        message.from_user.id, message.from_user.first_name, message.from_user.username
    )
    if getattr(user, "is_blocked", False):
        await state.clear()
        await message.answer(t(user.language if getattr(user, "language", None) else "uz", "blocked"))
        return
    if repo.is_onboarded(user):
        await state.clear()
        await message.answer(
            t(user.language, "start", name=user.first_name or ""),
            reply_markup=main_menu(user.language),
        )
        return
    await state.set_state(Onboarding.language)
    msg = await message.answer(t("uz", "lang_choose"), reply_markup=lang_kb())
    await state.update_data(prompt_id=msg.message_id)


@router.callback_query(StateFilter(Onboarding.language), F.data.startswith("setlang:"))
async def onboard_lang(cb: CallbackQuery, state: FSMContext) -> None:
    if not cb.data or not cb.message or not cb.from_user: return
    if not isinstance(cb.message, Message): return
    lang = cb.data.split(":")[1]
    repo.set_lang(cb.from_user.id, lang)
    # the language prompt is the message this inline button is attached to
    await _delete(cb.message)
    await state.set_state(Onboarding.phone)
    msg = await cb.message.answer(t(lang, "phone_ask"), reply_markup=_phone_kb(lang))
    await state.update_data(prompt_id=msg.message_id)
    await cb.answer()


@router.message(StateFilter(Onboarding.phone), F.contact)
async def onboard_phone(message: Message, state: FSMContext) -> None:
    if not message.from_user or not message.contact: return
    if not message.contact: return
    contact = message.contact
    if contact.user_id != message.from_user.id:
        user = repo.get_or_create_user(message.from_user.id, None, None)
        await message.answer(t(user.language, "phone_own"))
        return
    repo.set_phone(message.from_user.id, contact.phone_number)
    user = repo.get_or_create_user(message.from_user.id, None, None)
    data = await state.get_data()
    await _delete_id(message.bot, message.chat.id, data.get("prompt_id"))  # phone prompt
    await _delete(message)  # user's shared contact
    await state.set_state(Onboarding.name)
    msg = await message.answer(t(user.language, "ask_name"), reply_markup=ReplyKeyboardRemove())
    await state.update_data(prompt_id=msg.message_id)


@router.message(StateFilter(Onboarding.name), F.text)
async def onboard_name(message: Message, state: FSMContext) -> None:
    if not message.from_user or not message.text: return
    first, last = repo.split_full_name(message.text)
    if not first:
        user = repo.get_or_create_user(message.from_user.id, None, None)
        await message.answer(t(user.language, "ask_name"))
        return
    repo.set_name(message.from_user.id, first, last)
    data = await state.get_data()
    await _delete_id(message.bot, message.chat.id, data.get("prompt_id"))  # name prompt
    await _delete(message)  # user's name reply
    await state.clear()
    user = repo.get_or_create_user(message.from_user.id, None, None)
    await message.answer(
        t(user.language, "onboard_done", name=first),
        reply_markup=main_menu(user.language),
    )
    await message.answer(t(user.language, "start_shopping_prompt"), reply_markup=start_shopping_kb(user.language))
