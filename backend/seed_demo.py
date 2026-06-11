"""
Trakvora demo seed — fixed accounts for route-map / job-flow QA.

Creates 4 users, 2 trucks, 2 in-progress shipments (en_route_pickup).
Safe to re-run: only the 4 demo accounts are wiped and re-created.
All other seed data (admin, main seed users) is left untouched.

Run:
    docker compose exec backend python seed_demo.py

All demo accounts: Test1234!
"""
import asyncio
import os
import uuid
from datetime import date

import asyncpg
import bcrypt

# ── Connection ───────────────────────────────────────────────────────────────
DSN = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://trakvora:trakvora@db:5432/trakvora",
).replace("postgresql+asyncpg://", "postgresql://")

# ── Fixed UUIDs (deterministic — script is idempotent) ───────────────────────
SHIPPER_ID        = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")
OWNER_ID          = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000002")
DRIVER_SOLO_ID    = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000003")  # self-employed
DRIVER_FLEET_ID   = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000004")  # employed by owner

DRIVER_SOLO_PROF  = uuid.UUID("bbbbbbbb-0000-0000-0000-000000000001")  # drivers table row
DRIVER_FLEET_PROF = uuid.UUID("bbbbbbbb-0000-0000-0000-000000000002")

TRUCK_SOLO_ID     = uuid.UUID("cccccccc-0000-0000-0000-000000000001")  # solo driver's own truck
TRUCK_FLEET_ID    = uuid.UUID("cccccccc-0000-0000-0000-000000000002")  # fleet owner's truck

LOAD_1_ID         = uuid.UUID("dddddddd-0000-0000-0000-000000000001")  # Juja → Kinoo
LOAD_2_ID         = uuid.UUID("dddddddd-0000-0000-0000-000000000002")  # Nairobi → Narok

SHIPMENT_1_ID     = uuid.UUID("eeeeeeee-0000-0000-0000-000000000001")
SHIPMENT_2_ID     = uuid.UUID("eeeeeeee-0000-0000-0000-000000000002")

DEMO_USER_IDS     = [SHIPPER_ID, OWNER_ID, DRIVER_SOLO_ID, DRIVER_FLEET_ID]
DEMO_LOAD_IDS     = [LOAD_1_ID, LOAD_2_ID]
DEMO_SHIPMENT_IDS = [SHIPMENT_1_ID, SHIPMENT_2_ID]

# ── Credentials ───────────────────────────────────────────────────────────────
DEMO_PW = bcrypt.hashpw(b"Test1234!", bcrypt.gensalt()).decode()

# ── Tracker credentials (for POST /device/ping) ───────────────────────────────
TRACKER_SOLO_ID      = "DEV-SOLO-001"
TRACKER_SOLO_SECRET  = "demo-secret-solo-001"
TRACKER_FLEET_ID     = "DEV-FLEET-001"
TRACKER_FLEET_SECRET = "demo-secret-fleet-001"


# ── Step 1: selective wipe ────────────────────────────────────────────────────
async def wipe(conn: asyncpg.Connection) -> None:
    print("\n── Wiping demo accounts ──")

    # Break circular FKs before any deletes
    await conn.execute(
        "UPDATE trucks  SET assigned_driver_id = NULL WHERE owner_id = ANY($1)",
        DEMO_USER_IDS,
    )
    await conn.execute(
        "UPDATE drivers SET current_truck_id = NULL, employer_id = NULL WHERE user_id = ANY($1)",
        DEMO_USER_IDS,
    )

    DEMO_TRUCK_IDS = [TRUCK_SOLO_ID, TRUCK_FLEET_ID]

    # Optional tables — skip silently if they don't exist yet.
    # tracker_alerts has FKs on BOTH shipment_id AND truck_id, so delete both ways.
    for stmt in [
        ("DELETE FROM tracker_alerts  WHERE shipment_id = ANY($1)", DEMO_SHIPMENT_IDS),
        ("DELETE FROM tracker_alerts  WHERE truck_id    = ANY($1)", DEMO_TRUCK_IDS),
        ("DELETE FROM tracking_points WHERE shipment_id = ANY($1)", DEMO_SHIPMENT_IDS),
        ("DELETE FROM consignment_notes WHERE shipment_id = ANY($1)", DEMO_SHIPMENT_IDS),
    ]:
        try:
            await conn.execute(stmt[0], stmt[1])
        except Exception:
            pass

    await conn.execute(
        "DELETE FROM notifications WHERE user_id = ANY($1)", DEMO_USER_IDS
    )
    await conn.execute(
        """DELETE FROM transactions
           WHERE wallet_id IN (SELECT id FROM wallets WHERE user_id = ANY($1))""",
        DEMO_USER_IDS,
    )
    await conn.execute(
        "DELETE FROM shipments WHERE id = ANY($1)", DEMO_SHIPMENT_IDS
    )
    await conn.execute(
        "DELETE FROM bids WHERE load_id = ANY($1)", DEMO_LOAD_IDS
    )
    await conn.execute(
        "DELETE FROM loads WHERE id = ANY($1)", DEMO_LOAD_IDS
    )
    await conn.execute(
        "DELETE FROM wallets WHERE user_id = ANY($1)", DEMO_USER_IDS
    )
    await conn.execute(
        "DELETE FROM trucks WHERE owner_id = ANY($1)", DEMO_USER_IDS
    )
    await conn.execute(
        "DELETE FROM drivers WHERE user_id = ANY($1)", DEMO_USER_IDS
    )
    await conn.execute(
        "DELETE FROM users WHERE id = ANY($1)", DEMO_USER_IDS
    )
    print("  ✓ Demo accounts cleared")


