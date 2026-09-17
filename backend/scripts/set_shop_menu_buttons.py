"""Onboarding'dan o'tgan mijozlarga "Sotib olish" menyu tugmasini qo'yadi.

    python -m scripts.set_shop_menu_buttons

Nima uchun: umumiy menyu tugmasi endi Mini App emas (bot/run.py). Tugma har bir
ro'yxatdan o'tgan foydalanuvchiga alohida qo'yiladi — yangi o'tganlarga bot o'zi
qo'yadi, bu skript esa o'zgarishdan oldin o'tganlar uchun bir martalik.
Qayta ishga tushirish xavfsiz (idempotent).
"""

import asyncio

from aiogram import Bot
from sqlalchemy import select

from app.bot.handlers import show_shop_button
from app.bot.repo import is_onboarded
from app.core.config import settings
from app.core.db import SessionLocal
from app.models import User


async def main() -> None:
    with SessionLocal() as db:
        users = db.scalars(
            select(User).where(User.telegram_id.is_not(None), User.is_blocked.is_(False))
        ).all()
        chat_ids = [u.telegram_id for u in users if u.telegram_id and is_onboarded(u)]

    bot = Bot(token=settings.bot_token)
    try:
        for chat_id in chat_ids:
            await show_shop_button(bot, chat_id)
            await asyncio.sleep(0.05)  # Telegram limiti ~30 so'rov/soniya
    finally:
        await bot.session.close()
    print(f"Tugma qo'yildi: {len(chat_ids)} ta foydalanuvchi")


if __name__ == "__main__":
    asyncio.run(main())
