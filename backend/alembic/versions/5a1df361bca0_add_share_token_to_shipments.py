"""add share_token to shipments

Revision ID: 5a1df361bca0
Revises: s5t6u7v8w9x0
Create Date: 2026-06-09 09:27:03.390823

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '5a1df361bca0'
down_revision: Union[str, None] = 's5t6u7v8w9x0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('shipments', sa.Column('share_token', sa.String(32), nullable=True))
    # Backfill existing rows using built-in UUID + MD5 (no extensions required)
    op.execute(
        "UPDATE shipments SET share_token = replace(md5(gen_random_uuid()::text || id::text), '-', '') "
        "WHERE share_token IS NULL"
    )
    op.alter_column('shipments', 'share_token', nullable=False)
    op.create_unique_constraint('uq_shipments_share_token', 'shipments', ['share_token'])


def downgrade() -> None:
    op.drop_constraint('uq_shipments_share_token', 'shipments', type_='unique')
    op.drop_column('shipments', 'share_token')
