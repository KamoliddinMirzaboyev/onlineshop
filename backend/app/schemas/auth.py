from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.phone import normalize_phone, require_phone


class TelegramAuthIn(BaseModel):
    init_data: str


class AppRegisterIn(BaseModel):
    phone: str
    password: str = Field(min_length=6, max_length=128)
    first_name: str = Field(min_length=1, max_length=128)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return require_phone(v)

    @field_validator("first_name")
    @classmethod
    def _name(cls, v: str) -> str:
        s = (v or "").strip()
        if not s:
            raise ValueError("Ism majburiy")
        return s[:128]


class AppLoginIn(BaseModel):
    phone: str
    password: str = Field(min_length=1, max_length=128)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return require_phone(v)


class FCMTokenIn(BaseModel):
    fcm_token: str = Field(min_length=1, max_length=512)


class AdminLoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    telegram_id: int | None = None
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    language: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuthResult(BaseModel):
    token: TokenOut
    user: UserOut


class UserUpdateIn(BaseModel):
    first_name: str | None = Field(default=None, max_length=128)
    phone: str | None = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        if v is None or not str(v).strip():
            return None
        return require_phone(v)

    @field_validator("first_name")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        return s[:128] if s else None
