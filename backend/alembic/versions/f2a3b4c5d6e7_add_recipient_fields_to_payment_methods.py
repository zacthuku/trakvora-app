"""add recipient_account and recipient_name to payment_methods

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-06-04 11:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("payment_methods", sa.Column("recipient_account", sa.String(100), nullable=True))
    op.add_column("payment_methods", sa.Column("recipient_name",    sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("payment_methods", "recipient_name")
    op.drop_column("payment_methods", "recipient_account")
