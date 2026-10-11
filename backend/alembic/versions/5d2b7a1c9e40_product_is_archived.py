"""products.is_archived (buyurtmasi bor mahsulotni arxivlash)

Revision ID: 5d2b7a1c9e40
Revises: 4c9e1e3f9f5c
Create Date: 2026-10-11 12:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '5d2b7a1c9e40'
down_revision = '4c9e1e3f9f5c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('products', sa.Column('is_archived', sa.Boolean(), server_default=sa.false(), nullable=False))


def downgrade() -> None:
    op.drop_column('products', 'is_archived')
