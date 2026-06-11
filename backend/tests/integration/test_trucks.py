"""Integration tests for /trucks/* routes."""
import uuid as _uuid

import pytest

from tests.conftest import seed_onboarding_fee


def _truck_payload(reg: str | None = None) -> dict:
    """Return a truck payload with a unique registration number each call."""
    return {
        "registration_number": reg or f"KCA {_uuid.uuid4().hex[:4].upper()}",
        "truck_type": "flatbed",
        "capacity_tonnes": 20.0,
        "make": "Isuzu",
        "model": "FVZ",
        "year": 2020,
    }


@pytest.mark.integration
async def test_create_truck_as_owner_returns_201(client, db, owner_headers):
    await seed_onboarding_fee(client, db, owner_headers, truck_type="flatbed")
    resp = await client.post("/trucks", json=_truck_payload(), headers=owner_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert "registration_number" in body
    assert "id" in body


@pytest.mark.integration
async def test_create_truck_as_shipper_returns_403(client, shipper_headers):
    resp = await client.post("/trucks", json=_truck_payload(), headers=shipper_headers)
    assert resp.status_code == 403


@pytest.mark.integration
async def test_create_truck_unauthenticated_returns_401(client):
    resp = await client.post("/trucks", json=_truck_payload())
    assert resp.status_code == 401


@pytest.mark.integration
async def test_list_trucks_as_owner_returns_created_truck(client, db, owner_headers):
    await seed_onboarding_fee(client, db, owner_headers, truck_type="flatbed")
    await client.post("/trucks", json=_truck_payload(), headers=owner_headers)
    resp = await client.get("/trucks", headers=owner_headers)
    assert resp.status_code == 200
    trucks = resp.json()
    assert isinstance(trucks, list)
    assert len(trucks) >= 1


@pytest.mark.integration
async def test_get_truck_by_id(client, db, owner_headers):
    await seed_onboarding_fee(client, db, owner_headers, truck_type="flatbed")
    created = (await client.post("/trucks", json=_truck_payload(), headers=owner_headers)).json()
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
async def test_update_truck_capacity(client, db, owner_headers):
    await seed_onboarding_fee(client, db, owner_headers, truck_type="flatbed")
    created = (await client.post("/trucks", json=_truck_payload(), headers=owner_headers)).json()
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
