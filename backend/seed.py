"""
Trakvora database seed — Faker-powered, fresh wipe on every run.
Preserves only the super admin (admin@trakvora.com).

Run:  docker compose exec backend python seed.py

All seed accounts: Test1234!
Admin account:     Trakvora@1
"""
import asyncio
import os
import random
import string
import uuid
from datetime import date, timedelta

import asyncpg
import bcrypt
from faker import Faker

fake = Faker()
Faker.seed(0)

# ── Connection ──────────────────────────────────────────────────────────────
DSN = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://trakvora:trakvora@db:5432/trakvora",
).replace("postgresql+asyncpg://", "postgresql://")

# ── Auth constants ──────────────────────────────────────────────────────────
ADMIN_ID  = uuid.UUID("ffffffff-0000-0000-0000-000000000001")
USER_PW   = bcrypt.hashpw(b"Test1234!", bcrypt.gensalt()).decode()
ADMIN_PW  = bcrypt.hashpw(b"Trakvora@1", bcrypt.gensalt()).decode()
DOMAIN    = "trakvora.dev"

# ── Kenyan locations ────────────────────────────────────────────────────────
LOCATIONS = {
    "Nairobi ICD":        (-1.3192,  36.9283),
    "Nairobi Industrial": (-1.3031,  36.8602),
    "Nairobi Westlands":  (-1.2673,  36.8114),
    "Mombasa Port":       (-4.0435,  39.6682),
    "Mombasa Shimanzi":   (-4.0600,  39.6500),
    "Kisumu Kondele":     (-0.0917,  34.7680),
    "Eldoret Langas":     ( 0.5143,  35.2698),
    "Nakuru CBD":         (-0.3031,  36.0800),
    "Kampala Nakawa":     ( 0.3317,  32.6136),
    "Dar es Salaam":      (-6.7924,  39.2083),
    "Arusha":             (-3.3869,  36.6830),
}

_CORRIDOR_MAP = {
    ("Nairobi ICD",        "Mombasa Port"):       ("Nairobi-Mombasa",          485),
    ("Nairobi ICD",        "Mombasa Shimanzi"):   ("Nairobi-Mombasa",          485),
    ("Nairobi Industrial", "Mombasa Port"):       ("Nairobi-Mombasa",          485),
    ("Nairobi Westlands",  "Mombasa Port"):       ("Nairobi-Mombasa",          485),
    ("Nairobi Industrial", "Kampala Nakawa"):     ("Nairobi-Kampala",          680),
    ("Nairobi ICD",        "Kampala Nakawa"):     ("Nairobi-Kampala",          680),
    ("Nakuru CBD",         "Kampala Nakawa"):     ("Nairobi-Kampala",          590),
    ("Nairobi ICD",        "Dar es Salaam"):      ("Mombasa-Dar es Salaam",   1150),
    ("Nairobi Industrial", "Arusha"):             ("Nairobi-Arusha",           280),
    ("Nairobi ICD",        "Arusha"):             ("Nairobi-Arusha",           280),
    ("Kisumu Kondele",     "Nairobi Westlands"):  ("Nairobi-Kisumu",           350),
    ("Eldoret Langas",     "Nairobi Industrial"): ("Nairobi-Eldoret",          320),
    ("Nakuru CBD",         "Nairobi ICD"):        ("Nairobi-Nakuru",           160),
}

