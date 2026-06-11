#!/bin/bash
set -e
echo "Running database migrations..."
alembic upgrade head

if [ "${DEMO_SEED}" = "true" ]; then
  echo "Running demo seed..."
  python seed_demo.py
fi

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
