"""POST /api/auth/refresh — barcha rollar uchun.

Access token qisqa muddatli, shuning uchun har bir panel ham (do'kon xodimi,
kuryer, tadbirkor, platforma admini) refresh bilan uzaytira olishi kerak.
"""

import pytest

from app.core.security import create_refresh_token, hash_password
from app.models import AdminUser, Business, PlatformAdmin, User
from app.models.enums import AdminRole
from tests.conftest import auth


def _refresh(client, token: str):
    return client.post("/api/auth/refresh", json={"refresh_token": token})


def test_staff_can_refresh(client, tenant_a):
    resp = _refresh(client, create_refresh_token(
        subject=str(tenant_a.staff_id), role=AdminRole.superadmin.value,
    ))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["access_token"] and body["refresh_token"]

    # Yangi access token haqiqatan ishlaydi.
    me = client.get("/api/admin/auth/me", headers=auth(body["access_token"]))
    assert me.status_code == 200


def test_business_can_refresh(client, tenant_a):
    resp = _refresh(client, create_refresh_token(
        subject=str(tenant_a.business_id), role="businessman",
    ))
    assert resp.status_code == 200, resp.text
    me = client.get(
        "/api/business/auth/me", headers=auth(resp.json()["access_token"])
    )
    assert me.status_code == 200


def test_platform_admin_can_refresh(client, db_session):
    admin = PlatformAdmin(username="plat_refresh", hashed_password=hash_password("pw"))
    db_session.add(admin)
    db_session.commit()

    resp = _refresh(client, create_refresh_token(
        subject=str(admin.id), role="platform_superadmin",
    ))
    assert resp.status_code == 200, resp.text
    assert resp.json()["access_token"]


def test_customer_can_refresh(client, db_session):
    user = User(phone="+998901112233", first_name="Mijoz")
    db_session.add(user)
    db_session.commit()

    resp = _refresh(client, create_refresh_token(subject=str(user.id), role="user"))
    assert resp.status_code == 200, resp.text
    me = client.get("/api/auth/me", headers=auth(resp.json()["access_token"]))
    assert me.status_code == 200


@pytest.mark.parametrize("deactivate", ["staff", "business"])
def test_deactivated_principal_cannot_refresh(client, db_session, tenant_a, deactivate):
    if deactivate == "staff":
        row = db_session.get(AdminUser, tenant_a.staff_id)
        token = create_refresh_token(
            subject=str(tenant_a.staff_id), role=AdminRole.superadmin.value
        )
    else:
        row = db_session.get(Business, tenant_a.business_id)
        token = create_refresh_token(subject=str(tenant_a.business_id), role="businessman")
    row.is_active = False
    db_session.commit()

    assert _refresh(client, token).status_code == 401


def test_blocked_customer_cannot_refresh(client, db_session):
    user = User(phone="+998901112244", first_name="Bloklangan", is_blocked=True)
    db_session.add(user)
    db_session.commit()

    token = create_refresh_token(subject=str(user.id), role="user")
    assert _refresh(client, token).status_code == 401


def test_access_token_is_not_accepted_as_refresh(client, tenant_a):
    """Access token'da purpose='refresh' yo'q — uzaytirish uchun yaramaydi."""
    assert _refresh(client, tenant_a.staff_token).status_code == 401


def test_garbage_refresh_token_is_rejected(client):
    assert _refresh(client, "not-a-jwt").status_code == 401


def test_panel_login_returns_refresh_token(client, db_session, tenant_a):
    """admin/business/platform login javobida refresh_token bo'lishi shart."""
    db_session.get(AdminUser, tenant_a.staff_id).hashed_password = hash_password("parol123")
    db_session.commit()

    resp = client.post(
        "/api/admin/auth/login",
        json={"username": f"staff_a", "password": "parol123"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["refresh_token"]
