"""Fire-and-forget Telegram notifications via Bot API (httpx).

Used by API to ping the user and the orders channel on order events.
Failures are swallowed — a notification problem must never break an order.

Har bir mijozga qaratilgan xabar ikki mustaqil yo'l bilan yetadi: Telegram
(agar `telegram_id` bo'lsa — bot orqali kirgan) va FCM push + ilova ichidagi
"Bildirishnomalar" yozuvi (har doim, `user_id` orqali — OTP/telefon bilan
kirgan, Telegramga ulanmagan mijozlarda ham ishlaydi)."""

import html
import re

import httpx

from app.core.config import settings
from app.core.db import SessionLocal
from app.models import Notification, Order
from app.services import webpush


def _e(s: str | None) -> str:
    """parse_mode=HTML xabarlariga qo'yiladigan erkin matnni escape qiladi
    (address_line/phone/comment/courier nomi — mijoz/xodim kiritadi, tag
    tashlab yuborilsa Telegram API 400 qaytaradi yoki matn soxtalashtiriladi)."""
    return html.escape(s or "", quote=False)


_TAG_RE = re.compile(r"<[^>]+>")


def _plain(s: str) -> str:
    """HTML teglarsiz — ilova bildirishnomalar sahifasida/FCM push'da ko'rsatish uchun."""
    return _TAG_RE.sub("", s).strip()


def _record_and_push(
    user_id: int | None, kind: str, title: str, body_html: str,
    order_id: int | None = None, image_url: str | None = None,
) -> None:
    """Ilova ichidagi Bildirishnomalar yozuvi + FCM push — Telegram bilan
    bog'liq emas, shuning uchun OTP/telefon orqali kirgan (telegram_id yo'q)
    mijozlarda ham ishlaydi. Xato asosiy oqimni to'xtatmaydi."""
    if not user_id:
        return
    body = _plain(body_html)
    try:
        with SessionLocal() as db:
            db.add(Notification(
                user_id=user_id, kind=kind, title=title, body=body,
                order_id=order_id, image_url=image_url,
            ))
            db.commit()
    except Exception:
        pass
    try:
        from app.services import fcm
        fcm.notify_user(
            user_id, title, body,
            url=f"/orders/{order_id}" if order_id else "/",
            tag=f"order-{order_id}" if order_id else None,
        )
    except Exception:
        pass


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
        lines.append(f"👤 {_e(courier_name)}")
    if courier_phone:
        lines.append(f"📞 {_e(courier_phone)}")
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


def _broadcast_title(text: str) -> str:
    """Xabar matnining birinchi qatori — bildirishnomalar ro'yxatida sarlavha."""
    first = next((l for l in _plain(text).splitlines() if l.strip()), "")
    first = first.strip()
    return (first[:77] + "…") if len(first) > 80 else (first or "📣 Yangilik")


def broadcast_post(recipients: list[tuple[int, int | None]], text: str, photo_url: str | None) -> None:
    """Admin/tadbirkor panelidan mijozlarga bot orqali post yuborish (rasm/matn/ikkalasi).

    `recipients` — (user_id, telegram_id) juftliklari; telegram_id yo'q
    (OTP bilan kirgan) mijozlar ham FCM push + ilova bildirishnomasini oladi."""
    title = _broadcast_title(text)
    for user_id, tid in recipients:
        if tid:
            if photo_url and len(text) <= _CAPTION_LIMIT:
                _send_photo_url(tid, photo_url, caption=text)
            elif photo_url:
                _send_photo_url(tid, photo_url)
                _send(tid, text)
            else:
                _send(tid, text)
        _record_and_push(user_id, "broadcast", title, text, image_url=photo_url)


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
    order: Order, user_id: int | None, user_telegram_id: int | None,
    receipt_png: bytes | None = None, needs_location: bool = True,
) -> None:
    lines = [
        f"🆕 <b>Yangi buyurtma {order.number}</b>",
        f"Restoran ID: {order.restaurant_id}",
        f"Summa: {order.total:,} so'm",
        f"Manzil: {_e(order.address_line)}",
        f"Tel: {_e(order.phone) or '-'}",
    ]
    if order.comment:
        lines.append(f"Izoh: {_e(order.comment)}")
    text = "\n".join(lines)
    if settings.orders_chat_id:
        _send(settings.orders_chat_id, text)

    # Foydalanuvchiga chek (rasm) + status — bot orqali (telegram_id bo'lsa).
    pending_title = _STATUS_TEXT["uz"]["pending"]
    pending_text = pending_title + f"\n№ {order.number}"
    if user_telegram_id:
        if receipt_png:
            _send_photo(
                user_telegram_id, receipt_png,
                caption=f"🧾 Buyurtmangiz qabul qilindi · № {order.number}",
            )
        else:
            _send(user_telegram_id, pending_text)

        # Joylashuv hali yo'q bo'lsa — so'raymiz (TMA xaritadan yuborgan bo'lsa, kerak emas).
        if needs_location:
            _ask_location(user_telegram_id)

    # Ilova bildirishnomasi + FCM push — telegram_id bor-yo'qligidan qat'i nazar.
    _record_and_push(user_id, "order_status", pending_title, pending_text, order_id=order.id)

    # admin PWA push — faqat shu buyurtmaning do'koniga. Kuryerlarga bu yerda
    # push yuborilmaydi: buyurtmani admin qabul qilib, kuryer biriktiradi —
    # o'sha payt notify_courier_assigned ishlaydi.
    webpush.notify_admins(
        f"🆕 Yangi buyurtma {order.number}",
        f"{order.total:,} so'm · {order.address_line}",
        order.restaurant_id,
        url="/orders",
        tag=f"order-{order.id}",
    )


