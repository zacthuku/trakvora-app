"""make users.phone nullable for Google OAuth

Revision ID: 0021
Revises: 0020
Create Date: 2026-05-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("users", "phone", existing_type=sa.String(25), nullable=True)


def downgrade() -> None:
    op.alter_column("users", "phone", existing_type=sa.String(25), nullable=False)
