# Reyal Proof

Client design proofing. Designers upload images and share a link. Clients click the design to drop numbered pins, comment, and press Send Revision. No client account needed.

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
4. Anyone on `ALLOWED_EMAIL_DOMAIN` (default `reyaldesign.com`) or listed in `ALLOWED_EMAILS` can sign in, but they can use nothing until an admin gives them a role (see Team & access). `ADMIN_EMAIL` is the first admin. Its email and password login always works and always ends up an admin, so a bad role setup can never lock the team out.

## Using it (designers)

1. Sign in, fill in **New proof** (title, client, optional password and expiry, images). Multi-page proofs are multiple images, or a PDF (each page is rendered to an image, up to 60 pages). Proofs are previews: images up to 10 MB each, PDFs up to 30 MB, 40 MB per upload. The form blocks bigger files with a message before sending.
2. Open the project, copy the **Share link**, send it to the client. Set status to Sent.
3. When the client presses Send Revision, status becomes Feedback Received and you get an email (or a console log if SMTP is not set).
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

## AI Reviewer

A separate tool at `/aireviewer` (sidebar item, plus a tile on the dashboard) that checks images against a checklist with Claude before they go to proofing. It shares only the sign-in, the sidebar and the database file with the proofing app. It has its own tables (`Ai...`, no links to proofs or clients), its own client list, and its own image folder (`uploads/ai/`) that is only served to signed-in users.

- **AI Review:** pick a client and image type to load their checklist, drop images or a whole folder, review the batch with live progress, and open any result for the score, a plain-language summary, a fix list, a per-criterion checklist and numbered markers where the AI thinks problems are (an estimate, not a measurement). Verdicts: Ready for proofing (80+), Needs revisions (50-79), Fails (under 50). Large photos are resized before sending, so they never hit Claude's size limit.
- **History:** every review, grouped by day, filterable by result, client, image type and file name. Change a result by hand, or delete a review (its image goes too).
- **Clients:** per-client checklists. Criteria for every image type sit on top, and each of the six default types (Reel/Animation, Flyer, Photo Resize, Carousel, Story/IG Cover, Profile Logo) adds its own. Rename, reorder and add types freely.

- **Client icons:** upload a logo or icon per client on the Clients screen (PNG, JPG, WebP or GIF up to 2 MB, cropped to a 256px square). Until you do, a colored initial is shown. Icons appear in the client list, the review picker and History. Replacing or removing an icon, or deleting the client, deletes the old file.
- **AI status:** an **AI active / AI slow / AI down** indicator in the page header and the session panel, with the reason on hover (no key set, key rejected, Anthropic unreachable or having problems, rate limited, out of credits). It checks by listing models, which costs no tokens, once a minute and right after a failed review. Click it to check again.

**Switch and settings (in `.env`):** the whole tool is hidden (404, no sidebar item) unless `AI_REVIEWER_ENABLED="true"`. It needs `ANTHROPIC_API_KEY` from console.anthropic.com (billing on, and set a monthly spend limit there). Optional: `AI_REVIEWER_MODEL`, `AI_REVIEWER_EFFORT`, `AI_REVIEWER_MAX_TOKENS`, `AI_MAX_CONCURRENT`, and the two price variables used for the cost estimate. Each review is a paid call, so only signed-in team members can run one.

## Team & access

Admin page at `/admin/team` (sidebar, under Admin, with a yellow badge for people waiting). It controls who can use what.

- **Roles:** Admin (everything), Project Manager (Clients & proofs, Requests), Designer (AI Review). The **Roles & permissions** tab is the editable grid. Admins always keep Team & access.
- **New accounts** that sign in with Google land on an "Almost there" screen (it checks again every 15 seconds) until an admin picks Designer, Project Manager or Admin, or denies them. Admins get an email. **Pre-assign a role** gives someone a role before their first sign-in.
- **Per person:** click a member to change their role, give or remove a single tool for just them (shown with a dashed outline), sign them out of all devices, or suspend them. Suspending signs them out on their next click. The last active admin can't be demoted or suspended.
- **No access:** opening a page their role doesn't include shows a card with a link to their first tool and **Request access**, which emails the admins (once per tool per hour).
- **Sign-in activity:** every sign-in, sign-out, blocked attempt (wrong domain, suspended, denied), access change and access request, kept 12 months, with filters and **Export CSV**. It shows the IP address. City lookup is not set up.
- Access is checked on the server for every page, server action and API route, not just hidden in the sidebar. The check reads the database on each request. Tool names: `PROOFS`, `REQUESTS`, `AI_REVIEW`, `AI_CRITERIA`, `TEAM`.
- First deploy: everyone is signed out once. `creyes@reyaldesign.com` and `ADMIN_EMAIL` are admins from the start, everyone else waits for approval.
- Local testing: in development only, the shared `ADMIN_PASSWORD` signs in as any existing person, to try each role. This is removed from production builds.

## The proof page

A single-screen workspace. The header shows the title, type and a status track (Draft, Sent, Feedback received, Approved) that advances on its own, with one main button for the stage: **Send to client** while it is a draft or sent, **Upload vN** once feedback is in, none once approved. A bar under it has a tab per version, **+ New version**, and the share link with **Copy link**. Below, the page rail, the zoomable viewer and the comments panel (Open, Resolved, All). Each comment shows a zoomed crop of where the pin is, with **Reply** and **Resolve** inline. Settings (title, type, password, expiry, included revisions, status by hand) and **Delete proof** live in the **Settings** drawer. The client view is one click away with **Client view**.

## The designer dashboard

- **Clients page:** a "Waiting on you" strip with the proofs that have open client comments, sort tabs (Needs attention, Recent, A-Z), type filter chips, and a search across client names and proof titles. Each client card shows their status in words (feedback, with client, draft, approved), open comments and last activity.
- **Client page:** status tabs (All, Needs review, With client, Draft, Approved) with counts, proof cards with a type pill, status pill, version, open comments and a revisions meter, and a capped Activity panel. Hover a proof card for **Copy review link** and **Delete**. **Delete client** now lives in Edit client, behind a confirmation.

## The client review page

A branded, three-part layout: a page rail with thumbnails and comment counts, the zoomable design, and a **To send / Sent** panel. A header shows who shared the proof, the status (Waiting for your review, Revision sent, Approved) and the version switcher. A dismissible "How to review" guide appears on the first visit (the **?** button reopens it). On phones the panel becomes a bottom sheet. The password and expired-link screens use the same card and cursor spotlight as the sign-in page. Styles are in `src/app/review/review.css`, scoped to `.review`.

## Revisions

Each client includes a number of revision rounds per proof (default **2**). Change it with **Edit client** on the client page. A single proof can override it under its settings (leave blank to use the client's number).

- Every time a client presses **Send Revision**, one revision is used. Before it goes through they get a pop-up: "Use revision 1 of 2?" asking them to confirm that this is everything they need changed for that round. It appears every time, and warns when it is the last included revision.
- When a client has used all of them, **Send Revision** is replaced by a notice to contact Reyal Design. The server enforces this too. Raise the number to let them send again.
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
- Image optimization and thumbnails (originals are served as uploaded; add `sharp` if proofs are very large)
