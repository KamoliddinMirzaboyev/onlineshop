"""Render an order receipt as a PNG (Pillow), sent to the user via the bot.

Uses bundled DejaVuSans/-Bold TTFs (app/assets/fonts) — Pillow's own
ImageFont.load_default() only has full coverage for plain ASCII; Cyrillic, the
№ sign, curly apostrophes ('), and emoji all fall back to the same tofu-box
glyph. DejaVuSans has real Cyrillic + Latin Extended coverage. It still has no
color-emoji glyphs, so the receipt draws its own icons instead of emoji.

Har bir mahsulot yonida rasm (thumbnail) ko'rsatiladi — rasm URL'i order_item
snapshot'idan olinadi va yuklab olinadi (xato/timeout — o'rniga harf-belgili
placeholder chiziladi, chek hech qachon buzilmaydi).
"""

import ipaddress
import socket
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse

import httpx
from PIL import Image, ImageDraw, ImageFont

from app.models import Order

_PAYMENT = {"cash": "Naqd", "payme": "Payme", "click": "Click", "uzum": "Uzum"}

_FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"
_REGULAR = _FONT_DIR / "DejaVuSans.ttf"
_BOLD = _FONT_DIR / "DejaVuSans-Bold.ttf"

W = 640
PAD = 36
BRAND = (22, 163, 74)  # #16A34A
INK = (20, 20, 20)
MUTED = (130, 130, 130)
LINE = (232, 232, 232)
CARD = (248, 248, 248)
TOTAL_BG = (240, 253, 244)  # green-50
THUMB = 56                       # mahsulot rasmi o'lchami
ROW_H = THUMB + 18               # bitta mahsulot qatori balandligi
NOTE_H = 24                      # izohli mahsulot uchun qo'shimcha balandlik


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(_BOLD if bold else _REGULAR), size)


def _money(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def _placeholder(name: str, size: int, font: ImageFont.FreeTypeFont) -> Image.Image:
    """Rasm yuklanmagan/yo'q mahsulot uchun — bo'sh tofu-box o'rniga mahsulot
    nomining birinchi harfi bilan chiroyli monogram chizamiz."""
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, size, size], radius=14, fill=CARD)
    letter = (name.strip()[:1] or "?").upper()
    bbox = d.textbbox((0, 0), letter, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text((size / 2 - tw / 2 - bbox[0], size / 2 - th / 2 - bbox[1]), letter, font=font, fill=BRAND)
    return im


def _is_public_http_url(url: str) -> bool:
    """SSRF himoyasi: image_url admin/tadbirkor tomonidan erkin kiritiladi —
    ichki tarmoq/localhost/metadata (169.254.169.254 va h.k.)ga so'rov
    yubormasligimiz kerak."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            return False
        for info in socket.getaddrinfo(parsed.hostname, None):
            ip = ipaddress.ip_address(info[4][0])
            if not ip.is_global or ip.is_private or ip.is_loopback or ip.is_link_local:
                return False
        return True
    except Exception:
        return False


def _rounded_thumb(url: str | None, size: int) -> Image.Image | None:
    """Mahsulot rasmini yuklab, kvadrat kesib, yumaloq burchakli qiladi.
    Xato/timeout/ichki-tarmoq URL — None (chaqiruvchi o'rniga placeholder chizadi)."""
    if not url or not _is_public_http_url(url):
        return None
    try:
        # Redirect orqali ichki manzilga yo'naltirishning oldini olish uchun
        # follow_redirects=False — o'z uploads/CDN havolalari redirect qilmaydi.
        r = httpx.get(url, timeout=6, follow_redirects=False)
        if r.status_code != 200:
            return None
        im = Image.open(BytesIO(r.content)).convert("RGB")
    except Exception:
        return None
    # markazdan kvadrat kesish
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2)).resize(
        (size, size), Image.Resampling.LANCZOS
    )
    # yumaloq burchak maskasi
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size, size], radius=14, fill=255)
    im.putalpha(mask)
    return im


