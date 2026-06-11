"""Phase 3 — IoT alert types + POD signature fields on shipments.

Revision ID: 0039
Revises: 0038_add_owner_user_and_finance_admin_roles
Create Date: 2026-05-27
"""
from alembic import op
import sqlalchemy as sa

revision = "0039"
down_revision = "0038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── AlertType enum extensions ─────────────────────────────────────────────
    # native_enum=False means the column stores VARCHAR — no ALTER TYPE needed
    # The Enum values are enforced by SQLAlchemy at the ORM layer.
    # We only need to ensure the AlertType enum in the model includes the new values.
    # (No DDL required for non-native enums.)

    # ── Shipment POD / delivery geo fields ───────────────────────────────────
    op.add_column("shipments", sa.Column("pod_signature_url", sa.String(500), nullable=True))
    op.add_column("shipments", sa.Column("delivery_latitude",  sa.Float(), nullable=True))
    op.add_column("shipments", sa.Column("delivery_longitude", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("shipments", "delivery_longitude")
    op.drop_column("shipments", "delivery_latitude")
    op.drop_column("shipments", "pod_signature_url")
