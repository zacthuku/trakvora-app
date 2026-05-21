"""activity_logs

Revision ID: 0030
Revises: 0029
Create Date: 2026-05-20

"""
from alembic import op
import sqlalchemy as sa

revision = "0030"
down_revision = "0029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "activity_logs",
        sa.Column("id",            sa.UUID(),          primary_key=True),
        sa.Column("actor_id",      sa.UUID(),          nullable=True),
        sa.Column("actor_name",    sa.String(200),     nullable=True),
        sa.Column("actor_role",    sa.String(50),      nullable=True),
        sa.Column("action",        sa.String(60),      nullable=False),
        sa.Column("resource_type", sa.String(50),      nullable=True),
        sa.Column("resource_id",   sa.String(36),      nullable=True),
        sa.Column("summary",       sa.String(500),     nullable=False),
        sa.Column("meta",          sa.JSON(),          nullable=True),
        sa.Column("created_at",    sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",    sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_activity_logs_actor_id",   "activity_logs", ["actor_id"])
    op.create_index("ix_activity_logs_action",     "activity_logs", ["action"])
    op.create_index("ix_activity_logs_created_at", "activity_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_activity_logs_created_at", table_name="activity_logs")
    op.drop_index("ix_activity_logs_action",     table_name="activity_logs")
    op.drop_index("ix_activity_logs_actor_id",   table_name="activity_logs")
    op.drop_table("activity_logs")
