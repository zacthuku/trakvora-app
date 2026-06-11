"""add_capability_flags_to_users

Revision ID: 0047
Revises: 0046
Create Date: 2026-05-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0047"
down_revision: Union[str, None] = "0046"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("can_carry", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("can_ship", sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("users", "can_ship")
    op.drop_column("users", "can_carry")
