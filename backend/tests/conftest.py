"""
Shared test fixtures for Trakvora backend tests.

Requires a running PostgreSQL instance. Set DATABASE_URL env var or use the
default trakvora_test database (same credentials as CI service in ci.yml).
"""
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import get_db
from app.main import app
from app.models.base import Base

TEST_DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://trakvora_test:trakvora_test@localhost:5432/trakvora_test",
)

# ---------------------------------------------------------------------------
# Database fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db(test_engine):
    """Function-scoped session — rolled back after each test for isolation."""
    async_session = async_sessionmaker(test_engine, expire_on_commit=False)
    async with async_session() as session:
        yield session
        await session.rollback()


# ---------------------------------------------------------------------------
# HTTP client fixture — mocks all external I/O
# ---------------------------------------------------------------------------

@pytest.fixture
async def client(db):
    """AsyncClient with test DB injected and all external services mocked."""

    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    patches = [
        patch("app.services.email_service.send_welcome_email", new=AsyncMock()),
        patch("app.services.email_service.send_otp_email", new=AsyncMock()),
        patch("app.services.email_service.send_admin_credentials_email", new=AsyncMock()),
        patch("app.services.email_service.send_bid_received_email", new=AsyncMock()),
        patch("app.services.email_service.send_bid_accepted_email", new=AsyncMock()),
        patch("app.services.email_service.send_shipment_in_transit_email", new=AsyncMock()),
        patch("app.services.email_service.send_shipment_delivered_email", new=AsyncMock()),
        patch("app.services.sms_service.send_otp_sms", new=AsyncMock()),
        patch("app.services.sms_service.send_bid_received_sms", new=AsyncMock()),
        patch("app.services.notification_service.notify_all_admins", new=AsyncMock()),
    ]

    started = [p.start() for p in patches]

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    for p in patches:
        p.stop()

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------

VALID_PASSWORD = "TestPass1!"

def _user_payload(role: str, suffix: str = "") -> dict:
    return {
        "email": f"test_{role}{suffix}@trakvora.test",
        "phone": f"+2547{abs(hash(role + suffix)) % 100000000:08d}",
        "full_name": f"Test {role.title()} {suffix}",
        "password": VALID_PASSWORD,
        "role": role,
        "country": "KE",
    }


async def _register_and_login(client: AsyncClient, role: str, suffix: str = "") -> dict:
    payload = _user_payload(role, suffix)
    resp = await client.post("/auth/register", json=payload)
    assert resp.status_code == 201, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def shipper_headers(client):
    return await _register_and_login(client, "shipper")


@pytest.fixture
async def owner_headers(client):
    return await _register_and_login(client, "owner")


@pytest.fixture
async def driver_headers(client):
    return await _register_and_login(client, "driver")


@pytest.fixture
async def admin_headers(client):
    """Admin user created directly via register (sets role=admin), token returned."""
    return await _register_and_login(client, "admin")
