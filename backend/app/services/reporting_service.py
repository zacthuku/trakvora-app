"""
Reporting service — trip reports, fleet analytics, CSV/JSON export.

Endpoints that use this service:
  GET /reports/trip/{shipment_id}      → per-trip report
  GET /reports/fleet                   → owner fleet summary
  GET /reports/analytics               → admin/business analytics
  GET /reports/shipments.csv           → bulk CSV export
"""
from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.load import Load, LoadStatus
from app.models.shipment import Shipment
from app.models.tracking_point import TrackingPoint
from app.models.wallet import Transaction, TransactionType


async def generate_trip_report(shipment_id: str, db: AsyncSession) -> dict:
    """
    Per-shipment trip report: timeline, distance covered, dwell times, on-time status.
    """
    from app.models.truck import Truck
    from app.models.driver import Driver

    shipment = await db.get(Shipment, shipment_id)
    if not shipment:
        return {}

    load = await db.get(Load, shipment.load_id)

    # Tracking trail
    trail_result = await db.execute(
        select(TrackingPoint)
        .where(TrackingPoint.shipment_id == shipment.id)
        .order_by(TrackingPoint.recorded_at)
    )
    trail = trail_result.scalars().all()

    # Distance covered (sum of sequential haversine distances)
    distance_covered_km = _trail_distance_km(trail)

    # Duration
    start_time = trail[0].recorded_at if trail else None
    end_time = trail[-1].recorded_at if trail else None
    duration_minutes = None
    if start_time and end_time:
        duration_minutes = int((end_time - start_time).total_seconds() / 60)

    # On-time: compare delivered_at vs load delivery_date
    on_time = None
    if shipment.delivered_at and load and load.delivery_date:
        try:
            planned = datetime.fromisoformat(load.delivery_date).replace(tzinfo=timezone.utc)
            on_time = shipment.delivered_at <= planned
        except ValueError:
            pass

    return {
        "shipment_id": str(shipment.id),
        "load_id": str(shipment.load_id),
        "status": shipment.status,
        "pickup_location": load.pickup_location if load else None,
        "dropoff_location": load.dropoff_location if load else None,
        "planned_distance_km": float(load.distance_km or 0) if load else 0,
        "actual_distance_km": round(distance_covered_km, 2),
        "tracking_points": len(trail),
        "trip_start": start_time.isoformat() if start_time else None,
        "trip_end": end_time.isoformat() if end_time else None,
        "duration_minutes": duration_minutes,
        "delivered_at": shipment.delivered_at.isoformat() if shipment.delivered_at else None,
        "on_time": on_time,
        "dispute_open": shipment.dispute_open,
        "escrow_released": shipment.escrow_released,
    }


async def generate_fleet_report(owner_user_id: str, db: AsyncSession) -> dict:
    """Fleet owner summary: revenue, utilisation, completed vs cancelled."""
    from app.models.truck import Truck

    trucks_result = await db.execute(
        select(func.count(Truck.id)).where(Truck.owner_id == owner_user_id)
    )
    total_trucks = trucks_result.scalar() or 0

    shipments_result = await db.execute(
        select(Shipment).where(Shipment.owner_id == owner_user_id)
    )
    shipments = shipments_result.scalars().all()
    completed = [s for s in shipments if s.status == "delivered"]
    in_progress = [s for s in shipments if s.status in ("booked", "en_route_pickup", "loaded", "in_transit")]

    # Revenue from completed payout transactions
    revenue_result = await db.execute(
        select(func.sum(Transaction.amount_kes))
        .join(Shipment, Shipment.id == Transaction.shipment_id)
        .where(
            Shipment.owner_id == owner_user_id,
            Transaction.transaction_type == TransactionType.payout,
        )
    )
    total_revenue_kes = float(revenue_result.scalar() or 0)

    return {
        "owner_user_id": str(owner_user_id),
        "total_trucks": total_trucks,
        "total_shipments": len(shipments),
        "completed_shipments": len(completed),
        "in_progress_shipments": len(in_progress),
        "total_revenue_kes": total_revenue_kes,
        "completion_rate": round(len(completed) / len(shipments), 3) if shipments else 0,
    }


async def generate_platform_analytics(db: AsyncSession, days: int = 30) -> dict:
    """Admin-level platform analytics for the last N days."""
    from datetime import timedelta

    since = datetime.now(timezone.utc) - timedelta(days=days)

    loads_result = await db.execute(
        select(func.count(Load.id)).where(Load.created_at >= since)
    )
    shipments_result = await db.execute(
        select(func.count(Shipment.id)).where(Shipment.created_at >= since)
    )
    completed_result = await db.execute(
        select(func.count(Shipment.id)).where(
            Shipment.created_at >= since,
            Shipment.status == "delivered",
        )
    )
    revenue_result = await db.execute(
        select(func.sum(Transaction.amount_kes)).where(
            Transaction.created_at >= since,
            Transaction.transaction_type == TransactionType.platform_fee,
        )
    )

    return {
        "period_days": days,
        "loads_posted": loads_result.scalar() or 0,
        "shipments_created": shipments_result.scalar() or 0,
        "shipments_completed": completed_result.scalar() or 0,
        "platform_revenue_kes": float(revenue_result.scalar() or 0),
    }


