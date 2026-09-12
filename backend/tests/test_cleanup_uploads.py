"""Yetim rasm tozalagich: ishlatilayotgan fayllarga tegmaydi."""

import time

import pytest

from scripts import cleanup_uploads


@pytest.fixture
def uploads(tmp_path, monkeypatch):
    monkeypatch.setattr(cleanup_uploads, "UPLOAD_DIR", tmp_path)
    return tmp_path


def _old_file(dir_, name: str) -> "object":
    path = dir_ / name
    path.write_bytes(b"x" * 10)
    old = time.time() - 30 * 86400
    import os
    os.utime(path, (old, old))
    return path


def test_orphan_is_found_and_used_file_is_kept(uploads, db_session, tenant_a, monkeypatch):
    from app.models import Category, Product

    cat = Category(restaurant_id=tenant_a.restaurant_id, name_uz="K", name_ru="К")
    db_session.add(cat)
    db_session.commit()
    db_session.add(Product(
        restaurant_id=tenant_a.restaurant_id, category_id=cat.id,
        name_uz="Olma", name_ru="Яблоко", price=1000, unit="kg",
        image_url="https://api.example.uz/uploads/ishlatilgan.webp",
    ))
    db_session.commit()

    used = _old_file(uploads, "ishlatilgan.webp")
    orphan = _old_file(uploads, "yetim.webp")

    monkeypatch.setattr(cleanup_uploads, "SessionLocal", lambda: db_session)
    monkeypatch.setattr(db_session, "close", lambda: None)

    assert [p.name for p in cleanup_uploads.find_orphans()] == ["yetim.webp"]

    cleanup_uploads.main(["--delete"])
    assert used.exists()
    assert not orphan.exists()


def test_recent_file_is_not_deleted(uploads, db_session, monkeypatch):
    """Hozir yuklangan, hali formaga biriktirilmagan rasm saqlanadi."""
    fresh = uploads / "yangi.webp"
    fresh.write_bytes(b"x")

    monkeypatch.setattr(cleanup_uploads, "SessionLocal", lambda: db_session)
    monkeypatch.setattr(db_session, "close", lambda: None)

    assert cleanup_uploads.find_orphans() == []
    assert fresh.exists()


def test_order_item_snapshot_keeps_old_image(uploads, db_session, tenant_a, monkeypatch):
    """Mahsulot rasmi almashtirilgan — eski fayl buyurtma tarixida qolgani uchun
    o'chirilmaydi (chek va buyurtma kartochkasi o'sha rasmni ko'rsatadi)."""
    from app.models import Category, Order, OrderItem, Product, User
    from app.models.enums import OrderStatus

    cat = Category(restaurant_id=tenant_a.restaurant_id, name_uz="K", name_ru="К")
    db_session.add(cat)
    db_session.commit()
    product = Product(
        restaurant_id=tenant_a.restaurant_id, category_id=cat.id,
        name_uz="Olma", name_ru="Яблоко", price=1000, unit="kg",
        image_url="https://api.example.uz/uploads/yangi-rasm.webp",
    )
    db_session.add(product)
    user = User(phone="+998900001122", first_name="M")
    db_session.add(user)
    db_session.commit()

    db_session.add(Order(
        number="TEST-1", user_id=user.id, restaurant_id=tenant_a.restaurant_id,
        status=OrderStatus.delivered, items_total=1000, delivery_fee=0, total=1000,
        address_line="Manzil", phone="+998900001122",
        items=[OrderItem(
            product_id=product.id, name_uz="Olma", name_ru="Яблоко",
            price=1000, quantity=1, unit="kg",
            image_url="https://api.example.uz/uploads/eski-rasm.webp",
        )],
    ))
    db_session.commit()

    old_snapshot = _old_file(uploads, "eski-rasm.webp")
    current = _old_file(uploads, "yangi-rasm.webp")
    orphan = _old_file(uploads, "hech-kimniki.webp")

    monkeypatch.setattr(cleanup_uploads, "SessionLocal", lambda: db_session)
    monkeypatch.setattr(db_session, "close", lambda: None)

    assert [p.name for p in cleanup_uploads.find_orphans()] == ["hech-kimniki.webp"]
    cleanup_uploads.main(["--delete"])
    assert old_snapshot.exists()
    assert current.exists()
    assert not orphan.exists()
