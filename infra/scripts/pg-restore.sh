#!/usr/bin/env bash
# PostgreSQL restore from a pg_dump custom-format file.
# Usage: ./pg-restore.sh /path/to/trakvora_YYYYMMDD_HHMMSS.dump[.gpg]
#
# WARNING: This drops and recreates the target database.

set -euo pipefail

DUMP_FILE="${1:-}"
if [[ -z "${DUMP_FILE}" ]]; then
  echo "Usage: $0 /path/to/backup.dump[.gpg]"
  exit 1
fi

DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_NAME="${POSTGRES_DB:-trakvora}"
DB_USER="${POSTGRES_USER:-trakvora}"
export PGPASSWORD="${POSTGRES_PASSWORD:-trakvora}"

# Decrypt if encrypted
if [[ "${DUMP_FILE}" == *.gpg ]]; then
  DECRYPTED="${DUMP_FILE%.gpg}"
  echo "Decrypting ${DUMP_FILE}..."
  gpg --batch --yes --passphrase "${BACKUP_GPG_PASSPHRASE}" \
      --decrypt --output "${DECRYPTED}" "${DUMP_FILE}"
  DUMP_FILE="${DECRYPTED}"
fi

echo "[$(date -u +%FT%TZ)] Restoring ${DUMP_FILE} into ${DB_NAME}..."

# Drop existing connections and recreate DB
psql --host="${DB_HOST}" --port="${DB_PORT}" --username="${DB_USER}" \
  --dbname=postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}';"

psql --host="${DB_HOST}" --port="${DB_PORT}" --username="${DB_USER}" \
  --dbname=postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"

psql --host="${DB_HOST}" --port="${DB_PORT}" --username="${DB_USER}" \
  --dbname=postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

pg_restore \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  --dbname="${DB_NAME}" \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  "${DUMP_FILE}"

echo "[$(date -u +%FT%TZ)] Restore complete."
