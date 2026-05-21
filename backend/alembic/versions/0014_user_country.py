"""Add country field to users table, expand phone column

Revision ID: 0014
Revises: 0013
Create Date: 2026-05-11
"""
from alembic import op
import sqlalchemy as sa


revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("country", sa.String(2), nullable=True, server_default="KE"),
    )
    op.alter_column("users", "phone", type_=sa.String(25), existing_nullable=True)


def downgrade() -> None:
    op.drop_column("users", "country")
    op.alter_column("users", "phone", type_=sa.String(20), existing_nullable=True)
