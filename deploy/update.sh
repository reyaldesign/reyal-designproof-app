#!/usr/bin/env bash
# Update Reyal Studio on the VPS from GitHub. Run ON the server, no sudo needed (user must be in the docker group):
#   bash /opt/reyal-proof/deploy/update.sh
# Backs up the database and uploads (plus a permanent database copy before any migration), pulls main, rebuilds this app's image, restarts only this app, checks /login,
# and puts the previous image back if the new one does not come up. Other apps on the server are not touched.
set -euo pipefail
cd /opt/reyal-proof
IMAGE=ghcr.io/reyaldesign/reyal-designproof-app

STAMP=$(date -u +%Y%m%d-%H%M%S)
mkdir -p backups/keep
[ -f data/app.db ] && cp data/app.db "backups/app-$STAMP.db"
ls -1t backups/app-*.db 2>/dev/null | tail -n +11 | xargs -r rm -f

# Uploaded images too (proofs and AI Reviewer). Archives are large, so only the last 3 are kept, and
# the step is skipped with a warning (the update still goes ahead) if the disk does not have room for it.
if [ -d data/uploads ]; then
  need=$(( $(du -sk data/uploads | cut -f1) * 2 )); free=$(df -Pk backups | awk 'NR==2{print $4}')
  if [ "$free" -gt "$need" ]; then
    tar czf "backups/uploads-$STAMP.tgz" -C data uploads
    ls -1t backups/uploads-*.tgz 2>/dev/null | tail -n +4 | xargs -r rm -f
  else
    echo 'Warning: not enough free disk space to back up the uploads folder. Continuing without it.' >&2
  fi
fi

# A database change is about to be applied: keep a permanent copy that is never pruned (backups/keep).
git fetch -q origin
if ! git diff --quiet HEAD FETCH_HEAD -- prisma/migrations 2>/dev/null; then
  [ -f data/app.db ] && cp data/app.db "backups/keep/app-before-migration-$STAMP.db" && echo "New database migration found. Permanent copy saved: backups/keep/app-before-migration-$STAMP.db"
fi

docker tag "$IMAGE:latest" reyal-proof:previous 2>/dev/null || true
git pull --ff-only
docker compose build
docker compose up -d

for _ in $(seq 1 30); do
  sleep 2
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3100/login || true)
  if [ "$code" = 200 ]; then echo "Reyal Studio is up ($(git rev-parse --short HEAD))."; exit 0; fi
done

echo 'New version did not come up. Last log lines:' >&2
docker compose logs --tail 40 app >&2 || true
if docker image inspect reyal-proof:previous >/dev/null 2>&1; then
  echo 'Restoring the previous image.' >&2
  docker tag reyal-proof:previous "$IMAGE:latest"
  docker compose up -d --no-build
fi
exit 1
