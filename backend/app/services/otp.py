"""SMS OTP — mijoz ilovasi uchun telefon orqali kirish.

Oqim:
  1. `send_otp(phone)` — tasodifiy 5 xonali kod generatsiya qiladi, uni
     Redis'ga `otp:code:<phone>` kaliti bilan TTL bilan yozadi va SMS yuboradi.
  2. `verify_otp(phone, code)` — Redis'dagi kod bilan solishtiradi, to'g'ri
     bo'lsa kalitni darhol o'chiradi (bitta kod — bitta kirish).

Xavfsizlik chegaralari:
  - Kod `secrets` bilan generatsiya qilinadi (tasodifiy, taxmin qilib bo'lmaydi).
  - TTL `OTP_TTL_SECONDS` (standart 300 s) — eski kod ishlamaydi.
  - Bitta kodga `OTP_MAX_ATTEMPTS` (standart 5) urinish; oshsa kod bekor
     bo'ladi va yangisini so'rash kerak. Brute-force 10^5 dan 5 taga tushadi.
  - Solishtirish `secrets.compare_digest` bilan (timing xavfsiz).
  - Redis ishlamasa — kirish TO'XTAYDI (fail-closed). Rate limiter fail-open,
     chunki u himoya qatlami; bu esa autentifikatsiyaning o'zi.

Sozlash (`.env`):
  SMS_PROVIDER=eskiz
  ESKIZ_EMAIL=...          ESKIZ_PASSWORD=...
  ESKIZ_FROM=4546          (tasdiqlangan alfanumerik nom yoki qisqa raqam)
  OTP_FAKE_MODE=false

`OTP_FAKE_MODE=true` — faqat ishlab chiqish uchun: SMS yuborilmaydi, kod
loglarga yoziladi. Prod'da `main.py` uni ishga tushishda taqiqlaydi.
"""

from __future__ import annotations

import logging
import secrets
import threading
import time

import httpx

from app.core.config import settings
from app.core.redis import redis_client

logger = logging.getLogger(__name__)

_CODE_KEY = "otp:code:{phone}"
_ATTEMPTS_KEY = "otp:tries:{phone}"


class OtpError(Exception):
    """SMS yuborib bo'lmadi — chaqiruvchi 503 qaytaradi."""


def mask_phone(phone: str) -> str:
    """Jurnalga yozish uchun: +998901234567 → +99890***4567."""
    p = (phone or "").strip()
    if len(p) < 8:
        return "***"
    return f"{p[:6]}***{p[-4:]}"


def _generate_code() -> str:
    """Kriptografik tasodifiy 5 xonali kod (00000–99999)."""
    return f"{secrets.randbelow(100_000):05d}"


# ── SMS shlyuzi: Eskiz.uz ────────────────────────────────────────
# Token 30 kun yashaydi; jarayon xotirasida keshlanadi va muddati tugaganda
# yoki 401 kelganda yangilanadi.
_ESKIZ_BASE = "https://notify.eskiz.uz/api"
_token_lock = threading.Lock()
_token: str | None = None
_token_expires_at: float = 0.0


def _eskiz_login(force: bool = False) -> str:
    global _token, _token_expires_at
    with _token_lock:
        if not force and _token and time.time() < _token_expires_at:
            return _token
        if not settings.eskiz_email or not settings.eskiz_password:
            raise OtpError("ESKIZ_EMAIL / ESKIZ_PASSWORD sozlanmagan")
        try:
            r = httpx.post(
                f"{_ESKIZ_BASE}/auth/login",
                data={"email": settings.eskiz_email, "password": settings.eskiz_password},
                timeout=10.0,
            )
        except httpx.HTTPError as e:
            raise OtpError(f"Eskiz login tarmoq xatosi: {e}") from e
        if r.status_code != 200:
            raise OtpError(f"Eskiz login rad etdi: {r.status_code}")
        token = ((r.json() or {}).get("data") or {}).get("token")
        if not token:
            raise OtpError("Eskiz login javobida token yo'q")
        _token = token
        # 30 kun deklaratsiya qilingan; ehtiyot uchun 25 kun keshlaymiz.
        _token_expires_at = time.time() + 25 * 24 * 3600
        return token


