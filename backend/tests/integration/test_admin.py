"""Integration tests for /admin/* routes — role-based access control."""
import pytest

from app.core.security import create_access_token
from tests.conftest import VALID_PASSWORD, _register_and_login


@pytest.fixture
async def true_admin_headers(client, db):
    """
    Admin user with role=admin created via register.
    Note: The admin role in the system is just UserRole.admin — full admin access.
    """
    from app.repositories.user_repo import UserRepository
    from app.core.security import hash_password

    repo = UserRepository(db)
    user = await repo.create(
        email="admin_direct@trakvora.test",
        phone="+254799000001",
        full_name="Direct Admin",
        hashed_password=hash_password(VALID_PASSWORD),
        role="admin",
        country="KE",
    )
    from app.repositories.wallet_repo import WalletRepository
    await WalletRepository(db).create_wallet(user.id, currency="KES")
    await db.commit()

    token = create_access_token(str(user.id), "admin")
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
async def test_admin_dashboard_as_admin_returns_200(client, true_admin_headers):
    resp = await client.get("/admin/dashboard", headers=true_admin_headers)
    assert resp.status_code == 200


@pytest.mark.integration
async def test_admin_dashboard_as_shipper_returns_403(client, shipper_headers):
    resp = await client.get("/admin/dashboard", headers=shipper_headers)
    assert resp.status_code == 403


@pytest.mark.integration
async def test_admin_dashboard_unauthenticated_returns_401(client):
    resp = await client.get("/admin/dashboard")
    assert resp.status_code == 401


@pytest.mark.integration
async def test_admin_list_users_as_admin_returns_200(client, true_admin_headers):
    resp = await client.get("/admin/users", headers=true_admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list) or "items" in body


@pytest.mark.integration
async def test_admin_list_users_as_owner_returns_403(client, owner_headers):
    resp = await client.get("/admin/users", headers=owner_headers)
    assert resp.status_code == 403
