"""add control_tower hero slide

Revision ID: h4i5j6k7l8m9
Revises: g3h4i5j6k7l8
Create Date: 2026-06-04 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'h4i5j6k7l8m9'
down_revision: Union[str, None] = 'g3h4i5j6k7l8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    # Shift existing slides at position 2+ to make room
    conn.execute(sa.text("""
        UPDATE hero_slides
        SET sort_order = sort_order + 1
        WHERE sort_order >= 2
          AND (country_code IS NULL OR country_code = '')
    """))
    # Insert the new Control Tower slide at position 2
    conn.execute(sa.text("""
        INSERT INTO hero_slides
            (headline, highlight_word, description, image_type,
             cta_primary_text, cta_primary_url,
             cta_secondary_text, cta_secondary_url,
             sort_order, country_code)
        VALUES (
            'Live Operations Control Tower',
            'Operations',
            'Track every active shipment in real time. Geofence alerts, digital proof of delivery, and instant exception notifications — full visibility from pickup to delivery.',
            'control_tower',
            'See It Live',
            '/register',
            NULL,
            NULL,
            2,
            NULL
        )
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("""
        DELETE FROM hero_slides
        WHERE image_type = 'control_tower'
          AND (country_code IS NULL OR country_code = '')
    """))
    conn.execute(sa.text("""
        UPDATE hero_slides
        SET sort_order = sort_order - 1
        WHERE sort_order > 2
          AND (country_code IS NULL OR country_code = '')
    """))
