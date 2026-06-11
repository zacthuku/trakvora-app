"""pricing_and_hero

Revision ID: 0053
Revises: 0052
Create Date: 2026-06-03

Creates: corridor_rates, fuel_index, price_intelligence, hero_slides
Seed data: corridor rates for KE/UG/TZ, fuel baselines, default hero slides.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0053"
down_revision: Union[str, None] = "0052"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── corridor_rates ────────────────────────────────────────────────────────
    op.create_table(
        "corridor_rates",
        sa.Column("id",            sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("country_code",  sa.String(2),   nullable=False),
        sa.Column("corridor_key",  sa.String(20),  nullable=False),
        sa.Column("corridor_name", sa.String(100), nullable=False),
        sa.Column("base_rate",     sa.Float(),     nullable=False),
        sa.Column("is_active",     sa.Boolean(),   nullable=False, server_default="true"),
        sa.Column("notes",         sa.Text(),      nullable=True),
        sa.Column("created_at",    sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",    sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_corridor_rate_country_corridor", "corridor_rates", ["country_code", "corridor_key"])
    op.create_index("ix_corridor_rates_country_code", "corridor_rates", ["country_code"])

    # ── fuel_index ────────────────────────────────────────────────────────────
    op.create_table(
        "fuel_index",
        sa.Column("id",                      sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("country_code",            sa.String(2), nullable=False),
        sa.Column("baseline_price",          sa.Float(),   nullable=False),
        sa.Column("current_price",           sa.Float(),   nullable=False),
        sa.Column("currency_code",           sa.String(3), nullable=False),
        sa.Column("fuel_adjustment_factor",  sa.Float(),   nullable=False, server_default="1.0"),
        sa.Column("last_fetched_at",         sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_url",              sa.Text(),    nullable=True),
        sa.Column("fetch_notes",             sa.Text(),    nullable=True),
        sa.Column("created_at",              sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",              sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_fuel_index_country", "fuel_index", ["country_code"])
    op.create_index("ix_fuel_index_country_code", "fuel_index", ["country_code"])

    # ── price_intelligence ────────────────────────────────────────────────────
    op.create_table(
        "price_intelligence",
        sa.Column("id",             sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("corridor_key",   sa.String(20), nullable=False),
        sa.Column("cargo_type",     sa.String(20), nullable=False),
        sa.Column("distance_band",  sa.String(10), nullable=False),
        sa.Column("weight_band",    sa.String(10), nullable=False),
        sa.Column("sample_count",   sa.Integer(),  nullable=False),
        sa.Column("p25_per_km",     sa.Float(),    nullable=False),
        sa.Column("p50_per_km",     sa.Float(),    nullable=False),
        sa.Column("p75_per_km",     sa.Float(),    nullable=False),
        sa.Column("avg_per_km",     sa.Float(),    nullable=False),
        sa.Column("last_updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at",     sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",     sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_price_intelligence_bucket", "price_intelligence",
        ["corridor_key", "cargo_type", "distance_band", "weight_band"],
    )
    op.create_index("ix_price_intelligence_corridor_key", "price_intelligence", ["corridor_key"])

    # ── hero_slides ───────────────────────────────────────────────────────────
    op.create_table(
        "hero_slides",
        sa.Column("id",                 sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("headline",           sa.Text(),      nullable=False),
        sa.Column("highlight_word",     sa.String(100), nullable=False),
        sa.Column("description",        sa.Text(),      nullable=False),
        sa.Column("image_type",         sa.String(30),  nullable=False, server_default="dispatch_os"),
        sa.Column("cta_primary_text",   sa.String(100), nullable=False, server_default="Get Started"),
        sa.Column("cta_primary_url",    sa.String(200), nullable=False, server_default="/register"),
        sa.Column("cta_secondary_text", sa.String(100), nullable=True),
        sa.Column("cta_secondary_url",  sa.String(200), nullable=True),
        sa.Column("sort_order",         sa.Integer(),   nullable=False, server_default="0"),
        sa.Column("is_active",          sa.Boolean(),   nullable=False, server_default="true"),
        sa.Column("country_code",       sa.String(2),   nullable=True),
        sa.Column("created_at",         sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",         sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_hero_slides_country_code", "hero_slides", ["country_code"])

    # ══════════════════════════════════════════════════════════════════════════
    # SEED DATA
    # ══════════════════════════════════════════════════════════════════════════
    conn = op.get_bind()

    # ── Corridor rates — Kenya (KES/km, KTA Apr 2026 + 14% increase applied) ─
    conn.execute(sa.text("""
        INSERT INTO corridor_rates (country_code, corridor_key, corridor_name, base_rate, notes) VALUES
        ('KE', 'NBI-MBA', 'Nairobi ↔ Mombasa',         155, 'KTA Apr 2026: KES 68,800–86,400/40ft container'),
        ('KE', 'NBI-KSM', 'Nairobi ↔ Kisumu',           145, 'KTA estimate ~60 KES/m³; highland terrain premium'),
        ('KE', 'NBI-ELD', 'Nairobi ↔ Eldoret',          140, 'KTA estimate ~60 KES/m³; moderate highland'),
        ('KE', 'NBI-NKR', 'Nairobi ↔ Nakuru',           130, 'KTA estimate ~70 KES/m³; short flat route'),
        ('KE', 'NBI-KLA', 'Nairobi ↔ Kampala (transit)',165, 'Cross-border surcharge: delays at border crossings'),
        ('KE', 'MBA-KSM', 'Mombasa ↔ Kisumu',           150, 'Port-to-Rift Valley; longer alternative route'),
        ('KE', 'default', 'General Kenya domestic',      125, 'Updated from 120 following KTA 14% increase Apr 2026')
        ON CONFLICT (country_code, corridor_key) DO NOTHING
    """))

    # ── Corridor rates — Uganda (UGX/km) ─────────────────────────────────────
    conn.execute(sa.text("""
        INSERT INTO corridor_rates (country_code, corridor_key, corridor_name, base_rate, notes) VALUES
        ('UG', 'KLA-MBA', 'Kampala ↔ Mombasa (transit)', 490, 'Transit via Kenya; ~1,000km; cross-border surcharge'),
        ('UG', 'KLA-JJA', 'Kampala ↔ Jinja',             420, 'Short urban route ~80km'),
        ('UG', 'KLA-GUL', 'Kampala ↔ Gulu',              380, 'Northern Uganda ~330km'),
        ('UG', 'KLA-MBR', 'Kampala ↔ Mbarara',           360, 'Western Uganda ~270km'),
        ('UG', 'default',  'General Uganda domestic',     370, 'General Uganda freight rate estimate 2025')
        ON CONFLICT (country_code, corridor_key) DO NOTHING
    """))

    # ── Corridor rates — Tanzania (TZS/km) ───────────────────────────────────
    conn.execute(sa.text("""
        INSERT INTO corridor_rates (country_code, corridor_key, corridor_name, base_rate, notes) VALUES
        ('TZ', 'DAR-NBI', 'Dar es Salaam ↔ Nairobi',   2800, 'Cross-border; TAZARA/road ~800km'),
        ('TZ', 'DAR-ARU', 'Dar es Salaam ↔ Arusha',    2400, 'Northern circuit ~630km'),
        ('TZ', 'DAR-DOD', 'Dar es Salaam ↔ Dodoma',    2200, 'Capital route ~450km'),
        ('TZ', 'DAR-MWZ', 'Dar es Salaam ↔ Mwanza',    2600, 'Lake Victoria route ~1,100km'),
        ('TZ', 'default',  'General Tanzania domestic', 2300, 'General Tanzania freight rate estimate 2025')
        ON CONFLICT (country_code, corridor_key) DO NOTHING
    """))

    # ── Inactive seed for future countries (Rwanda, Nigeria, Ethiopia) ────────
    conn.execute(sa.text("""
        INSERT INTO corridor_rates (country_code, corridor_key, corridor_name, base_rate, is_active, notes) VALUES
        ('RW', 'default', 'General Rwanda domestic', 700, false, 'Placeholder — activate when RW goes live'),
        ('ET', 'default', 'General Ethiopia domestic', 55, false, 'Placeholder ETB/km — activate when ET goes live'),
        ('NG', 'default', 'General Nigeria domestic', 250, false, 'Placeholder NGN/km — activate when NG goes live')
        ON CONFLICT (country_code, corridor_key) DO NOTHING
    """))

    # ── Fuel index baselines (diesel price at system launch — Jun 2026) ───────
    # Kenya: ~182 KES/L diesel (EPRA Jun 2026 estimate)
    # Uganda: ~5,200 UGX/L diesel
    # Tanzania: ~3,100 TZS/L diesel
    conn.execute(sa.text("""
        INSERT INTO fuel_index (country_code, baseline_price, current_price, currency_code, fuel_adjustment_factor, source_url, fetch_notes) VALUES
        ('KE', 182.0, 182.0, 'KES', 1.0, 'https://www.epra.go.ke/pump-prices', 'Baseline set at system launch Jun 2026'),
        ('UG', 5200.0, 5200.0, 'UGX', 1.0, 'https://www.ura.go.ug', 'Baseline set at system launch Jun 2026'),
        ('TZ', 3100.0, 3100.0, 'TZS', 1.0, 'https://www.ewura.go.tz', 'Baseline set at system launch Jun 2026')
        ON CONFLICT (country_code) DO NOTHING
    """))

    # ── Default hero slides (global, country_code=NULL) ───────────────────────
    conn.execute(sa.text("""
        INSERT INTO hero_slides (headline, highlight_word, description, image_type, cta_primary_text, cta_primary_url, cta_secondary_text, cta_secondary_url, sort_order, country_code) VALUES
        (
            'Africa''s Intelligent Logistics Operating System',
            'Operating',
            'Connect shippers, transporters, drivers, finance and compliance in one platform to move freight smarter, faster and more profitably.',
            'dispatch_os',
            'Get Started Free',
            '/register',
            'Watch Demo',
            '/demo',
            1,
            NULL
        ),
        (
            'Everything You Need, Right In Your Pocket',
            'Pocket',
            'Drivers accept jobs, upload PODs and track earnings. Owners monitor fleets. Shippers follow their freight — all from one app.',
            'mobile_app',
            'Download App',
            '/download',
            'Learn More',
            '/features',
            2,
            NULL
        ),
        (
            'Complete Fleet Visibility & Control',
            'Visibility',
            'Track every truck in real time. Manage maintenance schedules, driver assignments and performance metrics in one place.',
            'fleet_mgmt',
            'Manage Your Fleet',
            '/register?role=owner',
            NULL,
            NULL,
            3,
            NULL
        ),
        (
            'Payments, Invoicing & Working Capital',
            'Capital',
            'Smart billing with M-Pesa and bank integrations. Real-time revenue tracking and working capital advances for fleet owners.',
            'finance',
            'View Pricing',
            '/pricing',
            NULL,
            NULL,
            4,
            NULL
        )
    """))


def downgrade() -> None:
    op.drop_table("hero_slides")
    op.drop_table("price_intelligence")
    op.drop_table("fuel_index")
    op.drop_table("corridor_rates")
