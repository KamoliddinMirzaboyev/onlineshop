from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import AppVersion
from app.schemas.app_version import AppVersionOut

router = APIRouter(prefix="/app", tags=["app-version"])


@router.get("/version/{app}", response_model=AppVersionOut)
def get_app_version(app: str, db: Session = Depends(get_db)):
    """Majburiy yangilanish tekshiruvi — auth talab qilinmaydi, eski/token'siz build ham
    chaqira olishi kerak. Yozuv topilmasa hech kim bloklanmasligi uchun 0 qaytariladi."""
    row = db.scalar(select(AppVersion).where(AppVersion.app == app))
    if row is None:
        return AppVersionOut(min_version_code=0, store_url=None)
    return row
