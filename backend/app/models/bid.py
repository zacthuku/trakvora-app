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

    @property
    def bidder_rating(self) -> float | None:
        u = self.__dict__.get("owner")
        return float(u.rating) if u and u.rating else None

    @property
    def truck_is_verified(self) -> bool | None:
        t = self.__dict__.get("truck")
        return t.is_verified if t is not None else None

    @property
    def truck_registration(self) -> str | None:
        t = self.__dict__.get("truck")
        return t.registration_number if t else None

    @property
    def truck_type_str(self) -> str | None:
        t = self.__dict__.get("truck")
        return str(t.truck_type) if t else None

    @property
    def truck_verification_score(self) -> float | None:
        t = self.__dict__.get("truck")
        return float(t.verification_score) if t and t.verification_score else None

    @property
    def bidder_partner_tier(self) -> str | None:
        u = self.__dict__.get("owner")
        return u.partner_tier.value if u and u.partner_tier else "standard"
