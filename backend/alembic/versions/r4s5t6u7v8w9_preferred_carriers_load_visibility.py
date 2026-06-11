"""add preferred carriers and load visibility

Revision ID: r4s5t6u7v8w9
Revises: q3r4s5t6u7v8
Create Date: 2026-06-08
"""
from alembic import op
import sqlalchemy as sa


revision = 'r4s5t6u7v8w9'
down_revision = 'q3r4s5t6u7v8'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE TYPE loadvisibility AS ENUM ('public', 'preferred_only')")

    op.create_table(
        'company_preferred_carriers',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True),
        sa.Column('company_id', sa.UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('carrier_user_id', sa.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('added_by', sa.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('company_id', 'carrier_user_id', name='uq_company_carrier'),
    )

    op.add_column(
        'loads',
        sa.Column('visibility', sa.Enum('public', 'preferred_only', name='loadvisibility', create_type=False),
                  nullable=False, server_default='public'),
    )


def downgrade():
    op.drop_column('loads', 'visibility')
    op.drop_table('company_preferred_carriers')
    op.execute("DROP TYPE IF EXISTS loadvisibility")
