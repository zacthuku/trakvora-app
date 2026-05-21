"""admin roles and field operations system

Revision ID: 0010
Revises: 0009
Create Date: 2026-05-06
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade():
    # ── New enum types (idempotent DO blocks) ───────────────────────────────
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE adminrole AS ENUM ('super_admin','operations_admin','field_inspector','iot_technician','compliance_officer','support_agent');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE inspectionstatus AS ENUM ('not_requested','pending','in_progress','submitted','approved','rejected','re_inspection');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE taskstatus AS ENUM ('pending','in_progress','submitted','completed','cancelled');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE vehiclecondition AS ENUM ('clean','good','fair','poor');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE trackerstatus AS ENUM ('not_installed','installed','verified');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE reviewdecision AS ENUM ('approved','rejected','re_inspection');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)

    # ── users: add admin_role ───────────────────────────────────────────────
    op.add_column("users",
        sa.Column("admin_role",
            postgresql.ENUM(name="adminrole", create_type=False),
            nullable=True))

    # ── trucks: add verification fields ────────────────────────────────────
    op.add_column("trucks", sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("trucks", sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("trucks", sa.Column("verification_score", sa.Float(), nullable=True))
    op.add_column("trucks", sa.Column("inspection_status",
        postgresql.ENUM(name="inspectionstatus", create_type=False),
        nullable=False, server_default="not_requested"))

    # ── inspection_tasks ────────────────────────────────────────────────────
    op.create_table("inspection_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("truck_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("trucks.id"), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assigned_to", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("status",
            postgresql.ENUM(name="taskstatus", create_type=False),
            nullable=False, server_default="pending"),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("location_lat", sa.Float(), nullable=True),
        sa.Column("location_lon", sa.Float(), nullable=True),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_inspection_tasks_assigned_to", "inspection_tasks", ["assigned_to"])
    op.create_index("ix_inspection_tasks_status", "inspection_tasks", ["status"])

    # ── vehicle_inspections ─────────────────────────────────────────────────
    op.create_table("vehicle_inspections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("inspection_tasks.id"), nullable=False),
        sa.Column("inspector_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("truck_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("trucks.id"), nullable=False),
        sa.Column("photo_urls", postgresql.JSONB(), nullable=True),
        sa.Column("driver_photo_url", sa.String(500), nullable=True),
        sa.Column("condition",
            postgresql.ENUM(name="vehiclecondition", create_type=False),
            nullable=True),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("damages", sa.Text(), nullable=True),
        sa.Column("roadworthy", sa.Boolean(), nullable=True),
        sa.Column("tracker_status",
            postgresql.ENUM(name="trackerstatus", create_type=False),
            nullable=False, server_default="not_installed"),
        sa.Column("tracker_id", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("inspection_lat", sa.Float(), nullable=True),
        sa.Column("inspection_lon", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_vehicle_inspections_task_id", "vehicle_inspections", ["task_id"])

    # ── compliance_reviews ──────────────────────────────────────────────────
    op.create_table("compliance_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("inspection_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vehicle_inspections.id"), nullable=False),
        sa.Column("reviewer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("decision",
            postgresql.ENUM(name="reviewdecision", create_type=False),
            nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_compliance_reviews_inspection_id", "compliance_reviews", ["inspection_id"])


def downgrade():
    op.drop_index("ix_compliance_reviews_inspection_id", table_name="compliance_reviews")
    op.drop_table("compliance_reviews")
    op.drop_index("ix_vehicle_inspections_task_id", table_name="vehicle_inspections")
    op.drop_table("vehicle_inspections")
    op.drop_index("ix_inspection_tasks_status", table_name="inspection_tasks")
    op.drop_index("ix_inspection_tasks_assigned_to", table_name="inspection_tasks")
    op.drop_table("inspection_tasks")
    op.drop_column("trucks", "inspection_status")
    op.drop_column("trucks", "verification_score")
    op.drop_column("trucks", "verified_at")
    op.drop_column("trucks", "is_verified")
    op.drop_column("users", "admin_role")
    op.execute("DROP TYPE IF EXISTS reviewdecision")
    op.execute("DROP TYPE IF EXISTS trackerstatus")
    op.execute("DROP TYPE IF EXISTS vehiclecondition")
    op.execute("DROP TYPE IF EXISTS taskstatus")
    op.execute("DROP TYPE IF EXISTS inspectionstatus")
    op.execute("DROP TYPE IF EXISTS adminrole")
