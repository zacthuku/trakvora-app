"""Add scheduled_at to loads table for deferred load publishing.

Revision ID: 0042
Revises: 0041
Create Date: 2026-05-27
"""
from alembic import op
import sqlalchemy as sa

revision = "0042"
down_revision = "0041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("loads", sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("loads", "scheduled_at")
