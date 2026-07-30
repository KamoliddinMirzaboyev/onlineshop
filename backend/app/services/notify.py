"""Fire-and-forget Telegram notifications via Bot API (httpx).

Used by API to ping the user and the orders channel on order events.
Failures are swallowed — a notification problem must never break an order.
"""

import httpx

from app.core.config import settings
from app.models import Order
from app.services import webpush

_API = f"https://api.telegram.org/bot{settings.bot_token}/sendMessage"
_PHOTO_API = f"https://api.telegram.org/bot{settings.bot_token}/sendPhoto"

# Mijoz tiliga qarab — bitta tilda (uz | ru), ikkalasi aralashmaydi.
_STATUS_TEXT: dict[str, dict[str, str]] = {
    "uz": {
        "pending": "🆕 Buyurtmangiz qabul qilindi",
        "confirmed": "✅ Buyurtma tasdiqlandi",
        "preparing": "👨‍🍳 Buyurtma tayyorlanmoqda",
        "ready": "📦 Buyurtma tayyor",
        "accepted": "✅ Kuryer buyurtmani qabul qildi",
        "delivering": "🛵 Buyurtmangiz yo'lda",
        "delivered": "🎉 Buyurtma yetkazib berildi",
        "cancelled": "❌ Buyurtma bekor qilindi",
    },
    "ru": {
        "pending": "🆕 Ваш заказ принят",
        "confirmed": "✅ Заказ подтверждён",
        "preparing": "👨‍🍳 Заказ готовится",
        "ready": "📦 Заказ готов",
        "accepted": "✅ Курьер принял заказ",
        "delivering": "🛵 Ваш заказ в пути",
        "delivered": "🎉 Заказ доставлен",
        "cancelled": "❌ Заказ отменён",
    },
}


def _lang(lang: str | None) -> str:
    return lang if lang in _STATUS_TEXT else "uz"


def _status_line(status: str, lang: str | None) -> str:
    l = _lang(lang)
    return _STATUS_TEXT[l].get(status, _STATUS_TEXT["uz"].get(status, ""))


def _courier_block(
    lang: str | None,
    courier_name: str | None,
    courier_phone: str | None,
) -> list[str]:
    if not courier_name and not courier_phone:
        return []
    l = _lang(lang)
    lines = ["", "🚴 <b>Kuryer:</b>" if l == "uz" else "🚴 <b>Курьер:</b>"]
    if courier_name:
        lines.append(f"👤 {courier_name}")
    if courier_phone:
        lines.append(f"📞 {courier_phone}")
    return lines


