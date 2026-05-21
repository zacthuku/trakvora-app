"""add passport_photo_url to drivers

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-29
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("drivers", sa.Column("passport_photo_url", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("drivers", "passport_photo_url")
