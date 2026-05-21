"""add otp_channel to users

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-28
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("otp_channel", sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "otp_channel")
