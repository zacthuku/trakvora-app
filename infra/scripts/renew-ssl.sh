#!/usr/bin/env bash
# Let's Encrypt SSL renewal — run via cron twice daily (certbot auto-skips if not due).
# Cron example:
#   0 3,15 * * * /opt/trakvora/infra/scripts/renew-ssl.sh >> /var/log/trakvora-ssl-renew.log 2>&1

set -euo pipefail

DOMAIN="${DOMAIN:-trakvora.com}"
NGINX_CONTAINER="${NGINX_CONTAINER:-trakvora-nginx-1}"

echo "[$(date -u +%FT%TZ)] Running Certbot renewal for ${DOMAIN}..."

certbot renew --quiet --deploy-hook "docker exec ${NGINX_CONTAINER} nginx -s reload"

echo "[$(date -u +%FT%TZ)] Renewal check complete."
