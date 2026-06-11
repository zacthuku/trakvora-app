"""Add target_role and max_loads_per_month to subscription_plans; seed shipper/driver plans

Revision ID: 0046
Revises: 0045
Create Date: 2026-05-29
"""
import uuid
from alembic import op
import sqlalchemy as sa

revision = "0046"
down_revision = "0045"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL requires new enum values to be committed before use in the same session.
    # autocommit_block() ensures the ALTER TYPE statements are committed immediately.
    with op.get_context().autocommit_block():
        op.execute(sa.text("ALTER TYPE plantier ADD VALUE IF NOT EXISTS 'shipper_free'"))
        op.execute(sa.text("ALTER TYPE plantier ADD VALUE IF NOT EXISTS 'shipper_growth'"))
        op.execute(sa.text("ALTER TYPE plantier ADD VALUE IF NOT EXISTS 'shipper_business'"))
        op.execute(sa.text("ALTER TYPE plantier ADD VALUE IF NOT EXISTS 'driver_free'"))

    # Add new columns to subscription_plans
    op.add_column("subscription_plans", sa.Column("target_role", sa.String(50), nullable=True))
    op.add_column("subscription_plans", sa.Column("max_loads_per_month", sa.Integer, nullable=True))

    # Tag all existing fleet plans as owner-targeted
    op.execute(sa.text("UPDATE subscription_plans SET target_role = 'owner'"))

    # Seed shipper plans
    op.execute(sa.text(f"""
        INSERT INTO subscription_plans
            (id, name, tier, billing_cycle, price_kes, max_trucks, max_drivers,
             max_loads_per_month, includes_api_access, includes_analytics,
             includes_priority_matching, description, is_active, target_role)
        VALUES
        (
            '{uuid.uuid4()}', 'Shipper Free', 'shipper_free', 'monthly', 0,
            NULL, NULL, 5, false, false, false,
            'Post up to 5 loads per month. Standard carrier matching.', true, 'shipper'
        ),
        (
            '{uuid.uuid4()}', 'Shipper Growth', 'shipper_growth', 'monthly', 2999,
            NULL, NULL, 30, false, true, true,
            'Post up to 30 loads per month. Priority matching and analytics.', true, 'shipper'
        ),
        (
            '{uuid.uuid4()}', 'Shipper Business', 'shipper_business', 'monthly', 7999,
            NULL, NULL, NULL, true, true, true,
            'Unlimited loads. Full analytics, API access, and priority matching.', true, 'shipper'
        )
    """))

    # Seed driver free plan
    op.execute(sa.text(f"""
        INSERT INTO subscription_plans
            (id, name, tier, billing_cycle, price_kes, max_trucks, max_drivers,
             max_loads_per_month, includes_api_access, includes_analytics,
             includes_priority_matching, description, is_active, target_role)
        VALUES
        (
            '{uuid.uuid4()}', 'Driver Free', 'driver_free', 'monthly', 0,
            NULL, NULL, NULL, false, false, false,
            'Free access to the job feed. No charges.', true, 'driver'
        )
    """))


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM subscription_plans WHERE target_role IN ('shipper', 'driver')"))
    op.execute(sa.text("UPDATE subscription_plans SET target_role = NULL"))
    op.drop_column("subscription_plans", "max_loads_per_month")
    op.drop_column("subscription_plans", "target_role")
    # Note: PostgreSQL does not support removing enum values; enum stays extended on downgrade
