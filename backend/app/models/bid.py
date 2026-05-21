import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class BidStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
    withdrawn = "withdrawn"


class Bid(Base):
    __tablename__ = "bids"

    load_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("loads.id"), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    truck_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trucks.id"), nullable=False)
    amount_kes: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[BidStatus] = mapped_column(Enum(BidStatus), default=BidStatus.pending)
    message: Mapped[str | None] = mapped_column(Text)

    load = relationship("Load", foreign_keys=[load_id])
    owner = relationship("User", foreign_keys=[owner_id])
    truck = relationship("Truck", foreign_keys=[truck_id])

    @property
    def bidder_name(self) -> str | None:
        u = self.__dict__.get("owner")
        return u.full_name if u else None

    @property
    def bidder_company(self) -> str | None:
        u = self.__dict__.get("owner")
        return u.company_name if u else None
