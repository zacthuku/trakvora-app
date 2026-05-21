"""Integration tests for /trucks/* routes."""
import pytest

TRUCK_PAYLOAD = {
    "registration_number": "KCA 100A",
    "truck_type": "flatbed",
    "capacity_tonnes": 20.0,
    "make": "Isuzu",
    "model": "FVZ",
    "year": 2020,
}


@pytest.mark.integration
async def test_create_truck_as_owner_returns_201(client, owner_headers):
    resp = await client.post("/trucks", json=TRUCK_PAYLOAD, headers=owner_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["registration_number"] == "KCA 100A"
    assert "id" in body


@pytest.mark.integration
async def test_create_truck_as_shipper_returns_403(client, shipper_headers):
    resp = await client.post("/trucks", json=TRUCK_PAYLOAD, headers=shipper_headers)
    assert resp.status_code == 403


@pytest.mark.integration
async def test_create_truck_unauthenticated_returns_401(client):
    resp = await client.post("/trucks", json=TRUCK_PAYLOAD)
    assert resp.status_code == 401


@pytest.mark.integration
async def test_list_trucks_as_owner_returns_created_truck(client, owner_headers):
    await client.post("/trucks", json=TRUCK_PAYLOAD, headers=owner_headers)
    resp = await client.get("/trucks", headers=owner_headers)
    assert resp.status_code == 200
    trucks = resp.json()
    assert isinstance(trucks, list)
    assert len(trucks) >= 1


@pytest.mark.integration
async def test_get_truck_by_id(client, owner_headers):
    created = (await client.post("/trucks", json=TRUCK_PAYLOAD, headers=owner_headers)).json()
    truck_id = created["id"]
    resp = await client.get(f"/trucks/{truck_id}", headers=owner_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == truck_id


@pytest.mark.integration
async def test_get_truck_nonexistent_returns_404(client, owner_headers):
    resp = await client.get(
        "/trucks/00000000-0000-0000-0000-000000000000",
        headers=owner_headers,
    )
    assert resp.status_code == 404


@pytest.mark.integration
async def test_update_truck_capacity(client, owner_headers):
    created = (await client.post("/trucks", json=TRUCK_PAYLOAD, headers=owner_headers)).json()
    truck_id = created["id"]
    resp = await client.patch(
        f"/trucks/{truck_id}",
        json={"capacity_tonnes": 30.0},
        headers=owner_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["capacity_tonnes"] == 30.0


@pytest.mark.integration
async def test_public_trucks_endpoint_requires_no_auth(client):
    resp = await client.get("/trucks/public")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
