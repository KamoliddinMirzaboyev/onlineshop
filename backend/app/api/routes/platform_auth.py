from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_platform_admin
from app.core.db import get_db
from app.core.ratelimit import rate_limiter
from app.core.security import create_access_token, hash_password, verify_password, verify_password_safe
from app.models import PlatformAdmin
from app.schemas.auth import AdminLoginIn, TokenOut
from app.schemas.business import PlatformAdminOut
from app.schemas.courier import ChangePasswordIn

router = APIRouter(prefix="/platform/auth", tags=["platform-auth"])

# IP boshiga 1 daqiqada 10 ta login urinishi.
_login_limit = rate_limiter("platform_login", limit=10, window_seconds=60)


@router.post("/login", response_model=TokenOut, dependencies=[Depends(_login_limit)])
def platform_login(data: AdminLoginIn, db: Session = Depends(get_db)):
    admin = db.scalar(select(PlatformAdmin).where(PlatformAdmin.username == data.username))
    pw_ok = verify_password_safe(data.password, admin.hashed_password if admin else None)
    if not admin or not admin.is_active or not pw_ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    token = create_access_token(subject=str(admin.id), role="platform_superadmin")
    return TokenOut(access_token=token)


@router.get("/me", response_model=PlatformAdminOut)
def platform_me(admin: PlatformAdmin = Depends(get_current_platform_admin)):
    return admin


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    data: ChangePasswordIn,
    admin: PlatformAdmin = Depends(get_current_platform_admin),
    db: Session = Depends(get_db),
):
    if not verify_password(data.old_password, admin.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Eski parol noto'g'ri")
    if data.new_password == data.old_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Yangi parol eskisidan farq qilishi kerak")

    if data.new_username and data.new_username != admin.username:
        existing = db.scalar(select(PlatformAdmin).where(PlatformAdmin.username == data.new_username))
        if existing:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu login allaqachon band")
        admin.username = data.new_username

    admin.hashed_password = hash_password(data.new_password)
    db.commit()
