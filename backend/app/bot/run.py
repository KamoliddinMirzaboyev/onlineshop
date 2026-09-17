import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import MenuButtonCommands

from app.bot.handlers import router
from app.bot.middleware import BlockedUserMiddleware
from app.bot.onboarding import router as onboarding_router
from app.core.config import settings

logging.basicConfig(level=logging.INFO)


def _build_storage():
    """Redis bo'lsa FSM multi-instance/restart chidamli; aks holda Memory."""
    try:
        from aiogram.fsm.storage.redis import RedisStorage

        return RedisStorage.from_url(settings.redis_url)
    except Exception as e:  # noqa: BLE001
        logging.warning("FSM RedisStorage ishlatilmadi (%s) — MemoryStorage", e)
        return MemoryStorage()


async def main() -> None:
    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    # Umumiy menyu tugmasi — Mini App EMAS. "Sotib olish" faqat onboarding'dan
    # o'tganlarga shaxsiy chat tugmasi sifatida qo'yiladi (onboarding.show_shop_button).
    # BotFather'dagi "Menu Button" ham shu sozlama — bu yerda har startda qayta yoziladi.
    await bot.set_chat_menu_button(menu_button=MenuButtonCommands())
    dp = Dispatcher(storage=_build_storage())
    dp.message.middleware(BlockedUserMiddleware())
    dp.callback_query.middleware(BlockedUserMiddleware())
    dp.include_router(onboarding_router)  # in-state messages captured first
    dp.include_router(router)
    logging.info("Barakali Bozor bot started polling…")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