# ── Reference data ──────────────────────────────────────────────────────────
_KE_FIRST = [
    "Amina", "Brian", "Catherine", "David", "Emmanuel", "Fatuma",
    "Grace", "Hassan", "Isabella", "Joseph", "Kezia", "Lilian",
    "Moses", "Nancy", "Omondi", "Peter", "Quincy", "Rose",
    "Samuel", "Tabitha",
]
_KE_LAST = [
    "Kariuki", "Otieno", "Kamau", "Wanjiku", "Mwangi", "Odhiambo",
    "Njeri", "Abubakar", "Hassan", "Ndungu", "Kimani", "Mutua",
    "Achieng", "Kibet", "Waweru", "Njoroge", "Korir", "Ochieng",
]
_CARGO_TYPES     = ["general", "construction", "refrigerated", "agricultural", "electronics", "hazardous", "livestock"]
_TRUCK_TYPES     = ["flatbed", "dry_van", "reefer", "tanker", "tipper"]
_LICENCE_CLASSES = ["CE", "BCE", "C", "B"]
_TRUCK_MAKES     = ["Scania", "Mercedes-Benz", "Volvo", "MAN", "Isuzu", "DAF", "Mitsubishi"]
_TRUCK_MODELS    = {
    "Scania":        ["R450", "P410", "G460"],
    "Mercedes-Benz": ["Actros 2545", "Atego 1625"],
    "Volvo":         ["FH 500", "FM 500"],
    "MAN":           ["TGS 26.440", "TGM 18.250"],
    "Isuzu":         ["NQR 500", "FTR 900"],
    "DAF":           ["XF 530", "CF 450"],
    "Mitsubishi":    ["Fuso FJ", "Canter FE"],
}
_TRUCK_CAPS      = {"flatbed": 30.0, "dry_van": 25.0, "reefer": 22.0, "tanker": 20.0, "tipper": 10.0}


# ── Helpers ──────────────────────────────────────────────────────────────────
_used_emails = set()
_used_regs   = set()


def ke_name() -> str:
    return f"{random.choice(_KE_FIRST)} {random.choice(_KE_LAST)}"


def ke_email(name: str) -> str:
    base = name.lower().replace("'", "").replace(" ", ".")
    email = f"{base}@{DOMAIN}"
    n = 2
    while email in _used_emails:
        email = f"{base}{n}@{DOMAIN}"
        n += 1
    _used_emails.add(email)
    return email


def ke_phone() -> str:
    return "+2547" + str(random.randint(10_000_000, 99_999_999))


def ke_reg() -> str:
    while True:
        letters = "".join(random.choices(string.ascii_uppercase, k=2))
        digits  = random.randint(100, 999)
        letter3 = random.choice(string.ascii_uppercase)
        reg = f"K{letters} {digits}{letter3}"
        if reg not in _used_regs:
            _used_regs.add(reg)
            return reg


def corridor_and_dist(pickup: str, dropoff: str) -> tuple[str, float]:
    pair = (pickup, dropoff)
    rev  = (dropoff, pickup)
    if pair in _CORRIDOR_MAP:
        return _CORRIDOR_MAP[pair]
    if rev in _CORRIDOR_MAP:
        return _CORRIDOR_MAP[rev]
    return "General", float(random.randint(100, 600))


# ── Wipe ────────────────────────────────────────────────────────────────────
async def wipe(conn: asyncpg.Connection) -> None:
    print("\n── Wiping database (super admin preserved) ──")

    # Break circular FKs so ordered deletes don't error
    await conn.execute("UPDATE trucks  SET assigned_driver_id = NULL")
    await conn.execute("UPDATE drivers SET current_truck_id   = NULL, employer_id = NULL")

    # Tables to clear in FK-safe order (children first)
    ordered = [
        "tracker_alerts",
        "tracking_points",
        "consignment_notes",
        "return_windows",
        "transactions",
        "notifications",
        "messages",
        "shipments",
        "bids",
        "loads",
        "wallets",
        "tracker_devices",
        "trucks",
        "drivers",
    ]
    # Optional tables (may not exist in all migration states)
    optional = [
        "subscriptions", "company_members", "companies",
        "parcels", "move_requests", "airfreights",
        "vehicle_inspections", "compliance_reviews",
        "inspection_tasks", "email_otp",
    ]

    for tbl in optional:
        try:
            await conn.execute(f"DELETE FROM {tbl}")
            print(f"  cleared {tbl}")
        except Exception:
            pass  # table doesn't exist yet

    for tbl in ordered:
        await conn.execute(f"DELETE FROM {tbl}")
        print(f"  cleared {tbl}")

    # Delete all users except super admin
    deleted = await conn.fetchval(
        "SELECT COUNT(*) FROM users WHERE id != $1", ADMIN_ID
    )
    await conn.execute("DELETE FROM users WHERE id != $1", ADMIN_ID)
    print(f"  deleted {deleted} user(s) — admin preserved")


