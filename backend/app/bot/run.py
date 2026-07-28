import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import MenuButtonWebApp, WebAppInfo

from app.bot.handlers import router
from app.bot.onboarding import router as onboarding_router
from app.core.config import settings

logging.basicConfig(level=logging.INFO)


async def main() -> None:
    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    # Register the chat menu button ("Sotib olish") in code as a web_app button,
    # pointing to the same URL as the reply-keyboard buttons. This guarantees both
    # entry points launch a real Mini App (with signed initData) rather than a
    # plain in-app browser, independent of any BotFather configuration.
    await bot.set_chat_menu_button(
        menu_button=MenuButtonWebApp(
            text="Sotib olish",
            web_app=WebAppInfo(url=settings.tma_url),
        )
    )
    dp = Dispatcher(storage=MemoryStorage())
    dp.include_router(onboarding_router)  # in-state messages captured first
    dp.include_router(router)
    logging.info("Barakali Bozor bot started polling…")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
