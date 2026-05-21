"""Add logbook, insurance, and compliance expiry fields to trucks

Revision ID: 0018
Revises: 0017
Create Date: 2026-05-12
"""
from alembic import op
import sqlalchemy as sa

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("trucks", sa.Column("logbook_url", sa.String(500), nullable=True))
    op.add_column("trucks", sa.Column("insurance_url", sa.String(500), nullable=True))
    op.add_column("trucks", sa.Column("insurance_expiry", sa.Date, nullable=True))
    op.add_column("trucks", sa.Column("ntsa_inspection_url", sa.String(500), nullable=True))
    op.add_column("trucks", sa.Column("ntsa_inspection_expiry", sa.Date, nullable=True))


def downgrade() -> None:
    op.drop_column("trucks", "ntsa_inspection_expiry")
    op.drop_column("trucks", "ntsa_inspection_url")
    op.drop_column("trucks", "insurance_expiry")
    op.drop_column("trucks", "insurance_url")
    op.drop_column("trucks", "logbook_url")
