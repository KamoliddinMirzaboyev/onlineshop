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
from alembic import op
import sqlalchemy as sa


revision = '3a7f68c8181a'
down_revision = '32f617e503df'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("delivery_zones", "min_order")
    op.drop_column("delivery_zones", "fee")
    op.drop_column("users", "password_hash")


def downgrade() -> None:
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
