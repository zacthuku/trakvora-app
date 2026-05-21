# trakvora

Real-time freight exchange platform for East Africa. Nairobi ↔ Mombasa | Nairobi ↔ Kampala | Nairobi ↔ Dar es Salaam.

## Quick Start

```bash
# 1. Clone and configure
cp .env.example .env

# 2. Start all services
docker-compose up --build

# 3. Apply database migrations (first run)
docker-compose exec backend alembic upgrade head
```

Services:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Database: localhost:5432

## Development

### Backend only
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload
```

### Frontend only
```bash
cd frontend
npm install
npm run dev
```

### Migrations
```bash
cd backend
alembic revision --autogenerate -m "description"
alembic upgrade head
alembic downgrade -1
```

### Tests

**Backend unit tests** (no database required):
```bash
cd backend
pip install -r requirements-dev.txt
pytest tests/unit/ -v
```

**Backend integration tests** (requires a running PostgreSQL instance):
```bash
# Create the test database first (one-time setup)
psql -U postgres -c "CREATE USER trakvora_test WITH PASSWORD 'trakvora_test';"
psql -U postgres -c "CREATE DATABASE trakvora_test OWNER trakvora_test;"

# Run integration tests
cd backend
DATABASE_URL=postgresql+asyncpg://trakvora_test:trakvora_test@localhost:5432/trakvora_test \
  pytest tests/integration/ -v
```

**Backend full suite:**
```bash
cd backend
pytest tests/ -v --tb=short
```

**Frontend tests** (no server required — uses jsdom):
```bash
cd frontend
npm install
npm run test:run          # run once
npm test                  # watch mode
npm run test:coverage     # with coverage report
```

**Run all tests via Docker** (integration tests use the `db` service):
```bash
# Start the DB service
docker-compose up -d db

# Backend
docker-compose exec backend pip install -r requirements-dev.txt
docker-compose exec backend pytest tests/ -v

# Frontend
docker-compose exec frontend npm run test:run
```

## Architecture

```
trakvora/
├── backend/          # FastAPI + PostgreSQL (layered: router → service → repo → model)
│   ├── app/
│   │   ├── models/   # SQLAlchemy ORM models
│   │   ├── schemas/  # Pydantic request/response schemas
│   │   ├── routers/  # HTTP route handlers (thin layer)
│   │   ├── services/ # Business logic
│   │   ├── repositories/ # Database queries
│   │   └── core/     # Security, exceptions, background tasks
│   └── alembic/      # DB migrations
└── frontend/         # React + Vite + Tailwind
    └── src/
        ├── features/ # Feature modules (auth, shipper, driver, loads, tracking)
        ├── components/ # Shared UI components
        ├── store/    # Global state (Zustand)
        └── services/ # API client (Axios)
```

## Build Phases

| Phase | Scope |
|---|---|
| Phase 1 (MVP) | Load posting, job accept, GPS tracking, consignment notes, KES payments |
| Phase 2 | Auction/bidding, wallet/escrow, fleet dashboard, verified badges |
| Phase 3 | Return load matching engine, ETA engine, credit system, corridor analytics |
