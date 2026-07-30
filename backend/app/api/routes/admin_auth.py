from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.core.db import get_db
from app.core.ratelimit import rate_limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.models import AdminUser
from app.schemas.admin import AdminUserOut
from app.schemas.auth import AdminLoginIn, TokenOut
from app.schemas.courier import ChangePasswordIn, ProfileUpdateIn

router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])

# IP boshiga 1 daqiqada 10 ta login urinishi.
_login_limit = rate_limiter("admin_login", limit=10, window_seconds=60)


@router.post("/login", response_model=TokenOut, dependencies=[Depends(_login_limit)])
def admin_login(data: AdminLoginIn, db: Session = Depends(get_db)):
    # Kuryer login maydoniga username o'rniga telefon raqamini ham kiritishi
    # mumkin — ikkalasi ham qabul qilinadi.
    admin = db.scalar(
        select(AdminUser).where(
            or_(AdminUser.username == data.username, AdminUser.phone == data.username)
        )
    )
    if not admin or not admin.is_active or not verify_password(data.password, admin.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    token = create_access_token(subject=str(admin.id), role=admin.role.value)
    return TokenOut(access_token=token)


@router.get("/me", response_model=AdminUserOut)
def admin_me(admin: AdminUser = Depends(get_current_admin)):
    return admin


@router.patch("/me", response_model=AdminUserOut)
def update_profile(
    data: ProfileUpdateIn,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Ism/familiya va telefon — kuryer/admin o'zi tahrirlaydi."""
    payload = data.model_dump(exclude_unset=True)
    if "name" in payload:
        name = (payload["name"] or "").strip() or None
        admin.name = name
    if "phone" in payload:
        phone = (payload["phone"] or "").strip() or None
        if phone:
            existing = db.scalar(
                select(AdminUser).where(AdminUser.phone == phone, AdminUser.id != admin.id)
            )
            if existing:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu telefon allaqachon band")
        admin.phone = phone
    db.commit()
    db.refresh(admin)
    return admin


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    data: ChangePasswordIn,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if not verify_password(data.old_password, admin.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Eski parol noto'g'ri")
    if data.new_password == data.old_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Yangi parol eskisidan farq qilishi kerak")

    if data.new_username and data.new_username != admin.username:
        existing = db.scalar(select(AdminUser).where(AdminUser.username == data.new_username))
        if existing:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu login allaqachon band")
        admin.username = data.new_username

    admin.hashed_password = hash_password(data.new_password)
    db.commit()
