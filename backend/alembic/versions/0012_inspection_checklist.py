"""Add checklist JSONB column to vehicle_inspections

Revision ID: 0012
Revises: 0011
Create Date: 2026-05-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "vehicle_inspections",
        sa.Column("checklist", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("vehicle_inspections", "checklist")
