"""Integration tests for parcel booking (/parcels/* routes)."""
import pytest

pytestmark = pytest.mark.integration

PARCEL_PAYLOAD = {
    "pickup_location": "Westlands, Nairobi",
    "pickup_latitude": -1.265,
    "pickup_longitude": 36.804,
    "dropoff_location": "Karen, Nairobi",
    "dropoff_latitude": -1.324,
    "dropoff_longitude": 36.713,
    "weight_kg": 2.5,
    "length_cm": 30,
    "width_cm": 20,
    "height_cm": 15,
    "contents_description": "Electronics",
    "declared_value_kes": 5000,
    "is_fragile": True,
    "requires_insurance": False,
    "service_level": "standard",
    "recipient_name": "Jane Mwangi",
    "recipient_phone": "+254711000001",
    "price_kes": 500.0,
}


# ---------------------------------------------------------------------------
# Create parcel
# ---------------------------------------------------------------------------

async def test_create_parcel_as_shipper(client, shipper_headers):
    resp = await client.post("/parcels", json=PARCEL_PAYLOAD, headers=shipper_headers)
    assert resp.status_code in (200, 201), resp.text
    body = resp.json()
    assert body["pickup_location"] == PARCEL_PAYLOAD["pickup_location"]
    assert body["status"] == "pending"
    return body


async def test_create_parcel_missing_required_field_returns_422(client, shipper_headers):
    bad = {k: v for k, v in PARCEL_PAYLOAD.items() if k != "pickup_location"}
    resp = await client.post("/parcels", json=bad, headers=shipper_headers)
    assert resp.status_code == 422


async def test_create_parcel_requires_auth(client):
    resp = await client.post("/parcels", json=PARCEL_PAYLOAD)
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# List my parcels
# GET /parcels returns the authenticated shipper's own parcel list.
# ---------------------------------------------------------------------------

async def test_list_my_parcels_as_shipper(client, shipper_headers):
    # Create one first
    await client.post("/parcels", json=PARCEL_PAYLOAD, headers=shipper_headers)
    resp = await client.get("/parcels", headers=shipper_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, (list, dict))


async def test_list_parcels_requires_auth(client):
    resp = await client.get("/parcels")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Admin parcel oversight
# NOTE: The GET /parcels endpoint returns the caller's own parcels (shipper-scoped).
# A dedicated admin-only list endpoint does not exist yet; we test that a
# non-shipper (owner) gets 403 when accessing the endpoint.
# ---------------------------------------------------------------------------

async def test_non_shipper_cannot_list_parcels(client, owner_headers):
    resp = await client.get("/parcels", headers=owner_headers)
    assert resp.status_code == 403
