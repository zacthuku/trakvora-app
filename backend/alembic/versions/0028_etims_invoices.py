"""etims_invoices

Revision ID: 0028
Revises: 0027
Create Date: 2026-05-20

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "etims_invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "transaction_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("transactions.id"),
            unique=True,
            nullable=False,
        ),
        sa.Column("internal_invoice_no", sa.String(50), unique=True, nullable=False),
        sa.Column("invoice_date", sa.String(8), nullable=False),
        sa.Column("seller_pin", sa.String(20), nullable=False),
        sa.Column("buyer_pin", sa.String(20), nullable=True),
        sa.Column("buyer_name", sa.String(200), nullable=False),
        sa.Column("buyer_email", sa.String(200), nullable=True),
        sa.Column("cu_invoice_no", sa.String(100), nullable=True),
        sa.Column("receipt_signature", sa.String(200), nullable=True),
        sa.Column("qr_code_url", sa.Text(), nullable=True),
        sa.Column("kra_submission_date", sa.String(30), nullable=True),
        sa.Column("taxable_amount_kes", sa.Numeric(14, 2), nullable=False),
        sa.Column("vat_amount_kes", sa.Numeric(14, 2), nullable=False),
        sa.Column("total_amount_kes", sa.Numeric(14, 2), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "submitted", "accepted", "failed", name="etimsinvoicestatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("kra_response", sa.JSON(), nullable=True),
        sa.Column("service_description", sa.String(300), nullable=False),
        sa.Column(
            "invoice_type",
            sa.Enum("platform_fee", "subscription", name="etimsinvoicetype"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_etims_invoices_transaction_id",
        "etims_invoices",
        ["transaction_id"],
    )
    op.create_index(
        "ix_etims_invoices_status",
        "etims_invoices",
        ["status"],
    )


def downgrade() -> None:
    op.drop_index("ix_etims_invoices_status", table_name="etims_invoices")
    op.drop_index("ix_etims_invoices_transaction_id", table_name="etims_invoices")
    op.drop_table("etims_invoices")
    sa.Enum(name="etimsinvoicestatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="etimsinvoicetype").drop(op.get_bind(), checkfirst=True)
