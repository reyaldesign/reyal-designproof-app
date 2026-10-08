# Reyal Proof

Client design proofing. Designers upload images and share a link. Clients click the design to drop numbered pins, comment, and press Send now. No client account needed.

Stack: Next.js 15 (App Router), TypeScript, Tailwind 3, Prisma + SQLite, react-zoom-pan-pinch. Images live on disk under `DATA_DIR/uploads`.

## Run locally

```bash
npm install
cp .env.example .env        # set SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npx prisma migrate dev
npm run dev                 # http://localhost:3000, sign in at /login
```

## Using it (designers)

1. Sign in, fill in **New proof** (title, client, optional password and expiry, images). Multi-page proofs are multiple images.
2. Open the project, copy the **Share link**, send it to the client. Set status to Sent.
3. When the client presses Send now, status becomes Feedback Received and you get an email (or a console log if SMTP is not set).
4. On the project page: Resolve or Reopen each comment, and Reply. Clients see replies on their next visit.
5. **Upload a new version** to add v2, v3. Clients switch versions from the top bar dropdown.
6. Clients can press **Approve this version**, which sets status to Approved.

## Deploy to the VPS (Docker + nginx)

One time on the VPS:

```bash
git clone <your-github-repo-url> /srv/reyal-proof && cd /srv/reyal-proof
cp .env.example .env && nano .env     # real SESSION_SECRET (openssl rand -hex 32), admin login, APP_URL, SMTP
docker compose up -d --build
```

Then copy `deploy/nginx-proof.conf` into nginx, set your domain, and run certbot for HTTPS.

After that, every push to `main` deploys itself through `.github/workflows/deploy.yml`. Add these GitHub repository secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (private key for a deploy user), `VPS_APP_DIR` (`/srv/reyal-proof`).

Data (database and uploads) lives in `./data` on the VPS, outside the image. Back that folder up.

## Not built yet

- PDF to image conversion (export pages as images first)
- Real-time updates (admin page refreshes on load; add Pusher or SSE if needed)
- Offline viewing, version comparison, CSV or PDF export, white-label, view analytics
- Multiple designer accounts (one login from `.env`)
- Image optimization and thumbnails (originals are served as uploaded; add `sharp` if proofs are very large)
