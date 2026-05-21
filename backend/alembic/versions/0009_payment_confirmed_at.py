"""add payment_confirmed_at to shipments

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-06
"""
from alembic import op
import sqlalchemy as sa


revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "shipments",
        sa.Column("payment_confirmed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_column("shipments", "payment_confirmed_at")
