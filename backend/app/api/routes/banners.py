from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.banner import Banner
from app.schemas.banner import BannerOut

router = APIRouter(prefix="/banners", tags=["banners"])


@router.get("", response_model=list[BannerOut])
def get_public_banners(restaurant_id: int | None = None, db: Session = Depends(get_db)):
    """Mijoz ilovasi (mijoz_app) uchun faol bannerlar."""
    stmt = (
        select(Banner)
        .where(Banner.is_active.is_(True))
        .order_by(Banner.sort_order, Banner.id.desc())
    )
    if restaurant_id is not None:
        stmt = stmt.where(Banner.restaurant_id == restaurant_id)
    return db.scalars(stmt).all()
