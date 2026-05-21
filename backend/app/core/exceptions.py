from fastapi import HTTPException, status


class NotFoundError(HTTPException):
    def __init__(self, resource: str = "Resource"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=f"{resource} not found")


class ForbiddenError(HTTPException):
    def __init__(self, detail: str = "Insufficient permissions"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class ConflictError(HTTPException):
    def __init__(self, detail: str = "Conflict"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class UnauthorizedError(HTTPException):
    def __init__(self, detail: str = "Not authenticated"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class ValidationError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


class LoadNotFound(NotFoundError):
    def __init__(self):
        super().__init__("Load")


class ShipmentNotFound(NotFoundError):
    def __init__(self):
        super().__init__("Shipment")


class BidNotFound(NotFoundError):
    def __init__(self):
        super().__init__("Bid")


class TruckNotFound(NotFoundError):
    def __init__(self):
        super().__init__("Truck")


class UserNotFound(NotFoundError):
    def __init__(self):
        super().__init__("User")


class BidFloorViolation(ValidationError):
    def __init__(self, floor: float):
        super().__init__(f"Bid must be at least KES {floor:,.2f}")


class LoadNotAvailable(ConflictError):
    def __init__(self):
        super().__init__("Load is no longer available for bidding")


class InsufficientFunds(ConflictError):
    def __init__(self):
        super().__init__("Insufficient wallet balance")
