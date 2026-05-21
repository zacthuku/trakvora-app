"""Integration tests for /users/* routes."""
import pytest


@pytest.mark.integration
async def test_get_me_authenticated_returns_user(client, shipper_headers):
    resp = await client.get("/users/me", headers=shipper_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "email" in body
    assert "id" in body
    assert "hashed_password" not in body


@pytest.mark.integration
async def test_get_me_unauthenticated_returns_401(client):
    resp = await client.get("/users/me")
    assert resp.status_code == 401


@pytest.mark.integration
async def test_patch_me_updates_full_name(client, shipper_headers):
    resp = await client.patch(
        "/users/me",
        json={"full_name": "Updated Name"},
        headers=shipper_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Updated Name"


@pytest.mark.integration
async def test_get_public_profile_returns_200(client, shipper_headers):
    me = (await client.get("/users/me", headers=shipper_headers)).json()
    user_id = me["id"]
    resp = await client.get(f"/users/{user_id}/public", headers=shipper_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "hashed_password" not in body
