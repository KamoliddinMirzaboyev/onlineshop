from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import decode_token
from app.models import AdminUser, Business, PlatformAdmin, Restaurant, User
from app.models.enums import AdminRole


def _bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    return authorization.split(" ", 1)[1]


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(_bearer(authorization))
    if not payload or payload.get("role") != "user":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    # Qisqa muddatli stream ticket'lar oddiy API uchun yaroqsiz.
    if payload.get("purpose"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = db.get(User, int(payload["sub"]))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    if user.is_blocked:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Akkauntingiz bloklangan")
    return user


def get_current_admin(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AdminUser:
    payload = decode_token(_bearer(authorization))
    if not payload or payload.get("role") not in {r.value for r in AdminRole}:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid admin token")
    if payload.get("purpose"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid admin token")
    admin = db.get(AdminUser, int(payload["sub"]))
    if not admin or not admin.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Admin not found")
    return admin


def require_superadmin(admin: AdminUser = Depends(get_current_admin)) -> AdminUser:
    if admin.role != AdminRole.superadmin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Superadmin only")
    return admin


# Admin panel (do'kon/buyurtma/ombor) — faqat superadmin va manager.
# Kuryerlar bu yerga kira olmaydi (ularda alohida /courier router bor).
def require_staff(admin: AdminUser = Depends(get_current_admin)) -> AdminUser:
    if admin.role not in {AdminRole.superadmin, AdminRole.manager}:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Staff only")
    return admin


def get_current_business(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Business:
    payload = decode_token(_bearer(authorization))
    if not payload or payload.get("role") != "businessman":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid business token")
    if payload.get("purpose"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid business token")
    business = db.get(Business, int(payload["sub"]))
    if not business or not business.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Business not found")
    return business


def require_business(business: Business = Depends(get_current_business)) -> Business:
    return business


def get_current_platform_admin(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> PlatformAdmin:
    payload = decode_token(_bearer(authorization))
    if not payload or payload.get("role") != "platform_superadmin":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid platform token")
    if payload.get("purpose"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid platform token")
    admin = db.get(PlatformAdmin, int(payload["sub"]))
    if not admin or not admin.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Platform admin not found")
    return admin


def require_platform_admin(
    admin: PlatformAdmin = Depends(get_current_platform_admin),
) -> PlatformAdmin:
    return admin


# ── Scoping: bitta endpoint, ikki xil principal (do'kon xodimi yoki tadbirkor) ──
def get_current_staff_or_business(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AdminUser | Business:
    """Do'kon xodimi (superadmin/manager) yoki tadbirkor (Business) tokenini qabul qiladi.

    Kuryer bu yerga kira olmaydi — unda alohida /courier router bor.
    """
    payload = decode_token(_bearer(authorization))
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    if payload.get("purpose"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    role = payload.get("role")

    if role == "businessman":
        business = db.get(Business, int(payload["sub"]))
        if not business or not business.is_active:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Business not found")
        return business

    if role in {AdminRole.superadmin.value, AdminRole.manager.value}:
        admin = db.get(AdminUser, int(payload["sub"]))
        if not admin or not admin.is_active:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Admin not found")
        return admin

    raise HTTPException(status.HTTP_403_FORBIDDEN, "Staff or business only")


def current_restaurant(
    restaurant_id: int | None = None,
    principal: AdminUser | Business = Depends(get_current_staff_or_business),
    db: Session = Depends(get_db),
) -> Restaurant:
    """Amal qilinayotgan do'konni aniqlaydi va egalikni tekshiradi.

    - Do'kon xodimi: har doim o'z `admin.restaurant_id`si. `restaurant_id` query
      param berilsa ham e'tiborga olinmaydi.
    - Tadbirkor: `restaurant_id` MAJBURIY va unga tegishli bo'lishi shart.
    """
    if isinstance(principal, Business):
        if restaurant_id is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "restaurant_id required")
        store = db.get(Restaurant, restaurant_id)
        if not store or store.business_id != principal.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your store")
        return store

    store = db.get(Restaurant, principal.restaurant_id)
    if not store:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Store not found")
    return store


def require_store_admin_or_business(
    principal: AdminUser | Business = Depends(get_current_staff_or_business),
) -> AdminUser | Business:
    """Xodim boshqaruvi uchun: do'kon superadmin'i yoki tadbirkor (manager emas)."""
    if isinstance(principal, AdminUser) and principal.role != AdminRole.superadmin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Superadmin or business only")
    return principal


def require_uploader(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AdminUser | Business | PlatformAdmin:
    """Rasm yuklash — do'kon xodimi va tadbirkor (mahsulot rasmi), hamda platform
    admin (e'lon rasmi). Kuryer va oddiy foydalanuvchi kira olmaydi."""
    payload = decode_token(_bearer(authorization))
    if payload and payload.get("role") == "platform_superadmin":
        admin = db.get(PlatformAdmin, int(payload["sub"]))
        if not admin or not admin.is_active:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Platform admin not found")
        return admin
    return get_current_staff_or_business(authorization=authorization, db=db)
