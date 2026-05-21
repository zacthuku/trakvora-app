"""initial tables

Revision ID: 0001
Revises:
Create Date: 2026-04-27

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("phone", sa.String(20), nullable=False, unique=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("company_name", sa.String(255)),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role", sa.Enum("shipper", "owner", "driver", "admin", name="userrole"), nullable=False),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("is_verified", sa.Boolean, default=False),
        sa.Column("national_id", sa.String(50)),
        sa.Column("profile_photo_url", sa.String(500)),
        sa.Column("rating", sa.Float),
        sa.Column("total_trips", sa.Integer, default=0),
        sa.Column("cancellation_count", sa.Integer, default=0),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "trucks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("registration_number", sa.String(20), nullable=False, unique=True),
        sa.Column("truck_type", sa.Enum("flatbed", "dry_van", "reefer", "tanker", "lowbed", "tipper", name="trucktype"), nullable=False),
        sa.Column("capacity_tonnes", sa.Float, nullable=False),
        sa.Column("make", sa.String(100)),
        sa.Column("model", sa.String(100)),
        sa.Column("year", sa.Integer),
        sa.Column("gps_tracker_id", sa.String(100)),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("current_latitude", sa.Float),
        sa.Column("current_longitude", sa.Float),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "drivers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("licence_number", sa.String(50), nullable=False),
        sa.Column("licence_class", sa.String(10)),
        sa.Column("licence_expiry", sa.String(20)),
        sa.Column("licence_photo_url", sa.String(500)),
        sa.Column("verification_status", sa.Enum("pending", "approved", "rejected", name="verificationstatus"), default="pending"),
        sa.Column("current_truck_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("trucks.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "loads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("shipper_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("pickup_location", sa.String(255), nullable=False),
        sa.Column("pickup_latitude", sa.Float, nullable=False),
        sa.Column("pickup_longitude", sa.Float, nullable=False),
        sa.Column("dropoff_location", sa.String(255), nullable=False),
        sa.Column("dropoff_latitude", sa.Float, nullable=False),
        sa.Column("dropoff_longitude", sa.Float, nullable=False),
        sa.Column("corridor", sa.String(100)),
        sa.Column("cargo_type", sa.Enum("general", "refrigerated", "hazardous", "livestock", "construction", "agricultural", "electronics", name="cargotype"), nullable=False),
        sa.Column("weight_tonnes", sa.Float, nullable=False),
        sa.Column("volume_cbm", sa.Float),
        sa.Column("cargo_description", sa.Text),
        sa.Column("cargo_value_kes", sa.Float),
        sa.Column("required_truck_type", sa.String(50)),
        sa.Column("price_kes", sa.Numeric(12, 2), nullable=False),
        sa.Column("booking_mode", sa.Enum("fixed", "auction", name="bookingmode"), default="fixed"),
        sa.Column("min_bid_floor_kes", sa.Numeric(12, 2)),
        sa.Column("status", sa.Enum("available", "bidding", "booked", "en_route_pickup", "loaded", "in_transit", "delivered", "cancelled", name="loadstatus"), default="available"),
        sa.Column("pickup_deadline", sa.String(50)),
        sa.Column("special_instructions", sa.Text),
        sa.Column("requires_insurance", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_loads_status", "loads", ["status"])
    op.create_index("ix_loads_corridor", "loads", ["corridor"])

    op.create_table(
        "bids",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("load_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("loads.id"), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("truck_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("trucks.id"), nullable=False),
        sa.Column("amount_kes", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.Enum("pending", "accepted", "rejected", "withdrawn", name="bidstatus"), default="pending"),
        sa.Column("message", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "shipments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("load_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("loads.id"), nullable=False, unique=True),
        sa.Column("truck_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("trucks.id"), nullable=False),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.Enum("available", "bidding", "booked", "en_route_pickup", "loaded", "in_transit", "delivered", "cancelled", name="loadstatus"), default="booked"),
        sa.Column("escrow_locked", sa.Boolean, default=False),
        sa.Column("escrow_released", sa.Boolean, default=False),
        sa.Column("pickup_photo_urls", sa.String(2000)),
        sa.Column("delivery_photo_urls", sa.String(2000)),
        sa.Column("current_latitude", sa.Float),
        sa.Column("current_longitude", sa.Float),
        sa.Column("eta", sa.DateTime(timezone=True)),
        sa.Column("delivered_at", sa.DateTime(timezone=True)),
        sa.Column("dispute_open", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "consignment_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("shipment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shipments.id"), nullable=False, unique=True),
        sa.Column("reference_number", sa.String(50), nullable=False, unique=True),
        sa.Column("cargo_details", sa.Text, nullable=False),
        sa.Column("s3_url", sa.String(500)),
        sa.Column("shipper_accepted", sa.Boolean, default=False),
        sa.Column("owner_accepted", sa.Boolean, default=False),
        sa.Column("driver_accepted", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "return_windows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("truck_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("trucks.id"), nullable=False),
        sa.Column("origin_location", sa.String(255), nullable=False),
        sa.Column("origin_latitude", sa.Float, nullable=False),
        sa.Column("origin_longitude", sa.Float, nullable=False),
        sa.Column("destination_location", sa.String(255), nullable=False),
        sa.Column("destination_latitude", sa.Float, nullable=False),
        sa.Column("destination_longitude", sa.Float, nullable=False),
        sa.Column("available_from", sa.String(50), nullable=False),
        sa.Column("available_until", sa.String(50)),
        sa.Column("capacity_tonnes", sa.Float, nullable=False),
        sa.Column("notes", sa.Text),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "wallets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("balance_kes", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("escrow_kes", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="KES"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("wallet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("wallets.id"), nullable=False),
        sa.Column("shipment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shipments.id")),
        sa.Column("transaction_type", sa.Enum("escrow_hold", "escrow_release", "escrow_refund", "payout", "top_up", "platform_fee", "dispute_hold", name="transactiontype"), nullable=False),
        sa.Column("amount_kes", sa.Numeric(14, 2), nullable=False),
        sa.Column("status", sa.Enum("pending", "completed", "failed", "reversed", name="transactionstatus"), default="pending"),
        sa.Column("reference", sa.String(100), unique=True),
        sa.Column("description", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_transactions_wallet_id", "transactions", ["wallet_id"])

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("notification_type", sa.Enum(
            "bid_received", "bid_accepted", "bid_rejected", "shipment_booked",
            "driver_en_route", "cargo_loaded", "in_transit", "delivered",
            "payment_released", "dispute_opened", "dispute_resolved",
            "consignment_signed", "system", name="notificationtype"
        ), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("is_read", sa.Boolean, default=False),
        sa.Column("reference_id", postgresql.UUID(as_uuid=True)),
        sa.Column("reference_type", sa.String(50)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_table("transactions")
    op.drop_table("wallets")
    op.drop_table("return_windows")
    op.drop_table("consignment_notes")
    op.drop_table("shipments")
    op.drop_table("bids")
    op.drop_table("loads")
    op.drop_table("drivers")
    op.drop_table("trucks")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS notificationtype")
    op.execute("DROP TYPE IF EXISTS transactionstatus")
    op.execute("DROP TYPE IF EXISTS transactiontype")
    op.execute("DROP TYPE IF EXISTS loadstatus")
    op.execute("DROP TYPE IF EXISTS bookingmode")
    op.execute("DROP TYPE IF EXISTS cargotype")
    op.execute("DROP TYPE IF EXISTS bidstatus")
    op.execute("DROP TYPE IF EXISTS verificationstatus")
    op.execute("DROP TYPE IF EXISTS trucktype")
    op.execute("DROP TYPE IF EXISTS userrole")
