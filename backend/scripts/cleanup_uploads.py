"""Yetim rasmlarni tozalash: hech bir yozuvda ishlatilmaydigan fayllarni o'chiradi.

Mahsulot/banner o'chirilganda fayl `uploads/` da qolib ketardi va papka cheksiz
o'sardi. Faylni yozuv o'chirilgan paytda o'chirib bo'lmaydi: `order_items`
mahsulot rasmini SNAPSHOT sifatida saqlaydi, ya'ni mahsulot o'chsa ham eski
buyurtma cheki o'sha faylga ishora qilib turadi. Shuning uchun bu yerda teskari
yo'l: BARCHA jadvallardagi havolalar yig'iladi va ro'yxatga tushmagan fayllar
o'chiriladi.

Ishlatish (server'da):
    docker compose -f docker-compose.prod.yml exec api \\
        python -m scripts.cleanup_uploads            # faqat ko'rsatadi
    docker compose -f docker-compose.prod.yml exec api \\
        python -m scripts.cleanup_uploads --delete   # haqiqatan o'chiradi

Oyiga bir marta cron'ga qo'yish kifoya.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import (
    Announcement,
    Banner,
    Category,
    Notification,
    OrderItem,
    Product,
    Restaurant,
)

UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"

# Yangi yuklangan, lekin hali hech qaysi yozuvga biriktirilmagan fayl (admin
# rasmni yukladi, formani hali saqlamadi) tasodifan o'chib ketmasin.
GRACE_DAYS = 7

# (model, ustun) — upload havolasini saqlashi mumkin bo'lgan hamma joy.
_URL_COLUMNS = (
    (Product, "image_url"),
    (Category, "image_url"),
    (Banner, "image_url"),
    (Announcement, "image_url"),
    (Notification, "image_url"),
    (OrderItem, "image_url"),      # buyurtma tarixidagi snapshot
    (Restaurant, "logo_url"),
    (Restaurant, "cover_url"),
)


def _filename(url: str | None) -> str | None:
    """URL'dan fayl nomi: '.../uploads/ab12.webp' → 'ab12.webp'."""
    if not url:
        return None
    name = url.split("?", 1)[0].rstrip("/").rsplit("/", 1)[-1]
    return name or None


def referenced_filenames() -> set[str]:
    names: set[str] = set()
    with SessionLocal() as db:
        for model, column in _URL_COLUMNS:
            col = getattr(model, column)
            for (url,) in db.execute(select(col).where(col.is_not(None))):
                name = _filename(url)
                if name:
                    names.add(name)
    return names


def find_orphans(grace_days: int = GRACE_DAYS) -> list[Path]:
    if not UPLOAD_DIR.is_dir():
        return []
    keep = referenced_filenames()
    cutoff = time.time() - grace_days * 86400
    orphans = []
    for path in sorted(UPLOAD_DIR.iterdir()):
        if not path.is_file() or path.name.startswith("."):
            continue
        if path.name in keep:
            continue
        if path.stat().st_mtime > cutoff:
            continue  # juda yangi — hali saqlanmagan forma bo'lishi mumkin
        orphans.append(path)
    return orphans


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--delete", action="store_true",
        help="Haqiqatan o'chirish (standart: faqat ro'yxat).",
    )
    parser.add_argument(
        "--grace-days", type=int, default=GRACE_DAYS,
        help=f"Shu kundan yangi fayllarga tegilmaydi (standart {GRACE_DAYS}).",
    )
    args = parser.parse_args(argv)

    orphans = find_orphans(args.grace_days)
    total = sum(p.stat().st_size for p in orphans)
    for path in orphans:
        print(f"{'O‘CHIRILDI' if args.delete else 'yetim'}  {path.name}"
              f"  {path.stat().st_size // 1024} KB")
        if args.delete:
            path.unlink(missing_ok=True)

    print(f"\n{len(orphans)} ta yetim fayl, jami {total / 1_048_576:.1f} MB"
          f"{'' if args.delete else ' — o‘chirish uchun --delete'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
