"""driver profile expansion and truck driver assignment

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the enum type first
    op.execute("CREATE TYPE availabilitystatus AS ENUM ('available', 'on_job', 'offline')")

    # ── drivers table: new columns ──────────────────────────────────────────
    op.add_column("drivers", sa.Column("employer_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("drivers", sa.Column("ntsa_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("drivers", sa.Column("psv_badge_url", sa.String(500), nullable=True))
    op.add_column("drivers", sa.Column("police_clearance_url", sa.String(500), nullable=True))
    op.add_column("drivers", sa.Column("good_conduct_url", sa.String(500), nullable=True))
    op.add_column("drivers", sa.Column("medical_cert_url", sa.String(500), nullable=True))
    op.add_column("drivers", sa.Column("bio", sa.Text(), nullable=True))
    op.add_column("drivers", sa.Column("experience_years", sa.Integer(), nullable=True))
    op.add_column("drivers", sa.Column("preferred_routes", sa.String(500), nullable=True))
    op.add_column("drivers", sa.Column("preferred_truck_types", sa.String(200), nullable=True))
    op.add_column("drivers", sa.Column(
        "availability_status",
        sa.Enum("available", "on_job", "offline", name="availabilitystatus", create_type=False),
        nullable=False,
        server_default="offline",
    ))
    op.add_column("drivers", sa.Column("availability_location", sa.String(255), nullable=True))
    op.add_column("drivers", sa.Column("available_from", sa.String(20), nullable=True))
    op.add_column("drivers", sa.Column("seeking_employment", sa.Boolean(), nullable=False, server_default=sa.false()))

    op.create_foreign_key("fk_drivers_employer_id", "drivers", "users", ["employer_id"], ["id"])

    # ── trucks table: driver assignment ─────────────────────────────────────
    op.add_column("trucks", sa.Column("is_driver_owned", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("trucks", sa.Column("assigned_driver_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_trucks_assigned_driver_id", "trucks", "drivers", ["assigned_driver_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_trucks_assigned_driver_id", "trucks", type_="foreignkey")
    op.drop_column("trucks", "assigned_driver_id")
    op.drop_column("trucks", "is_driver_owned")

    op.drop_constraint("fk_drivers_employer_id", "drivers", type_="foreignkey")
    op.drop_column("drivers", "seeking_employment")
    op.drop_column("drivers", "available_from")
    op.drop_column("drivers", "availability_location")
    op.drop_column("drivers", "availability_status")
    op.drop_column("drivers", "preferred_truck_types")
    op.drop_column("drivers", "preferred_routes")
    op.drop_column("drivers", "experience_years")
    op.drop_column("drivers", "bio")
    op.drop_column("drivers", "medical_cert_url")
    op.drop_column("drivers", "good_conduct_url")
    op.drop_column("drivers", "police_clearance_url")
    op.drop_column("drivers", "psv_badge_url")
    op.drop_column("drivers", "ntsa_verified")
    op.drop_column("drivers", "employer_id")
    op.execute("DROP TYPE IF EXISTS availabilitystatus")
