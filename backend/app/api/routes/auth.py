import logging

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, resolve_refresh_principal, revoke_session
from app.core.config import settings
from app.core.db import get_db
from app.core.token_blacklist import is_revoked
from app.core.phone import normalize_phone
from app.core.ratelimit import rate_limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    verify_telegram_init_data,
)
from app.models import User
from app.schemas.auth import (
    AuthResult,
    FCMTokenIn,
    LogoutIn,
    OtpRequestIn,
    OtpVerifyIn,
    RefreshTokenIn,
    TelegramAuthIn,
    TokenOut,
    UserOut,
    UserUpdateIn,
)
from app.services.otp import OtpError, send_otp, verify_otp

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

_tg_auth_limit = rate_limiter("tg_auth", limit=30, window_seconds=60)
_otp_request_limit = rate_limiter("otp_request", limit=5, window_seconds=60)
_otp_verify_limit = rate_limiter("otp_verify", limit=15, window_seconds=60)

_ALLOWED_LANGS = frozenset({"uz", "ru"})


def _lang_from_tg(code: str | None) -> str:
    raw = (code or "uz")[:2].lower()
    return raw if raw in _ALLOWED_LANGS else "uz"


def _get_or_create_tg_user(db: Session, tg: dict) -> User:
    """telegram_id bo'yicha user; concurrent create — IntegrityError → re-select."""
    tg_id = int(tg["id"])
    user = db.scalar(select(User).where(User.telegram_id == tg_id))
    if user:
        user.username = tg.get("username") or user.username
        # first_name profil orqali — TG bilan qayta yozilmaydi
        return user

    user = User(
        telegram_id=tg_id,
        username=tg.get("username"),
        first_name=tg.get("first_name"),
        last_name=tg.get("last_name"),
        language=_lang_from_tg(tg.get("language_code")),
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        user = db.scalar(select(User).where(User.telegram_id == tg_id))
        if not user:
            raise
        user.username = tg.get("username") or user.username
    return user


@router.post("/telegram", response_model=AuthResult, dependencies=[Depends(_tg_auth_limit)])
def telegram_auth(data: TelegramAuthIn, db: Session = Depends(get_db)):
    parsed = verify_telegram_init_data(data.init_data)
    if not parsed or "user" not in parsed:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid initData")

    tg = parsed["user"]
    user = _get_or_create_tg_user(db, tg)
    if user.is_blocked:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Akkauntingiz bloklangan")
    # Botdagi onboarding (telefon + ism) yakunlanmagan bo'lsa — Mini App'ga
    # kirishga ruxsat yo'q. "Open" tugmasi bot FSM'ni chetlab o'tadi; yagona
    # chokepoint shu yer.
    if not (user.phone and user.first_name):
        db.commit()
        raise HTTPException(status.HTTP_403_FORBIDDEN, "onboarding_required")
    db.commit()
    db.refresh(user)

    access_token = create_access_token(subject=str(user.id), role="user")
    refresh_token = create_refresh_token(subject=str(user.id), role="user")
    return AuthResult(
        token=TokenOut(access_token=access_token, refresh_token=refresh_token),
        user=UserOut.model_validate(user),
    )


@router.post("/otp/request", dependencies=[Depends(_otp_request_limit)])
def otp_request(data: OtpRequestIn):
    try:
        send_otp(data.phone)
    except OtpError as e:
        # Shlyuz ishlamayapti — mijozga aniq xabar, sabab faqat jurnalda.
        logger.error("OTP yuborilmadi: %s", e)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "SMS yuborib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.",
        ) from None
    return {"status": "ok", "expires_in": settings.otp_ttl_seconds}


