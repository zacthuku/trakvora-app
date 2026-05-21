"""Add shipper_rating and carrier_rating to shipments

Revision ID: 0025
Revises: 0024
Create Date: 2026-05-18
"""

from alembic import op
import sqlalchemy as sa


revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("shipments", sa.Column("shipper_rating", sa.Integer(), nullable=True))
    op.add_column("shipments", sa.Column("carrier_rating", sa.Integer(), nullable=True))
    op.add_column("shipments", sa.Column("shipper_rating_comment", sa.Text(), nullable=True))
    op.add_column("shipments", sa.Column("carrier_rating_comment", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("shipments", "carrier_rating_comment")
    op.drop_column("shipments", "shipper_rating_comment")
    op.drop_column("shipments", "carrier_rating")
    op.drop_column("shipments", "shipper_rating")
