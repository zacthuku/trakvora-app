"""IoT infrastructure: tracker_devices, tracker_alerts, inspection task_type

Revision ID: 0013
Revises: 0012
Create Date: 2026-05-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use sa.String for enum columns — avoids native-type double-create issues in Alembic.
    # SQLAlchemy model-level Enum handles validation at the app layer.

    # ── tracker_devices ───────────────────────────────────────────────────────
    op.create_table(
        "tracker_devices",
        sa.Column("id",                  postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("serial_number",       sa.String(100),  nullable=False, unique=True),
        sa.Column("imei",                sa.String(20),   nullable=True,  unique=True),
        sa.Column("firmware_version",    sa.String(50),   nullable=True),
        sa.Column("status",              sa.String(30),   nullable=False, server_default="warehouse"),
        sa.Column("truck_id",            postgresql.UUID(as_uuid=True), sa.ForeignKey("trucks.id"),  nullable=True),
        sa.Column("installed_by",        postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"),   nullable=True),
        sa.Column("installed_at",        sa.DateTime(timezone=True), nullable=True),
        sa.Column("signal_strength",     sa.Integer,  nullable=True),
        sa.Column("battery_level",       sa.Float,    nullable=True),
        sa.Column("last_heartbeat_at",   sa.DateTime(timezone=True), nullable=True),
        sa.Column("tamper_flag",         sa.Boolean,  nullable=False, server_default="false"),
        sa.Column("tamper_reason",       sa.String(300), nullable=True),
        sa.Column("provisioning_secret", sa.String(128), nullable=True),
        sa.Column("provisioned_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at",          sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at",          sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_tracker_devices_serial",   "tracker_devices", ["serial_number"])
    op.create_index("ix_tracker_devices_truck_id", "tracker_devices", ["truck_id"])

    # ── tracker_alerts ────────────────────────────────────────────────────────
    op.create_table(
        "tracker_alerts",
        sa.Column("id",                postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tracker_device_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tracker_devices.id"), nullable=True),
        sa.Column("truck_id",          postgresql.UUID(as_uuid=True), sa.ForeignKey("trucks.id"),           nullable=True),
        sa.Column("alert_type",        sa.String(30), nullable=False),
        sa.Column("severity",          sa.String(20), nullable=False, server_default="medium"),
        sa.Column("message",           sa.Text,       nullable=False),
        sa.Column("resolved_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by",       postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at",        sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at",        sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_tracker_alerts_device",   "tracker_alerts", ["tracker_device_id"])
    op.create_index("ix_tracker_alerts_truck",    "tracker_alerts", ["truck_id"])

    # ── task_type on inspection_tasks ─────────────────────────────────────────
    op.add_column(
        "inspection_tasks",
        sa.Column("task_type", sa.String(30), nullable=True, server_default="inspection"),
    )


def downgrade() -> None:
    op.drop_column("inspection_tasks", "task_type")
    op.execute("DROP TYPE IF EXISTS tasktype")

    op.drop_index("ix_tracker_alerts_truck",  table_name="tracker_alerts")
    op.drop_index("ix_tracker_alerts_device", table_name="tracker_alerts")
    op.drop_table("tracker_alerts")

    op.drop_index("ix_tracker_devices_truck_id", table_name="tracker_devices")
    op.drop_index("ix_tracker_devices_serial",   table_name="tracker_devices")
    op.drop_table("tracker_devices")

    op.execute("DROP TYPE IF EXISTS alertseverity")
    op.execute("DROP TYPE IF EXISTS alerttype")
    op.execute("DROP TYPE IF EXISTS deviceinventorystatus")
