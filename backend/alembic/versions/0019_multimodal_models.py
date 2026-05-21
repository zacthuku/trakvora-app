"""Add parcels, move_requests, and airfreight tables

Revision ID: 0019
Revises: 0018
Create Date: 2026-05-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create parcelservicelevel enum (checkfirst guards against pre-existing type)
    parcelservicelevel = sa.Enum(
        "standard", "express", "same_day",
        name="parcelservicelevel",
    )
    parcelservicelevel.create(op.get_bind(), checkfirst=True)

    # Create parcels table WITHOUT service_level to avoid asyncpg Enum auto-create bug
    op.create_table(
        "parcels",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("shipper_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("pickup_location", sa.String(255), nullable=False),
        sa.Column("pickup_latitude", sa.Float, nullable=False),
        sa.Column("pickup_longitude", sa.Float, nullable=False),
        sa.Column("dropoff_location", sa.String(255), nullable=False),
        sa.Column("dropoff_latitude", sa.Float, nullable=False),
        sa.Column("dropoff_longitude", sa.Float, nullable=False),
        sa.Column("weight_kg", sa.Float, nullable=False),
        sa.Column("length_cm", sa.Float, nullable=True),
        sa.Column("width_cm", sa.Float, nullable=True),
        sa.Column("height_cm", sa.Float, nullable=True),
        sa.Column("contents_description", sa.Text, nullable=True),
        sa.Column("declared_value_kes", sa.Float, nullable=True),
        sa.Column("is_fragile", sa.Boolean, server_default="false"),
        sa.Column("requires_insurance", sa.Boolean, server_default="false"),
        sa.Column("recipient_name", sa.String(200), nullable=True),
        sa.Column("recipient_phone", sa.String(25), nullable=True),
        sa.Column("special_instructions", sa.Text, nullable=True),
        sa.Column("price_kes", sa.Float, nullable=False),
        sa.Column("status", sa.String(30), server_default="pending"),
    )
    # Add enum column via raw DDL to bypass SQLAlchemy's async Enum auto-create
    op.execute("ALTER TABLE parcels ADD COLUMN service_level parcelservicelevel NOT NULL DEFAULT 'standard'")
    op.create_index("ix_parcels_shipper_id", "parcels", ["shipper_id"])

    op.create_table(
        "move_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("shipper_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("origin_location", sa.String(255), nullable=False),
        sa.Column("origin_latitude", sa.Float, nullable=False),
        sa.Column("origin_longitude", sa.Float, nullable=False),
        sa.Column("origin_floor", sa.Integer, server_default="0"),
        sa.Column("origin_has_lift", sa.Boolean, server_default="false"),
        sa.Column("destination_location", sa.String(255), nullable=False),
        sa.Column("destination_latitude", sa.Float, nullable=False),
        sa.Column("destination_longitude", sa.Float, nullable=False),
        sa.Column("destination_floor", sa.Integer, server_default="0"),
        sa.Column("destination_has_lift", sa.Boolean, server_default="false"),
        sa.Column("move_date", sa.String(20), nullable=True),
        sa.Column("move_type", sa.String(50), server_default="home"),
        sa.Column("num_rooms", sa.Integer, nullable=True),
        sa.Column("estimated_volume_cbm", sa.Float, nullable=True),
        sa.Column("requires_packing", sa.Boolean, server_default="false"),
        sa.Column("requires_storage", sa.Boolean, server_default="false"),
        sa.Column("inventory_items", JSONB, nullable=True),
        sa.Column("special_instructions", sa.Text, nullable=True),
        sa.Column("price_kes", sa.Float, nullable=False),
        sa.Column("status", sa.String(30), server_default="pending"),
    )
    op.create_index("ix_move_requests_shipper_id", "move_requests", ["shipper_id"])

    op.create_table(
        "airfreight",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("shipper_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("port_of_origin", sa.String(100), nullable=False),
        sa.Column("port_of_destination", sa.String(100), nullable=False),
        sa.Column("airline", sa.String(100), nullable=True),
        sa.Column("flight_number", sa.String(20), nullable=True),
        sa.Column("expected_departure", sa.String(30), nullable=True),
        sa.Column("hawb", sa.String(50), nullable=True),
        sa.Column("mawb", sa.String(50), nullable=True),
        sa.Column("cargo_description", sa.Text, nullable=True),
        sa.Column("cargo_weight_kg", sa.Float, nullable=False),
        sa.Column("volume_cbm", sa.Float, nullable=True),
        sa.Column("declared_value_usd", sa.Float, nullable=True),
        sa.Column("is_dangerous_goods", sa.Boolean, server_default="false"),
        sa.Column("iata_code", sa.String(10), nullable=True),
        sa.Column("price_kes", sa.Float, nullable=False),
        sa.Column("status", sa.String(30), server_default="pending"),
        sa.Column("special_instructions", sa.Text, nullable=True),
    )
    op.create_index("ix_airfreight_shipper_id", "airfreight", ["shipper_id"])


def downgrade() -> None:
    op.drop_index("ix_airfreight_shipper_id", "airfreight")
    op.drop_table("airfreight")
    op.drop_index("ix_move_requests_shipper_id", "move_requests")
    op.drop_table("move_requests")
    op.drop_index("ix_parcels_shipper_id", "parcels")
    op.drop_table("parcels")
    op.execute("DROP TYPE IF EXISTS parcelservicelevel")
