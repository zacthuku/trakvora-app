"""Add owner_user role to userrole enum and finance_admin to adminrole enum

Revision ID: 0038
Revises: 0037
Create Date: 2026-05-27

Adds:
  userrole enum: owner_user  (operations sub-role under a fleet owner)
  adminrole enum: finance_admin  (financial operations admin)
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "0038"
down_revision = "0037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL requires ALTER TYPE … ADD VALUE for existing enums.
    # IF NOT EXISTS guard makes this idempotent.
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'owner_user'")
    op.execute("ALTER TYPE adminrole ADD VALUE IF NOT EXISTS 'finance_admin'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values directly.
    # A full enum recreation would be needed; skip for safety.
    pass