# ── Step 2: users ─────────────────────────────────────────────────────────────
async def seed_users(conn: asyncpg.Connection) -> None:
    print("\n── Users ──")
    users = [
        (SHIPPER_ID,     "shipper@trakvora.dev",      "Alice Wanjiku",  "shipper", "Swift Cargo Ltd",       "+254711000001"),
        (OWNER_ID,       "owner@trakvora.dev",         "Brian Kamau",    "owner",   "Rift Fleet Transport",  "+254711000002"),
        (DRIVER_SOLO_ID, "driver.solo@trakvora.dev",   "Charles Otieno", "driver",  None,                    "+254711000003"),
        (DRIVER_FLEET_ID,"driver.fleet@trakvora.dev",  "David Mwangi",   "driver",  None,                    "+254711000004"),
    ]
    for uid, email, name, role, company, phone in users:
        await conn.execute(
            """INSERT INTO users
               (id, email, full_name, company_name, hashed_password, role,
                phone, is_active, is_verified, kyc_status,
                rating, total_trips, cancellation_count,
                created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6::userrole,
                       $7, true, true, 'approved'::kycstatus,
                       4.8, 12, 0, NOW(), NOW())""",
            uid, email, name, company, DEMO_PW, role, phone,
        )
        print(f"  ✓ [{role:7s}]  {email}")


# ── Step 3: driver profiles ───────────────────────────────────────────────────
async def seed_drivers(conn: asyncpg.Connection) -> None:
    print("\n── Driver profiles ──")
    expiry = "2027-12-31"
    drivers = [
        (DRIVER_SOLO_PROF,  DRIVER_SOLO_ID,  None,     "DL001001/2023"),
        (DRIVER_FLEET_PROF, DRIVER_FLEET_ID, OWNER_ID, "DL002002/2023"),
    ]
    for did, uid, employer_id, lic_num in drivers:
        await conn.execute(
            """INSERT INTO drivers
               (id, user_id, employer_id, licence_number, licence_class,
                licence_expiry, verification_status, ntsa_verified,
                availability_status, documents_submitted,
                experience_years, seeking_employment,
                created_at, updated_at)
               VALUES ($1,$2,$3,$4,'CE',$5,
                       'approved'::verificationstatus, true,
                       'on_job'::availabilitystatus, true,
                       5, false,
                       NOW(), NOW())""",
            did, uid, employer_id, lic_num, expiry,
        )
    print("  ✓ 2 driver profiles (NTSA verified, CE licence)")


