# Deploy and rollback runbook (Reyal Proof, AI Reviewer)

Everything here runs ON the server in `/opt/reyal-proof`. Nothing touches the other apps on the server.

## What `deploy/update.sh` protects for you
- Copies `data/app.db` to `backups/app-<time>.db` (last 10 kept).
- Archives `data/uploads` to `backups/uploads-<time>.tgz` (last 3 kept; skipped with a warning if the disk is too full).
- When the update brings a new database migration, saves a **permanent** copy to `backups/keep/app-before-migration-<time>.db`. Nothing prunes `backups/keep`, so clear old files out of it yourself now and then.
- Keeps the running image as `reyal-proof:previous`, and puts it back by itself if the new version fails the health check.

## Before the first AI Reviewer deploy (once)
```bash
cd /opt/reyal-proof && mkdir -p backups/keep
cp data/app.db backups/keep/app-pre-aireviewer-$(date -u +%Y%m%d-%H%M%S).db
tar czf backups/keep/uploads-pre-aireviewer-$(date -u +%Y%m%d-%H%M%S).tgz -C data uploads
git rev-parse --short HEAD | tee backups/keep/commit-pre-aireviewer.txt
docker tag ghcr.io/reyaldesign/reyal-designproof-app:latest reyal-proof:pre-aireviewer
```
Also check there is room first (`df -h /opt/reyal-proof`), and that `ls -la backups/keep` shows files of sensible size.

## Deploy it hidden first
1. In `/opt/reyal-proof/.env` add `ANTHROPIC_API_KEY` and the other `AI_REVIEWER_*` values, with `AI_REVIEWER_ENABLED="false"`. Set a monthly spend limit for the key in the Anthropic console.
2. `bash /opt/reyal-proof/deploy/update.sh`
3. Check `https://client.reyaldesign.com/api/health`, a client page, a proof page and a client review link. `/aireviewer` must return 404 (hidden).
4. Set `AI_REVIEWER_ENABLED="true"`, then `cd /opt/reyal-proof && docker compose up -d --force-recreate`.
5. Run one real review and check the spend in the Anthropic console.

## Rollback, lightest first
**Level 0, switch it off (seconds, nothing is lost).** Set `AI_REVIEWER_ENABLED="false"` in `.env`, then `docker compose up -d --force-recreate`. The tool disappears; its data stays in the database.

**Level 1, automatic.** If the new version fails the health check, `update.sh` restores the previous image itself.

**Level 2, back to the old code.**
```bash
docker tag reyal-proof:pre-aireviewer ghcr.io/reyaldesign/reyal-designproof-app:latest
cd /opt/reyal-proof && docker compose up -d --force-recreate --no-build
```
Database changes are only new tables, so the old code runs fine on the new database.

**Level 3, restore the database (last resort, loses anything created since the backup).**
```bash
cd /opt/reyal-proof && docker compose stop app
cp backups/keep/app-pre-aireviewer-*.db data/app.db
docker compose start app
```
Restore uploads the same way, by extracting the `.tgz` into `data/` (`tar xzf <file> -C data`).

## Code on GitHub
The commit before the AI Reviewer build is tagged `pre-aireviewer`. To return the source to it: `git checkout pre-aireviewer`, rebuild, and later `git checkout main` before the next update (the update script needs the `main` branch).

## Team & access (roles) rollback
The tag `pre-team-access` is the code before roles. Before deploying, tag the running image and keep a database copy:
```bash
cd /opt/reyal-proof && mkdir -p backups/keep && cp data/app.db backups/keep/app-pre-team-access-$(date -u +%Y%m%d-%H%M%S).db
docker tag ghcr.io/reyaldesign/reyal-designproof-app:latest reyal-proof:pre-team-access
```
To go back: `docker tag reyal-proof:pre-team-access ghcr.io/reyaldesign/reyal-designproof-app:latest`, then `docker compose up -d --force-recreate --no-build`. The migration only adds tables, so the old code runs on the new database. Everyone signs in once more, because sessions changed.

If you are locked out after the update: the email and password login with `ADMIN_EMAIL` and `ADMIN_PASSWORD` always works and always makes that account an active admin, so you can fix roles from `/admin/team`.
