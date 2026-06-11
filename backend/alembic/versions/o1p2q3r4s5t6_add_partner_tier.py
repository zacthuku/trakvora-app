"""add partner_tier column to users for marketplace trust badges

Revision ID: o1p2q3r4s5t6
Revises: n0p1q2r3s4t5
Create Date: 2026-06-08 19:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "o1p2q3r4s5t6"
down_revision: Union[str, None] = "n0p1q2r3s4t5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE partnertier AS ENUM ('standard', 'verified', 'premium')")
    op.add_column(
        "users",
        sa.Column(
            "partner_tier",
            sa.Enum("standard", "verified", "premium", name="partnertier", create_type=False),
            nullable=False,
            server_default="standard",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "partner_tier")
    op.execute("DROP TYPE IF EXISTS partnertier")
