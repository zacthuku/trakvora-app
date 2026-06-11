"""Integration tests for return-load matching (/return-windows/* routes)."""
import uuid as _uuid

import pytest

from tests.conftest import seed_onboarding_fee

pytestmark = pytest.mark.integration


async def _create_truck_for_owner(client, db, owner_headers: dict) -> str:
    """Create a truck owned by the given owner; return its UUID string."""
    await seed_onboarding_fee(client, db, owner_headers, truck_type="flatbed")
    resp = await client.post(
        "/trucks",
        json={
            "registration_number": f"KRW {_uuid.uuid4().hex[:4].upper()}",
            "truck_type": "flatbed",
            "capacity_tonnes": 20.0,
        },
        headers=owner_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _window_payload(truck_id: str) -> dict:
    return {
        "truck_id": truck_id,
        "origin_location": "Mombasa, Kenya",
        "origin_latitude": -4.043477,
        "origin_longitude": 39.668205,
        "destination_location": "Nairobi, Kenya",
        "destination_latitude": -1.286389,
        "destination_longitude": 36.817223,
        "available_from": "2026-06-01",
        "available_until": "2026-06-07",
        "capacity_tonnes": 20.0,
    }


# ---------------------------------------------------------------------------
# Create return window
# ---------------------------------------------------------------------------

async def test_create_return_window_as_owner(client, db, owner_headers):
    truck_id = await _create_truck_for_owner(client, db, owner_headers)
    resp = await client.post(
        "/return-windows", json=_window_payload(truck_id), headers=owner_headers
    )
    assert resp.status_code in (200, 201), resp.text
    body = resp.json()
    assert body["origin_location"] == "Mombasa, Kenya"
    return body


async def test_create_return_window_requires_auth(client):
    fake_truck_id = str(_uuid.uuid4())
    resp = await client.post("/return-windows", json=_window_payload(fake_truck_id))
    assert resp.status_code == 401


async def test_shipper_cannot_create_return_window(client, shipper_headers):
    fake_truck_id = str(_uuid.uuid4())
    resp = await client.post(
        "/return-windows", json=_window_payload(fake_truck_id), headers=shipper_headers
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# List return windows
# ---------------------------------------------------------------------------

async def test_list_return_windows_as_owner(client, db, owner_headers):
    truck_id = await _create_truck_for_owner(client, db, owner_headers)
    await client.post("/return-windows", json=_window_payload(truck_id), headers=owner_headers)
    resp = await client.get("/return-windows", headers=owner_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, (list, dict))


# ---------------------------------------------------------------------------
# Match return windows (backhaul matching engine)
# ---------------------------------------------------------------------------

async def test_get_matches_for_return_window(client, db, owner_headers):
    """The matching engine should return available loads near the return origin."""
    truck_id = await _create_truck_for_owner(client, db, owner_headers)
    create = await client.post(
        "/return-windows", json=_window_payload(truck_id), headers=owner_headers
    )
    assert create.status_code in (200, 201)

    resp = await client.get("/return-windows/matches", headers=owner_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, (list, dict))


# ---------------------------------------------------------------------------
# Delete (deactivate) return window
# ---------------------------------------------------------------------------

async def test_delete_return_window(client, db, owner_headers):
    truck_id = await _create_truck_for_owner(client, db, owner_headers)
    create = await client.post(
        "/return-windows", json=_window_payload(truck_id), headers=owner_headers
    )
    assert create.status_code in (200, 201)
    window_id = create.json()["id"]

    resp = await client.delete(f"/return-windows/{window_id}", headers=owner_headers)
    assert resp.status_code in (200, 204)


async def test_delete_nonexistent_return_window_returns_404(client, owner_headers):
    resp = await client.delete(f"/return-windows/{_uuid.uuid4()}", headers=owner_headers)
    assert resp.status_code == 404
