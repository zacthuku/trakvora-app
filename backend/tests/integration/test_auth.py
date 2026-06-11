"""Integration tests for /auth/* routes."""
import uuid as _uuid

import pytest

VALID_PASSWORD = "TestPass1!"


def _unique_shipper_payload(**overrides) -> dict:
    uid = _uuid.uuid4().hex[:8]
    return {
        "email": f"auth_test_{uid}@example.com",
        "phone": f"+25470{abs(hash(uid)) % 10000000:07d}",
        "full_name": "Auth Test Shipper",
        "password": VALID_PASSWORD,
        "role": "shipper",
        "country": "KE",
        **overrides,
    }


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_register_shipper_returns_201_with_otp_required(client):
    resp = await client.post("/auth/register", json=_unique_shipper_payload())
    assert resp.status_code == 201
    body = resp.json()
    assert body["requires_verification"] is True
    assert "email" in body
    assert "channel" in body
    assert "destination" in body


@pytest.mark.integration
async def test_register_duplicate_email_returns_409(client):
    payload = _unique_shipper_payload()
    await client.post("/auth/register", json=payload)
    resp = await client.post("/auth/register", json=payload)
    assert resp.status_code == 409


@pytest.mark.integration
async def test_register_invalid_email_returns_422(client):
    bad = _unique_shipper_payload(email="not-an-email")
    resp = await client.post("/auth/register", json=bad)
    assert resp.status_code == 422


@pytest.mark.integration
async def test_register_weak_password_returns_422(client):
    bad = _unique_shipper_payload(password="weak")
    resp = await client.post("/auth/register", json=bad)
    assert resp.status_code == 422


@pytest.mark.integration
async def test_register_missing_field_returns_422(client):
    payload = _unique_shipper_payload()
    payload.pop("phone")
    resp = await client.post("/auth/register", json=payload)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_login_correct_credentials_returns_tokens(client):
    payload = _unique_shipper_payload()
    await client.post("/auth/register", json=payload)
    resp = await client.post("/auth/login", json={
        "email": payload["email"],
        "password": VALID_PASSWORD,
    })
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body


@pytest.mark.integration
async def test_login_wrong_password_returns_401(client):
    payload = _unique_shipper_payload()
    await client.post("/auth/register", json=payload)
    resp = await client.post("/auth/login", json={
        "email": payload["email"],
        "password": "WrongPass1!",
    })
    assert resp.status_code == 401


@pytest.mark.integration
async def test_login_nonexistent_email_returns_401(client):
    resp = await client.post("/auth/login", json={
        "email": "nobody_nonexistent@example.com",
        "password": VALID_PASSWORD,
    })
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_refresh_with_valid_token_returns_new_access_token(client):
    payload = _unique_shipper_payload()
    await client.post("/auth/register", json=payload)
    # login auto-verifies unverified users and returns tokens
    login = await client.post("/auth/login", json={
        "email": payload["email"], "password": VALID_PASSWORD,
    })
    assert login.status_code == 200, login.text
    refresh_token = login.json()["refresh_token"]

    resp = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.integration
async def test_refresh_with_invalid_token_returns_401(client):
    resp = await client.post("/auth/refresh", json={"refresh_token": "invalid.token.here"})
    assert resp.status_code == 401
