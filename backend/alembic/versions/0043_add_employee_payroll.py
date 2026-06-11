"""Add employee_salaries table for internal payroll.

Revision ID: 0043
Revises: 0042
Create Date: 2026-05-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0043"
down_revision = "2f189d2234e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "employee_salaries",
        sa.Column("id",                      UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("admin_user_id",           UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("payment_month",           sa.String(7),    nullable=False),
        sa.Column("base_salary_kes",         sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("housing_allowance_kes",   sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("transport_allowance_kes", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("bonus_kes",               sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("bonus_reason",            sa.Text,         nullable=True),
        sa.Column("total_kes",               sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("status",                  sa.String(20),   nullable=False, server_default="draft"),
        sa.Column("approved_by_id",          UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("paid_at",                 sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes",                   sa.Text,         nullable=True),
        sa.Column("created_at",              sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at",              sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_employee_salaries_admin_user_id", "employee_salaries", ["admin_user_id"])
    op.create_unique_constraint("uq_employee_salary_user_month", "employee_salaries", ["admin_user_id", "payment_month"])


def downgrade() -> None:
    op.drop_constraint("uq_employee_salary_user_month", "employee_salaries", type_="unique")
    op.drop_index("ix_employee_salaries_admin_user_id", table_name="employee_salaries")
    op.drop_table("employee_salaries")
