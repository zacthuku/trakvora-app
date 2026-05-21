"""service_provider_roles

Revision ID: 0031
Revises: 0030
Create Date: 2026-05-20

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add new enum values to userrole (must be done outside a transaction in PG)
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'mover'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'air_freight'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'parcel_carrier'")

    # 2. Provider profile tables
    op.create_table(
        "mover_profiles",
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("service_areas", JSON, nullable=True),
        sa.Column("fleet_size", sa.Integer, nullable=True),
        sa.Column("services_offered", JSON, nullable=True),
        sa.Column("license_number", sa.String(100), nullable=True),
        sa.Column("insurance_number", sa.String(100), nullable=True),
        sa.Column("min_price_kes", sa.Float, nullable=True),
        sa.Column("bio", sa.Text, nullable=True),
        sa.Column("is_verified", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rating", sa.Float, nullable=True),
        sa.Column("total_jobs", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "air_freight_profiles",
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("iata_agent_code", sa.String(20), nullable=True),
        sa.Column("supported_routes", JSON, nullable=True),
        sa.Column("supported_airlines", JSON, nullable=True),
        sa.Column("has_warehousing", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("has_customs_clearance", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("dangerous_goods_certified", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("license_number", sa.String(100), nullable=True),
        sa.Column("min_weight_kg", sa.Float, nullable=True),
        sa.Column("max_weight_kg", sa.Float, nullable=True),
        sa.Column("min_price_kes", sa.Float, nullable=True),
        sa.Column("bio", sa.Text, nullable=True),
        sa.Column("is_verified", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rating", sa.Float, nullable=True),
        sa.Column("total_jobs", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "parcel_carrier_profiles",
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("service_areas", JSON, nullable=True),
        sa.Column("service_levels", JSON, nullable=True),
        sa.Column("max_weight_kg", sa.Float, nullable=True),
        sa.Column("has_cod", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("license_number", sa.String(100), nullable=True),
        sa.Column("min_price_kes", sa.Float, nullable=True),
        sa.Column("bio", sa.Text, nullable=True),
        sa.Column("is_verified", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rating", sa.Float, nullable=True),
        sa.Column("total_jobs", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # 3. Add provider columns to booking tables
    op.add_column("move_requests", sa.Column("provider_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True))
    op.add_column("move_requests", sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True))

    op.add_column("airfreight", sa.Column("provider_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True))
    op.add_column("airfreight", sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True))

    op.add_column("parcels", sa.Column("carrier_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True))
    op.add_column("parcels", sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("parcels", "accepted_at")
    op.drop_column("parcels", "carrier_id")
    op.drop_column("airfreight", "accepted_at")
    op.drop_column("airfreight", "provider_id")
    op.drop_column("move_requests", "accepted_at")
    op.drop_column("move_requests", "provider_id")
    op.drop_table("parcel_carrier_profiles")
    op.drop_table("air_freight_profiles")
    op.drop_table("mover_profiles")
    # Note: PostgreSQL does not support removing enum values
