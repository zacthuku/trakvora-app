"""add payment_methods table

Revision ID: e1f2a3b4c5d6
Revises: d75947c72285
Create Date: 2026-06-04 10:00:00.000000

"""
from typing import Sequence, Union
import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa

revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, None] = "d75947c72285"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    payment_methods = op.create_table(
        "payment_methods",
        sa.Column("id",           sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("country_code", sa.String(2),   nullable=False, index=True),
        sa.Column("method_id",    sa.String(50),  nullable=False),
        sa.Column("label",        sa.String(100), nullable=False),
        sa.Column("type",         sa.String(10),  nullable=False),
        sa.Column("field",        sa.String(10),  nullable=False),
        sa.Column("bank_code",    sa.String(20),  nullable=True),
        sa.Column("mobile_bank",  sa.String(30),  nullable=True),
        sa.Column("icon",         sa.String(10),  nullable=True),
        sa.Column("is_active",    sa.Boolean,     nullable=False, server_default="true"),
        sa.Column("sort_order",   sa.Integer,     nullable=False, server_default="0"),
        sa.Column("notes",        sa.Text,        nullable=True),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",   sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint("country_code", "method_id", name="uq_payment_method_country_id"),
    )

    now = datetime.now(timezone.utc)

    def row(country, method_id, label, ptype, field, bank_code=None, mobile_bank=None, icon=None, sort_order=0, notes=None):
        return {
            "id": uuid.uuid4(),
            "country_code": country,
            "method_id": method_id,
            "label": label,
            "type": ptype,
            "field": field,
            "bank_code": bank_code,
            "mobile_bank": mobile_bank,
            "icon": icon,
            "is_active": True,
            "sort_order": sort_order,
            "notes": notes,
            "created_at": now,
            "updated_at": now,
        }

    op.bulk_insert(payment_methods, [
        # Kenya
        row("KE", "mpesa",  "M-Pesa",       "mobile", "phone",   mobile_bank="MPS",    icon="📱", sort_order=0),
        row("KE", "airtel", "Airtel Money",  "mobile", "phone",   mobile_bank="AIRTEL", icon="📱", sort_order=1),
        row("KE", "equity", "Equity Bank",   "bank",   "account", bank_code="063",      icon="🏦", sort_order=2),
        row("KE", "kcb",    "KCB Bank",      "bank",   "account", bank_code="017",      icon="🏦", sort_order=3),
        row("KE", "coop",   "Co-op Bank",    "bank",   "account", bank_code="011",      icon="🏦", sort_order=4),
        row("KE", "ncba",   "NCBA",           "bank",   "account", bank_code="007",      icon="🏦", sort_order=5),
        # Uganda
        row("UG", "mtn",       "MTN Mobile Money", "mobile", "phone",   mobile_bank="MTN_UG",    icon="📱", sort_order=0),
        row("UG", "airtel_ug", "Airtel Money",      "mobile", "phone",   mobile_bank="AIRTEL_UG", icon="📱", sort_order=1),
        row("UG", "stanbic",   "Stanbic Bank",      "bank",   "account", bank_code="SBU",         icon="🏦", sort_order=2),
        row("UG", "dfcu",      "DFCU Bank",          "bank",   "account", bank_code="DFCU",        icon="🏦", sort_order=3),
        # Tanzania
        row("TZ", "mpesa_tz",  "M-Pesa",       "mobile", "phone",   mobile_bank="MPESA_TZ",  icon="📱", sort_order=0),
        row("TZ", "tigo",      "Tigo Pesa",    "mobile", "phone",   mobile_bank="TIGO",      icon="📱", sort_order=1),
        row("TZ", "airtel_tz", "Airtel Money", "mobile", "phone",   mobile_bank="AIRTEL_TZ", icon="📱", sort_order=2),
        row("TZ", "crdb",      "CRDB Bank",    "bank",   "account", bank_code="CRDB",        icon="🏦", sort_order=3),
        row("TZ", "nmb",       "NMB Bank",     "bank",   "account", bank_code="NMB",         icon="🏦", sort_order=4),
        # Rwanda
        row("RW", "mtn_rw",    "MTN Mobile Money", "mobile", "phone",   mobile_bank="MTN_RW",    icon="📱", sort_order=0),
        row("RW", "airtel_rw", "Airtel Money",      "mobile", "phone",   mobile_bank="AIRTEL_RW", icon="📱", sort_order=1),
        row("RW", "bk",        "Bank of Kigali",    "bank",   "account", bank_code="BK",          icon="🏦", sort_order=2),
        row("RW", "equity_rw", "Equity Bank RW",    "bank",   "account", bank_code="EQU",         icon="🏦", sort_order=3),
    ])


def downgrade() -> None:
    op.drop_table("payment_methods")
