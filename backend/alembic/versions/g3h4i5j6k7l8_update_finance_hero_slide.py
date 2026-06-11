"""update finance hero slide description and headline

Revision ID: g3h4i5j6k7l8
Revises: f2a3b4c5d6e7
Create Date: 2026-06-04 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'g3h4i5j6k7l8'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("""
        UPDATE hero_slides
        SET
            headline       = 'Commission & Billing, Automated',
            highlight_word = 'Automated',
            description    = 'Every completed job triggers an automatic commission invoice — VAT included. Full audit trails and optional managed payments, all handled without manual work.'
        WHERE image_type = 'finance'
          AND (country_code IS NULL OR country_code = '')
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("""
        UPDATE hero_slides
        SET
            headline       = 'Payments, Invoicing & Working Capital',
            highlight_word = 'Capital',
            description    = 'Smart billing with M-Pesa and bank integrations. Real-time revenue tracking and working capital advances for fleet owners.'
        WHERE image_type = 'finance'
          AND (country_code IS NULL OR country_code = '')
    """))
