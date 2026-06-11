"""Integration tests for IoT device management (/admin/iot/* routes)."""
import pytest

pytestmark = pytest.mark.integration

# All IoT endpoints live under /admin/iot (see app/routers/iot.py)
_BASE = "/admin/iot"


# ---------------------------------------------------------------------------
# Device inventory
# ---------------------------------------------------------------------------

async def test_list_devices_requires_auth(client):
    resp = await client.get(f"{_BASE}/devices")
    assert resp.status_code == 401


async def test_list_devices_as_admin(client, admin_headers):
    resp = await client.get(f"{_BASE}/devices", headers=admin_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), (list, dict))


async def test_create_device_as_admin(client, admin_headers):
    import random, uuid
    payload = {
        "serial_number": f"SN-{uuid.uuid4().hex[:8].upper()}",
        "imei": f"{random.randint(100000000000000, 999999999999999)}",
        "firmware_version": "1.0.0",
    }
    resp = await client.post(f"{_BASE}/devices", json=payload, headers=admin_headers)
    assert resp.status_code in (200, 201), resp.text
    body = resp.json()
    assert body["serial_number"] == payload["serial_number"]
    return body


async def test_create_device_duplicate_serial_returns_conflict(client, admin_headers):
    import random, uuid
    serial = f"DUP-{uuid.uuid4().hex[:8].upper()}"
    imei1 = f"{random.randint(100000000000000, 999999999999999)}"
    imei2 = f"{random.randint(100000000000000, 999999999999999)}"
    payload1 = {"serial_number": serial, "imei": imei1, "firmware_version": "1.0.0"}
    payload2 = {"serial_number": serial, "imei": imei2, "firmware_version": "1.0.0"}
    r1 = await client.post(f"{_BASE}/devices", json=payload1, headers=admin_headers)
    assert r1.status_code in (200, 201)
    r2 = await client.post(f"{_BASE}/devices", json=payload2, headers=admin_headers)
    assert r2.status_code == 409


async def test_get_device_detail(client, admin_headers):
    import random, uuid
    serial = f"SN-{uuid.uuid4().hex[:8].upper()}"
    imei = f"{random.randint(100000000000000, 999999999999999)}"
    create_resp = await client.post(
        f"{_BASE}/devices",
        json={"serial_number": serial, "imei": imei, "firmware_version": "2.0.0"},
        headers=admin_headers,
    )
    assert create_resp.status_code in (200, 201)
    device_id = create_resp.json()["id"]

    resp = await client.get(f"{_BASE}/devices/{device_id}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == device_id


async def test_non_admin_cannot_create_device(client, owner_headers):
    import random, uuid
    payload = {
        "serial_number": f"SN-{uuid.uuid4().hex[:8].upper()}",
        "imei": f"{random.randint(100000000000000, 999999999999999)}",
        "firmware_version": "1.0.0",
    }
    resp = await client.post(f"{_BASE}/devices", json=payload, headers=owner_headers)
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

async def test_list_alerts_as_admin(client, admin_headers):
    resp = await client.get(f"{_BASE}/alerts", headers=admin_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), (list, dict))


async def test_iot_dashboard_returns_fleet_health(client, admin_headers):
    resp = await client.get(f"{_BASE}/dashboard", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, dict)
