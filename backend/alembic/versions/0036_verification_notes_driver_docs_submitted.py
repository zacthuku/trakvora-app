"""Add verification_notes to trucks, documents_submitted + verification_notes to drivers

Revision ID: 0036
Revises: 0035
Create Date: 2026-05-26
"""
from alembic import op
import sqlalchemy as sa

revision = "0036"
down_revision = "4c7a7fc08220"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Trucks: admin rejection/approval notes
    op.add_column("trucks", sa.Column("verification_notes", sa.Text, nullable=True))

    # Drivers: track whether the driver has explicitly submitted docs for review
    op.add_column(
        "drivers",
        sa.Column(
            "documents_submitted",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    # Drivers: admin rejection notes
    op.add_column("drivers", sa.Column("verification_notes", sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column("drivers", "verification_notes")
    op.drop_column("drivers", "documents_submitted")
    op.drop_column("trucks", "verification_notes")
