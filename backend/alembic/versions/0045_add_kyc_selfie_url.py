"""Add kyc_selfie_url to users table.

Revision ID: 0045
Revises: 0044
Create Date: 2026-05-29
"""
from alembic import op
import sqlalchemy as sa

revision = "0045"
down_revision = "0044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("kyc_selfie_url", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "kyc_selfie_url")
