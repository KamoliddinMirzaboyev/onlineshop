"""SMS OTP orqali kirish — `app/services/otp.py` va `POST /api/auth/otp/*`.

Kod Redis'da TTL bilan yashaydi, bir martalik va urinishlar soni cheklangan.
Bu testlar Redis'ni soxta klient bilan almashtiradi — CI'da real Redis bor,
lekin testlar unga bog'liq bo'lmasligi kerak.
"""

import pytest

from app.models import User
from app.services import otp as otp_service


# ── Soxta Redis: kerakli komandalar (juda kichik, xulqi haqiqiysiday) ──
class FakeRedis:
    def __init__(self):
        self.store: dict[str, str] = {}
        self.fail = False

    def _check(self):
        if self.fail:
            raise ConnectionError("redis down")

    def get(self, key):
        self._check()
        return self.store.get(key)

    def set(self, key, value, ex=None):
        self._check()
        self.store[key] = str(value)

    def delete(self, *keys):
        self._check()
        for k in keys:
            self.store.pop(k, None)

    def incr(self, key):
        self._check()
        self.store[key] = str(int(self.store.get(key, 0)) + 1)
        return int(self.store[key])

    def expire(self, key, seconds):
        self._check()

    def pipeline(self):
        return _FakePipe(self)


class _FakePipe:
    def __init__(self, r): self.r, self.ops = r, []
    def set(self, *a, **k): self.ops.append(("set", a, k)); return self
    def delete(self, *a): self.ops.append(("delete", a, {})); return self
    def execute(self):
        for name, a, k in self.ops:
            getattr(self.r, name)(*a, **k)
        self.ops = []


@pytest.fixture
def fake_redis(monkeypatch):
    r = FakeRedis()
    monkeypatch.setattr(otp_service, "redis_client", r)
    return r


@pytest.fixture
def real_mode(monkeypatch, fake_redis):
    """Ishga tushirilgan holat: fake rejim o'chiq, shlyuz ulangan."""
    monkeypatch.setattr(otp_service.settings, "otp_fake_mode", False)
    monkeypatch.setattr(otp_service.settings, "demo_login_enabled", False)
    monkeypatch.setattr(otp_service.settings, "sms_provider", "eskiz")
    sent: list[tuple[str, str]] = []
    monkeypatch.setattr(otp_service, "_send_sms",
                        lambda phone, code: sent.append((phone, code)))
    return sent


PHONE = "+998901112233"


# ── Kod hayot sikli ──────────────────────────────────────────────
def test_code_is_random_and_five_digits(real_mode):
    codes = set()
    for _ in range(20):
        otp_service.send_otp(PHONE)
        code = real_mode[-1][1]
        assert len(code) == 5 and code.isdigit()
        codes.add(code)
    # 20 ta chaqiruvda hammasi bir xil chiqishi amalda mumkin emas.
    assert len(codes) > 1, "kod tasodifiy emas"


def test_correct_code_passes_once(real_mode):
    otp_service.send_otp(PHONE)
    code = real_mode[-1][1]
    assert otp_service.verify_otp(PHONE, code) is True
    # Bir martalik: o'sha kod ikkinchi marta o'tmaydi.
    assert otp_service.verify_otp(PHONE, code) is False


def test_wrong_code_fails(real_mode):
    otp_service.send_otp(PHONE)
    code = real_mode[-1][1]
    wrong = "00000" if code != "00000" else "11111"
    assert otp_service.verify_otp(PHONE, wrong) is False


def test_code_of_another_phone_does_not_work(real_mode):
    otp_service.send_otp(PHONE)
    code = real_mode[-1][1]
    assert otp_service.verify_otp("+998901112299", code) is False


def test_attempts_are_limited(real_mode, monkeypatch):
    monkeypatch.setattr(otp_service.settings, "otp_max_attempts", 3)
    otp_service.send_otp(PHONE)
    code = real_mode[-1][1]
    wrong = "00000" if code != "00000" else "11111"

    for _ in range(3):
        assert otp_service.verify_otp(PHONE, wrong) is False
    # Chegara oshdi — endi TO'G'RI kod ham o'tmaydi (kod bekor qilindi).
    assert otp_service.verify_otp(PHONE, code) is False


def test_verify_without_request_fails(real_mode):
    assert otp_service.verify_otp("+998905550000", "12345") is False


def test_redis_down_denies_access(real_mode, fake_redis):
    """Fail-CLOSED: autentifikatsiya Redis'siz ochiq qolmaydi."""
    otp_service.send_otp(PHONE)
    code = real_mode[-1][1]
    fake_redis.fail = True
    assert otp_service.verify_otp(PHONE, code) is False


def test_send_failure_does_not_leave_a_live_code(real_mode, fake_redis, monkeypatch):
    """SMS ketmasa, kod Redis'da qolib ketmaydi (aks holda u yerda 5 daqiqa
    'ochiq' kod turardi va mijoz uni bilmasa ham brute-force uchun oyna bo'lardi)."""
    def boom(phone, code):
        raise otp_service.OtpError("shlyuz yiqildi")

    monkeypatch.setattr(otp_service, "_send_sms", boom)
    with pytest.raises(otp_service.OtpError):
        otp_service.send_otp(PHONE)
    assert otp_service._CODE_KEY.format(phone=PHONE) not in fake_redis.store


