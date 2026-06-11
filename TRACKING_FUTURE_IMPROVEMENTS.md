# Trakvora Tracking — Future Improvements Roadmap

This document captures architectural improvements and feature enhancements that are intentionally out of scope for the current MVP implementation but should be planned for before production scale.

Grouped by priority phase.

---

## Phase 2 — Operational Hardening
*Do these before fleet exceeds ~20 active trucks or before production launch.*

### 2.1 Redis Pub/Sub for WebSocket Scaling

**Problem:** `broadcast_location()` uses an in-memory dict. With multiple Uvicorn workers, a GPS ping hitting worker A won't reach WebSocket clients connected to worker B. Tracking appears to freeze for some users under load.

**Solution:**
```
Tracker/API
   ↓
Redis PubSub channel: "tracking:{shipment_id}"
   ↓
All WebSocket Workers subscribe → broadcast to their connected clients
```

**Implementation:**
- Replace `_TRACKING_CONNECTIONS` dict with Redis pub/sub via `aioredis`
- Each worker subscribes to relevant channels on WebSocket connect
- Ping endpoint publishes to Redis instead of broadcasting directly
- Estimated effort: 1–2 days

**Dependency:** `aioredis` (Redis is already in `requirements.txt`)

---

### 2.2 Offline Sync for Mobile App

**Problem:** African routes (Uganda border, rural Kenya, Tanzania corridors) have frequent connectivity dead zones. When the driver loses connection, GPS points are lost entirely — gaps appear in the trail.

**Solution:** Queue unsent location updates in the browser using `IndexedDB` (via `idb` or `localforage`). Sync the queue automatically when connectivity returns.

**Implementation:**
```js
// On location update attempt:
if (navigator.onLine) {
  await driverApi.updateLocation(id, payload);
} else {
  await locationQueue.push(payload);  // persist to IndexedDB
}

// On reconnect (window "online" event):
const pending = await locationQueue.drain();
for (const point of pending) {
  await driverApi.updateLocation(id, { ...point, recorded_at: point.timestamp });
}
```

Backend: `LocationUpdate` schema already has `recorded_at` (device time) — honor it when provided so reconstructed trails are accurate.

**Estimated effort:** 2–3 days

---

### 2.3 Telemetry Anomaly Detection

**Problem:** Raw GPS data is noisy. Trucks will occasionally appear to teleport (GPS multipath), spike to impossible speeds, or show sudden coordinate jumps.

**Checks to add server-side on every ping:**
- Speed > 180 km/h → reject or flag as `anomaly=true`
- Coordinate jump > 50 km in < 60 seconds → flag
- No ping for > 15 minutes on an active shipment → trigger alert
- Tracker suddenly changes position while shipment is `delivered` → flag

**Data model:** Add `anomaly: bool = False` and `anomaly_reason: str | None` to `TrackingPoint`.

**Alerting:** When anomaly detected, create a `Notification` for `operations_admin` role users.

**Estimated effort:** 2 days

---

### 2.4 Tracker Secret Rotation

**Problem:** `tracker_secret` is currently permanent. Compromised devices or technician errors have no recovery path without manual DB edits.

**Add to Truck model:**
```python
tracker_secret_rotated_at: Mapped[datetime | None]
tracker_revoked_at: Mapped[datetime | None]
```

**Add admin endpoint:** `POST /admin/trucks/{truck_id}/rotate-secret`
- Generates a new secret, invalidates old one immediately
- Returns new secret once (same pattern as initial provisioning)

**Add admin endpoint:** `POST /admin/trucks/{truck_id}/revoke-tracker`
- Sets `tracker_revoked_at = now`
- Ping endpoint checks `revoked_at` — if set, returns 403

**Estimated effort:** 1 day

---

### 2.5 Audit Logging for Tracking Events

**Problem:** Trakvora handles escrow payments tied to shipment status. Location data can be used as evidence in disputes. Without an audit trail, it's impossible to reconstruct what happened.

**Create `TrackingAuditLog` table:**
```python
class TrackingAuditLog(Base):
    __tablename__ = "tracking_audit_logs"
    truck_id:        UUID FK
    shipment_id:     UUID FK (nullable)
    event_type:      Enum  # tracker_assigned, secret_generated, secret_rotated, revoked, anomaly_detected, manual_override
    performed_by:    UUID FK → users.id (nullable for device events)
    ip_address:      str
    details:         JSON
    occurred_at:     DateTime(timezone=True)
```

**Log these events:**
- Tracker secret generated / rotated / revoked
- Manual coordinate override by admin
- Anomaly detection trigger
- Tracker assignment to truck

