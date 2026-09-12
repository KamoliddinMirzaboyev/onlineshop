"""Ishlatilmagan ustunlarni olib tashlash.

- `delivery_zones.fee` / `min_order` — admin kiritardi, baza saqlardi, lekin
  yetkazish haqi HAR DOIM do'kon darajasidagi `delivery_fee` /
  `free_delivery_from` dan hisoblanardi. Ya'ni maydonlar hech narsaga ta'sir
  qilmasdi va adminni chalg'itardi.
- `users.password_hash` — mijoz Telegram yoki OTP bilan kiradi, paroli yo'q.
  Ustun hech qachon o'qilmagan ham, yozilmagan ham.

Revision ID: 3a7f68c8181a
Revises: 32f617e503df
Create Date: 2026-09-12 14:30:22.048064
"""
import sqlalchemy as sa
from alembic import op


revision = '3a7f68c8181a'
down_revision = '32f617e503df'
branch_labels = None
depends_on = None


def _columns(table: str) -> set[str]:
    bind = op.get_bind()
    return {c["name"] for c in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    # Idempotent: `app/initdb.py` eski deploy'lar uchun shu ustunlarni
    # `DROP COLUMN IF EXISTS` bilan allaqachon olib tashlagan bo'lishi mumkin
    # (u konteyner startida, migratsiyadan oldin ishlaydi). Tekshirmasak,
    # `op.drop_column` "column does not exist" bilan yiqilardi.
    zone_cols = _columns("delivery_zones")
    if "min_order" in zone_cols:
        op.drop_column("delivery_zones", "min_order")
    if "fee" in zone_cols:
        op.drop_column("delivery_zones", "fee")
    if "password_hash" in _columns("users"):
        op.drop_column("users", "password_hash")


def downgrade() -> None:
    if "password_hash" in _columns("users"):
        return  # allaqachon qaytarilgan
    op.add_column(
        "users",
        sa.Column("password_hash", sa.VARCHAR(length=255), nullable=True),
    )
    # server_default shart: jadval bo'sh bo'lmasa NOT NULL ustun default'siz
    # qo'shilmaydi (autogenerate buni qo'shmaydi — qo'lda to'g'rilangan).
    op.add_column(
        "delivery_zones",
        sa.Column("fee", sa.INTEGER(), nullable=False, server_default="0"),
    )
    op.add_column(
        "delivery_zones",
        sa.Column("min_order", sa.INTEGER(), nullable=False, server_default="0"),
    )
