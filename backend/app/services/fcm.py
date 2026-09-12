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
from app.models import AdminUser, User
from app.models.enums import AdminRole

log = logging.getLogger(__name__)

# Android bildirishnoma kanallari — har bir ilova O'ZI yaratgan kanal id'si.
# kuryer APK: "courier_orders"; mijoz ilovasi: "orders".
COURIER_CHANNEL = "courier_orders"
CUSTOMER_CHANNEL = "orders"

# FCM tokeni Firebase LOYIHASIGA bog'langan: boshqa loyiha nomidan yuborilsa
# push hech qachon yetib bormaydi (SenderId mismatch). Kuryer APK va mijoz
# ilovasi turli loyihalarda bo'lishi mumkin, shuning uchun har biri uchun
# alohida firebase-admin "app" ochamiz. Mijoz uchun alohida kalit berilmasa —
# kuryerникиdan foydalanadi (ikkalasi bitta loyihada bo'lgan holat).
_COURIER_APP = "courier"
_CUSTOMER_APP = "customer"

_apps: dict[str, object | None] = {}


def _init_app(kind: str, raw_json: str, path: str, name: str | None):
    """Bitta firebase-admin app'ini ochadi. Sozlanmagan/xato bo'lsa None."""
    raw_json = (raw_json or "").strip()
    path = (path or "").strip()
    if not raw_json and not path:
        return None
    try:
        import firebase_admin
        from firebase_admin import credentials

        if raw_json:
            info = json.loads(raw_json)
            cred = credentials.Certificate(info)
        else:
            cred = credentials.Certificate(path)
            with open(path, encoding="utf-8") as f:
                info = json.load(f)

        try:
            app = (
                firebase_admin.get_app(name) if name else firebase_admin.get_app()
            )
        except ValueError:
            app = (
                firebase_admin.initialize_app(cred, name=name)
                if name
                else firebase_admin.initialize_app(cred)
            )
        # Loyiha nomi logda turadi — ilovaning google-services.json'idagi
        # project_id shu bilan bir xil bo'lishi SHART.
        log.info("FCM %s app ready (project=%s)", kind, info.get("project_id", "?"))
        return app
    except Exception as e:  # noqa: BLE001
        log.warning("FCM %s init failed: %s", kind, e)
        return None


def _courier_app():
    if _COURIER_APP not in _apps:
        _apps[_COURIER_APP] = _init_app(
            "courier",
            settings.firebase_credentials_json,
            settings.firebase_credentials_path,
            name=None,  # default app — mavjud xatti-harakat o'zgarmaydi
        )
        if _apps[_COURIER_APP] is None:
            log.info("FCM disabled: no FIREBASE_CREDENTIALS_JSON/PATH")
    return _apps[_COURIER_APP]


def _customer_app():
    """Mijoz ilovasi uchun app. Alohida kalit berilmasa — kuryerникиsi."""
    if _CUSTOMER_APP not in _apps:
        app = _init_app(
            "customer",
            settings.firebase_customer_credentials_json,
            settings.firebase_customer_credentials_path,
            name=_CUSTOMER_APP,
        )
        if app is None:
            app = _courier_app()
            if app is not None:
                log.info(
                    "FCM: mijoz uchun alohida kalit yo'q — kuryer loyihasi "
                    "ishlatiladi (ikkala ilova bitta loyihada bo'lishi kerak)"
                )
        _apps[_CUSTOMER_APP] = app
    return _apps[_CUSTOMER_APP]


def _ensure_app() -> bool:
    """Kuryer (asosiy) app tayyor bo'lsa True — eski chaqiruvchilar uchun."""
    return _courier_app() is not None


def _send_token(
    token: str,
    title: str,
    body: str,
    data: dict[str, str] | None = None,
    channel_id: str = COURIER_CHANNEL,
    app=None,
) -> bool:
    """Bitta qurilmaga yuboradi. Invalid token bo'lsa False (tozalash uchun).

    `channel_id` qabul qiluvchi ilovada MAVJUD bo'lishi kerak — mijoz ilovasida
    kuryerning "courier_orders" kanali yo'q.
    `app` — token qaysi Firebase loyihasiga tegishli bo'lsa, o'sha app.
    """
    if app is None:
        app = _courier_app()
    if app is None:
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
                    channel_id=channel_id,
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
        messaging.send(message, app=app)
        return True
    except Exception as e:  # noqa: BLE001
        err = str(e).lower()
        # Token BOSHQA Firebase loyihasiga tegishli — bu server sozlamasidagi
        # xato (ilovaning google-services.json'i serverning service account'i
        # bilan bir loyihada emas), tokenning aybi yo'q. Tokenni o'chirmaymiz:
        # o'chirsak sabab yashirinadi va sozlama tuzatilgach ham push
        # ilova qayta ishga tushmaguncha kelmaydi.
        if "sender" in err and ("mismatch" in err or "id" in err):
            log.error(
                "FCM SENDER MISMATCH — ilova va server boshqa Firebase "
                "loyihasida. Ilovaning google-services.json'idagi project_id "
                "serverning FIREBASE_CREDENTIALS project_id'si bilan bir xil "
                "bo'lishi kerak. Xato: %s", e,
            )
            return True
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


def _clear_user_tokens(tokens: list[str]) -> None:
    if not tokens:
        return
    with SessionLocal() as db:
        db.execute(update(User).where(User.fcm_token.in_(tokens)).values(fcm_token=None))
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


def notify_user(user_id: int, title: str, body: str, url: str = "/", tag: str | None = None) -> None:
    """Mijoz ilovasiga (mijoz_app) FCM push — buyurtma holati/e'lonlar.
    Telegram bot bilan mustaqil: telegram_id yo'q (OTP orqali kirgan) mijozlarda
    ham ishlaydi, faqat User.fcm_token borligiga bog'liq."""
    # Faqat mijoz app'iga bog'liq: kuryer kaliti sozlanmagan bo'lsa ham
    # mijozga push ketaversin.
    app = _customer_app()
    if app is None:
        return
    with SessionLocal() as db:
        token = db.scalar(select(User.fcm_token).where(User.id == user_id))
    if not token:
        log.info("FCM: user %s da fcm_token yo'q — push yuborilmadi", user_id)
        return
    ok = _send_token(
        token, title, body, _payload_data(url, tag),
        channel_id=CUSTOMER_CHANNEL, app=app,
    )
    if not ok:
        _clear_user_tokens([token])


def configured() -> bool:
    return _ensure_app()


def notify_users_bulk(
    user_ids: list[int], title: str, body: str, url: str = "/", tag: str | None = None
) -> int:
    """Ko'p mijozga push — tokenlar BITTA so'rov bilan olinadi.

    `notify_user` har bir mijoz uchun alohida DB sessiya ochardi; ommaviy
    xabarda bu minglab sessiya degani edi. Qaytaradi: yuborilgan soni.
    """
    if not user_ids:
        return 0
    app = _customer_app()
    if app is None:
        return 0
    with SessionLocal() as db:
        tokens = [
            t for t in db.scalars(
                select(User.fcm_token).where(
                    User.id.in_(user_ids), User.fcm_token.is_not(None)
                )
            ).all()
            if t
        ]
    if not tokens:
        return 0
    data = _payload_data(url, tag)
    dead: list[str] = []
    sent = 0
    for token in tokens:
        if _send_token(token, title, body, data, channel_id=CUSTOMER_CHANNEL, app=app):
            sent += 1
        else:
            dead.append(token)
    if dead:
        _clear_user_tokens(dead)
    return sent
