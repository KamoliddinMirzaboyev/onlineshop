from sqlalchemy import select

from app.core.security import hash_password
from app.models import Business, PlatformAdmin


def test_seed_creates_platform_admin_and_is_idempotent(db_session, monkeypatch):
    from app import seed as seed_module

    # seed() creates a default store, which needs a Business row (normally made
    # by initdb.py). The fixture DB is empty, so create one first.
    db_session.add(Business(name="Biz", username="biz", hashed_password=hash_password("pw")))
    db_session.commit()

    # seed() bootstrap parolni .env'dan oladi va 8 belgidan qisqa bo'lsa
    # akkauntni yaratmaydi — testda aniq parol beramiz.
    monkeypatch.setattr(seed_module.settings, "first_platform_password", "platform12345")
    monkeypatch.setattr(seed_module.settings, "first_admin_password", "admin1234567")
    monkeypatch.setattr(seed_module, "SessionLocal", lambda: db_session)
    # db_session's context-manager exit must not close the fixture's session.
    monkeypatch.setattr(db_session, "close", lambda: None)

    seed_module.seed()
    seed_module.seed()  # second run must not duplicate

    admins = db_session.scalars(select(PlatformAdmin)).all()
    assert len(admins) == 1
    assert admins[0].username == "platform"
