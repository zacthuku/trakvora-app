"""commission_system

Revision ID: 0052
Revises: 0051
Create Date: 2026-06-03

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0052"
down_revision: Union[str, None] = "0051"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── New enums (DO block for idempotency — PostgreSQL has no CREATE TYPE IF NOT EXISTS) ──
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE terraindifficulty AS ENUM ('standard', 'highland', 'rough', 'remote');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE loadpaymentmode AS ENUM ('direct', 'escrow');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE commissioninvoicestatus AS ENUM ('pending', 'paid', 'overdue', 'waived', 'extended');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)

    # ── loads: new columns ───────────────────────────────────────────────────
    op.add_column("loads", sa.Column(
        "terrain_difficulty",
        postgresql.ENUM("standard", "highland", "rough", "remote",
                        name="terraindifficulty", create_type=False),
        server_default="standard",
        nullable=False,
    ))
    op.add_column("loads", sa.Column(
        "payment_mode",
        postgresql.ENUM("direct", "escrow",
                        name="loadpaymentmode", create_type=False),
        server_default="direct",
        nullable=False,
    ))

    # ── shipments: new columns ───────────────────────────────────────────────
    op.add_column("shipments", sa.Column(
        "payment_mode",
        sa.String(10),
        server_default="direct",
        nullable=False,
    ))
    op.add_column("shipments", sa.Column(
        "direct_payment_confirmed_at",
        sa.DateTime(timezone=True),
        nullable=True,
    ))

    # ── users: escrow eligibility flag ───────────────────────────────────────
    op.add_column("users", sa.Column(
        "can_use_escrow",
        sa.Boolean(),
        server_default="false",
        nullable=False,
    ))

    # ── commission_invoices table ────────────────────────────────────────────
    op.create_table(
        "commission_invoices",
        sa.Column("id",             postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("shipment_id",    postgresql.UUID(as_uuid=True), sa.ForeignKey("shipments.id"), nullable=False),
        sa.Column("owner_id",       postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"),    nullable=False),
        sa.Column("amount_kes",     sa.Numeric(14, 2), nullable=False),
        sa.Column("rate_used",      sa.Float(), nullable=False),
        sa.Column("rate_breakdown", postgresql.JSONB(), nullable=False),
        sa.Column("status",
            postgresql.ENUM("pending", "paid", "overdue", "waived", "extended",
                            name="commissioninvoicestatus", create_type=False),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("due_at",         sa.DateTime(timezone=True), nullable=False),
        sa.Column("paid_at",        sa.DateTime(timezone=True), nullable=True),
        sa.Column("waived_by_id",   postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("extended_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("window_hours",   sa.Integer(), nullable=False, server_default="24"),
        sa.Column("auto_blocked",   sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at",     sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",     sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_unique_constraint("uq_commission_invoice_shipment", "commission_invoices", ["shipment_id"])
    op.create_index("ix_commission_invoices_owner_id",   "commission_invoices", ["owner_id"])
    op.create_index("ix_commission_invoices_shipment_id","commission_invoices", ["shipment_id"])
    op.create_index("ix_commission_invoices_status_due", "commission_invoices", ["status", "due_at"])


def downgrade() -> None:
    op.drop_table("commission_invoices")
    op.execute("DROP TYPE IF EXISTS commissioninvoicestatus")
    op.drop_column("users", "can_use_escrow")
    op.drop_column("shipments", "direct_payment_confirmed_at")
    op.drop_column("shipments", "payment_mode")
    op.drop_column("loads", "payment_mode")
    op.drop_column("loads", "terrain_difficulty")
    op.execute("DROP TYPE IF EXISTS loadpaymentmode")
    op.execute("DROP TYPE IF EXISTS terraindifficulty")
