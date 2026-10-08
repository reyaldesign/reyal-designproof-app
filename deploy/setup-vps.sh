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
# This server hosts other apps. Refuse to continue if our port is taken, so nothing existing is disturbed.
if ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE '[:.]3100$'; then
  echo 'Port 3100 is already in use by something else. Pick a free port: change it in docker-compose.yml and deploy/nginx-proof.conf, then rerun.' >&2; exit 1
fi
if [ -e /etc/nginx/sites-enabled/reyal-proof ] || ! grep -rqs "client.reyaldesign.com" /etc/nginx 2>/dev/null; then :; else
  echo 'nginx already has a server_name client.reyaldesign.com. Not adding a second one.' >&2; exit 1
fi
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

# Add our site, test the WHOLE nginx config, and only then reload. If the test fails, undo our change and leave nginx untouched.
install -m 644 "$HERE/nginx-proof.conf" /etc/nginx/sites-available/reyal-proof
ln -sf /etc/nginx/sites-available/reyal-proof /etc/nginx/sites-enabled/reyal-proof
if nginx -t 2>/tmp/reyal-proof-nginx-test.txt; then
  systemctl reload nginx
else
  rm -f /etc/nginx/sites-enabled/reyal-proof
  echo 'nginx config test failed, so our site was removed and nginx was NOT reloaded. Details:' >&2
  cat /tmp/reyal-proof-nginx-test.txt >&2; exit 1
fi

cat <<NEXT

Server is ready for the first start. Still to do:
  1. Edit $BASE/.env (ADMIN_EMAIL, Google keys, SMTP).
  2. Log out and back in once, so $DEPLOY_USER gets Docker access.
  3. Build and start:  cd $BASE && docker compose build && docker compose up -d
  4. HTTPS once the DNS record for $DOMAIN points here:
       sudo apt-get install -y certbot python3-certbot-nginx && sudo certbot --nginx -d $DOMAIN
  Later updates:  bash $BASE/deploy/update.sh
NEXT
