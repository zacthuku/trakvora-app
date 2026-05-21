import uuid
from datetime import datetime

from pydantic import BaseModel, computed_field

from app.models.wallet import TransactionStatus, TransactionType


class WalletOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    user_id: uuid.UUID
    balance_kes: float
    escrow_kes: float
    currency: str
    updated_at: datetime

    @computed_field
    @property
    def balance(self) -> float:
        return self.balance_kes

    @computed_field
    @property
    def escrow(self) -> float:
        return self.escrow_kes


class TransactionOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    wallet_id: uuid.UUID
    shipment_id: uuid.UUID | None
    transaction_type: TransactionType
    amount_kes: float
    status: TransactionStatus
    reference: str | None
    description: str | None
    provider: str | None = None
    provider_reference: str | None = None
    provider_transaction_id: str | None = None
    provider_status: str | None = None
    provider_metadata: dict | None = None
    created_at: datetime

    @computed_field
    @property
    def amount(self) -> float:
        return self.amount_kes


class TransactionListOut(BaseModel):
    items: list[TransactionOut]
    total: int
    page: int
    page_size: int
