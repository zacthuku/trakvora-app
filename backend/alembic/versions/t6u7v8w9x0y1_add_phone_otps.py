"""add phone_otps table

Revision ID: t6u7v8w9x0y1
Revises: s5t6u7v8w9x0
Create Date: 2026-06-09
"""
from alembic import op
import sqlalchemy as sa

revision = 't6u7v8w9x0y1'
down_revision = '99b7576120c3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'phone_otps',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True),
        sa.Column('phone', sa.String(length=25), nullable=False),
        sa.Column('code', sa.String(length=6), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_used', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_phone_otps_phone', 'phone_otps', ['phone'])


def downgrade() -> None:
    op.drop_index('ix_phone_otps_phone', table_name='phone_otps')
    op.drop_table('phone_otps')
