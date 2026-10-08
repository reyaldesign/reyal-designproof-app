# Reyal Proof

Client design proofing. Designers upload images and share a link. Clients click the design to drop numbered pins, comment, and press Send now. No client account needed.

Stack: Next.js 15 (App Router), TypeScript, Tailwind 3, Prisma + SQLite, react-zoom-pan-pinch. Images live on disk under `DATA_DIR/uploads`.

## Run locally

```bash
npm install
cp .env.example .env        # set SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npx prisma migrate dev
npm run dev                 # http://localhost:3100, sign in at /login
```

## Google sign-in (designers)

1. Google Cloud Console, APIs & Services, Credentials, **Create credentials > OAuth client ID**, type **Web application**.
2. Add the redirect URI `<APP_URL>/api/auth/google/callback`, for example `http://localhost:3100/api/auth/google/callback` locally and `https://proof.yourdomain.com/api/auth/google/callback` on the VPS. Add the OAuth consent screen as **Internal** if the Google Workspace allows it.
3. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env` and restart. The **Sign in with Google** button appears on `/login`.
4. Anyone on `ALLOWED_EMAIL_DOMAIN` (default `reyaldesign.com`) or listed in `ALLOWED_EMAILS` can sign in. Email and password login stays as a fallback.

## Using it (designers)

1. Sign in, fill in **New proof** (title, client, optional password and expiry, images). Multi-page proofs are multiple images, or a PDF (each page is rendered to an image, up to 60 pages).
2. Open the project, copy the **Share link**, send it to the client. Set status to Sent.
3. When the client presses Send now, status becomes Feedback Received and you get an email (or a console log if SMTP is not set).
4. On the project page: Resolve or Reopen each comment, and Reply. Clients see replies on their next visit.
5. **Upload a new version** to add v2, v3. Clients switch versions from the top bar dropdown.
6. Clients can press **Approve this version**. They read a short terms pop-up, type their name and tick the box. The version is then locked (no more comments), status becomes Approved, and the project page shows who approved and when. Use **Reopen for changes** to undo it, or upload a new version.

## Deploy to the VPS (client.reyaldesign.com, Docker + GitHub)

Every push to `main` runs `.github/workflows/deploy.yml`: type-check, build the Docker image, publish it to GitHub Container Registry (`ghcr.io/reyaldesign/reyal-designproof-app`), then the VPS pulls it, restarts, health-checks `/login` and rolls back to the previous image if it fails. The app listens on `127.0.0.1:3100` and nginx proxies the domain to it. Data (database and uploads) lives in `/opt/reyal-proof/data` on the server, outside the image, and the deploy keeps the last 10 database copies in `/opt/reyal-proof/backups`.

Run the same image locally with `docker compose up --build` if you want to test it.

**One time**
1. DNS: add an `A` record `client` pointing to the server IP (the same one as `studio.reyaldesign.com`).
2. Run the setup on the server as someone with sudo. `DEPLOY_USER` is the account GitHub will log in as and must be allowed to use Docker:
   ```bash
   scp -r deploy you@SERVER:~/reyal-proof-deploy
   ssh you@SERVER "sudo DEPLOY_USER=you bash ~/reyal-proof-deploy/setup-vps.sh"
   ```
3. Edit `/opt/reyal-proof/.env` on the server (admin email, Google keys, SMTP).
4. Let the server pull the private image: create a GitHub token with only `read:packages`, then on the server run `docker login ghcr.io -u <github-user>` and paste the token.
5. Make a deploy key and add it: `ssh-keygen -t ed25519 -f ~/.ssh/reyal_proof_deploy -N ""`, append the `.pub` to the deploy user's `~/.ssh/authorized_keys` on the server, and add GitHub repo secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (the private key).
6. Push to `main`, or run the **Deploy** workflow by hand.
7. HTTPS once DNS is live: `sudo apt-get install -y certbot python3-certbot-nginx && sudo certbot --nginx -d client.reyaldesign.com`.

Add `https://client.reyaldesign.com/api/auth/google/callback` as an authorized redirect URI in the Google OAuth client.

**Every update after that:** push to `main`. Back up `/opt/reyal-proof/data`.

## Not built yet

- Real-time updates (admin page refreshes on load; add Pusher or SSE if needed)
- Offline viewing, version comparison, CSV or PDF export, white-label, view analytics
- Multiple designer accounts (one login from `.env`)
- Image optimization and thumbnails (originals are served as uploaded; add `sharp` if proofs are very large)
