#!/usr/bin/env bash
# One-time server setup for Reyal Proof (Docker). Run ON the VPS by someone with sudo:
#   sudo DEPLOY_USER=mlara bash setup-vps.sh
# Creates /opt/reyal-proof (data, backups, .env), gives the deploy user Docker access, and adds the nginx site for
# client.reyaldesign.com. It does not touch Reyal Studio. Safe to run twice.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo 'Run with sudo.' >&2; exit 1; }
DEPLOY_USER="${DEPLOY_USER:?Set DEPLOY_USER to the account GitHub deploys as, e.g. DEPLOY_USER=mlara}"
DOMAIN=client.reyaldesign.com
BASE=/opt/reyal-proof
HERE="$(cd "$(dirname "$0")" && pwd)"

id "$DEPLOY_USER" >/dev/null
command -v docker >/dev/null || { echo 'Docker is not installed on this server.' >&2; exit 1; }
docker compose version >/dev/null || { echo 'The "docker compose" plugin is missing.' >&2; exit 1; }
command -v nginx >/dev/null || apt-get install -y nginx
usermod -aG docker "$DEPLOY_USER"

mkdir -p "$BASE/data/uploads" "$BASE/backups"
chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$BASE"
chown -R 1000:1000 "$BASE/data"   # the container runs as the "node" user (uid 1000)

if [ ! -f "$BASE/.env" ]; then
  cat > "$BASE/.env" <<ENV
SESSION_SECRET="$(openssl rand -hex 32)"
APP_URL="https://$DOMAIN"
# Fill these in, then: cd $BASE && docker compose up -d
ADMIN_EMAIL="CHANGE_ME@reyaldesign.com"
ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=')"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
ALLOWED_EMAIL_DOMAIN="reyaldesign.com"
ALLOWED_EMAILS=""
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
MAIL_FROM="Reyal Proof <proof@reyaldesign.com>"
NOTIFY_EMAIL=""
ENV
  chown "$DEPLOY_USER":"$DEPLOY_USER" "$BASE/.env"
  chmod 600 "$BASE/.env"
  echo "Created $BASE/.env with a random session secret and admin password. Edit it next."
fi

install -m 644 "$HERE/nginx-proof.conf" /etc/nginx/sites-available/reyal-proof
ln -sf /etc/nginx/sites-available/reyal-proof /etc/nginx/sites-enabled/reyal-proof
nginx -t && systemctl reload nginx

cat <<NEXT

Server is ready for the first deploy. Still to do:
  1. Edit $BASE/.env (ADMIN_EMAIL, Google keys, SMTP).
  2. Let this server pull the private image. As $DEPLOY_USER, once:
       echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
     (a token with only the read:packages scope; it is stored in ~/.docker/config.json)
  3. Add the deploy SSH key and the GitHub secrets VPS_HOST, VPS_USER, VPS_SSH_KEY (see README), then push to main.
  4. HTTPS once the DNS record for $DOMAIN points here:
       sudo apt-get install -y certbot python3-certbot-nginx && sudo certbot --nginx -d $DOMAIN
NEXT
