"""add kra_pin to users

Revision ID: d75947c72285
Revises: 5730e8aa8993
Create Date: 2026-06-03 13:03:40.507015

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd75947c72285'
down_revision: Union[str, None] = '5730e8aa8993'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('kra_pin', sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'kra_pin')
