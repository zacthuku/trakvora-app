"""soft_delete_and_ban_on_users

Revision ID: 99b7576120c3
Revises: 5a1df361bca0
Create Date: 2026-06-09 09:52:50.681701

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '99b7576120c3'
down_revision: Union[str, None] = '5a1df361bca0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Soft-delete columns
    op.add_column('users', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('deleted_reason', sa.String(200), nullable=True))

    # Permanent ban columns
    op.add_column('users', sa.Column('is_banned', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('users', sa.Column('ban_reason', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('ban_snapshot', sa.JSON(), nullable=True))

    # Partial unique indexes on identity fields (only enforced when value is not null)
    op.execute(
        "CREATE UNIQUE INDEX uq_users_national_id ON users (national_id) WHERE national_id IS NOT NULL"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_users_kra_pin ON users (kra_pin) WHERE kra_pin IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_users_national_id")
    op.execute("DROP INDEX IF EXISTS uq_users_kra_pin")
    op.drop_column('users', 'ban_snapshot')
    op.drop_column('users', 'ban_reason')
    op.drop_column('users', 'is_banned')
    op.drop_column('users', 'deleted_reason')
    op.drop_column('users', 'deleted_at')
