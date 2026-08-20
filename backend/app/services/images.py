"""Rasm optimizatsiya — upload va mavjud fayllar uchun.

Max tomon 1200px, WebP quality 80. 4MB PNG → odatda 50–150KB.
"""

from __future__ import annotations

import io
from pathlib import Path

from PIL import Image, ImageOps

# Mobil kartochka/banner uchun yetarli; undan kattasi faqat trafik yeydi.
MAX_SIDE = 1200
WEBP_QUALITY = 80
# Mavjud fayllarni qayta yozishda (URL o'zgarmasin) format saqlanadi.
JPEG_QUALITY = 82

# Decompression-bomb himoyasi: 8MB fayl ichida header'da 100000x100000 kabi
# piksel o'lchamini e'lon qilib, dekodlashda serverni xotiradan chiqarib
# yuborish mumkin. 25MP (masalan 6000x4000) har qanday oddiy mahsulot rasmi
# uchun yetarli; Pillow bundan katta bo'lsa DecompressionBombError chiqaradi.
Image.MAX_IMAGE_PIXELS = 25_000_000


def process_upload(data: bytes) -> tuple[bytes, str]:
    """Yangi upload: har doim WebP qaytaradi.

    Returns: (bytes, ".webp")
    """
    im = _open(data)
    im = _normalize(im)
    buf = io.BytesIO()
    im.save(buf, format="WEBP", quality=WEBP_QUALITY, method=4)
    return buf.getvalue(), ".webp"


def reprocess_file(path: Path) -> bool:
    """Mavjud faylni joyida siqadi (URL/extension saqlanadi).

    Returns True agar yozilgan bo'lsa.
    """
    if not path.is_file():
        return False
    raw = path.read_bytes()
    if len(raw) < 200:
        return False  # 1x1 placeholder / buzilgan
    try:
        im = _open(raw)
    except Exception:
        return False
    im = _normalize(im)
    ext = path.suffix.lower()
    buf = io.BytesIO()
    if ext in (".jpg", ".jpeg"):
        im.convert("RGB").save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    elif ext == ".webp":
        im.save(buf, format="WEBP", quality=WEBP_QUALITY, method=4)
    elif ext == ".gif":
        # Statik GIF — PNG sifatida optimallashtirish o'rniga WebP emas (ext saqlanadi)
        im.convert("RGBA").save(buf, format="GIF", optimize=True)
    else:
        # .png va boshqa
        if im.mode == "RGBA":
            im.save(buf, format="PNG", optimize=True, compress_level=9)
        else:
            im.convert("RGB").save(buf, format="PNG", optimize=True, compress_level=9)
    out = buf.getvalue()
    if len(out) >= len(raw) and max(Image.open(io.BytesIO(raw)).size) <= MAX_SIDE:
        return False  # yaxshilanmadi
    path.write_bytes(out)
    return True


def _open(data: bytes) -> Image.Image:
    im: Image.Image = Image.open(io.BytesIO(data))
    # EXIF orientation (telefon kameralari)
    im_t = ImageOps.exif_transpose(im)
    if im_t is not None:
        im = im_t
    # Animatsiyali GIF/WebP — faqat birinchi freym
    if getattr(im, "is_animated", False):
        im.seek(0)
        im = im.copy()
    else:
        im.load()
    return im


def _normalize(im: Image.Image) -> Image.Image:
    # Palette / CMYK → RGB/RGBA
    if im.mode == "P":
        im = im.convert("RGBA" if "transparency" in im.info else "RGB")
    elif im.mode == "LA":
        im = im.convert("RGBA")
    elif im.mode == "CMYK":
        im = im.convert("RGB")
    elif im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGB")

    w, h = im.size
    if max(w, h) > MAX_SIDE:
        im = im.copy()
        im.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
    return im
