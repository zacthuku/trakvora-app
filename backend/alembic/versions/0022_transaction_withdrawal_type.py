"""Add withdrawal transaction type

Revision ID: 0022
Revises: 0021
Create Date: 2026-05-14
"""

from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'withdrawal' to the transactiontype enum if it doesn't exist
    op.execute("ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'withdrawal';")



def downgrade() -> None:
    # Removing values from an existing PostgreSQL enum type is not supported safely in-place.
    pass
