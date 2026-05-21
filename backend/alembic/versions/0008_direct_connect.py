"""add direct booking mode and direct offer fields

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'direct' to bookingmode enum
    op.execute("ALTER TYPE bookingmode ADD VALUE IF NOT EXISTS 'direct'")

    # Add direct_offer_user_id to loads
    op.add_column("loads", sa.Column(
        "direct_offer_user_id",
        postgresql.UUID(as_uuid=True),
        sa.ForeignKey("users.id"),
        nullable=True,
    ))

    # Add direct_offer and direct_offer_response to notificationtype enum
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'direct_offer'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'direct_offer_response'")


def downgrade() -> None:
    op.drop_column("loads", "direct_offer_user_id")
    # PostgreSQL does not support removing enum values; downgrade is partial
