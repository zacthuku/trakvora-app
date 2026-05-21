"""Add platform_configs and subscriptions tables

Revision ID: 0016
Revises: 0015
Create Date: 2026-05-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "platform_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("country_code", sa.String(2), nullable=False, server_default="KE"),
        sa.Column("service_type", sa.String(50), nullable=False, server_default="truck"),
        sa.Column("commission_rate", sa.Float, nullable=False, server_default="0.05"),
        sa.Column("vat_rate", sa.Float, nullable=False, server_default="0.16"),
        sa.Column("min_commission_kes", sa.Float, nullable=False, server_default="500"),
        sa.Column("max_commission_kes", sa.Float, nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("notes", sa.Text, nullable=True),
    )

    # Subscription plans (product catalogue)
    op.create_table(
        "subscription_plans",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("tier", sa.Enum("free", "fleet_basic", "fleet_pro", "enterprise", name="plantier"), nullable=False),
        sa.Column("billing_cycle", sa.Enum("monthly", "annual", name="billingcycle"), nullable=False),
        sa.Column("price_kes", sa.Float, nullable=False),
        sa.Column("max_trucks", sa.Integer, nullable=True),
        sa.Column("max_drivers", sa.Integer, nullable=True),
        sa.Column("includes_api_access", sa.Boolean, server_default="false"),
        sa.Column("includes_analytics", sa.Boolean, server_default="false"),
        sa.Column("includes_priority_matching", sa.Boolean, server_default="false"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
    )

    # User subscriptions
    op.create_table(
        "subscriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("plan_id", UUID(as_uuid=True), sa.ForeignKey("subscription_plans.id"), nullable=False),
        sa.Column(
            "status",
            sa.Enum("active", "past_due", "cancelled", "trialing", "expired", name="subscriptionstatus"),
            nullable=False,
            server_default="trialing",
        ),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("flutterwave_subscription_id", sa.String(100), nullable=True),
    )
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"])

    # Seed default platform configs (Kenya, all service types, 5% commission)
    op.execute("""
        INSERT INTO platform_configs (id, country_code, service_type, commission_rate, vat_rate, min_commission_kes, is_active)
        VALUES
          (gen_random_uuid(), 'KE', 'truck',      0.05, 0.16, 500, true),
          (gen_random_uuid(), 'KE', 'van',         0.06, 0.16, 200, true),
          (gen_random_uuid(), 'KE', 'pickup',      0.06, 0.16, 150, true),
          (gen_random_uuid(), 'KE', 'parcel',      0.08, 0.16, 50,  true),
          (gen_random_uuid(), 'KE', 'movers',      0.07, 0.16, 300, true),
          (gen_random_uuid(), 'KE', 'airfreight',  0.04, 0.16, 2000, true),
          (gen_random_uuid(), 'UG', 'truck',       0.05, 0.18, 500, true),
          (gen_random_uuid(), 'TZ', 'truck',       0.05, 0.18, 500, true)
    """)

    # Seed default subscription plans
    op.execute("""
        INSERT INTO subscription_plans (id, name, tier, billing_cycle, price_kes, max_trucks, max_drivers, includes_api_access, includes_analytics, includes_priority_matching, is_active)
        VALUES
          (gen_random_uuid(), 'Free',         'free',        'monthly',  0,      2,    5,    false, false, false, true),
          (gen_random_uuid(), 'Fleet Basic',  'fleet_basic', 'monthly',  4999,   5,    15,   false, false, false, true),
          (gen_random_uuid(), 'Fleet Pro',    'fleet_pro',   'monthly',  12999,  25,   75,   false, true,  true,  true),
          (gen_random_uuid(), 'Enterprise',   'enterprise',  'monthly',  39999,  NULL, NULL, true,  true,  true,  true),
          (gen_random_uuid(), 'Fleet Basic (Annual)', 'fleet_basic', 'annual', 49990, 5, 15, false, false, false, true),
          (gen_random_uuid(), 'Fleet Pro (Annual)',   'fleet_pro',   'annual', 129990, 25, 75, false, true, true, true)
    """)


def downgrade() -> None:
    op.drop_index("ix_subscriptions_user_id", "subscriptions")
    op.drop_table("subscriptions")
    op.drop_table("subscription_plans")
    op.drop_table("platform_configs")
    op.execute("DROP TYPE IF EXISTS subscriptionstatus")
    op.execute("DROP TYPE IF EXISTS billingcycle")
    op.execute("DROP TYPE IF EXISTS plantier")
