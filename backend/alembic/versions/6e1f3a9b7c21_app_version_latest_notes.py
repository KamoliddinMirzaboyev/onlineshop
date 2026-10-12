"""app_versions: latest_version_code + release notes (ixtiyoriy yangilanish modali)

Revision ID: 6e1f3a9b7c21
Revises: 5d2b7a1c9e40
Create Date: 2026-10-12 10:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '6e1f3a9b7c21'
down_revision = '5d2b7a1c9e40'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('app_versions', sa.Column('latest_version_code', sa.Integer(), server_default='0', nullable=False))
    op.add_column('app_versions', sa.Column('release_notes_uz', sa.Text(), nullable=True))
    op.add_column('app_versions', sa.Column('release_notes_ru', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('app_versions', 'release_notes_ru')
    op.drop_column('app_versions', 'release_notes_uz')
    op.drop_column('app_versions', 'latest_version_code')
