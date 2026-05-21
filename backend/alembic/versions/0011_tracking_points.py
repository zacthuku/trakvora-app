"""tracking points table and tracker health fields

Revision ID: 0011
Revises: 0010
Create Date: 2026-05-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade():
    # ── New enum type ────────────────────────────────────────────────────────
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE trackingsource AS ENUM ('driver_phone','gps_tracker');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)

    # ── tracking_points ──────────────────────────────────────────────────────
    op.create_table(
        "tracking_points",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("truck_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("trucks.id"), nullable=False),
        sa.Column("shipment_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("shipments.id"), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("altitude", sa.Float(), nullable=True),
        sa.Column("source",
                  postgresql.ENUM(name="trackingsource", create_type=False),
                  nullable=False),
        sa.Column("accuracy", sa.Float(), nullable=True),
        sa.Column("speed_kmh", sa.Float(), nullable=True),
        sa.Column("heading", sa.Float(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_tracking_points_truck_time", "tracking_points",
                    ["truck_id", "recorded_at"])
    op.create_index("ix_tracking_points_shipment_time", "tracking_points",
                    ["shipment_id", "recorded_at"])

    # ── trucks: tracker auth + health columns ────────────────────────────────
    op.add_column("trucks", sa.Column("tracker_secret", sa.String(64), nullable=True))
    op.add_column("trucks", sa.Column("last_ping_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("trucks", sa.Column("last_ping_ip", sa.String(45), nullable=True))
    op.add_column("trucks", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("trucks", sa.Column("battery_level", sa.Float(), nullable=True))
    op.add_column("trucks", sa.Column("signal_strength", sa.Integer(), nullable=True))


def downgrade():
    op.drop_column("trucks", "signal_strength")
    op.drop_column("trucks", "battery_level")
    op.drop_column("trucks", "last_seen_at")
    op.drop_column("trucks", "last_ping_ip")
    op.drop_column("trucks", "last_ping_at")
    op.drop_column("trucks", "tracker_secret")
    op.drop_index("ix_tracking_points_shipment_time", table_name="tracking_points")
    op.drop_index("ix_tracking_points_truck_time", table_name="tracking_points")
    op.drop_table("tracking_points")
    op.execute("DROP TYPE IF EXISTS trackingsource")
