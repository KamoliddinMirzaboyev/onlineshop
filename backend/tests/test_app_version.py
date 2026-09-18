import pytest

from app.core.security import create_access_token, hash_password
from app.models import PlatformAdmin
from tests.conftest import auth


@pytest.fixture
def platform_token(db_session) -> str:
    admin = PlatformAdmin(username="plat_appver", hashed_password=hash_password("pw"))
    db_session.add(admin)
    db_session.commit()
    return create_access_token(subject=str(admin.id), role="platform_superadmin")


def test_public_version_check_defaults_to_zero_when_missing(client):
    resp = client.get("/api/app/version/mijoz")
    assert resp.status_code == 200
    assert resp.json() == {"min_version_code": 0, "store_url": None}


def test_platform_admin_can_set_and_read_app_version(client, platform_token):
    resp = client.put(
        "/api/platform/app-version/mijoz",
        json={"min_version_code": 42, "store_url": "https://play.google.com/store/apps/details?id=uz.barakalibozor.mijoz"},
        headers=auth(platform_token),
    )
    assert resp.status_code == 200
    assert resp.json()["min_version_code"] == 42

    resp = client.get("/api/app/version/mijoz")
    assert resp.status_code == 200
    assert resp.json()["min_version_code"] == 42
    assert resp.json()["store_url"].endswith("uz.barakalibozor.mijoz")


def test_non_platform_admin_cannot_set_app_version(client, tenant_a):
    resp = client.put(
        "/api/platform/app-version/mijoz",
        json={"min_version_code": 42, "store_url": None},
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 401
