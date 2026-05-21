"""kyc_status

Revision ID: 0027
Revises: 0026
Create Date: 2026-05-18

"""
from alembic import op
import sqlalchemy as sa

revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE kycstatus AS ENUM ('unverified', 'pending', 'approved', 'rejected')")
    op.add_column(
        "users",
        sa.Column(
            "kyc_status",
            sa.Enum("unverified", "pending", "approved", "rejected", name="kycstatus"),
            server_default="unverified",
            nullable=False,
        ),
    )
    op.add_column("users", sa.Column("kyc_rejection_reason", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "kyc_rejection_reason")
    op.drop_column("users", "kyc_status")
    op.execute("DROP TYPE kycstatus")