def notify_courier_assigned(order: Order, courier_admin_id: int) -> None:
    """Push to the assigned courier (web push + FCM)."""
    title = f"🛵 Yangi buyurtma № {order.number}"
    body = f"{order.total:,} so'm · {order.address_line}"
    webpush.notify_courier(
        courier_admin_id,
        title,
        body,
        url=f"/courier/orders/{order.id}",
        tag=f"assign-{order.id}",
    )
    from app.services import fcm

    fcm.notify_courier(
        courier_admin_id,
        title,
        body,
        url=f"/orders/{order.id}",
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
    user_id: int | None,
    user_telegram_id: int | None,
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
    if not msg:
        return
    if user_telegram_id:
        _send(user_telegram_id, msg)
    _record_and_push(
        user_id, "order_status", _status_line(order.status.value, lang), msg, order_id=order.id,
    )


def notify_delivering_eta(
    order: Order,
    user_id: int | None,
    user_telegram_id: int | None,
    eta_minutes: int | None,
    distance_km: float | None,
    courier_name: str | None = None,
    courier_phone: str | None = None,
    lang: str | None = "uz",
    receipt_png: bytes | None = None,
) -> None:
    """Kuryer 'yetkazilmoqda' — ETA + masofa + kuryer + (ixtiyoriy) yangilangan chek."""
    l = _lang(lang)
    total = int(order.total or 0)
    if l == "ru":
        lines = [f"🛵 <b>Ваш заказ в пути · № {order.number}</b>"]
        if eta_minutes:
            lines.append(f"⏱ Ориентировочно через <b>{eta_minutes} мин</b>")
        if distance_km:
            lines.append(f"📍 Расстояние: ~{distance_km:g} км")
        lines.append(f"💳 Итого: <b>{total:,} сум</b>".replace(",", " "))
        receipt_caption = f"🧾 Актуальный чек · № {order.number} · {total:,} сум".replace(",", " ")
    else:
        lines = [f"🛵 <b>Buyurtmangiz yo'lda · № {order.number}</b>"]
        if eta_minutes:
            lines.append(f"⏱ Taxminan <b>{eta_minutes} daqiqada</b> yetkaziladi")
        if distance_km:
            lines.append(f"📍 Masofa: ~{distance_km:g} km")
        lines.append(f"💳 Jami: <b>{total:,} so'm</b>".replace(",", " "))
        receipt_caption = f"🧾 Yangilangan chek · № {order.number} · {total:,} so'm".replace(",", " ")
    lines.extend(_courier_block(l, courier_name, courier_phone))
    text = "\n".join(lines)

    # Avval yangilangan chek (miqdor/summa o'zgargan bo'lishi mumkin), keyin ETA matni.
    if user_telegram_id:
        if receipt_png:
            _send_photo(user_telegram_id, receipt_png, caption=receipt_caption[:1024])
        _send(user_telegram_id, text)

    eta_title = "🛵 Buyurtmangiz yo'lda" if l != "ru" else "🛵 Ваш заказ в пути"
    _record_and_push(user_id, "order_status", eta_title, text, order_id=order.id)


def notify_eta_update(
    order: Order,
    user_id: int | None,
    user_telegram_id: int | None,
    eta_minutes: int,
    lang: str | None = "uz",
) -> None:
    """Marshrut qayta hisoblanganda qisqa ETA yangilanishi (spam'siz)."""
    l = _lang(lang)
    if l == "ru":
        text = (
            f"⏱ <b>Обновление ETA · № {order.number}</b>\n"
            f"Курьер перестроил маршрут — ориентировочно через <b>{eta_minutes} мин</b>"
        )
    else:
        text = (
            f"⏱ <b>ETA yangilandi · № {order.number}</b>\n"
            f"Kuryer marshrutni yangiladi — taxminan <b>{eta_minutes} daqiqa</b>"
        )
    if user_telegram_id:
        _send(user_telegram_id, text)
    title = "⏱ Обновление ETA" if l == "ru" else "⏱ ETA yangilandi"
    _record_and_push(user_id, "order_status", title, text, order_id=order.id)


def notify_order_adjusted(
    order: Order,
    user_id: int | None,
    user_telegram_id: int | None,
    lang: str | None = "uz",
    receipt_png: bytes | None = None,
) -> None:
    """Kuryer miqdorni tahrirlaganda — mijozga yangi chek + summa."""
    l = _lang(lang)
    total = int(order.total or 0)
    if l == "ru":
        text = (
            f"✏️ <b>Заказ обновлён · № {order.number}</b>\n"
            f"Количество/состав изменены курьером.\n"
            f"💳 Новая сумма: <b>{total:,} сум</b>".replace(",", " ")
        )
        caption = f"🧾 Обновлённый чек · № {order.number} · {total:,} сум".replace(",", " ")
    else:
        text = (
            f"✏️ <b>Buyurtma yangilandi · № {order.number}</b>\n"
            f"Kuryer miqdor/tarkibni tahrirladi.\n"
            f"💳 Yangi summa: <b>{total:,} so'm</b>".replace(",", " ")
        )
        caption = f"🧾 Yangilangan chek · № {order.number} · {total:,} so'm".replace(",", " ")

    if user_telegram_id:
        if receipt_png:
            _send_photo(user_telegram_id, receipt_png, caption=caption[:1024])
        _send(user_telegram_id, text)

    title = "✏️ Заказ обновлён" if l == "ru" else "✏️ Buyurtma yangilandi"
    _record_and_push(user_id, "order_status", title, text, order_id=order.id)
