"""Integration tests for /shipments/* routes."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import uuid as _uuid

from tests.conftest import seed_onboarding_fee

LOAD_PAYLOAD = {
    "pickup_location": "Nairobi CBD",
    "pickup_latitude": -1.2921,
    "pickup_longitude": 36.8219,
    "dropoff_location": "Mombasa Port",
    "dropoff_latitude": -4.0435,
    "dropoff_longitude": 39.6682,
    "cargo_type": "general",
    "weight_tonnes": 5.0,
    "price_kes": 25000.0,
    "booking_mode": "auction",
    "min_bid_floor_kes": 15000.0,
}


def _truck_payload() -> dict:
    return {
        "registration_number": f"KDA {_uuid.uuid4().hex[:4].upper()}",
        "truck_type": "dry_van",
        "capacity_tonnes": 10.0,
    }


@pytest.mark.integration
async def test_get_shipments_by_load_after_bid_accepted(client, db, shipper_headers, owner_headers, driver_headers):
    """Full flow: create load → owner bids → shipper accepts → shipment exists."""
    from sqlalchemy import select
    from app.models.driver import Driver
    from app.models.truck import Truck

    load_resp = await client.post("/loads", json=LOAD_PAYLOAD, headers=shipper_headers)
    assert load_resp.status_code == 201, load_resp.text
    load_id = load_resp.json()["id"]

    await seed_onboarding_fee(client, db, owner_headers, truck_type="dry_van")
    truck_resp = await client.post("/trucks", json=_truck_payload(), headers=owner_headers)
    assert truck_resp.status_code == 201, truck_resp.text
    truck_id = _uuid.UUID(truck_resp.json()["id"])

    # Get driver's user_id so we can link them to the truck
    me_resp = await client.get("/users/me", headers=driver_headers)
    assert me_resp.status_code == 200, me_resp.text
    driver_user_id = _uuid.UUID(me_resp.json()["id"])

    # Mark truck as verified so the bid can be placed
    result = await db.execute(select(Truck).where(Truck.id == truck_id))
    truck = result.scalar_one()
    truck.is_verified = True
    await db.commit()

    # Link driver to the truck via a Driver record so bid-accept can resolve driver_id
    existing = (await db.execute(select(Driver).where(Driver.user_id == driver_user_id))).scalar_one_or_none()
    if existing:
        existing.current_truck_id = truck_id
    else:
        db.add(Driver(user_id=driver_user_id, licence_number="DL-TEST-001", current_truck_id=truck_id))
    await db.commit()

    bid_resp = await client.post("/bids", json={
        "load_id": load_id,
        "truck_id": str(truck_id),
        "amount_kes": 20000.0,
    }, headers=owner_headers)
    assert bid_resp.status_code == 201, bid_resp.text
    bid_id = bid_resp.json()["id"]

    # Mock wallet balance check + escrow lock (no real funds in test DB)
    mock_wallet = MagicMock()
    mock_wallet.balance_kes = 100_000.0
    with patch("app.repositories.wallet_repo.WalletRepository.get_by_user", new=AsyncMock(return_value=mock_wallet)):
        with patch("app.services.payment_service.lock_escrow", new=AsyncMock()):
            accept_resp = await client.patch(f"/bids/{bid_id}/accept", headers=shipper_headers)

    assert accept_resp.status_code == 200, accept_resp.text
    shipment_resp = await client.get(f"/shipments/by-load/{load_id}", headers=shipper_headers)
    assert shipment_resp.status_code == 200


@pytest.mark.integration
async def test_get_active_shipment_unauthenticated_returns_401(client):
    resp = await client.get("/shipments/my-active")
    assert resp.status_code == 401


@pytest.mark.integration
async def test_get_unrated_shipments_authenticated(client, shipper_headers):
    resp = await client.get("/shipments/unrated", headers=shipper_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
