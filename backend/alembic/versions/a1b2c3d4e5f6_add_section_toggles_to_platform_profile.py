"""add show_stats_section and show_testimonials_section to platform_profiles

Revision ID: a1b2c3d4e5f6
Revises: f2a3b4c5d6e7
Create Date: 2026-06-04 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("platform_profiles", sa.Column("show_stats_section",        sa.Boolean(), nullable=True, server_default="false"))
    op.add_column("platform_profiles", sa.Column("show_testimonials_section", sa.Boolean(), nullable=True, server_default="false"))


def downgrade() -> None:
    op.drop_column("platform_profiles", "show_testimonials_section")
    op.drop_column("platform_profiles", "show_stats_section")
