"""SMS OTP — mijoz ilovasi uchun telefon orqali kirish.

# ponytail: hozircha soxta OTP — kod har doim FAKE_CODE, real SMS
# yuborilmaydi. Haqiqiy shlyuz (Eskiz.uz va h.k.) ulanganda faqat
# `send_otp()` ichini almashtirish kifoya — chaqiruvchi kod o'zgarmaydi.
"""

import logging

logger = logging.getLogger(__name__)

FAKE_CODE = "11111"


def send_otp(phone: str) -> None:
    logger.info("OTP (mock) %s -> %s", phone, FAKE_CODE)


def verify_otp(phone: str, code: str) -> bool:
    return code.strip() == FAKE_CODE
