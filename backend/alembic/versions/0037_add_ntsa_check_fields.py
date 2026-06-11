"""Add NTSA automated check fields to drivers and trucks

Revision ID: 0037
Revises: 0036
Create Date: 2026-05-26

Adds:
  drivers.licence_check_status  – result of Smile Identity driving licence check
  drivers.licence_check_at      – when the check ran
  drivers.licence_check_detail  – human-readable detail / error message

  trucks.reg_check_status       – result of YourVerify plate check
  trucks.reg_check_at           – when the check ran
  trucks.reg_check_detail       – human-readable detail / error message
  trucks.reg_check_owner        – registered owner name returned by YourVerify
"""

from alembic import op
import sqlalchemy as sa

revision = "0037"
down_revision = "0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Drivers: licence check fields ─────────────────────────────────────────
    op.add_column(
        "drivers",
        sa.Column(
            "licence_check_status",
            sa.String(20),
            nullable=False,
            server_default="unverified",
        ),
    )
    op.add_column(
        "drivers",
        sa.Column("licence_check_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "drivers",
        sa.Column("licence_check_detail", sa.Text, nullable=True),
    )

    # ── Trucks: plate check fields ─────────────────────────────────────────────
    op.add_column(
        "trucks",
        sa.Column(
            "reg_check_status",
            sa.String(20),
            nullable=False,
            server_default="unverified",
        ),
    )
    op.add_column(
        "trucks",
        sa.Column("reg_check_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "trucks",
        sa.Column("reg_check_detail", sa.Text, nullable=True),
    )
    op.add_column(
        "trucks",
        sa.Column("reg_check_owner", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("trucks", "reg_check_owner")
    op.drop_column("trucks", "reg_check_detail")
    op.drop_column("trucks", "reg_check_at")
    op.drop_column("trucks", "reg_check_status")
    op.drop_column("drivers", "licence_check_detail")
    op.drop_column("drivers", "licence_check_at")
    op.drop_column("drivers", "licence_check_status")