# ── Step 4: trucks ────────────────────────────────────────────────────────────
async def seed_trucks(conn: asyncpg.Connection) -> None:
    print("\n── Trucks ──")

    # Solo driver's own truck
    await conn.execute(
        """INSERT INTO trucks
           (id, owner_id, registration_number, truck_type, capacity_tonnes,
            make, model, year, is_active, is_driver_owned, is_verified,
            assigned_driver_id, gps_tracker_id, tracker_secret,
            created_at, updated_at)
           VALUES ($1,$2,'KAA 001A','flatbed'::trucktype,8.0,
                   'Isuzu','FTR 900',2020,
                   true, true, true,
                   $3, $4, $5,
                   NOW(), NOW())""",
        TRUCK_SOLO_ID, DRIVER_SOLO_ID,
        DRIVER_SOLO_PROF, TRACKER_SOLO_ID, TRACKER_SOLO_SECRET,
    )
    print(f"  ✓ KAA 001A  (solo driver)   tracker={TRACKER_SOLO_ID}")

    # Fleet owner's truck assigned to employed driver
    await conn.execute(
        """INSERT INTO trucks
           (id, owner_id, registration_number, truck_type, capacity_tonnes,
            make, model, year, is_active, is_driver_owned, is_verified,
            assigned_driver_id, gps_tracker_id, tracker_secret,
            created_at, updated_at)
           VALUES ($1,$2,'KBB 002B','flatbed'::trucktype,30.0,
                   'Scania','R450',2021,
                   true, false, true,
                   $3, $4, $5,
                   NOW(), NOW())""",
        TRUCK_FLEET_ID, OWNER_ID,
        DRIVER_FLEET_PROF, TRACKER_FLEET_ID, TRACKER_FLEET_SECRET,
    )
    print(f"  ✓ KBB 002B  (fleet owner)   tracker={TRACKER_FLEET_ID}")

    # Sync Driver.current_truck_id now that trucks exist
    await conn.execute(
        "UPDATE drivers SET current_truck_id=$1 WHERE id=$2",
        TRUCK_SOLO_ID, DRIVER_SOLO_PROF,
    )
    await conn.execute(
        "UPDATE drivers SET current_truck_id=$1 WHERE id=$2",
        TRUCK_FLEET_ID, DRIVER_FLEET_PROF,
    )
    print("  ✓ current_truck_id synced on both driver profiles")


# ── Step 5: loads ─────────────────────────────────────────────────────────────
async def seed_loads(conn: asyncpg.Connection) -> None:
    print("\n── Loads ──")
    today = date.today().isoformat()

    # Job 1: Juja → Kinoo  (direct to self-employed driver)
    await conn.execute(
        """INSERT INTO loads
           (id, shipper_id,
            pickup_location,  pickup_latitude,  pickup_longitude,
            dropoff_location, dropoff_latitude, dropoff_longitude,
            corridor, cargo_type, weight_tonnes, cargo_description,
            price_kes, booking_mode, status, distance_km,
            pickup_date, direct_offer_user_id,
            created_at, updated_at)
           VALUES ($1,$2,
                   'Juja Town',   -1.1025,  37.0148,
                   'Kinoo, Kikuyu', -1.2503, 36.7157,
                   'Juja-Kinoo','general'::cargotype, 5.0,
                   'General cargo — electronics delivery',
                   75000.00, 'direct'::bookingmode,
                   'en_route_pickup'::loadstatus, 45.0,
                   $3, $4,
                   NOW(), NOW())""",
        LOAD_1_ID, SHIPPER_ID, today, DRIVER_SOLO_ID,
    )
    print("  ✓ Load 1  Juja → Kinoo          (direct to solo driver)")

    # Job 2: Nairobi → Narok  (direct to fleet owner, assigned to employed driver)
    await conn.execute(
        """INSERT INTO loads
           (id, shipper_id,
            pickup_location,   pickup_latitude,  pickup_longitude,
            dropoff_location,  dropoff_latitude, dropoff_longitude,
            corridor, cargo_type, weight_tonnes, cargo_description,
            price_kes, booking_mode, status, distance_km,
            pickup_date, direct_offer_user_id,
            created_at, updated_at)
           VALUES ($1,$2,
                   'Nairobi CBD', -1.2921, 36.8219,
                   'Narok Town',  -1.0928, 35.8716,
                   'Nairobi-Narok','general'::cargotype, 20.0,
                   'Agricultural produce — bulk transport',
                   75000.00, 'direct'::bookingmode,
                   'en_route_pickup'::loadstatus, 160.0,
                   $3, $4,
                   NOW(), NOW())""",
        LOAD_2_ID, SHIPPER_ID, today, OWNER_ID,
    )
    print("  ✓ Load 2  Nairobi → Narok       (fleet owner → employed driver)")


# ── Step 6: shipments ─────────────────────────────────────────────────────────
async def seed_shipments(conn: asyncpg.Connection) -> None:
    print("\n── Shipments ──")

    # Shipment 1: solo driver is both owner and driver of their truck
    await conn.execute(
        """INSERT INTO shipments
           (id, load_id, truck_id, driver_id, owner_id,
            status, escrow_locked, escrow_released, dispute_open,
            delivery_code, share_token, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,
                   'en_route_pickup'::loadstatus,
                   true, false, false,
                   'SOLO01', 'demo-share-solo01', NOW(), NOW())""",
        SHIPMENT_1_ID, LOAD_1_ID, TRUCK_SOLO_ID,
        DRIVER_SOLO_ID, DRIVER_SOLO_ID,
    )
    print("  ✓ Shipment 1  en_route_pickup  delivery_code=SOLO01")

    # Shipment 2: fleet owner accepted, employed driver assigned
    await conn.execute(
        """INSERT INTO shipments
           (id, load_id, truck_id, driver_id, owner_id,
            status, escrow_locked, escrow_released, dispute_open,
            delivery_code, share_token, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,
                   'en_route_pickup'::loadstatus,
                   true, false, false,
                   'FLTE01', 'demo-share-flte01', NOW(), NOW())""",
        SHIPMENT_2_ID, LOAD_2_ID, TRUCK_FLEET_ID,
        DRIVER_FLEET_ID, OWNER_ID,
    )
    print("  ✓ Shipment 2  en_route_pickup  delivery_code=FLTE01")


