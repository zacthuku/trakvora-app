"""add onboarding_fee_records table for partner vehicle onboarding payments

Revision ID: n0p1q2r3s4t5
Revises: m9o0p1q2r3s4
Create Date: 2026-06-08 18:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "n0p1q2r3s4t5"
down_revision: Union[str, None] = "m9o0p1q2r3s4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "onboarding_fee_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("truck_type", sa.String(40), nullable=False),
        sa.Column("amount_kes", sa.Integer, nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "paid", "expired", name="onboarding_fee_status"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("tx_ref", sa.String(100), nullable=False),
        sa.Column("truck_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["truck_id"], ["trucks.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tx_ref"),
    )
    op.create_index("ix_onboarding_fee_owner", "onboarding_fee_records", ["owner_id"])
    op.create_index("ix_onboarding_fee_tx_ref", "onboarding_fee_records", ["tx_ref"])


def downgrade() -> None:
    op.drop_index("ix_onboarding_fee_tx_ref", table_name="onboarding_fee_records")
    op.drop_index("ix_onboarding_fee_owner", table_name="onboarding_fee_records")
    op.drop_table("onboarding_fee_records")
    op.execute("DROP TYPE IF EXISTS onboarding_fee_status")
