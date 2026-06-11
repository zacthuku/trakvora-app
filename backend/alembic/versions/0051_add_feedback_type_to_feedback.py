"""add_feedback_type_to_feedback

Revision ID: 0051
Revises: 0050
Create Date: 2026-06-02

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0051"
down_revision: Union[str, None] = "0050"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("feedback", sa.Column("feedback_type", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("feedback", "feedback_type")