**Estimated effort:** 1 day

---

## Phase 3 — Fleet Intelligence
*Do these when the platform has paying shippers who need more than basic tracking.*

### 3.1 Geofencing

**Problem:** Ops teams need to know when trucks arrive at warehouses, cross borders, or enter restricted zones — without manually watching the map.

**Tables needed:**
```python
class Geofence(Base):
    __tablename__ = "geofences"
    name:         str
    type:         Enum  # warehouse, border, depot, restricted_zone, customer_site
    center_lat:   float
    center_lng:   float
    radius_m:     float   # simple circular geofence
    created_by:   UUID FK → users.id

class GeofenceEvent(Base):
    __tablename__ = "geofence_events"
    geofence_id:  UUID FK
    truck_id:     UUID FK
    shipment_id:  UUID FK (nullable)
    event:        Enum  # entered, exited
    occurred_at:  DateTime
```

**Check on every ping:** distance from point to all active geofences → if crossed boundary, insert `GeofenceEvent` + create `Notification`.

**Auto-status transitions:** When truck enters a warehouse geofence while shipment is `in_transit` → auto-advance to `delivered` (with confirmation required from shipper).

**Estimated effort:** 3–4 days

---

### 3.2 Route Deviation Detection

**Problem:** Trucks taking unauthorized detours — fuel theft, cargo diversion, border smuggling — are impossible to detect without route comparison.

**Approach:**
1. At shipment booking, calculate expected route using OSRM (open-source, self-hostable) or GraphHopper
2. Store route as a polyline (encoded string) on the `Shipment`
3. On each ping, check if the truck is within a corridor tolerance (e.g., 5 km from route)
4. If outside corridor for > 10 minutes, set `off_route=True`, `off_route_since`, `off_route_distance_km`
5. Create alert notification for ops team

**New fields on `Shipment`:**
```python
planned_route:        str | None   # encoded polyline
off_route:            bool = False
off_route_since:      datetime | None
off_route_distance_km: float | None
```

**Routing engine:** OSRM can be self-hosted on a $20/month VPS. Avoid Google Directions API to prevent billing.

**Estimated effort:** 4–5 days

---

### 3.3 ETA Prediction

**Problem:** Current ETA is manually entered by the driver. It's often wrong and never updated.

**Approach:**
1. Use current speed + remaining distance (haversine from current position to dropoff) to estimate arrival
2. Factor in historical average speeds per corridor (Mombasa–Nairobi, Nairobi–Kampala, etc.)
3. Recalculate automatically on every GPS ping
4. Push updated ETA to shipper via WebSocket

**Implementation:** Add `_recalculate_eta(shipment, tracking_point)` call in the ping endpoint after saving the TrackingPoint. Update `shipment.eta` if the new estimate differs by > 30 minutes.

**Estimated effort:** 2 days

---

### 3.4 Driver Scoring

**Problem:** No visibility into driving behaviour — speeding, harsh braking, long idle times.

**Score components:**
- Average speed vs speed limit
- Frequency of speeds > 120 km/h
- Excessive idle time (speed = 0 for > 30 min while job active)
- Night driving (22:00–05:00)
- Route adherence score

**Store score on `Driver`:**
```python
safety_score:        float | None  # 0–100
last_scored_at:      datetime | None
```

**Owner dashboard:** Show scores for their fleet. Shippers can filter available trucks by driver score.

**Estimated effort:** 3 days

---

### 3.5 Trail Playback UI

**Problem:** When incidents happen (dispute, accident, theft), ops teams need to replay exactly where a truck was at any point in time.

**Frontend feature: Replay Mode**
- Time slider below the map (from `shipment.created_at` to `shipment.delivered_at`)
- Scrubbing the slider moves the truck marker along the stored trail
- Play button animates the replay at configurable speed (1x, 5x, 10x)
- Show speed and heading at each point during replay

**Implement in:** `ShipperLoadTrackingPage.jsx` and a new `AdminShipmentReplayPage.jsx`

**Requires:** `GET /tracking/{shipment_id}/trail?from=&to=` (already planned) — just needs the UI

**Estimated effort:** 2–3 days

---

### 3.6 Marker Clustering (Admin Fleet Map)

Already partially addressed with `react-leaflet-cluster` in the MVP plan. Future improvements:
- Color-code clusters: green (all healthy) → amber (some stale trackers) → red (anomalies present)
- Show cluster count as a badge
- Clicking cluster zooms/spiders to show individual trucks

