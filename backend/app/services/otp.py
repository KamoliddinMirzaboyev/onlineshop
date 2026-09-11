"""SMS OTP — mijoz ilovasi uchun telefon orqali kirish.

# ponytail: hozircha soxta OTP — kod har doim FAKE_CODE, real SMS
# yuborilmaydi. Haqiqiy shlyuz (Eskiz.uz va h.k.) ulanganda faqat
# `send_otp()` ichini almashtirish kifoya — chaqiruvchi kod o'zgarmaydi.
"""

import logging

logger = logging.getLogger(__name__)

FAKE_CODE = "11111"


# Apple Reviewer / Demo test raqamlari (har doim 11111 kod bilan o'tadi)
DEMO_PHONES = {
    "+998901234567",
    "+998900000000",
    "+998990000000",
    "998901234567",
    "998900000000",
}


def send_otp(phone: str) -> None:
    logger.info("OTP %s -> %s", phone, FAKE_CODE)


def verify_otp(phone: str, code: str) -> bool:
    c = code.strip()
    p = phone.strip()
    if p in DEMO_PHONES and c == FAKE_CODE:
        return True
    return c == FAKE_CODE
