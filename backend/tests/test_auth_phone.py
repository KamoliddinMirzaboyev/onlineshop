import pytest
from app.models import User
from tests.conftest import auth


def test_phone_auth_existing_user(client, db_session):
    user = User(phone="+998901234567", first_name="Ali", last_name="Valiyev")
    db_session.add(user)
    db_session.commit()

    resp = client.post("/api/auth/phone", json={"phone": "+998901234567"})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["token"]["access_token"]
    assert data["token"]["refresh_token"]
    assert data["user"]["id"] == user.id
    assert data["user"]["first_name"] == "Ali"
    assert data["user"]["last_name"] == "Valiyev"

    # Token orqali /auth/me ishlaydi
    me = client.get("/api/auth/me", headers=auth(data["token"]["access_token"]))
    assert me.status_code == 200
    assert me.json()["id"] == user.id


def test_phone_auth_new_user(client, db_session):
    resp = client.post("/api/auth/phone", json={"phone": "+998991112233"})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["token"]["access_token"]
    assert data["token"]["refresh_token"]
    assert data["user"]["phone"] == "+998991112233"
    assert data["user"]["first_name"] is None

    # Yangi user ismini PATCH /auth/me orqali to'ldiradi
    me = client.patch(
        "/api/auth/me",
        headers=auth(data["token"]["access_token"]),
        json={"first_name": "Sardor", "last_name": "Karimov"},
    )
    assert me.status_code == 200
    assert me.json()["first_name"] == "Sardor"
    assert me.json()["last_name"] == "Karimov"


def test_phone_auth_blocked_user(client, db_session):
    user = User(phone="+998971239988", is_blocked=True)
    db_session.add(user)
    db_session.commit()

    resp = client.post("/api/auth/phone", json={"phone": "+998971239988"})
    assert resp.status_code == 403
    assert "bloklangan" in resp.text


def test_phone_auth_invalid_phone(client):
    resp = client.post("/api/auth/phone", json={"phone": "12345"})
    assert resp.status_code == 422
