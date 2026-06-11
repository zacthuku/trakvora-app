"""add load_carrier_offers junction table for multi-carrier blast offers

Revision ID: l8m9o0p1q2r3
Revises: k7l8m9o0p1q2
Create Date: 2026-06-08 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'l8m9o0p1q2r3'
down_revision: Union[str, None] = 'k7l8m9o0p1q2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "load_carrier_offers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("load_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("loads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("load_id", "user_id", name="uq_lco_load_user"),
    )
    op.create_index("ix_lco_load_id", "load_carrier_offers", ["load_id"])
    op.create_index("ix_lco_user_id", "load_carrier_offers", ["user_id"])
    op.create_index("ix_lco_status", "load_carrier_offers", ["status"])


def downgrade() -> None:
    op.drop_index("ix_lco_status", table_name="load_carrier_offers")
    op.drop_index("ix_lco_user_id", table_name="load_carrier_offers")
    op.drop_index("ix_lco_load_id", table_name="load_carrier_offers")
    op.drop_table("load_carrier_offers")
