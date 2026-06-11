"""Integration tests for /bids/* routes."""
import uuid as _uuid

import pytest

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
        "registration_number": f"KBZ {_uuid.uuid4().hex[:4].upper()}",
        "truck_type": "flatbed",
        "capacity_tonnes": 20.0,
    }


async def _create_load(client, headers) -> str:
    resp = await client.post("/loads", json=LOAD_PAYLOAD, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _create_verified_truck(client, db, owner_headers) -> str:
    """Create a truck and mark it as verified directly in the test DB."""
    from sqlalchemy import select
    from app.models.truck import Truck

    await seed_onboarding_fee(client, db, owner_headers, truck_type="flatbed")

    resp = await client.post("/trucks", json=_truck_payload(), headers=owner_headers)
    assert resp.status_code == 201, resp.text
    truck_id = _uuid.UUID(resp.json()["id"])

    # Mark verified so bids are allowed
    result = await db.execute(select(Truck).where(Truck.id == truck_id))
    truck = result.scalar_one()
    truck.is_verified = True
    await db.commit()
    return str(truck_id)


@pytest.mark.integration
async def test_place_bid_as_owner_returns_201(client, db, shipper_headers, owner_headers):
    load_id = await _create_load(client, shipper_headers)
    truck_id = await _create_verified_truck(client, db, owner_headers)

    resp = await client.post("/bids", json={
        "load_id": load_id,
        "truck_id": truck_id,
        "amount_kes": 20000.0,
    }, headers=owner_headers)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["load_id"] == load_id
    assert body["status"] == "pending"


@pytest.mark.integration
async def test_place_bid_as_shipper_returns_403(client, shipper_headers):
    load_id = await _create_load(client, shipper_headers)
    resp = await client.post("/bids", json={
        "load_id": load_id,
        "truck_id": "00000000-0000-0000-0000-000000000000",
        "amount_kes": 20000.0,
    }, headers=shipper_headers)
    assert resp.status_code == 403


@pytest.mark.integration
async def test_place_bid_unauthenticated_returns_401(client):
    resp = await client.post("/bids", json={
        "load_id": "00000000-0000-0000-0000-000000000000",
        "truck_id": "00000000-0000-0000-0000-000000000000",
        "amount_kes": 20000.0,
    })
    assert resp.status_code == 401


@pytest.mark.integration
async def test_list_bids_for_load(client, db, shipper_headers, owner_headers):
    load_id = await _create_load(client, shipper_headers)
    truck_id = await _create_verified_truck(client, db, owner_headers)
    bid_resp = await client.post("/bids", json={
        "load_id": load_id,
        "truck_id": truck_id,
        "amount_kes": 20000.0,
    }, headers=owner_headers)
    assert bid_resp.status_code == 201, bid_resp.text

    resp = await client.get(f"/bids/load/{load_id}", headers=shipper_headers)
    assert resp.status_code == 200
    bids = resp.json()
    assert isinstance(bids, list)
    assert len(bids) >= 1


@pytest.mark.integration
async def test_list_my_bids_as_owner(client, db, shipper_headers, owner_headers):
    load_id = await _create_load(client, shipper_headers)
    truck_id = await _create_verified_truck(client, db, owner_headers)
    bid_resp = await client.post("/bids", json={
        "load_id": load_id,
        "truck_id": truck_id,
        "amount_kes": 20000.0,
    }, headers=owner_headers)
    assert bid_resp.status_code == 201, bid_resp.text

    resp = await client.get("/bids/my-bids", headers=owner_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.integration
async def test_withdraw_bid(client, db, shipper_headers, owner_headers):
    load_id = await _create_load(client, shipper_headers)
    truck_id = await _create_verified_truck(client, db, owner_headers)
    bid_resp = await client.post("/bids", json={
        "load_id": load_id,
        "truck_id": truck_id,
        "amount_kes": 20000.0,
    }, headers=owner_headers)
    assert bid_resp.status_code == 201, bid_resp.text
    bid_id = bid_resp.json()["id"]

    resp = await client.patch(f"/bids/{bid_id}/withdraw", headers=owner_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "withdrawn"
