import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Password hashing (admin users) ───────────────────────────────
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT ──────────────────────────────────────────────────────────
def create_access_token(
    subject: str,
    role: str,
    *,
    expires_minutes: int | None = None,
    purpose: str | None = None,
) -> str:
    """JWT chiqaradi. `purpose` (masalan 'sse') qisqa muddatli stream ticket uchun."""
    minutes = (
        expires_minutes
        if expires_minutes is not None
        else settings.access_token_expire_minutes
    )
    expire = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    payload: dict = {"sub": str(subject), "role": role, "exp": expire}
    if purpose:
        payload["purpose"] = purpose
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None


# ── Telegram WebApp initData verification ────────────────────────
# https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
def verify_telegram_init_data(init_data: str, max_age_seconds: int = 86400) -> dict | None:
    """Validate Telegram Mini App initData. Returns parsed dict or None if invalid."""
    try:
        parsed = dict(parse_qsl(init_data, strict_parsing=True))
    except ValueError:
        return None

    received_hash = parsed.pop("hash", None)
    if not received_hash:
        return None

    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(parsed.items())
    )
    secret_key = hmac.new(
        b"WebAppData", settings.bot_token.encode(), hashlib.sha256
    ).digest()
    computed_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        return None

    # freshness check
    auth_date = parsed.get("auth_date")
    if auth_date:
        age = datetime.now(timezone.utc).timestamp() - int(auth_date)
        if age > max_age_seconds:
            return None

    user_raw = parsed.get("user")
    if user_raw:
        parsed["user"] = json.loads(user_raw)
    return parsed
