"""Add country_configs table with seeded rows for KE, UG, TZ

Revision ID: 0020
Revises: 0019
Create Date: 2026-05-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "country_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("country_code", sa.String(2), unique=True, nullable=False),
        sa.Column("country_name", sa.String(100), nullable=False),
        sa.Column("currency_code", sa.String(3), nullable=False, server_default="KES"),
        sa.Column("currency_symbol", sa.String(5), nullable=False, server_default="KSh"),
        sa.Column("vat_rate", sa.Float, nullable=False, server_default="0.16"),
        sa.Column("distance_unit", sa.String(5), nullable=False, server_default="km"),
        sa.Column("date_format", sa.String(20), nullable=False, server_default="DD/MM/YYYY"),
        sa.Column("phone_prefix", sa.String(5), nullable=False, server_default="+254"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("country_admin_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
    )

    op.execute("""
        INSERT INTO country_configs (id, country_code, country_name, currency_code, currency_symbol, vat_rate, phone_prefix, is_active)
        VALUES
          (gen_random_uuid(), 'KE', 'Kenya',    'KES', 'KSh', 0.16, '+254', true),
          (gen_random_uuid(), 'UG', 'Uganda',   'UGX', 'USh', 0.18, '+256', true),
          (gen_random_uuid(), 'TZ', 'Tanzania', 'TZS', 'TSh', 0.18, '+255', true),
          (gen_random_uuid(), 'RW', 'Rwanda',   'RWF', 'RF',  0.18, '+250', false),
          (gen_random_uuid(), 'ET', 'Ethiopia', 'ETB', 'Br',  0.15, '+251', false),
          (gen_random_uuid(), 'NG', 'Nigeria',  'NGN', '₦',   0.075,'+234', false)
    """)


def downgrade() -> None:
    op.drop_table("country_configs")
