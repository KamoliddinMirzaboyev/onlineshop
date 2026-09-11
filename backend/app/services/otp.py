"""SMS OTP — mijoz ilovasi uchun telefon orqali kirish.

Loyiha to'liq ishga tushguncha real SMS yuborilmaydi: `OTP_FAKE_MODE=true`
bo'lganda har qanday raqam uchun `OTP_FAKE_CODE` (default "11111") o'tadi.

SMS shlyuz (Eskiz.uz va h.k.) ulanganda:
  1. `_send_sms()` ichini to'ldiring (va kodni Redis'ga yozing),
  2. `.env`da `OTP_FAKE_MODE=false` qiling.
Chaqiruvchi kod (`auth.py`) umuman o'zgarmaydi.

MUHIM: fake rejim yoqiq ekan — telefon raqamini bilgan HAR KIM o'sha
hisobga kira oladi. Ishga tushirishdan oldin albatta o'chiring.
"""

import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# Apple Reviewer / demo tekshiruvi uchun raqamlar — fake rejim o'chirilgandan
# keyin ham shular uchungina fake kod ishlaydi (store review bloklanmasin).
DEMO_PHONES = {
    "+998901234567",
    "+998900000000",
    "+998990000000",
}


def _send_sms(phone: str, code: str) -> None:
    """Real SMS shlyuzi shu yerga ulanadi (hozircha yo'q)."""
    raise NotImplementedError("SMS shlyuzi hali ulanmagan")


def send_otp(phone: str) -> None:
    if settings.otp_fake_mode or phone in DEMO_PHONES:
        logger.info("OTP (fake) %s -> %s", phone, settings.otp_fake_code)
        return
    _send_sms(phone, settings.otp_fake_code)


def verify_otp(phone: str, code: str) -> bool:
    c = code.strip()
    p = phone.strip()
    if settings.otp_fake_mode or p in DEMO_PHONES:
        return c == settings.otp_fake_code
    # Fake rejim o'chirilgan, lekin real shlyuz hali ulanmagan — hech kimni
    # kiritmaymiz (ochiq qoldirgandan ko'ra kirishni to'xtatgan xavfsizroq).
    logger.error("OTP tekshiruvi: fake rejim o'chiq, real shlyuz ulanmagan")
    return False
