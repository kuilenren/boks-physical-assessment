#!/bin/bash
set -euo pipefail

DOMAIN="${1:?Usage: ./deploy-ssl.sh <domain>}"

echo "=== BOKS SSL Deployment (Let's Encrypt) ==="
echo "Target domain: ${DOMAIN}"
echo ""

# Navigate to infra directory
cd "$(dirname "$0")/.."

# Create required directories
mkdir -p infra/certbot/conf infra/certbot/www infra/nginx/conf.d

# Start services without SSL first (for cert issuance)
echo "Starting services for initial cert request..."
docker compose -f infra/docker-compose.yml -f infra/docker-compose.production.yml up -d postgres redis nginx

# Request Let's Encrypt certificate
echo "Requesting SSL certificate from Let's Encrypt..."
docker compose -f infra/docker-compose.yml -f infra/docker-compose.production.yml run --rm certbot certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "admin@${DOMAIN}" \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d "${DOMAIN}"

echo ""
echo "=== Certificate issued successfully ==="
echo ""
echo "Next steps:"
echo "  1. Set BOKS_PUBLIC_HOST=${DOMAIN} in your .env"
echo "  2. Set BOKS_WECHAT_APP_ID and BOKS_WECHAT_APP_SECRET"
echo "  3. Restart with SSL:"
echo "     docker compose -f infra/docker-compose.yml -f infra/docker-compose.production.yml up -d"
echo ""
echo "Certificate auto-renewal is configured (runs every 24h)."
