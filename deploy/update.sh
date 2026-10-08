#!/usr/bin/env bash
# Update Reyal Proof on the VPS from GitHub. Run ON the server, no sudo needed (user must be in the docker group):
#   bash /opt/reyal-proof/deploy/update.sh
# Backs up the database, pulls main, rebuilds this app's image, restarts only this app, checks /login,
# and puts the previous image back if the new one does not come up. Other apps on the server are not touched.
set -euo pipefail
cd /opt/reyal-proof
IMAGE=ghcr.io/reyaldesign/reyal-designproof-app

[ -f data/app.db ] && cp data/app.db "backups/app-$(date -u +%Y%m%d-%H%M%S).db"
ls -1t backups/app-*.db 2>/dev/null | tail -n +11 | xargs -r rm -f

docker tag "$IMAGE:latest" reyal-proof:previous 2>/dev/null || true
git pull --ff-only
docker compose build
docker compose up -d

for _ in $(seq 1 30); do
  sleep 2
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3100/login || true)
  if [ "$code" = 200 ]; then echo "Reyal Proof is up ($(git rev-parse --short HEAD))."; exit 0; fi
done

echo 'New version did not come up. Last log lines:' >&2
docker compose logs --tail 40 app >&2 || true
if docker image inspect reyal-proof:previous >/dev/null 2>&1; then
  echo 'Restoring the previous image.' >&2
  docker tag reyal-proof:previous "$IMAGE:latest"
  docker compose up -d --no-build
fi
exit 1
