"""add_original_role_to_users

Revision ID: 0048
Revises: 0047
Create Date: 2026-06-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0048"
down_revision: Union[str, None] = "0047"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "original_role",
            sa.Enum(
                "shipper", "owner", "owner_user", "driver", "admin",
                "mover", "air_freight", "parcel_carrier",
                name="userrole",
            ),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "original_role")
