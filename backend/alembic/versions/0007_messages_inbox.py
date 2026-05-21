"""add messages inbox table

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE messagetype AS ENUM ('invite_accepted', 'general')")
    op.execute("""
        CREATE TABLE messages (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sender_id   UUID NOT NULL REFERENCES users(id),
            recipient_id UUID NOT NULL REFERENCES users(id),
            subject     VARCHAR(255) NOT NULL,
            body        TEXT NOT NULL,
            is_read     BOOLEAN NOT NULL DEFAULT false,
            message_type messagetype NOT NULL DEFAULT 'general',
            created_at  TIMESTAMPTZ DEFAULT now(),
            updated_at  TIMESTAMPTZ DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_messages_recipient_id ON messages (recipient_id)")
    op.execute("CREATE INDEX ix_messages_sender_id ON messages (sender_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS messages")
    op.execute("DROP TYPE IF EXISTS messagetype")