def render_receipt(order: Order) -> bytes:
    f_title = _font(34, bold=True)
    f_h = _font(22, bold=True)
    f = _font(21)
    f_b = _font(21, bold=True)
    f_sm = _font(16)
    f_xs = _font(14, bold=True)

    # rasmlarni oldindan yuklab olamiz — yuklanmasa harf-monogram bilan almashtiramiz
    thumbs = [
        _rounded_thumb(it.image_url, THUMB) or _placeholder(it.name_uz, THUMB, f_h)
        for it in order.items
    ]

    # --- balandlikni o'lchaymiz ---
    head = PAD + 180 + 35 + 20                 # logo + title + number + date
    # izohli mahsulot qatori balandroq (NOTE_H qo'shimcha).
    notes_extra = sum(NOTE_H for it in order.items if it.note)
    items_block = 30 + len(order.items) * ROW_H + notes_extra + 20
    totals_block = 3 * 34 + 28
    addr_lines = 2 + (1 if getattr(order, "customer_name", None) else 0) + (1 if order.phone else 0) + (1 if order.comment else 0)
    addr_block = 30 + addr_lines * 28 + 20
    footer = 50
    H = head + items_block + totals_block + addr_block + footer + PAD

    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)

    # tepa brand chizig'i
    d.rectangle([0, 0, W, 10], fill=BRAND)
    y = PAD + 10

    # logotipni chizish
    try:
        logo_path = _FONT_DIR.parent / "bblogo.png"
        if logo_path.exists():
            logo = Image.open(logo_path).convert("RGBA")
            lw, lh = logo.size
            logo_h = 75
            logo_w = int(lw * (logo_h / lh))
            logo = logo.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
            img.paste(logo, (W // 2 - logo_w // 2, y), logo)
            y += logo_h + 15
    except Exception:
        pass

    # Sarlavha
    title = "BARAKALI BOZOR"
    tw = d.textlength(title, font=f_title)
    d.text((W // 2 - tw // 2, y), title, font=f_title, fill=BRAND)
    y += 55

    # Buyurtma ma'lumotlari
    d.text((PAD, y), f"Buyurtma № {order.number}", font=f_h, fill=INK)
    date_str = order.created_at.strftime("%d.%m.%Y  %H:%M")
    dw = d.textlength(date_str, font=f_sm)
    d.text((W - PAD - dw, y + 4), date_str, font=f_sm, fill=MUTED)
    y += 35
    d.line([PAD, y, W - PAD, y], fill=LINE, width=2)
    y += 20

    # mahsulotlar — rasm + nom + miqdor/narx
    d.text((PAD, y), "MAHSULOTLAR", font=f_xs, fill=MUTED)
    y += 30
    for it, thumb in zip(order.items, thumbs):
        img.paste(thumb, (PAD, y), thumb)

        tx = PAD + THUMB + 16
        name = it.name_uz
        if len(name) > 26:
            name = name[:25] + "…"
        d.text((tx, y + 6), name, font=f, fill=INK)
        unit = it.unit or "dona"
        d.text(
            (tx, y + 6 + 28),
            f"{it.quantity:g} {unit} × {_money(it.price)} so'm",
            font=f_sm,
            fill=MUTED,
        )
        amount = _money(it.price * it.quantity) + " so'm"
        aw = d.textlength(amount, font=f_b)
        d.text((W - PAD - aw, y + THUMB // 2 - 12), amount, font=f_b, fill=INK)
        y += ROW_H
        # mahsulot izohi (bo'lsa) — rasm ostida, qisqartirilgan
        if it.note:
            note = it.note if len(it.note) <= 48 else it.note[:47] + "…"
            d.text((PAD + THUMB + 16, y - 6), f"Izoh: {note}", font=f_xs, fill=MUTED)
            y += NOTE_H
    y += 2
    d.line([PAD, y, W - PAD, y], fill=LINE, width=2)
    y += 16

    # totallar (Jami — brand fonli ajratilgan qatorcha)
    def row(label: str, value: str, bold: bool = False):
        nonlocal y
        ff = f_b if bold else f
        d.text((PAD, y), label, font=ff, fill=INK)
        w = d.textlength(value, font=ff)
        d.text((W - PAD - w, y), value, font=ff, fill=BRAND if bold else INK)
        y += 34

    row("Mahsulotlar", _money(order.items_total) + " so'm")
    row("Yetkazish", _money(order.delivery_fee) + " so'm")
    d.rounded_rectangle([PAD - 12, y - 6, W - PAD + 12, y + 34], radius=12, fill=TOTAL_BG)
    row("Jami", _money(order.total) + " so'm", bold=True)
    y += 12
    d.line([PAD, y, W - PAD, y], fill=LINE, width=2)
    y += 20

    # yetkazish ma'lumoti
    d.text((PAD, y), "YETKAZISH", font=f_xs, fill=MUTED)
    y += 30
    if getattr(order, "customer_name", None):
        d.text((PAD, y), f"Mijoz:   {order.customer_name}", font=f_sm, fill=INK)
        y += 28
    d.text((PAD, y), f"Manzil:  {order.address_line}", font=f_sm, fill=INK)
    y += 28
    d.text((PAD, y), f"To'lov:  {_PAYMENT.get(order.payment_method.value, '-')}", font=f_sm, fill=INK)
    y += 28
    if order.phone:
        d.text((PAD, y), f"Telefon: {order.phone}", font=f_sm, fill=INK)
        y += 28
    if order.comment:
        d.text((PAD, y), f"Izoh:    {order.comment}", font=f_sm, fill=MUTED)
        y += 28

    y += 10
    thanks = "Buyurtmangiz uchun rahmat!"
    tw = d.textlength(thanks, font=f_sm)
    d.text(((W - tw) / 2, y), thanks, font=f_sm, fill=MUTED)

    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
