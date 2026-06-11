"""
Shared test fixtures for Trakvora backend tests.

Requires a running PostgreSQL instance. Set DATABASE_URL env var or use the
default trakvora_test database (same credentials as CI service in ci.yml).
"""
import datetime
import os
import uuid as _uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.database import get_db
from app.main import app
from app.models.base import Base

TEST_DB_URL = os.getenv(
    "TEST_DATABASE_URL",
    os.getenv("DATABASE_URL", "postgresql+asyncpg://trakvora:trakvora@localhost:5432/trakvora_test"),
)

# ---------------------------------------------------------------------------
# Database fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
async def test_engine():
    # NullPool: connections are never reused between requests.
    # Prevents asyncio "Future attached to a different loop" errors that occur
    # when pool connections created in one task's context are handed to another.
    engine = create_async_engine(TEST_DB_URL, echo=False, poolclass=NullPool)
    # Clean slate: DROP SCHEMA to remove any leftover tables (including stale
    # FK constraints from prior runs that weren't named by the current model).
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(text('GRANT ALL ON SCHEMA public TO PUBLIC'))
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(text('GRANT ALL ON SCHEMA public TO PUBLIC'))
    await engine.dispose()


# ---------------------------------------------------------------------------
# Direct-DB fixture (for fixtures that bypass the HTTP layer)
# ---------------------------------------------------------------------------

@pytest.fixture
async def db(test_engine):
    """Function-scoped session for direct DB writes in test fixtures.

    With NullPool every call creates a fresh connection, so there are no
    cross-task Future mismatches.  Rolled back after each test; tests that
    need committed data should call ``await session.commit()`` themselves.
    """
    _session = async_sessionmaker(test_engine, expire_on_commit=False)
    async with _session() as session:
        yield session
        await session.rollback()


# ---------------------------------------------------------------------------
# HTTP client fixture — mocks all external I/O
# ---------------------------------------------------------------------------

@pytest.fixture
async def client(test_engine):
    """AsyncClient that mimics production get_db: fresh session per request.

    Sharing a single session across requests caused autoflush to fire inside a
    greenlet that was already mid-query on the same connection, triggering
    asyncpg's "another operation is in progress" error.  Creating a new session
    per request (commit on success / rollback on error) matches production
    behaviour exactly and eliminates the concurrent-operation problem.
    """
    session_factory = async_sessionmaker(test_engine, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db

    patches = [
        patch("app.services.email_service.send_welcome_email", new=AsyncMock()),
        patch("app.services.email_service.send_otp_email", new=AsyncMock()),
        patch("app.services.email_service.send_admin_credentials_email", new=AsyncMock()),
        patch("app.services.email_service.send_bid_received_email", new=AsyncMock()),
        patch("app.services.email_service.send_bid_accepted_email", new=AsyncMock()),
        patch("app.services.email_service.send_shipment_in_transit_email", new=AsyncMock()),
        patch("app.services.email_service.send_shipment_delivered_email", new=AsyncMock()),
        patch("app.services.email_service.send_rating_prompt_email", new=AsyncMock()),
        patch("app.services.email_service.send_rating_received_email", new=AsyncMock()),
        patch("app.services.sms_service.send_otp_sms", new=AsyncMock()),
        patch("app.services.sms_service.send_bid_received_sms", new=AsyncMock()),
        patch("app.services.notification_service.notify_all_admins", new=AsyncMock()),
        # Plate check background task uses a separate DB engine (AsyncSessionLocal) which
        # creates connections attached to a different event-loop context in tests, causing
        # "another operation is in progress" errors on the asyncpg pool. Mock it out.
        patch(
            "app.routers.trucks._run_plate_check",
            new=AsyncMock(return_value=None),
        ),
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
    # Use a unique suffix so that committed users from one test don't collide
    # with the same fixture called by a later test (auth_service commits explicitly).
    uid = suffix or _uuid.uuid4().hex[:8]
    return {
        "email": f"test_{role}_{uid}@example.com",
        "phone": f"+2547{abs(hash(role + uid)) % 100000000:08d}",
        "full_name": f"Test {role.title()} {uid}",
        "password": VALID_PASSWORD,
        "role": role,
        "country": "KE",
    }


async def _register_and_login(client: AsyncClient, role: str, suffix: str = "") -> dict:
    payload = _user_payload(role, suffix)
    reg = await client.post("/auth/register", json=payload)
    assert reg.status_code == 201, reg.text
    # Register now returns OTPRequiredResponse — use login to get a token.
    # login_user auto-verifies unverified users so this works without OTP.
    login = await client.post("/auth/login", json={
        "email": payload["email"],
        "password": payload["password"],
    })
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


_ONBOARDING_FEE_KES: dict[str, int] = {
    "motorcycle_courier": 500, "cargo_bike": 500, "van": 750, "pickup": 1_000,
    "dry_van": 1_500, "tipper": 2_000, "flatbed": 2_000, "reefer": 3_000,
    "tanker": 3_000, "lowbed": 5_000,
}


async def seed_onboarding_fee(client, db, headers, truck_type: str = "flatbed") -> None:
    """Seed a paid OnboardingFeeRecord so POST /trucks succeeds for fleet owners."""
    from app.models.onboarding_fee import OnboardingFeeRecord, OnboardingFeeStatus

    me = await client.get("/users/me", headers=headers)
    owner_id = _uuid.UUID(me.json()["id"])
    db.add(OnboardingFeeRecord(
        owner_id=owner_id,
        truck_type=truck_type,
        amount_kes=_ONBOARDING_FEE_KES.get(truck_type, 2_000),
        status=OnboardingFeeStatus.paid,
        tx_ref=f"test-fee-{_uuid.uuid4()}",
        paid_at=datetime.datetime.now(datetime.timezone.utc),
    ))
    await db.commit()


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