async def generate_advanced_company_analytics(company_id: str, db: AsyncSession, days: int = 90) -> dict:
    """
    Advanced analytics for company dashboard: trends, OTIF, utilization, revenue by corridor.
    Returns data suitable for charts and KPI displays.
    """
    from datetime import timedelta
    from app.models.company import Company, CompanyMember
    from app.models.truck import Truck

    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Get company members
    member_ids_result = await db.execute(
        select(CompanyMember.user_id).where(
            CompanyMember.company_id == company_id,
            CompanyMember.is_active == True,
        )
    )
    member_ids = [r[0] for r in member_ids_result.all()]

    if not member_ids:
        return {"error": "No active company members found"}

    # Basic metrics
    loads_result = await db.execute(
        select(
            func.count(Load.id).label("total_loads"),
            func.sum(Load.price_kes).label("total_spend_kes"),
        ).where(Load.shipper_id.in_(member_ids), Load.created_at >= since)
    )
    loads_row = loads_result.one()

    # Shipments and completion
    shipments_result = await db.execute(
        select(Shipment).where(
            Shipment.owner_id.in_(member_ids),
            Shipment.created_at >= since
        )
    )
    shipments = shipments_result.scalars().all()

    completed_shipments = [s for s in shipments if s.status == "delivered"]
    on_time_deliveries = []

    # Batch-load all loads for completed shipments in one query
    loads_map: dict = {}
    completed_load_ids = list({s.load_id for s in completed_shipments})
    if completed_load_ids:
        loads_batch = await db.execute(select(Load).where(Load.id.in_(completed_load_ids)))
        loads_map = {l.id: l for l in loads_batch.scalars().all()}

    for shipment in completed_shipments:
        load = loads_map.get(shipment.load_id)
        if load and load.delivery_date and shipment.delivered_at:
            try:
                planned = datetime.fromisoformat(load.delivery_date).replace(tzinfo=timezone.utc)
                if shipment.delivered_at <= planned:
                    on_time_deliveries.append(shipment)
            except ValueError:
                pass

    # Revenue by corridor (pickup->dropoff combinations)
    corridor_revenue = {}
    for shipment in completed_shipments:
        load = loads_map.get(shipment.load_id)
        if load and load.pickup_location and load.dropoff_location:
            corridor = f"{load.pickup_location} → {load.dropoff_location}"
            corridor_revenue[corridor] = corridor_revenue.get(corridor, 0) + (load.price_kes or 0)

    # Fleet utilization (if company owns trucks)
    trucks_result = await db.execute(
        select(func.count(Truck.id)).where(Truck.owner_id.in_(member_ids))
    )
    fleet_size = trucks_result.scalar() or 0

    # Monthly trends (last 6 months)
    monthly_data = []
    for i in range(5, -1, -1):
        month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0) - timedelta(days=30*i)
        month_end = month_start + timedelta(days=30)

        month_loads = await db.execute(
            select(func.count(Load.id)).where(
                Load.shipper_id.in_(member_ids),
                Load.created_at >= month_start,
                Load.created_at < month_end
            )
        )
        month_spend = await db.execute(
            select(func.sum(Load.price_kes)).where(
                Load.shipper_id.in_(member_ids),
                Load.created_at >= month_start,
                Load.created_at < month_end
            )
        )

        monthly_data.append({
            "month": month_start.strftime("%Y-%m"),
            "loads": month_loads.scalar() or 0,
            "spend_kes": float(month_spend.scalar() or 0)
        })

    return {
        "period_days": days,
        "company_id": company_id,
        "basic_metrics": {
            "total_loads": loads_row.total_loads or 0,
            "total_spend_kes": float(loads_row.total_spend_kes or 0),
            "member_count": len(member_ids),
        },
        "performance": {
            "total_shipments": len(shipments),
            "completed_shipments": len(completed_shipments),
            "completion_rate": round(len(completed_shipments) / len(shipments), 3) if shipments else 0,
            "otif_rate": round(len(on_time_deliveries) / len(completed_shipments), 3) if completed_shipments else 0,
        },
        "fleet": {
            "fleet_size": fleet_size,
            "utilization_rate": round(len(completed_shipments) / (fleet_size * (days/30)), 3) if fleet_size else 0,
        },
        "corridor_revenue": dict(sorted(corridor_revenue.items(), key=lambda x: x[1], reverse=True)[:10]),
        "monthly_trends": monthly_data,
    }


