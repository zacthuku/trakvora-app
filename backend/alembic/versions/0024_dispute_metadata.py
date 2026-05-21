"""Add dispute metadata columns to shipments

Revision ID: 0024
Revises: 0023
Create Date: 2026-05-18
"""

from alembic import op
import sqlalchemy as sa


revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("shipments", sa.Column("dispute_reason", sa.Text(), nullable=True))
    op.add_column("shipments", sa.Column("dispute_opened_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("shipments", sa.Column("dispute_note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("shipments", "dispute_note")
    op.drop_column("shipments", "dispute_opened_at")
    op.drop_column("shipments", "dispute_reason")
