"""Add companies and company_members tables

Revision ID: 0017
Revises: 0016
Create Date: 2026-05-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("kra_pin", sa.String(20), nullable=True),
        sa.Column("industry", sa.String(100), nullable=True),
        sa.Column("country_code", sa.String(2), nullable=False, server_default="KE"),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("website", sa.String(200), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_verified", sa.Boolean, server_default="false"),
        sa.Column("owner_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
    )
    op.create_index("ix_companies_owner_user_id", "companies", ["owner_user_id"])

    op.create_table(
        "company_members",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("company_id", UUID(as_uuid=True), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "role",
            sa.Enum("admin", "ops", "viewer", name="companymemberrole"),
            nullable=False,
            server_default="viewer",
        ),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("invited_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
    )
    op.create_index("ix_company_members_company_id", "company_members", ["company_id"])
    op.create_index("ix_company_members_user_id", "company_members", ["user_id"])
    op.create_unique_constraint("uq_company_member", "company_members", ["company_id", "user_id"])

    # Add optional company_id to users (a shipper user can belong to a company)
    op.add_column("users", sa.Column("company_id", UUID(as_uuid=True), sa.ForeignKey("companies.id"), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "company_id")
    op.drop_constraint("uq_company_member", "company_members", type_="unique")
    op.drop_index("ix_company_members_user_id", "company_members")
    op.drop_index("ix_company_members_company_id", "company_members")
    op.drop_table("company_members")
    op.drop_index("ix_companies_owner_user_id", "companies")
    op.drop_table("companies")
    op.execute("DROP TYPE IF EXISTS companymemberrole")
