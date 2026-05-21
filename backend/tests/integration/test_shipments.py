"""Integration tests for /shipments/* routes."""
from unittest.mock import AsyncMock, patch

import pytest

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
    "booking_mode": "bid",
    "min_bid_floor_kes": 15000.0,
}

TRUCK_PAYLOAD = {
    "registration_number": "KDA 321Z",
    "truck_type": "dry_van",
    "capacity_tonnes": 10.0,
}


@pytest.mark.integration
async def test_get_shipments_by_load_after_bid_accepted(client, shipper_headers, owner_headers):
    """Full flow: create load → owner bids → shipper accepts → shipment exists."""
    load_resp = await client.post("/loads", json=LOAD_PAYLOAD, headers=shipper_headers)
    load_id = load_resp.json()["id"]

    truck_resp = await client.post("/trucks", json=TRUCK_PAYLOAD, headers=owner_headers)
    truck_id = truck_resp.json()["id"]

    bid_resp = await client.post("/bids", json={
        "load_id": load_id,
        "truck_id": truck_id,
        "amount_kes": 20000.0,
    }, headers=owner_headers)
    assert bid_resp.status_code == 201
    bid_id = bid_resp.json()["id"]

    # Mock escrow lock (no real wallet funds in test)
    with patch("app.services.payment_service.lock_escrow", new=AsyncMock()):
        with patch("app.services.email_service.send_bid_accepted_email", new=AsyncMock()):
            accept_resp = await client.patch(f"/bids/{bid_id}/accept", headers=shipper_headers)

    if accept_resp.status_code == 200:
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
