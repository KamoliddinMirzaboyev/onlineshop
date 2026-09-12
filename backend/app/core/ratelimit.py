"""Oddiy Redis asosidagi rate limiter (login brute-force'ga qarshi).

Redis ishlamasa — fail-open (loginni bloklamaymiz), chunki to'xtab qolish
xavfsizlikdan ko'ra ko'proq zarar keltiradi. LEKIN bu holat jim o'tmasligi
kerak: Redis o'chgan paytda brute-force himoyasi umuman yo'q, shuning uchun
har safar (bir daqiqada bir marta) ERROR darajasida yoziladi.
"""

import logging
import time

from fastapi import HTTPException, Request, status

from app.core.redis import redis_client

logger = logging.getLogger(__name__)

# Redis o'chganda har so'rovda log yozib jurnalni to'ldirmaymiz.
_DEGRADED_LOG_INTERVAL_S = 60.0
_last_degraded_log = 0.0


def _log_degraded(prefix: str, exc: Exception) -> None:
    global _last_degraded_log
    now = time.monotonic()
    if now - _last_degraded_log < _DEGRADED_LOG_INTERVAL_S:
        return
    _last_degraded_log = now
    logger.error(
        "RATE LIMIT O'CHIQ: Redis javob bermadi (%s) — '%s' uchun brute-force "
        "himoyasi ishlamayapti: %s",
        type(exc).__name__, prefix, exc,
    )


def _client_ip(request: Request) -> str:
    """Proxy ortida haqiqiy klient IP.

    Bitta ishonchli reverse-proxy (Caddy) oldida ishlaydi deb hisoblanadi: u
    X-Forwarded-For'ga o'zi ko'rgan ulanuvchi IP'ni OXIRIGA qo'shib beradi.
    SHUNING UCHUN OXIRGI qiymat olinadi — birinchisini olish klient
    `X-Forwarded-For: 1.2.3.4` deb soxta header yuborib rate-limit'ni chetlab
    o'tishiga imkon berardi (real bug).
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        last = xff.split(",")[-1].strip()
        if last:
            return last
    real = request.headers.get("x-real-ip")
    if real and real.strip():
        return real.strip()
    return request.client.host if request.client else "unknown"


def rate_limiter(prefix: str, limit: int, window_seconds: int):
    """IP bo'yicha `window_seconds` ichida `limit` martadan ko'p so'rovni rad etadi."""

    def dependency(request: Request) -> None:
        ip = _client_ip(request)
        key = f"rl:{prefix}:{ip}"
        try:
            count = redis_client.incr(key)
            if count == 1:
                redis_client.expire(key, window_seconds)
        except Exception as exc:  # noqa: BLE001 — Redis yo'q, fail-open
            _log_degraded(prefix, exc)
            return
        from typing import cast

        if cast(int, count) > limit:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring.",
            )

    return dependency
