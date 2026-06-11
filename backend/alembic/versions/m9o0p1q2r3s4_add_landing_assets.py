"""add landing_assets table for locally-stored how-it-works images

Revision ID: m9o0p1q2r3s4
Revises: l8m9o0p1q2r3
Create Date: 2026-06-08 14:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "m9o0p1q2r3s4"
down_revision: Union[str, None] = "l8m9o0p1q2r3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "landing_assets",
        sa.Column("id",         postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("key",        sa.String(100),  nullable=False),
        sa.Column("file_url",   sa.Text(),        nullable=False),
        sa.Column("alt_text",   sa.String(200),  nullable=False, server_default=""),
        sa.Column("is_active",  sa.Boolean(),     nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )
    op.create_index("ix_landing_assets_key", "landing_assets", ["key"])

    op.execute("""
        INSERT INTO landing_assets (key, file_url, alt_text, is_active) VALUES
        ('how-it-works-step1', '/static/uploads/landing/cargo.jpg',        'Cargo loading at warehouse', true),
        ('how-it-works-step2', '/static/uploads/landing/truck-highway.jpg', 'Truck on highway',           true)
    """)


def downgrade() -> None:
    op.drop_index("ix_landing_assets_key", table_name="landing_assets")
    op.drop_table("landing_assets")
