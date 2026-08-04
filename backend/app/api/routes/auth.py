from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.phone import normalize_phone
from app.core.ratelimit import rate_limiter
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
    verify_telegram_init_data,
)
from app.models import User
from app.schemas.auth import (
    AppLoginIn,
    AppRegisterIn,
    AuthResult,
    FCMTokenIn,
    TelegramAuthIn,
    TokenOut,
    UserOut,
    UserUpdateIn,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_tg_auth_limit = rate_limiter("tg_auth", limit=30, window_seconds=60)
_app_auth_limit = rate_limiter("app_auth", limit=15, window_seconds=60)

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
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=str(user.id), role="user")
    return AuthResult(token=TokenOut(access_token=token), user=UserOut.model_validate(user))


@router.post("/register", response_model=AuthResult, dependencies=[Depends(_app_auth_limit)])
def app_register(data: AppRegisterIn, db: Session = Depends(get_db)):
    phone = data.phone  # allaqachon normalize
    existing = db.scalar(select(User).where(User.phone == phone))

    # Bot orqali telefon saqlangan, parol yo'q — akkauntni "da'vo qilish".
    if existing is not None:
        if existing.password_hash:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Phone number already registered")
        if existing.is_blocked:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Akkauntingiz bloklangan")
        existing.password_hash = hash_password(data.password)
        if data.first_name:
            existing.first_name = data.first_name
        db.commit()
        db.refresh(existing)
        token = create_access_token(subject=str(existing.id), role="user")
        return AuthResult(
            token=TokenOut(access_token=token), user=UserOut.model_validate(existing)
        )

    user = User(
        phone=phone,
        password_hash=hash_password(data.password),
        first_name=data.first_name,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Phone number already registered")
    db.refresh(user)

    token = create_access_token(subject=str(user.id), role="user")
    return AuthResult(token=TokenOut(access_token=token), user=UserOut.model_validate(user))


@router.post("/login", response_model=AuthResult, dependencies=[Depends(_app_auth_limit)])
def app_login(data: AppLoginIn, db: Session = Depends(get_db)):
    phone = data.phone
    user = db.scalar(select(User).where(User.phone == phone))
    if not user or not user.password_hash or not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid phone or password")
    if user.is_blocked:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Akkauntingiz bloklangan")

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
