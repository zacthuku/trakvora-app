"""Add multi-modal vehicle service types and extend TruckType enum

Revision ID: 0015
Revises: 60e9ec068878
Create Date: 2026-05-12
"""
from alembic import op
import sqlalchemy as sa

revision = "0015"
down_revision = "60e9ec068878"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extend the existing trucktype PostgreSQL enum (ADD VALUE is non-transactional in PG)
    op.execute("ALTER TYPE trucktype ADD VALUE IF NOT EXISTS 'van'")
    op.execute("ALTER TYPE trucktype ADD VALUE IF NOT EXISTS 'pickup'")
    op.execute("ALTER TYPE trucktype ADD VALUE IF NOT EXISTS 'motorcycle_courier'")
    op.execute("ALTER TYPE trucktype ADD VALUE IF NOT EXISTS 'cargo_bike'")

    # New vehicleservicetype enum
    vehicleservicetype = sa.Enum(
        "truck", "van", "pickup", "parcel", "movers", "airfreight",
        name="vehicleservicetype",
    )
    vehicleservicetype.create(op.get_bind())

    # Add service_type to loads so each load knows which modal it belongs to
    op.add_column(
        "loads",
        sa.Column(
            "service_type",
            sa.Enum("truck", "van", "pickup", "parcel", "movers", "airfreight", name="vehicleservicetype"),
            nullable=True,
            server_default="truck",
        ),
    )

    # Add service_type to trucks (a truck can be re-typed as a van/pickup)
    op.add_column(
        "trucks",
        sa.Column(
            "service_type",
            sa.Enum("truck", "van", "pickup", "parcel", "movers", "airfreight", name="vehicleservicetype"),
            nullable=True,
            server_default="truck",
        ),
    )


def downgrade() -> None:
    op.drop_column("trucks", "service_type")
    op.drop_column("loads", "service_type")
    op.execute("DROP TYPE IF EXISTS vehicleservicetype")
    # Note: PostgreSQL does not support removing values from an enum;
    # the added TruckType values (van, pickup, etc.) remain in the DB type after downgrade.
