"""Add PAYE, SHIF, NSSF, net_pay columns to employee_salaries.

Revision ID: 0044
Revises: 0043
Create Date: 2026-05-28
"""
from alembic import op
import sqlalchemy as sa

revision = "0044"
down_revision = "0043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("employee_salaries", sa.Column("paye_kes",     sa.Numeric(14, 2), nullable=False, server_default="0"))
    op.add_column("employee_salaries", sa.Column("shif_kes",     sa.Numeric(14, 2), nullable=False, server_default="0"))
    op.add_column("employee_salaries", sa.Column("nssf_kes",     sa.Numeric(14, 2), nullable=False, server_default="0"))
    op.add_column("employee_salaries", sa.Column("net_pay_kes",  sa.Numeric(14, 2), nullable=False, server_default="0"))
    op.add_column("employee_salaries", sa.Column("employee_pin", sa.String(20),     nullable=True))


def downgrade() -> None:
    for col in ("paye_kes", "shif_kes", "nssf_kes", "net_pay_kes", "employee_pin"):
        op.drop_column("employee_salaries", col)
