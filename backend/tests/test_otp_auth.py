"""SMS OTP orqali kirish — `POST /api/auth/otp/*`.

DIQQAT: bu testlar mavjud xulqni qayd etadi. Ishlab chiqarishga chiqishdan
oldin `OTP_FAKE_MODE` o'chirilib, real SMS shlyuzi ulanishi shart (qarang:
`app/services/otp.py`). Shu ikki test aynan o'sha holatni qoplaydi:
shlyuz ulanmagan bo'lsa hech kim kira olmaydi.
"""

import pytest

from app.models import User
from app.services import otp as otp_service


@pytest.fixture
def real_mode(monkeypatch):
    """Fake rejim o'chirilgan — ishga tushirishdan keyingi holat."""
    monkeypatch.setattr(otp_service.settings, "otp_fake_mode", False)


def test_real_mode_rejects_everyone_until_gateway_is_wired(real_mode):
    """Shlyuz yo'q ekan — kirish OCHIQ QOLDIRILMAYDI, to'xtatiladi."""
    assert otp_service.verify_otp("+998901112233", "11111") is False
    assert otp_service.verify_otp("+998901112233", "00000") is False


def test_real_mode_send_fails_loudly(real_mode):
    """`_send_sms` hali yozilmagan — jim o'tmaydi, xato beradi."""
    with pytest.raises(NotImplementedError):
        otp_service.send_otp("+998901112233")


def test_fake_mode_accepts_only_the_configured_code(monkeypatch):
    monkeypatch.setattr(otp_service.settings, "otp_fake_mode", True)
    monkeypatch.setattr(otp_service.settings, "otp_fake_code", "11111")
    assert otp_service.verify_otp("+998901112233", "11111") is True
    assert otp_service.verify_otp("+998901112233", "22222") is False


def test_demo_phones_still_work_in_real_mode(real_mode):
    """App Store/Play tekshiruvchisi uchun ajratilgan raqamlar.

    Bu ro'yxat ishga tushirishdan oldin qisqartirilishi kerak — har bir raqam
    o'sha hisobga kirish imkonini beradi.
    """
    demo = next(iter(otp_service.DEMO_PHONES))
    assert otp_service.verify_otp(demo, otp_service.settings.otp_fake_code) is True


# ── Endpoint xulqi (kodni tekshirishdan keyingi qism) ────────────
def _verify(client, phone: str, code: str = "11111", first_name: str | None = None):
    body = {"phone": phone, "code": code}
    if first_name:
        body["first_name"] = first_name
    return client.post("/api/auth/otp/verify", json=body)


def test_wrong_code_is_rejected(client, monkeypatch):
    monkeypatch.setattr(otp_service.settings, "otp_fake_mode", True)
    assert _verify(client, "+998901119900", code="99999").status_code == 401


def test_new_phone_creates_user(client, db_session, monkeypatch):
    monkeypatch.setattr(otp_service.settings, "otp_fake_mode", True)
    resp = _verify(client, "+998901119901", first_name="Yangi")
    assert resp.status_code == 200, resp.text
    assert resp.json()["user"]["phone"] == "+998901119901"

    db_session.expire_all()
    assert db_session.query(User).filter_by(phone="+998901119901").one()


def test_existing_phone_reuses_same_account(client, db_session, monkeypatch):
    """Botdan ro'yxatdan o'tgan odam ilovada ham o'sha profilga kiradi."""
    monkeypatch.setattr(otp_service.settings, "otp_fake_mode", True)
    user = User(phone="+998901119902", first_name="Eski", telegram_id=555000111)
    db_session.add(user)
    db_session.commit()

    body = _verify(client, "+998901119902").json()
    assert body["user"]["id"] == user.id
    assert db_session.query(User).filter_by(phone="+998901119902").count() == 1


def test_legacy_phone_without_plus_is_matched(client, db_session, monkeypatch):
    """Normalizatsiyadan oldin saqlangan "998…" qatorlar profilni bo'lmasin."""
    monkeypatch.setattr(otp_service.settings, "otp_fake_mode", True)
    user = User(phone="998901119903", first_name="Eski format")
    db_session.add(user)
    db_session.commit()

    body = _verify(client, "+998901119903").json()
    assert body["user"]["id"] == user.id
    db_session.expire_all()
    assert db_session.get(User, user.id).phone == "+998901119903"  # tuzatib qo'yiladi


def test_blocked_user_cannot_sign_in(client, db_session, monkeypatch):
    monkeypatch.setattr(otp_service.settings, "otp_fake_mode", True)
    db_session.add(User(phone="+998901119904", first_name="B", is_blocked=True))
    db_session.commit()

    assert _verify(client, "+998901119904").status_code == 403


def test_signin_returns_refresh_token(client, monkeypatch):
    monkeypatch.setattr(otp_service.settings, "otp_fake_mode", True)
    body = _verify(client, "+998901119905", first_name="R").json()
    assert body["token"]["access_token"]
    assert body["token"]["refresh_token"]
