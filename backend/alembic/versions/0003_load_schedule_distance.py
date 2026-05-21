"""add distance_km, pickup_date, pickup_window to loads

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-28
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("loads", sa.Column("distance_km", sa.Float(), nullable=True))
    op.add_column("loads", sa.Column("pickup_date", sa.String(20), nullable=True))
    op.add_column("loads", sa.Column("pickup_window", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("loads", "pickup_window")
    op.drop_column("loads", "pickup_date")
    op.drop_column("loads", "distance_km")
