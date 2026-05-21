#!/usr/bin/env bash
# PostgreSQL hardening — run on the Linux DB server after PostgreSQL 15 is installed.
# Usage: sudo -u postgres ./db-harden.sh
# Set BACKEND_IP to restrict pg_hba.conf to the backend server's IP.

set -euo pipefail

BACKEND_IP="${BACKEND_IP:-127.0.0.1}"
DB_NAME="${POSTGRES_DB:-trakvora}"
DB_USER="${POSTGRES_USER:-trakvora}"
DB_PASS="${POSTGRES_PASSWORD:-CHANGE_ME}"

PG_CONF="/etc/postgresql/15/main/postgresql.conf"
PG_HBA="/etc/postgresql/15/main/pg_hba.conf"

echo "=== Hardening PostgreSQL 15 ==="

# -- postgresql.conf tweaks --
cat >> "${PG_CONF}" <<EOF

# Trakvora hardening
listen_addresses = '${BACKEND_IP},localhost'
log_connections = on
log_disconnections = on
log_failed_logins = on
log_duration = off
log_min_duration_statement = 500
ssl = on
password_encryption = scram-sha-256
EOF

# -- pg_hba.conf: only allow backend IP --
cat > "${PG_HBA}" <<EOF
# TYPE  DATABASE  USER      ADDRESS           METHOD
local   all       postgres                    peer
local   all       all                         peer
host    ${DB_NAME} ${DB_USER} ${BACKEND_IP}/32 scram-sha-256
host    all       all       127.0.0.1/32      scram-sha-256
EOF

# -- Create app user and DB --
psql -U postgres <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}') \gexec

REVOKE ALL ON DATABASE ${DB_NAME} FROM PUBLIC;
GRANT CONNECT ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL

systemctl reload postgresql

echo "=== PostgreSQL hardening complete ==="
