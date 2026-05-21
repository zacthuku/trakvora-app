"""Integration tests for /loads/* routes."""
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
    "booking_mode": "fixed",
}


# ---------------------------------------------------------------------------
# Price estimate (public endpoint)
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_price_estimate_returns_pricing_keys(client):
    resp = await client.get("/loads/price-estimate?distance_km=400")
    assert resp.status_code == 200
    body = resp.json()
    assert "total_price_kes" in body
    assert "platform_fee_kes" in body
    assert "owner_payout_kes" in body
    assert "vat_kes" in body


@pytest.mark.integration
async def test_price_estimate_requires_distance_km(client):
    resp = await client.get("/loads/price-estimate")
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Create load (shipper only)
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_create_load_as_shipper_returns_201(client, shipper_headers):
    resp = await client.post("/loads", json=LOAD_PAYLOAD, headers=shipper_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert "id" in body
    assert body["pickup_location"] == "Nairobi CBD"


@pytest.mark.integration
async def test_create_load_unauthenticated_returns_401(client):
    resp = await client.post("/loads", json=LOAD_PAYLOAD)
    assert resp.status_code == 401


@pytest.mark.integration
async def test_create_load_as_driver_returns_403(client, driver_headers):
    resp = await client.post("/loads", json=LOAD_PAYLOAD, headers=driver_headers)
    assert resp.status_code == 403


@pytest.mark.integration
async def test_create_load_as_owner_returns_403(client, owner_headers):
    resp = await client.post("/loads", json=LOAD_PAYLOAD, headers=owner_headers)
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# List my loads
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_list_mine_returns_created_load(client, shipper_headers):
    await client.post("/loads", json=LOAD_PAYLOAD, headers=shipper_headers)
    resp = await client.get("/loads/mine", headers=shipper_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1


@pytest.mark.integration
async def test_list_mine_unauthenticated_returns_401(client):
    resp = await client.get("/loads/mine")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Get single load
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_get_load_by_id(client, shipper_headers):
    created = (await client.post("/loads", json=LOAD_PAYLOAD, headers=shipper_headers)).json()
    load_id = created["id"]
    resp = await client.get(f"/loads/{load_id}", headers=shipper_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == load_id


@pytest.mark.integration
async def test_get_load_nonexistent_returns_404(client, shipper_headers):
    resp = await client.get(
        "/loads/00000000-0000-0000-0000-000000000000",
        headers=shipper_headers,
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Marketplace (any authenticated user)
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_marketplace_returns_list(client, owner_headers):
    resp = await client.get("/loads/marketplace", headers=owner_headers)
    assert resp.status_code == 200
    assert "items" in resp.json() or "total" in resp.json()