async def generate_operational_alerts(db: AsyncSession, days: int = 7) -> dict:
    """
    Operational alerts for admin dashboard: late loads, SLA breaches, high-risk trips.
    """
    from datetime import timedelta

    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Late loads (past delivery date but not delivered)
    late_loads_result = await db.execute(
        select(Load, Shipment).join(Shipment, Load.id == Shipment.load_id).where(
            Load.delivery_date < datetime.now(timezone.utc).date().isoformat(),
            Shipment.status != "delivered",
            Load.created_at >= since
        )
    )
    late_loads = []
    for load, shipment in late_loads_result.all():
        days_late = (datetime.now(timezone.utc).date() - datetime.fromisoformat(load.delivery_date).date()).days
        late_loads.append({
            "load_id": str(load.id),
            "shipment_id": str(shipment.id),
            "pickup": load.pickup_location,
            "dropoff": load.dropoff_location,
            "delivery_date": load.delivery_date,
            "days_late": days_late,
            "status": shipment.status,
        })

    # High-risk trips (long distance, high value, or disputed)
    high_risk_result = await db.execute(
        select(Load, Shipment).join(Shipment, Load.id == Shipment.load_id).where(
            Shipment.status.in_(["loaded", "in_transit"]),
            (Load.distance_km > 1000) | (Load.price_kes > 50000) | (Shipment.dispute_open == True)
        )
    )
    high_risk_trips = []
    for load, shipment in high_risk_result.all():
        risk_factors = []
        if load.distance_km and load.distance_km > 1000:
            risk_factors.append("long_distance")
        if load.price_kes and load.price_kes > 50000:
            risk_factors.append("high_value")
        if shipment.dispute_open:
            risk_factors.append("disputed")

        high_risk_trips.append({
            "load_id": str(load.id),
            "shipment_id": str(shipment.id),
            "pickup": load.pickup_location,
            "dropoff": load.dropoff_location,
            "distance_km": float(load.distance_km or 0),
            "value_kes": float(load.price_kes or 0),
            "risk_factors": risk_factors,
        })

    # Exception summary
    total_shipments = await db.execute(
        select(func.count(Shipment.id)).where(Shipment.created_at >= since)
    )
    disputed_shipments = await db.execute(
        select(func.count(Shipment.id)).where(
            Shipment.created_at >= since,
            Shipment.dispute_open == True
        )
    )

    return {
        "period_days": days,
        "alerts": {
            "late_loads_count": len(late_loads),
            "late_loads": late_loads[:10],  # Top 10 most critical
            "high_risk_trips_count": len(high_risk_trips),
            "high_risk_trips": high_risk_trips[:10],
        },
        "exception_summary": {
            "total_shipments": total_shipments.scalar() or 0,
            "disputed_shipments": disputed_shipments.scalar() or 0,
            "dispute_rate": round((disputed_shipments.scalar() or 0) / (total_shipments.scalar() or 1), 3),
        }
    }


async def export_shipments_csv(owner_user_id: str | None, db: AsyncSession) -> str:
    """
    Export shipments to CSV string.
    If owner_user_id is provided, scoped to that owner. Otherwise all (admin).
    """
    query = select(Shipment)
    if owner_user_id:
        query = query.where(Shipment.owner_id == owner_user_id)
    query = query.order_by(Shipment.created_at.desc())

    result = await db.execute(query)
    shipments = result.scalars().all()

    load_ids = [str(s.load_id) for s in shipments]
    loads_map: dict[str, Load] = {}
    if load_ids:
        loads_result = await db.execute(select(Load).where(Load.id.in_(load_ids)))
        for load in loads_result.scalars().all():
            loads_map[str(load.id)] = load

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "shipment_id", "load_id", "status", "pickup_location", "dropoff_location",
        "price_kes", "distance_km", "created_at", "delivered_at", "escrow_released",
    ])
    for s in shipments:
        load = loads_map.get(str(s.load_id))
        writer.writerow([
            str(s.id),
            str(s.load_id),
            s.status,
            load.pickup_location if load else "",
            load.dropoff_location if load else "",
            float(load.price_kes) if load else "",
            float(load.distance_km or 0) if load else "",
            s.created_at.isoformat() if s.created_at else "",
            s.delivered_at.isoformat() if s.delivered_at else "",
            s.escrow_released,
        ])

    return output.getvalue()


# ── Internal helpers ─────────────────────────────────────────────────────────

def _trail_distance_km(trail: list) -> float:
    import math

    def hav(lat1, lon1, lat2, lon2):
        R = 6371.0
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlam = math.radians(lon2 - lon1)
        a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    total = 0.0
    for i in range(1, len(trail)):
        total += hav(
            trail[i - 1].latitude, trail[i - 1].longitude,
            trail[i].latitude, trail[i].longitude,
        )
    return total
