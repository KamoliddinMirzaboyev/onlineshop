from datetime import datetime

from pydantic import BaseModel


class TelegramAuthIn(BaseModel):
    init_data: str


class AdminLoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    telegram_id: int
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    language: str
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdateIn(BaseModel):
    first_name: str | None = None
    phone: str | None = None


class AuthResult(BaseModel):
    token: TokenOut
    user: UserOut
