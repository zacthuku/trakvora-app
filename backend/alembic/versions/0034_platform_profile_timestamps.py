"""platform_profile: add missing created_at / updated_at timestamps

Revision ID: 0034
Revises: 0033
Create Date: 2026-05-25
"""

from alembic import op
import sqlalchemy as sa

revision = "0034"
down_revision = "0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "platform_profiles",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.add_column(
        "platform_profiles",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("platform_profiles", "updated_at")
    op.drop_column("platform_profiles", "created_at")