# ── Step 7: wallets ───────────────────────────────────────────────────────────
async def seed_wallets(conn: asyncpg.Connection) -> None:
    print("\n── Wallets ──")
    wallets = [
        (SHIPPER_ID,     350_000.0, 150_000.0),  # 75k escrow per active job
        (OWNER_ID,       200_000.0,       0.0),
        (DRIVER_SOLO_ID,  50_000.0,       0.0),
        (DRIVER_FLEET_ID, 30_000.0,       0.0),
    ]
    for uid, balance, escrow in wallets:
        wid = uuid.uuid4()
        await conn.execute(
            """INSERT INTO wallets
               (id, user_id, balance_kes, escrow_kes, currency,
                created_at, updated_at)
               VALUES ($1,$2,$3,$4,'KES',NOW(),NOW())""",
            wid, uid, balance, escrow,
        )
        await conn.execute(
            """INSERT INTO transactions
               (id, wallet_id, transaction_type, amount_kes, status,
                reference, description, created_at, updated_at)
               VALUES ($1,$2,'top_up'::transactiontype,$3,
                       'completed'::transactionstatus,$4,
                       'Demo wallet top-up',NOW(),NOW())""",
            uuid.uuid4(), wid, balance,
            f"DEMO-{uuid.uuid4().hex[:12].upper()}",
        )
    print("  ✓ 4 wallets with top-up transactions")


# ── Summary print ─────────────────────────────────────────────────────────────
def print_summary() -> None:
    w = 55
    print("\n" + "─" * w)
    print("✓  Demo seed complete")
    print("─" * w)
    print()
    print("  Login credentials  (password: Test1234!)")
    print(f"  {'[shipper]':<10}  shipper@trakvora.dev")
    print(f"  {'[owner]':<10}  owner@trakvora.dev")
    print(f"  {'[driver]':<10}  driver.solo@trakvora.dev   ← Job 1 Juja→Kinoo")
    print(f"  {'[driver]':<10}  driver.fleet@trakvora.dev  ← Job 2 Nairobi→Narok")
    print()
    print("  GPS Tracker credentials  (POST /device/ping)")
    print(f"  Solo truck :  tracker_id={TRACKER_SOLO_ID:<14}  secret={TRACKER_SOLO_SECRET}")
    print(f"  Fleet truck:  tracker_id={TRACKER_FLEET_ID:<14}  secret={TRACKER_FLEET_SECRET}")
    print()
    print("  Shipment IDs  (WebSocket: /ws/tracking/<id>)")
    print(f"  Shipment 1:  {SHIPMENT_1_ID}")
    print(f"  Shipment 2:  {SHIPMENT_2_ID}")
    print()
    print("  Delivery codes  (needed to confirm delivery)")
    print("  Shipment 1: SOLO01")
    print("  Shipment 2: FLTE01")
    print()
    print("  Quick device-ping test (replace lat/lng as you move):")
    print("  curl -X POST http://localhost:8000/device/ping \\")
    print(f"       -H 'X-Device-Secret: {TRACKER_SOLO_SECRET}' \\")
    print("       -H 'Content-Type: application/json' \\")
    print("       -d '{\"tracker_id\":\"DEV-SOLO-001\",\"latitude\":-1.15,")
    print("             \"longitude\":36.90,\"accuracy\":5,\"speed_kmh\":60,")
    print("             \"heading\":270,\"altitude\":1500,\"battery\":85,\"signal\":-70}'")
    print()


# ── Entry point ───────────────────────────────────────────────────────────────
async def main() -> None:
    conn = await asyncpg.connect(DSN)
    try:
        await wipe(conn)
        await seed_users(conn)
        await seed_drivers(conn)
        await seed_trucks(conn)
        await seed_loads(conn)
        await seed_shipments(conn)
        await seed_wallets(conn)
        print_summary()
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
