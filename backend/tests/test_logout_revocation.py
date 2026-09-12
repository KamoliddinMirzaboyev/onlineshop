"""POST /logout — token serverda ham bekor qilinishi.

Avval logout faqat klient xotirasidan o'chirardi: o'g'irlangan yoki boshqa
qurilmada qolgan token muddati tugaguncha (refresh uchun 30 kun) ishlayverardi.

Redis bu yerda soxta (in-memory) klient bilan almashtiriladi — testlar tashqi
xizmatga bog'lanmasin, lekin bekor qilish mantig'i to'liq API orqali sinaladi.
"""

import time

import pytest

from app.core import token_blacklist
from app.core.security import create_refresh_token
from app.models import User
from app.models.enums import AdminRole
from tests.conftest import auth


class _FakeRedis:
    """setex/exists — token_blacklist ishlatadigan yagona ikki amal."""

    def __init__(self) -> None:
        self.store: dict[str, float] = {}

    def setex(self, key: str, ttl: int, _value: str) -> None:
        self.store[key] = time.time() + ttl

    def exists(self, key: str) -> int:
        exp = self.store.get(key)
        if exp is None:
            return 0
        if exp < time.time():
            del self.store[key]
            return 0
        return 1


@pytest.fixture
def fake_redis(monkeypatch):
    fake = _FakeRedis()
    monkeypatch.setattr(token_blacklist, "redis_client", fake)
    return fake


def test_access_token_stops_working_after_logout(client, tenant_a, fake_redis):
    access = tenant_a.staff_token

    # Logoutdan oldin ishlaydi.
    assert client.get("/api/admin/auth/me", headers=auth(access)).status_code == 200

    assert client.post("/api/admin/auth/logout", headers=auth(access)).status_code == 204

    # Logoutdan keyin xuddi shu token rad etiladi.
    after = client.get("/api/admin/auth/me", headers=auth(access))
    assert after.status_code == 401, after.text


def test_revoked_refresh_token_cannot_mint_new_session(client, tenant_a, fake_redis):
    refresh = create_refresh_token(
        subject=str(tenant_a.staff_id), role=AdminRole.superadmin.value
    )
    # Avval ishlaydi.
    assert client.post("/api/auth/refresh", json={"refresh_token": refresh}).status_code == 200

    logout = client.post("/api/admin/auth/logout", json={"refresh_token": refresh})
    assert logout.status_code == 204, logout.text

    again = client.post("/api/auth/refresh", json={"refresh_token": refresh})
    assert again.status_code == 401, again.text


def test_logout_without_redis_does_not_break(client, tenant_a, monkeypatch):
    """Redis tushgan bo'lsa logout xato bermaydi (fail-open)."""

    class _Broken:
        def setex(self, *a, **k):
            raise RuntimeError("redis down")

        def exists(self, *a, **k):
            raise RuntimeError("redis down")

    monkeypatch.setattr(token_blacklist, "redis_client", _Broken())
    access = tenant_a.staff_token
    assert client.post("/api/admin/auth/logout", headers=auth(access)).status_code == 204
    # Redis yo'q — tekshiruv o'tkazib yuboriladi, tizim ishlashda davom etadi.
    assert client.get("/api/admin/auth/me", headers=auth(access)).status_code == 200


def test_customer_logout_revokes_token(client, db_session, fake_redis):
    user = User(phone="+998901112233", first_name="Test")
    db_session.add(user)
    db_session.commit()

    from app.core.security import create_access_token

    access = create_access_token(subject=str(user.id), role="user")
    assert client.get("/api/auth/me", headers=auth(access)).status_code == 200

    assert client.post("/api/auth/logout", headers=auth(access)).status_code == 204
    assert client.get("/api/auth/me", headers=auth(access)).status_code == 401
