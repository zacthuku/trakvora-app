"""add kra_document_url and national_id to users

Revision ID: 5730e8aa8993
Revises: 0053
Create Date: 2026-06-03 11:41:38.028816

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '5730e8aa8993'
down_revision: Union[str, None] = '0053'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('kra_document_url', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'kra_document_url')
