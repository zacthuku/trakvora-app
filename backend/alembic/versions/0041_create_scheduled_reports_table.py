"""Create scheduled_reports table.

Revision ID: 0041
Revises: 0040
Create Date: 2026-05-27
"""
from alembic import op
import sqlalchemy as sa

revision = "0041"
down_revision = "0040"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scheduled_reports",
        sa.Column("id",           sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id",      sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("report_type",  sa.String(50),  nullable=False),
        sa.Column("frequency",    sa.String(20),  nullable=False, server_default="weekly"),
        sa.Column("email_to",     sa.String(255), nullable=True),
        sa.Column("last_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active",    sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at",   sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_scheduled_reports_user_id", "scheduled_reports", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_scheduled_reports_user_id", table_name="scheduled_reports")
    op.drop_table("scheduled_reports")
