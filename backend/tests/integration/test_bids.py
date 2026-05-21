"""Integration tests for /bids/* routes."""
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
    "registration_number": "KBZ 999X",
    "truck_type": "flatbed",
    "capacity_tonnes": 20.0,
}


async def _create_load(client, headers) -> str:
    resp = await client.post("/loads", json=LOAD_PAYLOAD, headers=headers)
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_truck(client, headers) -> str:
    resp = await client.post("/trucks", json=TRUCK_PAYLOAD, headers=headers)
    assert resp.status_code == 201
    return resp.json()["id"]


@pytest.mark.integration
async def test_place_bid_as_owner_returns_201(client, shipper_headers, owner_headers):
    load_id = await _create_load(client, shipper_headers)
    truck_id = await _create_truck(client, owner_headers)

    resp = await client.post("/bids", json={
        "load_id": load_id,
        "truck_id": truck_id,
        "amount_kes": 20000.0,
    }, headers=owner_headers)
    assert resp.status_code == 201
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
async def test_list_bids_for_load(client, shipper_headers, owner_headers):
    load_id = await _create_load(client, shipper_headers)
    truck_id = await _create_truck(client, owner_headers)
    await client.post("/bids", json={
        "load_id": load_id,
        "truck_id": truck_id,
        "amount_kes": 20000.0,
    }, headers=owner_headers)

    resp = await client.get(f"/bids/load/{load_id}", headers=shipper_headers)
    assert resp.status_code == 200
    bids = resp.json()
    assert isinstance(bids, list)
    assert len(bids) >= 1


@pytest.mark.integration
async def test_list_my_bids_as_owner(client, shipper_headers, owner_headers):
    load_id = await _create_load(client, shipper_headers)
    truck_id = await _create_truck(client, owner_headers)
    await client.post("/bids", json={
        "load_id": load_id,
        "truck_id": truck_id,
        "amount_kes": 20000.0,
    }, headers=owner_headers)

    resp = await client.get("/bids/my-bids", headers=owner_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.integration
async def test_withdraw_bid(client, shipper_headers, owner_headers):
    load_id = await _create_load(client, shipper_headers)
    truck_id = await _create_truck(client, owner_headers)
    bid = (await client.post("/bids", json={
        "load_id": load_id,
        "truck_id": truck_id,
        "amount_kes": 20000.0,
    }, headers=owner_headers)).json()

    resp = await client.patch(f"/bids/{bid['id']}/withdraw", headers=owner_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "withdrawn"