def test_unconfigured_provider_raises(monkeypatch, fake_redis):
    monkeypatch.setattr(otp_service.settings, "otp_fake_mode", False)
    monkeypatch.setattr(otp_service.settings, "demo_login_enabled", False)
    monkeypatch.setattr(otp_service.settings, "sms_provider", "")
    with pytest.raises(otp_service.OtpError):
        otp_service.send_otp(PHONE)


def test_phone_is_masked_in_logs():
    assert otp_service.mask_phone("+998901234567") == "+99890***4567"
    assert "1234567" not in otp_service.mask_phone("+998901234567")


# ── Demo raqamlar ────────────────────────────────────────────────
def test_demo_phones_are_on_until_sms_gateway_is_wired(fake_redis):
    """Hozirgi holat: SMS shlyuzi yo'q, shuning uchun demo raqamlar YOQIQ.

    Shlyuz ulangandan va store tekshiruvi tugagandan keyin `.env` da
    `DEMO_LOGIN_ENABLED=false` qilinadi — quyidagi test o'sha holatni qoplaydi.
    """
    assert otp_service.settings.demo_login_enabled is True


def test_demo_phones_can_be_turned_off(monkeypatch, fake_redis):
    monkeypatch.setattr(otp_service.settings, "otp_fake_mode", False)
    monkeypatch.setattr(otp_service.settings, "demo_login_enabled", False)
    demo = next(iter(otp_service.settings.demo_phones_set))
    assert otp_service.verify_otp(demo, otp_service.settings.otp_fake_code) is False


def test_demo_phones_work_when_explicitly_enabled(monkeypatch, fake_redis):
    monkeypatch.setattr(otp_service.settings, "otp_fake_mode", False)
    monkeypatch.setattr(otp_service.settings, "demo_login_enabled", True)
    demo = next(iter(otp_service.settings.demo_phones_set))
    assert otp_service.verify_otp(demo, otp_service.settings.otp_fake_code) is True
    # Ro'yxatdan tashqari raqam baribir o'tmaydi.
    assert otp_service.verify_otp("+998907776655", otp_service.settings.otp_fake_code) is False


# ── Endpoint xulqi ───────────────────────────────────────────────
def _verify(client, phone: str, code: str = "11111", first_name: str | None = None):
    body = {"phone": phone, "code": code}
    if first_name:
        body["first_name"] = first_name
    return client.post("/api/auth/otp/verify", json=body)


@pytest.fixture
def fake_mode(monkeypatch):
    monkeypatch.setattr(otp_service.settings, "otp_fake_mode", True)


def test_gateway_failure_returns_503(client, monkeypatch, fake_redis):
    monkeypatch.setattr(otp_service.settings, "otp_fake_mode", False)
    monkeypatch.setattr(otp_service.settings, "demo_login_enabled", False)
    monkeypatch.setattr(otp_service.settings, "sms_provider", "eskiz")
    monkeypatch.setattr(otp_service, "_send_sms",
                        lambda p, c: (_ for _ in ()).throw(otp_service.OtpError("x")))
    resp = client.post("/api/auth/otp/request", json={"phone": "+998901119800"})
    assert resp.status_code == 503
    assert "SMS" in resp.json()["detail"]


def test_wrong_code_is_rejected(client, fake_mode):
    assert _verify(client, "+998901119900", code="99999").status_code == 401


def test_new_phone_creates_user(client, db_session, fake_mode):
    resp = _verify(client, "+998901119901", first_name="Yangi")
    assert resp.status_code == 200, resp.text
    assert resp.json()["user"]["phone"] == "+998901119901"
    db_session.expire_all()
    assert db_session.query(User).filter_by(phone="+998901119901").one()


def test_existing_phone_reuses_same_account(client, db_session, fake_mode):
    """Botdan ro'yxatdan o'tgan odam ilovada ham o'sha profilga kiradi."""
    user = User(phone="+998901119902", first_name="Eski", telegram_id=555000111)
    db_session.add(user)
    db_session.commit()

    body = _verify(client, "+998901119902").json()
    assert body["user"]["id"] == user.id
    assert db_session.query(User).filter_by(phone="+998901119902").count() == 1


def test_legacy_phone_without_plus_is_matched(client, db_session, fake_mode):
    """Normalizatsiyadan oldin saqlangan "998…" qatorlar profilni bo'lmasin."""
    user = User(phone="998901119903", first_name="Eski format")
    db_session.add(user)
    db_session.commit()

    body = _verify(client, "+998901119903").json()
    assert body["user"]["id"] == user.id
    db_session.expire_all()
    assert db_session.get(User, user.id).phone == "+998901119903"


def test_blocked_user_cannot_sign_in(client, db_session, fake_mode):
    db_session.add(User(phone="+998901119904", first_name="B", is_blocked=True))
    db_session.commit()
    assert _verify(client, "+998901119904").status_code == 403


def test_signin_returns_refresh_token(client, fake_mode):
    body = _verify(client, "+998901119905", first_name="R").json()
    assert body["token"]["access_token"]
    assert body["token"]["refresh_token"]
