"""Rasm yuklash — admin paneldan fayl ko'rinishida.

Fayl `UPLOAD_DIR` ga saqlanadi, `/uploads/...` orqali statik beriladi.
Qaytadi: {"url": "<api_base_url>/uploads/<name>"} — TMA va admin shu URL ni
to'g'ridan-to'g'ri <img src> da ishlatadi.

Yuklanganda avtomatik: max 1200px, WebP quality 80 (katta PNG/JPEG → kichik WebP).
"""

import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api.deps import require_uploader
from app.core.config import settings
from app.services.images import process_upload

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# SVG ataylab yo'q — u JavaScript saqlay oladi va same-origin /uploads dan
# berilganda saqlangan XSS bo'ladi. Faqat raster formatlar.
_ALLOWED = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
_MAX_BYTES = 8 * 1024 * 1024  # 8 MB
_CHUNK_BYTES = 256 * 1024  # oqimdan bir marta o'qiladigan bo'lak


def _sniff(data: bytes) -> str | None:
    """Fayl baytlaridan haqiqiy formatni aniqlaydi (clientdan kelgan
    content_type'ga ishonmaymiz). Mos kelmasa None."""
    if data[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return ".gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return None


router = APIRouter(
    prefix="/admin", tags=["uploads"],
    dependencies=[Depends(require_uploader)],
)


@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    if (file.content_type or "") not in _ALLOWED:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Faqat rasm fayllari (jpg, png, webp, gif)",
        )

    # Oqim bilan o'qiymiz: `await file.read()` butun faylni RAM ga solardi —
    # 1-2 GB yuborilsa kichik VPS da OOM killer butun API ni o'chirardi.
    # Chegaradan oshgan zahoti to'xtaymiz, ortiqcha bayt xotiraga tushmaydi.
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(_CHUNK_BYTES):
        total += len(chunk)
        if total > _MAX_BYTES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Fayl 8 MB dan katta")
        chunks.append(chunk)
    data = b"".join(chunks)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Fayl bo'sh")

    # Magic-byte tekshiruvi — kontent haqiqatan rasm ekanini tasdiqlaydi.
    if not _sniff(data):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Fayl haqiqiy rasm emas")

    try:
        optimized, ext = process_upload(data)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Rasm o'qib bo'lmadi") from None

    name = f"{secrets.token_hex(16)}{ext}"
    (UPLOAD_DIR / name).write_bytes(optimized)

    return {"url": f"{settings.api_base_url}/uploads/{name}"}
