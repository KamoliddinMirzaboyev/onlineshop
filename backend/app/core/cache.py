"""Oddiy Redis asosidagi TTL kesh (o'qish og'ir bo'lgan endpoint'lar uchun).

Redis ishlamasa — fail-open (DB'dan o'qiladi), ratelimit.py bilan bir xil uslub.
"""

import json
from typing import Any

from app.core.redis import redis_client


def cache_get_json(key: str) -> Any | None:
    try:
        raw = redis_client.get(key)
    except Exception:
        return None
    return json.loads(raw) if raw else None


def cache_set_json(key: str, value: Any, ttl: int) -> None:
    try:
        redis_client.set(key, json.dumps(value), ex=ttl)
    except Exception:
        pass


def cache_delete(*keys: str) -> None:
    if not keys:
        return
    try:
        redis_client.delete(*keys)
    except Exception:
        pass


def invalidate_restaurant_catalog(restaurant_id: int) -> None:
    """Do'kon katalog keshini tashlash (kategoriya/mahsulot o'zgarishi)."""
    cache_delete(f"catalog:restaurant:{restaurant_id}", "catalog:restaurants:all")
