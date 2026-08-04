"""Telefon raqam normalizatsiyasi (UZ +998…)."""

from __future__ import annotations

import re

_DIGITS = re.compile(r"\D+")


def normalize_phone(raw: str | None) -> str | None:
    """Raqamni E.164-ga yaqin shaklga keltiradi: +998XXXXXXXXX.

    Qabul qilinadigan kirishlar: +99890…, 99890…, 90…, 890…, bo'shliq/tire.
    Noto'g'ri/bo'sh → None.
    """
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    digits = _DIGITS.sub("", s)
    if not digits:
        return None

    # 998 + 9 raqam
    if digits.startswith("998") and len(digits) == 12:
        return f"+{digits}"
    # 8 90… (eski format)
    if digits.startswith("8") and len(digits) == 10:
        return f"+998{digits[1:]}"
    # 90… (9 raqam)
    if len(digits) == 9 and digits[0] in "33957":
        return f"+998{digits}"
    # allaqachon + bilan kelgan bo'lishi mumkin (faqat raqam qoldi)
    if len(digits) >= 10 and len(digits) <= 15:
        return f"+{digits}"
    return None


def require_phone(raw: str | None) -> str:
    phone = normalize_phone(raw)
    if not phone:
        raise ValueError("Telefon raqami noto'g'ri. Masalan: +998901234567")
    return phone
