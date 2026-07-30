"""Broadcasts an Announcement to every non-blocked bot user via the Bot API.

Mirrors app/services/notify.py's style: plain httpx calls to api.telegram.org,
failures are swallowed per-recipient (one blocked/deleted account must never
abort the batch).
"""

import json
import time
from collections.abc import Callable
from datetime import datetime, timezone

import httpx
from sqlalchemy import select

from app.core.config import settings
from app.core.db import SessionLocal
from app.models import Announcement, User
from app.models.enums import AnnouncementStatus

_MSG_API = f"https://api.telegram.org/bot{settings.bot_token}/sendMessage"
_PHOTO_API = f"https://api.telegram.org/bot{settings.bot_token}/sendPhoto"
_DELAY_SECONDS = 0.05  # ~20 msg/s, under Telegram's flood limit


def _keyboard(button_text: str) -> dict:
    return {"inline_keyboard": [[{"text": button_text, "web_app": {"url": settings.tma_url}}]]}


def _send_one(chat_id: int, text: str, image_url: str | None, button_text: str) -> bool:
    """Sends one message to one Telegram user. Returns True on success."""
    try:
        if image_url:
            resp = httpx.post(
                _PHOTO_API,
                data={
                    "chat_id": chat_id,
                    "photo": image_url,
                    "caption": text,
                    "parse_mode": "HTML",
                    "reply_markup": json.dumps(_keyboard(button_text)),
                },
                timeout=10,
            )
        else:
            resp = httpx.post(
                _MSG_API,
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "HTML",
                    "reply_markup": _keyboard(button_text),
                },
                timeout=10,
            )
        return resp.status_code == 200
    except Exception:
        return False


def _send_all(
    telegram_ids: list[int],
    text: str,
    image_url: str | None,
    button_text: str,
    send: Callable[[int, str, str | None, str], bool] = _send_one,
) -> tuple[int, int]:
    """Sends to every id, tolerating individual failures. Returns (sent, failed)."""
    sent = failed = 0
    for chat_id in telegram_ids:
        if send(chat_id, text, image_url, button_text):
            sent += 1
        else:
            failed += 1
        time.sleep(_DELAY_SECONDS)
    return sent, failed


def broadcast(announcement_id: int) -> None:
    """Runs as a BackgroundTasks job — opens its own DB session since the
    request session that created the Announcement row is already closed."""
    with SessionLocal() as db:
        ann = db.get(Announcement, announcement_id)
        if not ann:
            return
        telegram_ids = [
            t for t in db.scalars(select(User.telegram_id).where(User.is_blocked.is_(False))).all()
            if t is not None
        ]
        ann.status = AnnouncementStatus.sending
        ann.total_recipients = len(telegram_ids)
        db.commit()

        sent, failed = _send_all(telegram_ids, ann.text, ann.image_url, ann.button_text)

        ann.sent_count = sent
        ann.failed_count = failed
        ann.status = AnnouncementStatus.sent
        ann.sent_at = datetime.now(timezone.utc)
        db.commit()


if __name__ == "__main__":
    def _fake_send(chat_id: int, text: str, image_url: str | None, button_text: str) -> bool:
        return chat_id != 2  # simulate chat_id 2 failing (e.g. user blocked the bot)

    result = _send_all([1, 2, 3], "hi", None, "Ochish", send=_fake_send)
    assert result == (2, 1), f"expected (2, 1), got {result}"
    print("announcements self-check OK")
