import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.core.exceptions import InsufficientFunds
from app.database import AsyncSessionLocal, engine
from app.routers import (
    admin, airfreight, auth, bids, commissions, compliance, companies, demo, drivers, etims, feedback, field_ops,
    health, inbox, inspections, invitations, iot, loads, move_requests, notifications, parcels, payments,
    provider_profile, reports, return_windows, scheduled_reports, shipments, stats, subscriptions, support,
    tracking, tracking_rest, trucks, uploads, users, webhooks, workforce,
)
from app.routers import settings as settings_router

# Docker sets STATIC_DIR=/app/static; Windows sets it to C:\Trakvora\backend\static.
# Falls back to a sibling ./static directory when the env var is not set.
# NOTE: Path("") resolves to PosixPath('.') which always exists, so we must
# check the raw string — not the Path object — before creating the Path.
_static_env = os.getenv("STATIC_DIR", "").strip()
STATIC_DIR = Path(_static_env) if _static_env else Path(__file__).parent.parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    (STATIC_DIR / "uploads" / "photos").mkdir(parents=True, exist_ok=True)
    (STATIC_DIR / "uploads" / "docs").mkdir(parents=True, exist_ok=True)
    (STATIC_DIR / "uploads" / "videos").mkdir(parents=True, exist_ok=True)

    # ── Redis connection ──────────────────────────────────────────────────────
    _redis = None
    try:
        from app.core.redis_client import close_redis, get_redis
        _redis = await get_redis()
        await _redis.ping()
    except Exception as exc:  # noqa: BLE001
        import logging
        logging.getLogger(__name__).warning("Redis unavailable at startup: %s — caching disabled", exc)
        _redis = None

    # ── APScheduler ──────────────────────────────────────────────────────────
    try:
        from app.core import scheduler as escrow_scheduler
        escrow_scheduler.start(AsyncSessionLocal)
        _scheduler = escrow_scheduler
    except ImportError:
        _scheduler = None

    yield

    if _scheduler:
        _scheduler.stop()
    if _redis:
        from app.core.redis_client import close_redis
        await close_redis()
    await engine.dispose()


app = FastAPI(
    title="trakvora API",
    description="Real-time freight exchange for East Africa",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(InsufficientFunds)
async def insufficient_funds_handler(request: Request, exc: InsufficientFunds):
    return JSONResponse(status_code=402, content={"detail": "Insufficient wallet balance"})

app.mount("/static", StaticFiles(directory=str(STATIC_DIR), html=False), name="static")

app.include_router(health.router, tags=["health"])
app.include_router(settings_router.router)
app.include_router(uploads.router, tags=["uploads"])
app.include_router(admin.router, tags=["admin"])
app.include_router(field_ops.router)
app.include_router(iot.router)
app.include_router(inspections.router)
app.include_router(compliance.router)
app.include_router(workforce.router)
app.include_router(stats.router, tags=["stats"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(loads.router, prefix="/loads", tags=["loads"])
app.include_router(bids.router, prefix="/bids", tags=["bids"])
app.include_router(shipments.router, prefix="/shipments", tags=["shipments"])
app.include_router(trucks.router, prefix="/trucks", tags=["trucks"])
app.include_router(drivers.router, prefix="/drivers", tags=["drivers"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(inbox.router, prefix="/inbox", tags=["inbox"])
app.include_router(tracking.router, prefix="/ws", tags=["tracking"])
app.include_router(tracking_rest.router, prefix="/tracking", tags=["tracking"])
app.include_router(payments.router, prefix="/payments", tags=["payments"])
app.include_router(commissions.router)
app.include_router(etims.router)
app.include_router(companies.router)
app.include_router(reports.router)
app.include_router(subscriptions.router)
app.include_router(webhooks.router)
app.include_router(support.router)
app.include_router(demo.router)
app.include_router(parcels.router)
app.include_router(move_requests.router)
app.include_router(airfreight.router)
app.include_router(return_windows.router)
app.include_router(provider_profile.router)
app.include_router(invitations.router)
app.include_router(scheduled_reports.router)
app.include_router(feedback.router)
