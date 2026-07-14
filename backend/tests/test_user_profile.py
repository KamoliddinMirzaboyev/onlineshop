from tests.conftest import auth
from app.core.security import create_access_token
from app.models import User


def _make_user(db_session, telegram_id=555) -> User:
    user = User(telegram_id=telegram_id, first_name="Eski Ism", phone=None, language="uz")
    db_session.add(user)
    db_session.commit()
    return user


def test_me_includes_created_at(client, db_session):
    user = _make_user(db_session)
    token = create_access_token(subject=str(user.id), role="user")
    resp = client.get("/api/auth/me", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["created_at"] is not None


def test_patch_me_updates_name_and_phone(client, db_session):
    user = _make_user(db_session)
    token = create_access_token(subject=str(user.id), role="user")

    resp = client.patch(
        "/api/auth/me",
        json={"first_name": "Yangi Ism", "phone": "+998901234567"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["first_name"] == "Yangi Ism"
    assert body["phone"] == "+998901234567"


def test_patch_me_partial_update_keeps_other_field(client, db_session):
    user = _make_user(db_session)
    token = create_access_token(subject=str(user.id), role="user")

    resp = client.patch("/api/auth/me", json={"phone": "+998901234567"}, headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["first_name"] == "Eski Ism"
    assert body["phone"] == "+998901234567"


def test_patch_me_requires_auth(client, db_session):
    resp = client.patch("/api/auth/me", json={"first_name": "X"})
    assert resp.status_code == 401
