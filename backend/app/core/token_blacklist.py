"""Chiqib ketgan (logout qilingan) tokenlarni bekor qilish.

JWT o'zi stateless — muddati tugamaguncha haqiqiy bo'lib qolaveradi. Logout
faqat klient xotirasidan o'chirardi: o'g'irlangan token yoki boshqa qurilmada
qolgan sessiya 30 kun davomida ishlayverardi.

Bu yerda token *hash'i* bo'yicha qora ro'yxat yuritiladi — `jti` claim'i kerak
emas, shuning uchun allaqachon berilgan tokenlar ham bekor qilinadi. Redis
kaliti tokenning o'z muddati bilan birga o'chadi (TTL), ya'ni ro'yxat o'smaydi.

Redis ishlamay qolsa: tekshiruv "o'tkazib yuboriladi" (fail-open). Aks holda
Redis tushishi butun tizimga kirishni to'sardi — yetkazib berish biznesi uchun
bu bekor qilingan tokenning qisqa muddat ishlashidan ko'ra og'irroq zarar.
"""

import hashlib
import logging
import time

from app.core.redis import redis_client

log = logging.getLogger(__name__)

_PREFIX = "revoked_token:"
# Kalit token muddati tugagach o'chadi; `exp` yo'q/buzilgan bo'lsa shu zaxira.
_FALLBACK_TTL = 60 * 60 * 24 * 31


def _key(token: str) -> str:
    return _PREFIX + hashlib.sha256(token.encode()).hexdigest()


def revoke(token: str, payload: dict | None = None) -> None:
    """Tokenni qora ro'yxatga qo'yadi (qolgan umri bo'yicha TTL bilan)."""
    if not token:
        return
    ttl = _FALLBACK_TTL
    exp = (payload or {}).get("exp")
    if isinstance(exp, (int, float)):
        ttl = int(exp - time.time())
        if ttl <= 0:
            return  # allaqachon eskirgan — saqlashning hojati yo'q
        ttl = min(ttl, _FALLBACK_TTL)
    try:
        redis_client.setex(_key(token), ttl, "1")
    except Exception as e:  # noqa: BLE001 — Redis yo'qligi logoutni buzmasin
        log.warning("Token revoke failed (redis): %s", e)


def is_revoked(token: str) -> bool:
    if not token:
        return False
    try:
        return redis_client.exists(_key(token)) == 1
    except Exception as e:  # noqa: BLE001 — fail-open (yuqoridagi izohga qarang)
        log.warning("Token revocation check failed (redis): %s", e)
        return False
