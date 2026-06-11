"""Add fcm_token to users table for Firebase push notifications.

Revision ID: 0040
Revises: 0039
Create Date: 2026-05-27
"""
from alembic import op
import sqlalchemy as sa

revision = "0040"
down_revision = "0039"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("fcm_token", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "fcm_token")
