"""Add subscription_fee to TransactionType enum

Revision ID: 0026
Revises: 0025
Create Date: 2026-05-18
"""

from alembic import op


revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'subscription_fee'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values; downgrade is a no-op
    pass
