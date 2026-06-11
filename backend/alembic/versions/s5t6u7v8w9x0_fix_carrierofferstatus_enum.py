"""fix carrierofferstatus enum type for load_carrier_offers

Revision ID: s5t6u7v8w9x0
Revises: r4s5t6u7v8w9
Create Date: 2026-06-09
"""
from alembic import op
import sqlalchemy as sa

revision = 's5t6u7v8w9x0'
down_revision = 'r4s5t6u7v8w9'
branch_labels = None
depends_on = None

carrierofferstatus = sa.Enum(
    'pending', 'accepted', 'rejected', 'cancelled',
    name='carrierofferstatus'
)


def upgrade() -> None:
    carrierofferstatus.create(op.get_bind(), checkfirst=True)
    op.execute("ALTER TABLE load_carrier_offers ALTER COLUMN status DROP DEFAULT")
    op.execute(
        "ALTER TABLE load_carrier_offers "
        "ALTER COLUMN status TYPE carrierofferstatus "
        "USING status::carrierofferstatus"
    )
    op.execute("ALTER TABLE load_carrier_offers ALTER COLUMN status SET DEFAULT 'pending'::carrierofferstatus")


def downgrade() -> None:
    op.execute("ALTER TABLE load_carrier_offers ALTER COLUMN status DROP DEFAULT")
    op.execute(
        "ALTER TABLE load_carrier_offers "
        "ALTER COLUMN status TYPE VARCHAR(20) "
        "USING status::VARCHAR"
    )
    op.execute("ALTER TABLE load_carrier_offers ALTER COLUMN status SET DEFAULT 'pending'")
    carrierofferstatus.drop(op.get_bind(), checkfirst=True)
