"""Add transaction provider metadata

Revision ID: 0023
Revises: 0022
Create Date: 2026-05-15
"""

from alembic import op
import sqlalchemy as sa


revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("provider", sa.String(50), nullable=True))
    op.add_column("transactions", sa.Column("provider_reference", sa.String(100), nullable=True))
    op.add_column("transactions", sa.Column("provider_transaction_id", sa.String(100), nullable=True))
    op.add_column("transactions", sa.Column("provider_status", sa.String(100), nullable=True))
    op.add_column("transactions", sa.Column("provider_metadata", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("transactions", "provider_metadata")
    op.drop_column("transactions", "provider_status")
    op.drop_column("transactions", "provider_transaction_id")
    op.drop_column("transactions", "provider_reference")
    op.drop_column("transactions", "provider")
