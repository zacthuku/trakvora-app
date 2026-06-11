"""platform_profile: company page content + user team fields

Revision ID: 0033
Revises: 0032
Create Date: 2026-05-25
"""

from alembic import op
import sqlalchemy as sa

revision = "0033"
down_revision = "0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Create platform_profiles table ──────────────────────────────────────
    op.create_table(
        "platform_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tagline",          sa.String(200), nullable=False),
        sa.Column("subtitle",         sa.Text(),      nullable=False),
        sa.Column("hq_city",          sa.String(100), nullable=False),
        sa.Column("founded_year",     sa.Integer(),   nullable=False),
        sa.Column("stat_carriers",    sa.String(20),  nullable=False),
        sa.Column("stat_countries",   sa.String(20),  nullable=False),
        sa.Column("stat_shipments",   sa.String(20),  nullable=False),
        sa.Column("mission_headline", sa.String(200), nullable=False),
        sa.Column("mission_body",     sa.Text(),      nullable=False),
    )

    # ── 2. Seed default row ─────────────────────────────────────────────────────
    op.execute(
        """
        INSERT INTO platform_profiles
            (id, tagline, subtitle, hq_city, founded_year,
             stat_carriers, stat_countries, stat_shipments,
             mission_headline, mission_body)
        VALUES
            (1,
             'Built to move Africa''s freight.',
             'Trakvora is the operating system for freight in East Africa — connecting shippers, fleet owners, and drivers on one transparent, end-to-end logistics platform.',
             'Nairobi, Kenya',
             2023,
             '3,000+', '4', '50,000+',
             'Digitise freight so every cargo move is fast, fair, and traceable.',
             'Africa moves billions of dollars of cargo each year, yet most of it is still coordinated by phone, spreadsheet, and handshake. Trakvora replaces that with a real-time platform that gives every player — shipper, fleet owner, and driver — the tools and visibility they deserve.\n\nWe believe that when logistics is transparent and efficient, the entire economy benefits. Better roads start with better data.'
            )
        """
    )

    # ── 3. Add team-page fields to users ───────────────────────────────────────
    op.add_column("users", sa.Column("job_title",         sa.String(120), nullable=True))
    op.add_column("users", sa.Column("show_on_team_page", sa.Boolean(),   nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("users", "show_on_team_page")
    op.drop_column("users", "job_title")
    op.drop_table("platform_profiles")
