"""Integration tests for /notifications/* routes."""
import pytest


@pytest.mark.integration
async def test_list_notifications_authenticated_returns_list(client, shipper_headers):
    resp = await client.get("/notifications/", headers=shipper_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.integration
async def test_list_notifications_unauthenticated_returns_401(client):
    resp = await client.get("/notifications/")
    assert resp.status_code == 401


@pytest.mark.integration
async def test_mark_all_read_returns_200(client, shipper_headers):
    resp = await client.post("/notifications/read-all", headers=shipper_headers)
    assert resp.status_code == 200
