"""FCM ikki Firebase loyihasi bilan ishlashi.

Kuryer APK va mijoz ilovasi turli Firebase loyihalarida bo'lishi mumkin.
Token loyihaga bog'langan — noto'g'ri loyiha nomidan yuborilsa push yetib
bormaydi (real bug: mijozga birorta bildirishnoma kelmagan).
"""
import app.services.fcm as fcm


def _reset():
    fcm._apps.clear()


def test_customer_falls_back_to_courier_app_when_not_configured(monkeypatch):
    """Alohida kalit yo'q — ikkala ilova bitta loyihada deb hisoblanadi."""
    _reset()
    monkeypatch.setattr(fcm.settings, "firebase_customer_credentials_json", "")
    monkeypatch.setattr(fcm.settings, "firebase_customer_credentials_path", "")
    sentinel = object()
    monkeypatch.setitem(fcm._apps, fcm._COURIER_APP, sentinel)

    assert fcm._customer_app() is sentinel


def test_customer_uses_its_own_app_when_configured(monkeypatch):
    """Alohida kalit bor — mijozga push O'SHA loyihadan ketadi."""
    _reset()
    courier_app = object()
    customer_app = object()
    monkeypatch.setitem(fcm._apps, fcm._COURIER_APP, courier_app)
    monkeypatch.setattr(
        fcm, "_init_app", lambda kind, raw, path, name: customer_app
    )
    monkeypatch.setattr(
        fcm.settings, "firebase_customer_credentials_path", "/tmp/mijoz.json"
    )

    resolved = fcm._customer_app()
    assert resolved is customer_app
    assert resolved is not courier_app


def test_notify_user_sends_with_customer_app_and_channel(monkeypatch):
    """Mijozga push: mijoz app'i + mijoz ilovasidagi kanal."""
    _reset()
    customer_app = object()
    monkeypatch.setattr(fcm, "_customer_app", lambda: customer_app)

    captured = {}

    def fake_send(token, title, body, data=None, channel_id=fcm.COURIER_CHANNEL, app=None):
        captured.update(token=token, channel_id=channel_id, app=app)
        return True

    monkeypatch.setattr(fcm, "_send_token", fake_send)

    class _Scalar:
        def scalar(self, *_a, **_k):
            return "tok-123"

        def __enter__(self):
            return self

        def __exit__(self, *_a):
            return False

    monkeypatch.setattr(fcm, "SessionLocal", lambda: _Scalar())

    fcm.notify_user(1, "Sarlavha", "Matn", url="/orders/5")

    assert captured["token"] == "tok-123"
    assert captured["channel_id"] == fcm.CUSTOMER_CHANNEL
    assert captured["app"] is customer_app


def test_notify_user_skips_when_no_token(monkeypatch):
    _reset()
    monkeypatch.setattr(fcm, "_customer_app", lambda: object())

    class _Empty:
        def scalar(self, *_a, **_k):
            return None

        def __enter__(self):
            return self

        def __exit__(self, *_a):
            return False

    monkeypatch.setattr(fcm, "SessionLocal", lambda: _Empty())
    called = False

    def fake_send(*_a, **_k):
        nonlocal called
        called = True
        return True

    monkeypatch.setattr(fcm, "_send_token", fake_send)

    fcm.notify_user(1, "T", "B")
    assert called is False


def test_courier_channel_is_separate_from_customer():
    assert fcm.COURIER_CHANNEL == "courier_orders"
    assert fcm.CUSTOMER_CHANNEL == "orders"
    assert fcm.COURIER_CHANNEL != fcm.CUSTOMER_CHANNEL
