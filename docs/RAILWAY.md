# Deploying SquareFeets CRM on Railway (dev server)

Railway runs the code straight from GitHub. This project becomes **one Railway project with three services**:

| Service name | What it is | Source | Public? |
| --- | --- | --- | --- |
| `Postgres` | database | Railway's PostgreSQL | no |
| `api` | NestJS API | repo folder `apps/api` | no (private network only) |
| `web` | Next.js website | repo folder `apps/web` | **yes** — this is the address you open |

The website forwards every `/api` call to the API over Railway's private network, so users only ever see one address.
Both folders already contain a `railway.json` (build + start + health-check settings) — you do not need to type any commands.

## Before you start
1. The code must be on GitHub (`https://github.com/ai-emarketers/squarefeets_crm`, branch `main`): `git push -u origin main`.
2. A Railway account: https://railway.com → *Login with GitHub*. Railway gives a trial credit and then bills by usage; check https://railway.com/pricing for the current plan.

## Steps
1. **New project** → *Deploy from GitHub repo* → pick `squarefeets_crm`. (If asked, allow Railway to read the repo.) Railway creates one service and tries to build it; it will fail until step 3 — that is expected.
2. **Add the database:** in the project canvas click **+ Create** → *Database* → *Add PostgreSQL*. A service named `Postgres` appears.
3. **Configure the first service as the API:** click it → *Settings*
   - Service name → rename to `api`
   - *Source* → **Root Directory** = `/apps/api`
   - *Networking* → leave it without a public domain (private only)
4. **API variables** (`api` → *Variables* → *New Variable* / *Raw editor*):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `JWT_SECRET` | a long random value (generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
   | `JWT_EXPIRES_IN` | `7d` |
   | `PORT` | `4000` |
   | `SEED_ADMIN_EMAIL` | the Owner login email, e.g. `anil@sharmaproperty.in` |
   | `SEED_ADMIN_PASSWORD` | a **new** strong password (used only on the first deploy) |
   | `UPLOAD_DIR` | `/data/uploads` |
   | `WEB_ORIGIN` | the website's public address (fill in after step 6; optional because the site proxies the API) |

5. **Add a volume for uploaded documents:** `api` → right-click / *Settings* → **Volumes** → add a volume mounted at `/data`. Without it, uploaded files disappear on every redeploy.
6. **Add the website:** **+ Create** → *GitHub Repo* → the same repo → *Settings*
   - Service name → `web`
   - **Root Directory** = `/apps/web`
   - *Networking* → **Generate Domain** (this is your dev URL, like `web-production-xxxx.up.railway.app`)
   - *Variables*:

   | Variable | Value |
   | --- | --- |
   | `API_INTERNAL_URL` | `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:4000` |
   | `NEXT_PUBLIC_API_URL` | `/api` |

   `API_INTERNAL_URL` is read when the website is *built*, so after changing it, redeploy `web`.
7. **Deploy:** Railway redeploys automatically when variables change. Deploy `api` first and wait for it to turn green; then `web`.
   - On the first API start it runs the database migration and, because the database is empty, loads the demo data and the Owner login. It never seeds again once users exist (the seed wipes data).
8. **Open the website:** `web` → the generated domain → sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

## Updating later
Push to `main` → Railway rebuilds and redeploys both services. Database changes are applied automatically at API start (`prisma migrate deploy`).

## If something fails
| Symptom | Fix |
| --- | --- |
| `api` build fails | *Deployments* → *View logs*. Check the Root Directory is `/apps/api`. |
| `api` crashes: `Environment variable not found: DATABASE_URL` | Variable reference must be exactly `${{Postgres.DATABASE_URL}}` and the database service must be named `Postgres`. |
| `api` health check fails | Check the logs for the real error; the check calls `/api/health`. |
| Login page shows `Failed to fetch` / 502 from the site | `API_INTERNAL_URL` is wrong or `api` is down. Fix it and **redeploy `web`**. |
| Can't sign in | Wrong `SEED_ADMIN_*` values: they only apply on the first seed. Change the password in the app, or delete the database data and redeploy. |
| Uploaded files vanish | The `/data` volume is missing, or `UPLOAD_DIR` is not `/data/uploads`. |

## Production note
Treat this as a **dev** environment. Before real users: use a strong unique `JWT_SECRET` and Owner password, add a custom domain, and enable Railway's database backups.
