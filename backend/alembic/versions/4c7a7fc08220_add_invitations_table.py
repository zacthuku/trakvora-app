"""add_invitations_table

Revision ID: 4c7a7fc08220
Revises: 0035
Create Date: 2026-05-26 09:30:08.460329

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '4c7a7fc08220'
down_revision: Union[str, None] = '0035'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Reuse the enum type if it already exists in the DB
invitation_status_enum = sa.Enum(
    'pending', 'accepted', 'expired', 'cancelled',
    name='invitationstatus',
    create_type=True,
)


def upgrade() -> None:
    op.create_table(
        'invitations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('inviter_id', sa.UUID(), nullable=False),
        sa.Column('invitee_email', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=30), nullable=False),
        sa.Column('company_id', sa.UUID(), nullable=True),
        sa.Column('employer_user_id', sa.UUID(), nullable=True),
        sa.Column('admin_role', sa.String(length=30), nullable=True),
        sa.Column('company_member_role', sa.String(length=20), nullable=True,
                  server_default='viewer'),
        sa.Column('status', invitation_status_enum, nullable=False, server_default='pending'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['employer_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['inviter_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token'),
    )
    op.create_index('ix_invitations_invitee_email', 'invitations', ['invitee_email'],
                    unique=False)


def downgrade() -> None:
    op.drop_index('ix_invitations_invitee_email', table_name='invitations')
    op.drop_table('invitations')
    invitation_status_enum.drop(op.get_bind(), checkfirst=True)
