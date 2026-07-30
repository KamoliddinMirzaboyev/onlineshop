from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TelegramAuthIn(BaseModel):
    init_data: str

class AppRegisterIn(BaseModel):
    phone: str
    password: str
    first_name: str

class AppLoginIn(BaseModel):
    phone: str
    password: str

class FCMTokenIn(BaseModel):
    fcm_token: str


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
    first_name: str | None = None
    phone: str | None = None