**Estimated effort:** 1 day on top of base clustering

---

## Phase 4 — Geospatial Scaling (PostGIS Migration)

**Problem:** As the fleet grows and route analytics become important, `FLOAT` coordinates become a bottleneck for spatial queries (nearest truck, trucks within polygon, geofence checks).

**Solution: Migrate to PostGIS**

```sql
-- After installing PostGIS extension:
ALTER TABLE tracking_points ADD COLUMN geom GEOGRAPHY(Point, 4326);
UPDATE tracking_points SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326);
CREATE INDEX ix_tracking_points_geom ON tracking_points USING GIST (geom);
```

**Enables:**
```sql
-- Nearest truck to a location:
SELECT * FROM trucks ORDER BY geom <-> ST_MakePoint(36.82, -1.29) LIMIT 1;

-- Trucks within 50km of Nairobi:
SELECT * FROM trucks WHERE ST_DWithin(geom, ST_MakePoint(36.82, -1.29)::geography, 50000);

-- Points within a geofence polygon:
SELECT * FROM tracking_points WHERE ST_Within(geom, ST_GeomFromGeoJSON(:polygon));
```

**Migration path:**
1. Install `geoalchemy2` Python package
2. Enable PostGIS extension on the database
3. Add `geom` columns alongside existing `latitude/longitude` floats
4. Populate via migration: `ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)`
5. Update queries to use spatial functions
6. Keep float columns as fallback until fully migrated

**Estimated effort:** 3–4 days

---

## Phase 4 — Message Queue for Telemetry Ingestion

**Problem:** At high fleet scale (200+ trucks, 6-second pings), the tracking API receives ~2,000 requests/minute peak. Direct DB writes on every request block the API worker pool.

**Solution:**
```
IoT Devices
    ↓
Ingress API (accepts ping, validates auth, returns 200 immediately)
    ↓
Redis Streams / RabbitMQ
    ↓
Consumer Workers (DB writes, broadcast, anomaly checks)
```

**Benefits:**
- API workers return fast — IoT devices aren't blocked
- Consumer workers can be scaled independently
- Burst telemetry is absorbed by the queue
- Consumer failures don't lose data (queue persists)

**Technology:** Redis Streams (already have Redis). `aioredis` supports streams natively.

**Estimated effort:** 4–5 days

---

## Phase 4 — Data Compression (Trail Optimization)

**Problem:** Displaying 5,000-point trails is slow to render in the browser and wastes bandwidth.

**Solution: Douglas-Peucker polyline simplification**

Apply before returning trail data:
```python
from rdp import rdp  # pip install rdp

points = [(p.latitude, p.longitude) for p in trail]
simplified = rdp(points, epsilon=0.0001)  # ~11m tolerance at equator
```

**Result:** A 5,000-point long-haul trail reduces to ~200–500 points with imperceptible visual difference.

**Apply in:** `GET /tracking/{shipment_id}/trail` — simplify before serializing.

**Add query param:** `?simplified=true` (default false) so the raw data is available for analytics while the frontend uses simplified for rendering.

**Estimated effort:** 0.5 days

---

## Phase 5 — Enterprise Telematics (Long-Term)

These are multi-month initiatives relevant once Trakvora serves enterprise customers.

| Feature | Description | Dependency |
|---------|-------------|------------|
| **CAN Bus Integration** | Engine RPM, fuel level, odometer via OBD-II/CAN bus from truck ECU | Partner with telematics hardware vendor |
| **Temperature Telemetry** | Reefer truck temperature monitoring (cold chain) | Sensors + protocol support |
| **Tire Pressure Monitoring** | TPMS integration for blowout prevention | TPMS-capable GPS hardware |
| **Dashcam Integration** | AI-flagged incident video clips linked to TrackingPoints | Cloud video storage + CV pipeline |
| **Drone/Air Support** | Altitude-aware tracking for future air cargo (altitude field already in schema) | Regulatory approval |
| **Heatmaps** | Historical traffic density per corridor for route planning | PostGIS + data volume |

---

## Quick Reference: What to Build When

| When | Build |
|------|-------|
| Before 20 trucks | Redis pub/sub WebSocket scaling |
| Before launch | Offline sync, anomaly detection, audit logging |
| After 50 trucks | Geofencing, ETA prediction, route deviation |
| After 100 trucks | PostGIS migration, message queue, driver scoring |
| Enterprise | CAN bus, temperature, dashcam |

---

*Last updated: 2026-05-08*
*See implementation plan: `.claude/plans/focus-on-tracking-1-lazy-meadow.md`*
