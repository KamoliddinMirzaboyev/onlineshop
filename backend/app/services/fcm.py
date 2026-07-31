"""Firebase Cloud Messaging (native Android/iOS) delivery.

Web Push (VAPID) brauzer PWA uchun; FCM — Flutter kuryer APK uchun.
Xatolik hech qachon order oqimini buzmasin.
"""

from __future__ import annotations

import json
import logging
from sqlalchemy import select, update

from app.core.config import settings
from app.core.db import SessionLocal
from app.models import AdminUser
from app.models.enums import AdminRole

log = logging.getLogger(__name__)

_app_ready = False
_init_attempted = False


def _ensure_app() -> bool:
    """firebase-admin ni bir marta init qiladi. Sozlanmagan bo'lsa False."""
    global _app_ready, _init_attempted
    if _app_ready:
        return True
    if _init_attempted:
        return False
    _init_attempted = True

    raw_json = (settings.firebase_credentials_json or "").strip()
    path = (settings.firebase_credentials_path or "").strip()
    if not raw_json and not path:
        log.info("FCM disabled: no FIREBASE_CREDENTIALS_JSON/PATH")
        return False

    try:
        import firebase_admin
        from firebase_admin import credentials

        if firebase_admin._apps:  # type: ignore[attr-defined]
            _app_ready = True
            return True

        if raw_json:
            info = json.loads(raw_json)
            cred = credentials.Certificate(info)
        else:
            cred = credentials.Certificate(path)
        firebase_admin.initialize_app(cred)
        _app_ready = True
        log.info("FCM firebase-admin initialized")
        return True
    except Exception as e:  # noqa: BLE001
        log.warning("FCM init failed: %s", e)
        return False


def _send_token(token: str, title: str, body: str, data: dict[str, str] | None = None) -> bool:
    """Bitta qurilmaga yuboradi. Invalid token bo'lsa False (tozalash uchun)."""
    if not _ensure_app():
        return True  # "success" — configured emas, tokenni o'chirmaymiz
    try:
        from firebase_admin import messaging

        message = messaging.Message(
            token=token,
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    channel_id="courier_orders",
                    sound="default",
                    priority="max",
                    default_vibrate_timings=True,
                    visibility="public",
                ),
            ),
            apns=messaging.APNSConfig(
                headers={"apns-priority": "10"},
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        alert=messaging.ApsAlert(title=title, body=body),
                        sound="default",
                        content_available=True,
                    )
                ),
            ),
        )
        messaging.send(message)
        return True
    except Exception as e:  # noqa: BLE001
        err = str(e).lower()
        # Token o'lik / app o'chirilgan
        if any(
            x in err
            for x in (
                "not-found",
                "unregistered",
                "invalid-argument",
                "registration-token-not-registered",
                "requested entity was not found",
            )
        ):
            log.info("FCM token invalid, will clear: %s", e)
            return False
        log.warning("FCM send failed: %s", e)
        return True  # boshqa xato — tokenni saqlaymiz


def _clear_tokens(tokens: list[str]) -> None:
    if not tokens:
        return
    with SessionLocal() as db:
        db.execute(
            update(AdminUser)
            .where(AdminUser.fcm_token.in_(tokens))
            .values(fcm_token=None)
        )
        db.commit()


def _payload_data(url: str = "/", tag: str | None = None) -> dict[str, str]:
    data: dict[str, str] = {"url": url or "/"}
    if tag:
        data["tag"] = tag
    return data


def notify_courier(
    admin_user_id: int,
    title: str,
    body: str,
    url: str = "/",
    tag: str | None = None,
) -> None:
    if not _ensure_app():
        return
    with SessionLocal() as db:
        token = db.scalar(
            select(AdminUser.fcm_token).where(AdminUser.id == admin_user_id)
        )
    if not token:
        return
    ok = _send_token(token, title, body, _payload_data(url, tag))
    if not ok:
        _clear_tokens([token])


def notify_all_couriers(
    title: str,
    body: str,
    restaurant_id: int,
    url: str = "/",
    tag: str | None = None,
) -> None:
    """Shu do'kon kuryerlarining FCM tokenlariga yuborish."""
    if not _ensure_app():
        return
    with SessionLocal() as db:
        tokens = list(
            db.scalars(
                select(AdminUser.fcm_token).where(
                    AdminUser.restaurant_id == restaurant_id,
                    AdminUser.role == AdminRole.courier,
                    AdminUser.is_active.is_(True),
                    AdminUser.fcm_token.is_not(None),
                )
            ).all()
        )
    dead: list[str] = []
    data = _payload_data(url, tag)
    for token in tokens:
        if not token:
            continue
        if not _send_token(token, title, body, data):
            dead.append(token)
    if dead:
        _clear_tokens(dead)


def configured() -> bool:
    return _ensure_app()
