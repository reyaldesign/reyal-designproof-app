# Reyal Proof

Client design proofing. Designers upload images and share a link. Clients click the design to drop numbered pins, comment, and press Send now. No client account needed.

Stack: Next.js 15 (App Router), TypeScript, Tailwind 3, Prisma + SQLite, react-zoom-pan-pinch, sharp (card thumbnails), mupdf (PDF pages). Images live on disk under `DATA_DIR/uploads`.

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

1. Sign in, fill in **New proof** (title, client, optional password and expiry, images). Multi-page proofs are multiple images, or a PDF (each page is rendered to an image, up to 60 pages). Proofs are previews: images up to 10 MB each, PDFs up to 30 MB, 40 MB per upload. The form blocks bigger files with a message before sending.
2. Open the project, copy the **Share link**, send it to the client. Set status to Sent.
3. When the client presses Send now, status becomes Feedback Received and you get an email (or a console log if SMTP is not set).
4. On the project page: Resolve or Reopen each comment, and Reply. Clients see replies on their next visit.
5. **Upload a new version** to add v2, v3. Clients switch versions from the top bar dropdown.
6. Clients can press **Approve this version**. They read a short terms pop-up, type their name and tick the box. The version is then locked (no more comments), status becomes Approved, and the project page shows who approved and when. Use **Reopen for changes** to undo it, or upload a new version.

## Deploy to the VPS (client.reyaldesign.com, Docker)

The server pulls this repo from GitHub and builds the Docker image itself. It listens on `127.0.0.1:3100` and nginx proxies the domain to it. Everything lives in `/opt/reyal-proof` (the repo, `.env`, `data/` with the database and uploads, `backups/`). It is one Docker Compose project named `reyal-proof`, so it never touches the other apps on the server.

**First time (on the server)**
1. Give the server read access to the private repo: create a key with `ssh-keygen -t ed25519 -f ~/.ssh/reyal_proof_github -N ""`, add an `~/.ssh/config` block for host `github-reyal-proof` that uses it, and add the public key under the repo's Settings, Deploy keys (read-only).
2. `git clone git@github-reyal-proof:reyaldesign/reyal-designproof-app.git /opt/reyal-proof`
3. `sudo DEPLOY_USER=ubuntu bash /opt/reyal-proof/deploy/setup-vps.sh` (checks that port 3100 is free, creates `.env`, adds the nginx site after testing it).
4. Edit `/opt/reyal-proof/.env` (admin email, Google keys, SMTP).
5. `cd /opt/reyal-proof && docker compose build && docker compose up -d`
6. DNS `A` record `client` to the server IP, then `sudo certbot --nginx -d client.reyaldesign.com`.
7. Add `https://client.reyaldesign.com/api/auth/google/callback` as an authorized redirect URI in the Google OAuth client.

**Every update after that:** `bash /opt/reyal-proof/deploy/update.sh`. It backs up the database (last 10 kept), pulls `main`, rebuilds, restarts, checks `/login`, and restores the previous image if the new one fails.

**Optional push-to-deploy:** the Deploy workflow always builds and publishes the image to ghcr.io. It only deploys to the server if the repo variable `AUTO_DEPLOY` is `true` and the secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` are set. Not needed for the flow above.

## Revisions

Each client includes a number of revision rounds per proof (default **2**). Change it with **Edit client** on the client page. A single proof can override it under its settings (leave blank to use the client's number).

- Every time a client presses **Send now**, one revision is used. Before it goes through they get a pop-up: "Use revision 1 of 2?" asking them to confirm that this is everything they need changed for that round. It appears every time, and warns when it is the last included revision.
- When a client has used all of them, **Send now** is replaced by a notice to contact Reyal Design. The server enforces this too. Raise the number to let them send again.
- The proof page shows "Revisions 1 of 2 used". Approving does not use a revision.

## Activity, statuses and sending

- Each client page has an **Activity** feed: proofs created, versions uploaded, each revision sent, replies, approvals.
- Comments carry a status: **Needs team** (no reply yet), **Replied**, **Done** (resolved).
- On a proof page, **Client view** opens exactly what the client sees. **Send to client** gives the link with a copy button and an email draft (opened in your own mail app, nothing is sent automatically) and can mark the proof as Sent.

## Proof types and deleting proofs

- When you create a proof you choose its **type**: Website, Social media, Menu or Prints. It shows as a lettered circle on the cards (W, S, M, P) and can be changed in the proof's settings. Proofs made before types existed show "?" until you set one. The type is stored so the lists can be filtered by it.
- Hover a proof card on the client page and click the trash icon to delete just that proof. You are asked to confirm. This removes its versions, comments and uploaded image files from disk. Deleting a client does the same for all of their proofs.

## Not built yet

- Real-time updates (admin page refreshes on load; add Pusher or SSE if needed)
- Offline viewing, version comparison, CSV or PDF export, white-label, view analytics
- Multiple designer accounts (one login from `.env`)
- Image optimization and thumbnails (originals are served as uploaded; add `sharp` if proofs are very large)