# ── Seed ────────────────────────────────────────────────────────────────────
async def seed(conn: asyncpg.Connection) -> None:
    await wipe(conn)

    # ── 0. Ensure super admin exists ─────────────────────────────────────────
    print("\n── Super admin ──")
    exists = await conn.fetchval("SELECT 1 FROM users WHERE id=$1", ADMIN_ID)
    if not exists:
        await conn.execute(
            """INSERT INTO users
               (id,email,full_name,hashed_password,role,admin_role,
                is_active,is_verified,rating,total_trips,cancellation_count,
                created_at,updated_at)
               VALUES($1,'admin@trakvora.com','Trakvora Admin',
                      $2,'admin'::userrole,'super_admin'::adminrole,
                      true,true,5.0,0,0,NOW(),NOW())""",
            ADMIN_ID, ADMIN_PW,
        )
        print("  ✓ Created admin@trakvora.com")
    else:
        print("  ✓ admin@trakvora.com already exists — preserved")

    # ── 1. Users ─────────────────────────────────────────────────────────────
    print("\n── Users ──")
    shipper_ids:     list[uuid.UUID] = []
    owner_ids:       list[uuid.UUID] = []
    driver_user_ids: list[uuid.UUID] = []

    async def insert_user(role: str, company: str | None = None) -> uuid.UUID:
        uid  = uuid.uuid4()
        name = ke_name()
        await conn.execute(
            """INSERT INTO users
               (id,email,full_name,company_name,hashed_password,role,phone,
                is_active,is_verified,rating,total_trips,cancellation_count,
                created_at,updated_at)
               VALUES($1,$2,$3,$4,$5,$6::userrole,$7,
                      true,true,$8,$9,0,NOW(),NOW())""",
            uid, ke_email(name), name, company, USER_PW, role,
            ke_phone(),
            round(random.uniform(3.5, 5.0), 1),
            random.randint(5, 80),
        )
        return uid

    for _ in range(3):
        shipper_ids.append(await insert_user("shipper", fake.company() + " Ltd"))
    for _ in range(2):
        owner_ids.append(await insert_user("owner", fake.company() + " Transport"))
    for _ in range(5):
        driver_user_ids.append(await insert_user("driver"))

    print(f"  ✓ 3 shippers · 2 owners · 5 drivers")

    # ── 2. Driver profiles ────────────────────────────────────────────────────
    print("\n── Driver profiles ──")
    driver_profile_ids: dict[uuid.UUID, uuid.UUID] = {}  # user_id → driver_record_id

    for uid in driver_user_ids:
        did    = uuid.uuid4()
        driver_profile_ids[uid] = did
        expiry = (date.today() + timedelta(days=random.randint(365, 1825))).isoformat()
        await conn.execute(
            """INSERT INTO drivers
               (id,user_id,licence_number,licence_class,licence_expiry,bio,
                experience_years,verification_status,ntsa_verified,
                availability_status,seeking_employment,created_at,updated_at)
               VALUES($1,$2,$3,$4,$5,$6,$7,
                      $8::verificationstatus,$9,
                      $10::availabilitystatus,$11,
                      NOW(),NOW())""",
            did, uid,
            fake.bothify("?######/20##").upper(),
            random.choice(_LICENCE_CLASSES),
            expiry,
            fake.sentence(nb_words=10),
            random.randint(2, 15),
            "approved",
            True,
            random.choice(["available", "available", "offline"]),
            random.choice([True, False]),
        )
    print(f"  ✓ {len(driver_profile_ids)} driver profiles (all verified)")

    # ── 3. Trucks ─────────────────────────────────────────────────────────────
    print("\n── Trucks ──")
    all_truck_ids:   list[uuid.UUID] = []
    owner_truck_ids: list[uuid.UUID] = []  # trucks owned by fleet owners (used for bids)
    assigned_count = 0

    # Drivers 0-3 are available for owner assignment (2 per owner)
    available_for_assignment = list(driver_user_ids[:4])
    drv_idx = 0

    for owner_id in owner_ids:
        for slot in range(3):           # 3 trucks per owner
            tid   = uuid.uuid4()
            all_truck_ids.append(tid)
            owner_truck_ids.append(tid)
            make  = random.choice(_TRUCK_MAKES)
            model = random.choice(_TRUCK_MODELS[make])
            ttype = random.choice(_TRUCK_TYPES)

            # Assign a driver to the first 2 trucks per owner
            assigned_did = None
            assigned_uid = None
            if slot < 2 and drv_idx < len(available_for_assignment):
                assigned_uid = available_for_assignment[drv_idx]
                assigned_did = driver_profile_ids[assigned_uid]
                drv_idx += 1

            await conn.execute(
                """INSERT INTO trucks
                   (id,owner_id,registration_number,truck_type,capacity_tonnes,
                    make,model,year,is_active,is_driver_owned,
                    assigned_driver_id,created_at,updated_at)
                   VALUES($1,$2,$3,$4::trucktype,$5,$6,$7,$8,
                          true,false,$9,NOW(),NOW())""",
                tid, owner_id, ke_reg(), ttype, _TRUCK_CAPS[ttype],
                make, model, random.randint(2015, 2023),
                assigned_did,
            )

            if assigned_uid:
                # Keep Driver.current_truck_id in sync (critical for active-job visibility)
                await conn.execute(
                    """UPDATE drivers
                       SET current_truck_id=$1, employer_id=$2
                       WHERE user_id=$3""",
                    tid, owner_id, assigned_uid,
                )
                assigned_count += 1

    # 1 driver-owned truck (driver index 4 — unassigned to an owner)
    driver_owned_uid = driver_user_ids[4]
    tid = uuid.uuid4()
    all_truck_ids.append(tid)
    make  = random.choice(_TRUCK_MAKES)
    model = random.choice(_TRUCK_MODELS[make])
    await conn.execute(
        """INSERT INTO trucks
           (id,owner_id,registration_number,truck_type,capacity_tonnes,
            make,model,year,is_active,is_driver_owned,created_at,updated_at)
           VALUES($1,$2,$3,'flatbed'::trucktype,$4,$5,$6,$7,
                  true,true,NOW(),NOW())""",
        tid, driver_owned_uid, ke_reg(), 8.0, make, model, random.randint(2015, 2021),
    )

    print(f"  ✓ {len(all_truck_ids)} trucks · {assigned_count} drivers assigned (current_truck_id synced)")

    # ── 4. Loads ──────────────────────────────────────────────────────────────
    print("\n── Loads ──")
    load_ids:    list[uuid.UUID] = []
    load_prices: dict[uuid.UUID, float] = {}
    loc_names = list(LOCATIONS.keys())

    for _ in range(12):
        pickup, dropoff = random.sample(loc_names, 2)
        plat, plng      = LOCATIONS[pickup]
        dlat, dlng      = LOCATIONS[dropoff]
        corridor, dist  = corridor_and_dist(pickup, dropoff)
        cargo           = random.choice(_CARGO_TYPES)
        mode            = random.choice(["auction", "auction", "fixed"])
        price           = float(random.randint(50, 350) * 1000)
        weight          = round(random.uniform(5, 40), 1)
        pdate           = (date.today() + timedelta(days=random.randint(2, 30))).isoformat()
        floor           = round(price * 0.70 / 1000) * 1000 if mode == "auction" else None
        lid             = uuid.uuid4()
        load_ids.append(lid)
        load_prices[lid] = price

        await conn.execute(
            """INSERT INTO loads
               (id,shipper_id,pickup_location,pickup_latitude,pickup_longitude,
                dropoff_location,dropoff_latitude,dropoff_longitude,corridor,
                cargo_type,weight_tonnes,cargo_description,price_kes,
                booking_mode,min_bid_floor_kes,status,distance_km,
                pickup_date,created_at,updated_at)
               VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,
                      $10::cargotype,$11,$12,$13,
                      $14::bookingmode,$15,
                      'available'::loadstatus,$16,$17,
                      NOW(),NOW())""",
            lid, random.choice(shipper_ids),
            pickup, plat, plng, dropoff, dlat, dlng, corridor,
            cargo, weight, fake.sentence(nb_words=6), price,
            mode, float(floor) if floor else None,
            float(dist), pdate,
        )
    print(f"  ✓ {len(load_ids)} loads (all available, mix of auction/fixed)")

    # ── 5. Bids ───────────────────────────────────────────────────────────────
    print("\n── Bids ──")
    bid_count = 0
    # Pick 10 loads and place 1-2 bids each using owner trucks
    for lid in random.sample(load_ids, min(10, len(load_ids))):
        price     = load_prices[lid]
        num_bids  = random.randint(1, 2)
        bid_trucks = random.sample(owner_truck_ids, min(num_bids, len(owner_truck_ids)))
        for truck_id in bid_trucks:
            row = await conn.fetchrow("SELECT owner_id FROM trucks WHERE id=$1", truck_id)
            if not row:
                continue
            amount = float(round(price * random.uniform(0.75, 0.95) / 1000) * 1000)
            await conn.execute(
                """INSERT INTO bids
                   (id,load_id,owner_id,truck_id,amount_kes,
                    status,message,created_at,updated_at)
                   VALUES($1,$2,$3,$4,$5,
                          'pending'::bidstatus,$6,NOW(),NOW())""",
                uuid.uuid4(), lid, row["owner_id"], truck_id, amount,
                fake.sentence(nb_words=6),
            )
            bid_count += 1
    print(f"  ✓ {bid_count} bids (all pending)")

    # ── 6. Wallets + top-up transactions ──────────────────────────────────────
    print("\n── Wallets ──")
    all_user_ids = shipper_ids + owner_ids + driver_user_ids
    for uid in all_user_ids:
        wid     = uuid.uuid4()
        balance = float(random.randint(10, 500) * 1000)
        await conn.execute(
            """INSERT INTO wallets
               (id,user_id,balance_kes,escrow_kes,currency,created_at,updated_at)
               VALUES($1,$2,$3,0.00,'KES',NOW(),NOW())""",
            wid, uid, balance,
        )
        await conn.execute(
            """INSERT INTO transactions
               (id,wallet_id,transaction_type,amount_kes,status,
                reference,description,created_at,updated_at)
               VALUES($1,$2,'top_up'::transactiontype,$3,
                      'completed'::transactionstatus,$4,$5,NOW(),NOW())""",
            uuid.uuid4(), wid, balance,
            f"TRK-{uuid.uuid4().hex[:8].upper()}",
            "Initial wallet top-up",
        )
    print(f"  ✓ {len(all_user_ids)} wallets with top-up transactions")

    # ── 7. Notifications ──────────────────────────────────────────────────────
    print("\n── Notifications ──")
    for uid in random.sample(all_user_ids, min(6, len(all_user_ids))):
        await conn.execute(
            """INSERT INTO notifications
               (id,user_id,notification_type,title,body,
                is_read,created_at,updated_at)
               VALUES($1,$2,'system'::notificationtype,$3,$4,
                      false,NOW(),NOW())""",
            uuid.uuid4(), uid,
            "Welcome to Trakvora",
            "Your account is set up. Browse loads, manage your fleet, or track shipments.",
        )
    print("  ✓ 6 welcome notifications")

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "─" * 50)
    print("✓ Seed complete\n")
    print("  Super admin  admin@trakvora.com      Trakvora@1")
    print("  All others   *@trakvora.dev          Test1234!")
    print()
    # Print generated emails for easy login reference
    rows = await conn.fetch(
        "SELECT email, role FROM users WHERE id != $1 ORDER BY role, email", ADMIN_ID
    )
    for r in rows:
        print(f"  [{r['role']:8s}]  {r['email']}")


async def main() -> None:
    conn = await asyncpg.connect(DSN)
    try:
        await seed(conn)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
