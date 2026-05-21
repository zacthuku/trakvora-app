"""Split commission_rate into shipper/carrier/cancellation on platform_configs

Revision ID: 0032
Revises: 0031
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa

revision = "0032"
down_revision = "0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("platform_configs",
        sa.Column("shipper_commission_rate", sa.Float(), nullable=True))
    op.add_column("platform_configs",
        sa.Column("carrier_commission_rate", sa.Float(), nullable=True))
    op.add_column("platform_configs",
        sa.Column("cancellation_fee_rate", sa.Float(), nullable=True))

    # Seed KE/truck canonical row with values matching the legal pages
    op.execute("""
        UPDATE platform_configs
        SET shipper_commission_rate = 0.03,
            carrier_commission_rate = 0.07,
            cancellation_fee_rate   = 0.05,
            max_commission_kes      = 15000
        WHERE country_code = 'KE' AND service_type = 'truck'
    """)

    # Back-fill all remaining rows with symmetric defaults from commission_rate
    op.execute("""
        UPDATE platform_configs
        SET shipper_commission_rate = COALESCE(shipper_commission_rate, commission_rate),
            carrier_commission_rate = COALESCE(carrier_commission_rate, commission_rate),
            cancellation_fee_rate   = COALESCE(cancellation_fee_rate, 0.05)
    """)


def downgrade() -> None:
    op.drop_column("platform_configs", "cancellation_fee_rate")
    op.drop_column("platform_configs", "carrier_commission_rate")
    op.drop_column("platform_configs", "shipper_commission_rate")