def _eskiz_send(phone: str, text: str) -> None:
    """Eskiz orqali bitta SMS. 401 kelsa token yangilanib bir marta qayta urinadi."""
    # Eskiz raqamni "+"siz kutadi: 998901234567
    to = phone.lstrip("+")
    for attempt in (1, 2):
        token = _eskiz_login(force=(attempt == 2))
        try:
            r = httpx.post(
                f"{_ESKIZ_BASE}/message/sms/send",
                headers={"Authorization": f"Bearer {token}"},
                data={"mobile_phone": to, "message": text, "from": settings.eskiz_from},
                timeout=15.0,
            )
        except httpx.HTTPError as e:
            raise OtpError(f"Eskiz tarmoq xatosi: {e}") from e
        if r.status_code == 401 and attempt == 1:
            continue  # token eskirgan — qayta login qilib urinamiz
        if r.status_code not in (200, 201):
            raise OtpError(f"Eskiz SMS rad etdi: {r.status_code} {r.text[:200]}")
        return


def _send_sms(phone: str, code: str) -> None:
    """SMS shlyuziga uzatadi. Yangi provayder shu yerga qo'shiladi."""
    provider = (settings.sms_provider or "").strip().lower()
    text = settings.otp_message_template.format(code=code)
    if provider == "eskiz":
        _eskiz_send(phone, text)
        return
    raise OtpError(f"SMS provayderi sozlanmagan yoki noma'lum: '{provider}'")


# ── Ommaviy API ──────────────────────────────────────────────────
def _is_demo(phone: str) -> bool:
    """Store tekshiruvi uchun ajratilgan raqamlar — faqat ataylab yoqilganda.

    App Store / Play tekshiruvchisi real SMS ololmaydi, shuning uchun reviewga
    yuborishdan oldin `DEMO_LOGIN_ENABLED=true` qilinadi va reviewdan keyin
    darhol o'chiriladi. Standart holat — o'chiq.
    """
    return settings.demo_login_enabled and phone.strip() in settings.demo_phones_set


def send_otp(phone: str) -> None:
    """Kod generatsiya qiladi, Redis'ga yozadi va SMS yuboradi."""
    phone = phone.strip()

    if _is_demo(phone):
        logger.info("OTP: demo raqam %s — SMS yuborilmadi", mask_phone(phone))
        return

    if settings.otp_fake_mode:
        # Faqat ishlab chiqish. Prod'da main.py bunga yo'l qo'ymaydi.
        logger.warning("OTP FAKE REJIM: %s uchun kod = %s",
                       mask_phone(phone), settings.otp_fake_code)
        return

    code = _generate_code()
    try:
        pipe = redis_client.pipeline()
        pipe.set(_CODE_KEY.format(phone=phone), code, ex=settings.otp_ttl_seconds)
        pipe.delete(_ATTEMPTS_KEY.format(phone=phone))
        pipe.execute()
    except Exception as e:  # noqa: BLE001
        logger.exception("OTP: Redis'ga yozib bo'lmadi")
        raise OtpError("Vaqtinchalik nosozlik — birozdan so'ng urinib ko'ring") from e

    try:
        _send_sms(phone, code)
    except OtpError:
        # Kod yuborilmagan bo'lsa uni saqlab qo'yishning ma'nosi yo'q.
        try:
            redis_client.delete(_CODE_KEY.format(phone=phone))
        except Exception:  # noqa: BLE001
            pass
        raise
    logger.info("OTP yuborildi: %s", mask_phone(phone))


def verify_otp(phone: str, code: str) -> bool:
    """Kodni tekshiradi. To'g'ri bo'lsa kod bekor qilinadi (bir martalik)."""
    phone = phone.strip()
    code = code.strip()

    if _is_demo(phone):
        return secrets.compare_digest(code, settings.otp_fake_code)

    if settings.otp_fake_mode:
        return secrets.compare_digest(code, settings.otp_fake_code)

    code_key = _CODE_KEY.format(phone=phone)
    tries_key = _ATTEMPTS_KEY.format(phone=phone)

    try:
        stored = redis_client.get(code_key)
    except Exception:  # noqa: BLE001
        # Fail-CLOSED: Redis yo'q bo'lsa hech kimni kiritmaymiz.
        logger.exception("OTP: Redis o'qib bo'lmadi — kirish rad etildi")
        return False

    if not stored:
        return False

    try:
        tries = redis_client.incr(tries_key)
        if tries == 1:
            redis_client.expire(tries_key, settings.otp_ttl_seconds)
    except Exception:  # noqa: BLE001
        logger.exception("OTP: urinishlar hisoblagichi ishlamadi")
        return False

    if tries > settings.otp_max_attempts:
        # Kodni bekor qilamiz — endi faqat yangi kod so'rash mumkin.
        try:
            redis_client.delete(code_key, tries_key)
        except Exception:  # noqa: BLE001
            pass
        logger.warning("OTP: %s uchun urinishlar chegarasi oshdi", mask_phone(phone))
        return False

    if not secrets.compare_digest(str(stored), code):
        return False

    try:
        redis_client.delete(code_key, tries_key)
    except Exception:  # noqa: BLE001
        pass
    return True
