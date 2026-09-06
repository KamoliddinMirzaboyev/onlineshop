from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.phone import normalize_phone
from app.core.ratelimit import rate_limiter
from app.core.security import create_access_token, verify_telegram_init_data
from app.models import User
from app.schemas.auth import (
    AuthResult,
    FCMTokenIn,
    OtpRequestIn,
    OtpVerifyIn,
    TelegramAuthIn,
    TokenOut,
    UserOut,
    UserUpdateIn,
)
from app.services.otp import send_otp, verify_otp

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

    token = create_access_token(subject=str(user.id), role="user")
    return AuthResult(token=TokenOut(access_token=token), user=UserOut.model_validate(user))


@router.post("/otp/request", dependencies=[Depends(_otp_request_limit)])
def otp_request(data: OtpRequestIn):
    send_otp(data.phone)
    return {"status": "ok"}


@router.post("/otp/verify", response_model=AuthResult, dependencies=[Depends(_otp_verify_limit)])
def otp_verify(data: OtpVerifyIn, db: Session = Depends(get_db)):
    if not verify_otp(data.phone, data.code):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Kod noto'g'ri")

    # phone bo'yicha user — botdan (Telegram) allaqachon shu raqam bilan
    # ro'yxatdan o'tgan bo'lsa xuddi shu akkauntga kiradi (bitta profil).
    user = db.scalar(select(User).where(User.phone == data.phone))
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
    token = create_access_token(subject=str(user.id), role="user")
    return AuthResult(token=TokenOut(access_token=token), user=UserOut.model_validate(user))


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
