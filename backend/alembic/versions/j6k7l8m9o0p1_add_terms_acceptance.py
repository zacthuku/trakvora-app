"""add terms acceptance fields to users

Revision ID: j6k7l8m9o0p1
Revises: i5j6k7l8m9o0
Create Date: 2026-06-08 11:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'j6k7l8m9o0p1'
down_revision: Union[str, None] = 'i5j6k7l8m9o0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('terms_accepted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('terms_version', sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'terms_version')
    op.drop_column('users', 'terms_accepted_at')
