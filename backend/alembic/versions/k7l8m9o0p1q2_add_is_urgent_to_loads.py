"""add is_urgent flag to loads

Revision ID: k7l8m9o0p1q2
Revises: j6k7l8m9o0p1
Create Date: 2026-06-08 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'k7l8m9o0p1q2'
down_revision: Union[str, None] = 'j6k7l8m9o0p1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("loads", sa.Column("is_urgent", sa.Boolean(), nullable=False, server_default="false"))
    op.create_index("ix_loads_is_urgent", "loads", ["is_urgent"])


def downgrade() -> None:
    op.drop_index("ix_loads_is_urgent", table_name="loads")
    op.drop_column("loads", "is_urgent")
