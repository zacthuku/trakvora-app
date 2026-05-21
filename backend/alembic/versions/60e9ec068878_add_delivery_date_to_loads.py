"""add_delivery_date_to_loads

Revision ID: 60e9ec068878
Revises: 0014
Create Date: 2026-05-11 12:48:49.200800

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '60e9ec068878'
down_revision: Union[str, None] = '0014'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('loads', sa.Column('delivery_date', sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('loads', 'delivery_date')
