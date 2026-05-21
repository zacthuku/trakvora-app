"""Integration tests for /auth/* routes."""
import pytest

VALID_PASSWORD = "TestPass1!"

SHIPPER_PAYLOAD = {
    "email": "auth_test_shipper@trakvora.test",
    "phone": "+254700000001",
    "full_name": "Auth Test Shipper",
    "password": VALID_PASSWORD,
    "role": "shipper",
    "country": "KE",
}


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_register_shipper_returns_201_with_tokens(client):
    resp = await client.post("/auth/register", json=SHIPPER_PAYLOAD)
    assert resp.status_code == 201
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"


@pytest.mark.integration
async def test_register_duplicate_email_returns_409(client):
    await client.post("/auth/register", json=SHIPPER_PAYLOAD)
    resp = await client.post("/auth/register", json=SHIPPER_PAYLOAD)
    assert resp.status_code == 409


@pytest.mark.integration
async def test_register_invalid_email_returns_422(client):
    bad = {**SHIPPER_PAYLOAD, "email": "not-an-email"}
    resp = await client.post("/auth/register", json=bad)
    assert resp.status_code == 422


@pytest.mark.integration
async def test_register_weak_password_returns_422(client):
    bad = {**SHIPPER_PAYLOAD, "email": "weak@trakvora.test", "password": "weak"}
    resp = await client.post("/auth/register", json=bad)
    assert resp.status_code == 422


@pytest.mark.integration
async def test_register_missing_field_returns_422(client):
    payload = {k: v for k, v in SHIPPER_PAYLOAD.items() if k != "phone"}
    resp = await client.post("/auth/register", json=payload)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_login_correct_credentials_returns_tokens(client):
    await client.post("/auth/register", json=SHIPPER_PAYLOAD)
    resp = await client.post("/auth/login", json={
        "email": SHIPPER_PAYLOAD["email"],
        "password": VALID_PASSWORD,
    })
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body


@pytest.mark.integration
async def test_login_wrong_password_returns_401(client):
    await client.post("/auth/register", json=SHIPPER_PAYLOAD)
    resp = await client.post("/auth/login", json={
        "email": SHIPPER_PAYLOAD["email"],
        "password": "WrongPass1!",
    })
    assert resp.status_code == 401


@pytest.mark.integration
async def test_login_nonexistent_email_returns_401(client):
    resp = await client.post("/auth/login", json={
        "email": "nobody@trakvora.test",
        "password": VALID_PASSWORD,
    })
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------

@pytest.mark.integration
async def test_refresh_with_valid_token_returns_new_access_token(client):
    reg = await client.post("/auth/register", json=SHIPPER_PAYLOAD)
    refresh_token = reg.json()["refresh_token"]

    resp = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.integration
async def test_refresh_with_invalid_token_returns_401(client):
    resp = await client.post("/auth/refresh", json={"refresh_token": "invalid.token.here"})
    assert resp.status_code == 401
