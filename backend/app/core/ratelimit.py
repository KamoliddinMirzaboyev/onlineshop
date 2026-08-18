"""Oddiy Redis asosidagi rate limiter (login brute-force'ga qarshi).

Redis ishlamasa — fail-open (loginni bloklamaymiz), chunki to'xtab qolish
xavfsizlikdan ko'ra ko'proq zarar keltiradi.
"""

from fastapi import HTTPException, Request, status

from app.core.redis import redis_client


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
        except Exception:
            return  # Redis yo'q — fail-open
        from typing import cast

        if cast(int, count) > limit:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring.",
            )

    return dependency
