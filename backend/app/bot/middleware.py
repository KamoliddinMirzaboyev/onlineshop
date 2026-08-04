"""Bot middleware: bloklangan foydalanuvchini barcha handlerlardan to'xtatadi."""

from collections.abc import Awaitable, Callable
from typing import Any

from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, Message, TelegramObject

from app.bot import repo
from app.bot.i18n import t


class BlockedUserMiddleware(BaseMiddleware):
    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        from_user = None
        if isinstance(event, Message):
            from_user = event.from_user
        elif isinstance(event, CallbackQuery):
            from_user = event.from_user

        if from_user is not None:
            user = repo.get_user(from_user.id)
            if user is not None and getattr(user, "is_blocked", False):
                lang = user.language if getattr(user, "language", None) else "uz"
                text = t(lang, "blocked")
                if isinstance(event, Message):
                    await event.answer(text)
                elif isinstance(event, CallbackQuery):
                    await event.answer(text, show_alert=True)
                    if event.message and isinstance(event.message, Message):
                        try:
                            await event.message.answer(text)
                        except Exception:  # noqa: BLE001
                            pass
                return None
        return await handler(event, data)
