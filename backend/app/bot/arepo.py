"""`repo.*` ning async qobig'i.

Bot bitta event loop'da ishlaydi. `repo` esa sinxron SQLAlchemy'dan
foydalanadi — uni `async def` handler ichidan to'g'ridan-to'g'ri chaqirish
har bir xabarda loop'ni bloklaydi va bot hammaga sekinlashadi. Shu yerdagi
qobiqlar chaqiruvni thread'ga olib chiqadi.

DB'ga tegmaydigan sof funksiyalar (`split_full_name`, `is_onboarded`) bu
yerda yo'q — ularni to'g'ridan-to'g'ri `repo` dan chaqiring.
"""

from __future__ import annotations

import asyncio
import functools
from collections.abc import Callable
from typing import Any, TypeVar

from app.bot import repo

T = TypeVar("T")


def _threaded(fn: Callable[..., T]) -> Callable[..., Any]:
    @functools.wraps(fn)
    async def inner(*args: Any, **kwargs: Any) -> T:
        return await asyncio.to_thread(fn, *args, **kwargs)

    return inner


get_user = _threaded(repo.get_user)
get_or_create_user = _threaded(repo.get_or_create_user)
set_lang = _threaded(repo.set_lang)
set_phone = _threaded(repo.set_phone)
set_name = _threaded(repo.set_name)
get_latest_pending_order = _threaded(repo.get_latest_pending_order)
get_contact_restaurant = _threaded(repo.get_contact_restaurant)
set_order_location = _threaded(repo.set_order_location)