@router.post("/otp/verify", response_model=AuthResult, dependencies=[Depends(_otp_verify_limit)])
def otp_verify(data: OtpVerifyIn, db: Session = Depends(get_db)):
    if not verify_otp(data.phone, data.code):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Kod noto'g'ri")

    # phone bo'yicha user — botdan (Telegram) allaqachon shu raqam bilan
    # ro'yxatdan o'tgan bo'lsa xuddi shu akkauntga kiradi (bitta profil).
    # `data.phone` doim normalizatsiyalangan ("+998…"), lekin normalizatsiya
    # qo'shilishidan oldin saqlangan eski qatorlarda "+" yo'q ("998…"). Faqat
    # aniq mos kelishni qidirsak — o'sha odamga har safar yangi bo'sh profil
    # ochilib ketardi (Telegram profili, buyurtmalari bilan ajralib qolardi).
    user = db.scalar(
        select(User)
        .where(User.phone.in_([data.phone, data.phone.lstrip("+")]))
        .order_by(User.id)
    )
    if user is not None and user.phone != data.phone:
        user.phone = data.phone  # eski qatorni bir xil ko'rinishga keltiramiz
        db.commit()
    if user is None:
        user = User(phone=data.phone, first_name=data.first_name)
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            user = db.scalar(select(User).where(User.phone == data.phone))
            if not user:
                raise
    elif data.first_name and not user.first_name:
        user.first_name = data.first_name
        db.commit()

    if user.is_blocked:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Akkauntingiz bloklangan")

    db.refresh(user)
    access_token = create_access_token(subject=str(user.id), role="user")
    refresh_token = create_refresh_token(subject=str(user.id), role="user")
    return AuthResult(
        token=TokenOut(access_token=access_token, refresh_token=refresh_token),
        user=UserOut.model_validate(user),
    )


@router.post("/refresh", response_model=TokenOut)
def refresh_token(data: RefreshTokenIn, db: Session = Depends(get_db)):
    """Barcha rollar uchun: mijoz, do'kon xodimi, kuryer, tadbirkor, platforma."""
    # Logout qilingan refresh token bilan yangi sessiya ochib bo'lmasin.
    if is_revoked(data.refresh_token):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token bekor qilingan")
    payload = verify_refresh_token(data.refresh_token)
    if not payload or "sub" not in payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Yaroqsiz yoki muddati o'tgan refresh token")

    try:
        sub_id = int(payload["sub"])
    except (ValueError, TypeError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Yaroqsiz token subyekti")

    role = payload.get("role", "user")
    principal = resolve_refresh_principal(db, role, sub_id)
    if principal is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Foydalanuvchi topilmadi yoki bloklangan")

    # AdminUser roli o'zgargan bo'lishi mumkin — yangi token yangi rol bilan.
    current_role = getattr(getattr(principal, "role", None), "value", role)
    return TokenOut(
        access_token=create_access_token(subject=str(sub_id), role=current_role),
        refresh_token=create_refresh_token(subject=str(sub_id), role=current_role),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    data: LogoutIn | None = None,
    authorization: str | None = Header(default=None),
):
    """Chiqish: access va refresh token serverda bekor qilinadi.

    Avval logout faqat qurilma xotirasidan o'chirardi — o'g'irlangan token
    30 kun davomida haqiqiy bo'lib qolardi.
    """
    revoke_session(authorization, data.refresh_token if data else None)
    return None


@router.post("/fcm-token")
def update_fcm_token(
    data: FCMTokenIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    user.fcm_token = data.fcm_token
    db.commit()
    return {"status": "ok"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_me(
    data: UserUpdateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    if data.first_name is not None:
        user.first_name = data.first_name
    if data.last_name is not None:
        user.last_name = data.last_name
    if data.phone is not None:
        phone = normalize_phone(data.phone)
        if not phone:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Telefon raqami noto'g'ri")
        clash = db.scalar(
            select(User).where(User.phone == phone, User.id != user.id)
        )
        if clash:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu telefon allaqachon band")
        user.phone = phone
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu telefon allaqachon band")
    db.refresh(user)
    return user


@router.delete("/fcm-token", status_code=204)
def clear_fcm_token(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.fcm_token = None
    db.commit()


@router.delete("/me", status_code=204)
def delete_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Apple Guideline 5.1.1(v) — Account Deletion.
    Foydalanuvchi o'z hisobini to'liq o'chirishi uchun.
    Agar faol buyurtmalari bo'lsa (delivering va h.k.) — xatolik beradi.
    Buyurtmasi bo'lmasa — to'liq o'chiriladi.
    Tarixiy buyurtmalari bo'lsa — barcha PII (ism, telefon, manzil, fcm) tozalanadi."""
    active_statuses = {"pending", "confirmed", "preparing", "ready", "accepted", "delivering"}
    has_active = any(o.status in active_statuses for o in user.orders)
    if has_active:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Faol buyurtmalaringiz mavjud. Avval buyurtma yakunlanishi kerak.",
        )

    for addr in list(user.addresses):
        db.delete(addr)

    if not user.orders:
        db.delete(user)
    else:
        user.phone = None
        user.first_name = "O'chirilgan foydalanuvchi"
        user.last_name = None
        user.username = None
        user.telegram_id = None
        user.fcm_token = None
        user.is_blocked = True

    db.commit()