def _send(chat_id: int, text: str) -> None:
    try:
        httpx.post(_API, json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"}, timeout=5)
    except Exception:
        pass


def _send_photo(chat_id: int, png: bytes, caption: str = "") -> None:
    try:
        httpx.post(
            _PHOTO_API,
            data={"chat_id": chat_id, "caption": caption},
            files={"photo": ("receipt.png", png, "image/png")},
            timeout=10,
        )
    except Exception:
        pass


def _send_photo_url(chat_id: int, photo_url: str, caption: str = "") -> None:
    try:
        httpx.post(
            _PHOTO_API,
            json={"chat_id": chat_id, "photo": photo_url, "caption": caption, "parse_mode": "HTML"},
            timeout=10,
        )
    except Exception:
        pass


# Telegram caption limiti — 1024 belgi. Undan uzun bo'lsa, rasm keption'siz,
# matn alohida xabar sifatida yuboriladi (aks holda API xato qaytaradi).
_CAPTION_LIMIT = 1024


def broadcast_post(telegram_ids: list[int], text: str, photo_url: str | None) -> None:
    """Admin/tadbirkor panelidan mijozlarga bot orqali post yuborish (rasm/matn/ikkalasi)."""
    for tid in telegram_ids:
        if photo_url and len(text) <= _CAPTION_LIMIT:
            _send_photo_url(tid, photo_url, caption=text)
        elif photo_url:
            _send_photo_url(tid, photo_url)
            _send(tid, text)
        else:
            _send(tid, text)


def _ask_location(chat_id: int) -> None:
    try:
        httpx.post(_API, json={
            "chat_id": chat_id,
            "text": "📍 Buyurtmangizni yetkazib berish uchun joylashuvingizni yuboring\n📍 Отправьте геолокацию для доставки",
            "reply_markup": {
                "keyboard": [[{"text": "📍 Joylashuv yuborish / Геолокация", "request_location": True}]],
                "resize_keyboard": True,
                "one_time_keyboard": True,
            },
        }, timeout=5)
    except Exception:
        pass


def notify_new_order(
    order: Order, user_telegram_id: int | None, receipt_png: bytes | None = None,
    needs_location: bool = True,
) -> None:
    lines = [
        f"🆕 <b>Yangi buyurtma {order.number}</b>",
        f"Restoran ID: {order.restaurant_id}",
        f"Summa: {order.total:,} so'm",
        f"Manzil: {order.address_line}",
        f"Tel: {order.phone or '-'}",
    ]
    text = "\n".join(lines)
    if settings.orders_chat_id:
        _send(settings.orders_chat_id, text)

    # Foydalanuvchiga chek (rasm) + status.
    if user_telegram_id:
        if receipt_png:
            _send_photo(
                user_telegram_id, receipt_png,
                caption=f"🧾 Buyurtmangiz qabul qilindi · № {order.number}",
            )
        else:
            _send(user_telegram_id, _STATUS_TEXT["uz"]["pending"] + f"\n№ {order.number}")

        # Joylashuv hali yo'q bo'lsa — so'raymiz (TMA xaritadan yuborgan bo'lsa, kerak emas).
        if needs_location:
            _ask_location(user_telegram_id)

    # admin PWA push
    webpush.notify_admins(
        f"🆕 Yangi buyurtma {order.number}",
        f"{order.total:,} so'm · {order.address_line}",
        url="/orders",
        tag=f"order-{order.id}",
    )

    # Shu do'kon kuryerlariga — yangi buyurtma mavjud (birinchi qabul qilgan oladi).
    # Courier PWA serverda /courier/ ostida joylashgan.
    webpush.notify_all_couriers(
        f"🆕 Yangi buyurtma № {order.number}",
        f"{order.total:,} so'm · {order.address_line}",
        order.restaurant_id,
        url="/courier/orders",
        tag=f"neworder-{order.id}",
    )


def notify_courier_assigned(order: Order, courier_admin_id: int) -> None:
    """Push to the assigned courier's app (web push)."""
    webpush.notify_courier(
        courier_admin_id,
        f"🛵 Yangi buyurtma № {order.number}",
        f"{order.total:,} so'm · {order.address_line}",
        url=f"/courier/orders/{order.id}",
        tag=f"assign-{order.id}",
    )


def notify_location_update(order_number: str, lat: float, lng: float) -> None:
    if settings.orders_chat_id:
        maps_url = f"https://maps.google.com/?q={lat},{lng}"
        _send(settings.orders_chat_id, f"📍 Buyurtma <b>{order_number}</b> joylashuvi:\n{maps_url}")


def build_status_message(
    status: str,
    order_number: str,
    lang: str | None = "uz",
    courier_name: str | None = None,
    courier_phone: str | None = None,
) -> str:
    """Test va yuborish uchun status matnini yig'adi (bitta til)."""
    text = _status_line(status, lang)
    if not text:
        return ""
    lines = [text, f"№ {order_number}"]
    # Kuryer qabul qilganda (accepted) yoki yo'lda (delivering) — ism/telefon.
    if status in {"accepted", "delivering"}:
        lines.extend(_courier_block(lang, courier_name, courier_phone))
    return "\n".join(lines)


def notify_status_change(
    order: Order,
    user_telegram_id: int,
    lang: str | None = "uz",
    courier_name: str | None = None,
    courier_phone: str | None = None,
) -> None:
    msg = build_status_message(
        order.status.value,
        order.number,
        lang=lang,
        courier_name=courier_name,
        courier_phone=courier_phone,
    )
    if msg:
        _send(user_telegram_id, msg)


def notify_delivering_eta(
    order: Order,
    user_telegram_id: int,
    eta_minutes: int | None,
    distance_km: float | None,
    courier_name: str | None = None,
    courier_phone: str | None = None,
    lang: str | None = "uz",
) -> None:
    """Kuryer 'yetkazilmoqda' — ETA + masofa + kuryer, mijoz tilida."""
    l = _lang(lang)
    if l == "ru":
        lines = [f"🛵 <b>Ваш заказ в пути · № {order.number}</b>"]
        if eta_minutes:
            lines.append(f"⏱ Ориентировочно через <b>{eta_minutes} мин</b>")
        if distance_km:
            lines.append(f"📍 Расстояние: ~{distance_km:g} км")
    else:
        lines = [f"🛵 <b>Buyurtmangiz yo'lda · № {order.number}</b>"]
        if eta_minutes:
            lines.append(f"⏱ Taxminan <b>{eta_minutes} daqiqada</b> yetkaziladi")
        if distance_km:
            lines.append(f"📍 Masofa: ~{distance_km:g} km")
    lines.extend(_courier_block(l, courier_name, courier_phone))
    _send(user_telegram_id, "\n".join(lines))
