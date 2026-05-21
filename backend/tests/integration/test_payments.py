"""Integration tests for /payments/* routes."""
from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.integration
async def test_get_wallet_authenticated_returns_balance(client, shipper_headers):
    resp = await client.get("/payments/wallet", headers=shipper_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "balance" in body
    assert isinstance(body["balance"], (int, float))


@pytest.mark.integration
async def test_get_wallet_unauthenticated_returns_401(client):
    resp = await client.get("/payments/wallet")
    assert resp.status_code == 401


@pytest.mark.integration
async def test_get_transactions_authenticated_returns_list(client, shipper_headers):
    resp = await client.get("/payments/transactions", headers=shipper_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body or isinstance(body, list)


@pytest.mark.integration
async def test_get_transactions_unauthenticated_returns_401(client):
    resp = await client.get("/payments/transactions")
    assert resp.status_code == 401


@pytest.mark.integration
async def test_initiate_topup_returns_payment_url(client, shipper_headers):
    mock_response = {
        "payment_url": "https://checkout.flutterwave.com/v3/hosted/pay/test",
        "tx_ref": "TRAK-TEST-1234",
        "amount": 1000.0,
        "amount_kes": 1000.0,
        "currency": "KES",
    }
    with patch(
        "app.services.payment_service.initiate_topup",
        new=AsyncMock(return_value=mock_response),
    ):
        resp = await client.post(
            "/payments/topup/initiate",
            json={"amount": 1000.0},
            headers=shipper_headers,
        )
    assert resp.status_code == 201
    body = resp.json()
    assert "payment_url" in body
    assert "tx_ref" in body


@pytest.mark.integration
async def test_initiate_topup_unauthenticated_returns_401(client):
    resp = await client.post("/payments/topup/initiate", json={"amount": 1000.0})
    assert resp.status_code == 401


@pytest.mark.integration
async def test_initiate_topup_missing_amount_returns_422(client, shipper_headers):
    resp = await client.post("/payments/topup/initiate", json={}, headers=shipper_headers)
    assert resp.status_code == 422
