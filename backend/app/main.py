import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import AsyncSessionLocal, engine
from app.routers import (
    admin, airfreight, auth, bids, compliance, companies, demo, drivers, etims, field_ops, health, inbox,
    inspections, iot, loads, move_requests, notifications, parcels, payments, provider_profile, reports,
    return_windows, shipments, stats, subscriptions, support, tracking, tracking_rest, trucks,
    uploads, users, webhooks, workforce,
)
from app.routers import settings as settings_router

# /app/static in Docker; fall back to the local backend/static directory
STATIC_DIR = Path(os.getenv("STATIC_DIR", "/app/static"))
if not STATIC_DIR.exists():
    STATIC_DIR = Path(__file__).parent.parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    (STATIC_DIR / "uploads" / "photos").mkdir(parents=True, exist_ok=True)
    (STATIC_DIR / "uploads" / "docs").mkdir(parents=True, exist_ok=True)
    try:
        from app.core import scheduler as escrow_scheduler
        escrow_scheduler.start(AsyncSessionLocal)
        _scheduler = escrow_scheduler
    except ImportError:
        _scheduler = None
    yield
    if _scheduler:
        _scheduler.stop()
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
