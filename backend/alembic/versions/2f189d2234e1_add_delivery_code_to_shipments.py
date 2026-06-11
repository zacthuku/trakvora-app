"""add delivery_code to shipments

Revision ID: 2f189d2234e1
Revises: 0042
Create Date: 2026-05-27 17:05:17.683110

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2f189d2234e1'
down_revision: Union[str, None] = '0042'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('shipments', sa.Column('delivery_code', sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column('shipments', 'delivery_code')
