#!/usr/bin/env bash
# PostgreSQL backup — runs inside or alongside the DB container.
# Usage: ./pg-backup.sh [/path/to/backup/dir]
# Set BACKUP_S3_BUCKET to also push to S3/S3-compatible storage via rclone.

set -euo pipefail

BACKUP_DIR="${1:-/backups/postgres}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DUMP_FILE="${BACKUP_DIR}/trakvora_${TIMESTAMP}.dump"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_NAME="${POSTGRES_DB:-trakvora}"
DB_USER="${POSTGRES_USER:-trakvora}"
export PGPASSWORD="${POSTGRES_PASSWORD:-trakvora}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -u +%FT%TZ)] Starting backup of ${DB_NAME}..."

pg_dump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  --format=custom \
  --compress=9 \
  --file="${DUMP_FILE}" \
  "${DB_NAME}"

echo "[$(date -u +%FT%TZ)] Dump written to ${DUMP_FILE} ($(du -sh "${DUMP_FILE}" | cut -f1))"

# Encrypt if GPG passphrase is set
if [[ -n "${BACKUP_GPG_PASSPHRASE:-}" ]]; then
  gpg --batch --yes --passphrase "${BACKUP_GPG_PASSPHRASE}" \
      --symmetric --cipher-algo AES256 "${DUMP_FILE}"
  rm -f "${DUMP_FILE}"
  DUMP_FILE="${DUMP_FILE}.gpg"
  echo "[$(date -u +%FT%TZ)] Encrypted backup: ${DUMP_FILE}"
fi

# Upload to S3/rclone remote if configured
if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  if command -v rclone &>/dev/null; then
    rclone copy "${DUMP_FILE}" "${BACKUP_S3_BUCKET}/postgres/"
    echo "[$(date -u +%FT%TZ)] Uploaded to ${BACKUP_S3_BUCKET}/postgres/"
  else
    echo "[$(date -u +%FT%TZ)] WARNING: BACKUP_S3_BUCKET set but rclone not found. Skipping upload."
  fi
fi

# Purge old local backups
find "${BACKUP_DIR}" -name "trakvora_*.dump*" -mtime "+${RETENTION_DAYS}" -delete
echo "[$(date -u +%FT%TZ)] Cleaned up backups older than ${RETENTION_DAYS} days."

echo "[$(date -u +%FT%TZ)] Backup complete."
