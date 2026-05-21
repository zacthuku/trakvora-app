import enum


class VehicleServiceType(str, enum.Enum):
    """Top-level service category. Drives which booking flow and pricing rules apply."""
    truck = "truck"           # Long haul / bulk logistics
    van = "van"               # Distribution and SME logistics
    pickup = "pickup"         # Flexible and last-mile delivery
    parcel = "parcel"         # On-demand and scheduled parcels
    movers = "movers"         # Home and office relocation
    airfreight = "airfreight" # Urgent and high-value air shipments
