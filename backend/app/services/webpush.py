"""Web Push (VAPID) delivery.

Two targets:
  notify_admins(...)          -> admin panel subscriptions (admin_user_id IS NULL)
  notify_courier(uid, ...)    -> one courier's subscriptions (admin_user_id == uid)

Both load subscriptions, send, and prune dead ones (404/410). Failures never
propagate — a push problem must not break an order.
"""

import json
import logging

from pywebpush import WebPushException, webpush  # type: ignore
from sqlalchemy import delete, select

from app.core.config import settings
from app.core.db import SessionLocal
from app.models import AdminUser, PushSubscription

log = logging.getLogger(__name__)


def _send(sub: PushSubscription, payload: dict) -> None:
    webpush(
        subscription_info={
            "endpoint": sub.endpoint,
            "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
        },
        data=json.dumps(payload),
        vapid_private_key=settings.vapid_private_key,
        vapid_claims={"sub": settings.vapid_subject},
    )


from typing import Sequence
def _deliver(subs: Sequence[PushSubscription], payload: dict) -> None:
    dead: list[int] = []
    for s in subs:
        try:
            _send(s, payload)
        except WebPushException as e:
            code = getattr(e.response, "status_code", None)
            if code in (404, 410):
                dead.append(s.id)
            else:
                log.warning("web push failed: %s", e)
        except Exception as e:  # noqa: BLE001
            log.warning("web push error: %s", e)
    if dead:
        with SessionLocal() as db:
            db.execute(delete(PushSubscription).where(PushSubscription.id.in_(dead)))
            db.commit()


def notify_admins(
    title: str, body: str, restaurant_id: int, url: str = "/", tag: str | None = None
) -> None:
    """Faqat shu restoranga bog'langan admin-panel obunalariga.

    restaurant_id — majburiy: aks holda bitta do'konning buyurtmasi hamma
    do'konlar planshetiga tushib qolardi (avvalgi cross-tenant leak).
    """
    if not settings.vapid_private_key:
        return  # push not configured
    with SessionLocal() as db:
        subs = db.scalars(
            select(PushSubscription).where(
                PushSubscription.admin_user_id.is_(None),
                PushSubscription.restaurant_id == restaurant_id,
            )
        ).all()
    _deliver(subs, {"title": title, "body": body, "url": url, "tag": tag})


def notify_courier(
    admin_user_id: int, title: str, body: str, url: str = "/", tag: str | None = None
) -> None:
    if not settings.vapid_private_key:
        return
    with SessionLocal() as db:
        subs = db.scalars(
            select(PushSubscription).where(
                PushSubscription.admin_user_id == admin_user_id
            )
        ).all()
    _deliver(subs, {"title": title, "body": body, "url": url, "tag": tag})


def notify_all_couriers(
    title: str, body: str, restaurant_id: int, url: str = "/", tag: str | None = None
) -> None:
    """Shu restoran kuryerlariga push — yangi biriktirilmagan buyurtma
    o'sha do'kon kuryerlariga ko'rinadi, birinchi qabul qilgan oladi."""
    if not settings.vapid_private_key:
        return
    with SessionLocal() as db:
        subs = db.scalars(
            select(PushSubscription)
            .join(AdminUser, AdminUser.id == PushSubscription.admin_user_id)
            .where(AdminUser.restaurant_id == restaurant_id)
        ).all()
    _deliver(subs, {"title": title, "body": body, "url": url, "tag": tag})
