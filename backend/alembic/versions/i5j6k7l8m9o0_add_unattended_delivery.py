"""add unattended delivery GPS stamp fields

Revision ID: i5j6k7l8m9o0
Revises: h4i5j6k7l8m9
Create Date: 2026-06-08 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'i5j6k7l8m9o0'
down_revision: Union[str, None] = 'h4i5j6k7l8m9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('loads', sa.Column('unattended_delivery', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('shipments', sa.Column('delivery_location_name', sa.String(480), nullable=True))
    op.add_column('shipments', sa.Column('auto_delivered_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('shipments', sa.Column('delivery_method', sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column('shipments', 'delivery_method')
    op.drop_column('shipments', 'auto_delivered_at')
    op.drop_column('shipments', 'delivery_location_name')
    op.drop_column('loads', 'unattended_delivery')
