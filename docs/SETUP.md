# SquareFeets Realty CRM — Setup & Credentials Guide

Use this guide to run the CRM on a new computer (Windows, macOS or Linux), and as the single reference for
every login, password and address the project uses.

> **Keep this file private.** The values below are the *development defaults*. Before putting the CRM on the
> internet, change every password and secret marked **CHANGE IN PRODUCTION** (see section 8).

---

## 1. Credentials at a glance

| What | Value (default) | Where it is set | Change in production? |
| --- | --- | --- | --- |
| **CRM login — Owner email** | `anil@sharmaproperty.in` | `SEED_ADMIN_EMAIL` in `apps/api/.env` | Optional |
| **CRM login — Owner password** | `ChangeMe@123` | `SEED_ADMIN_PASSWORD` in `apps/api/.env` | **YES** |
| Database host / port | `localhost` / `5432` | `docker-compose.yml`, `DATABASE_URL` | Your server |
| Database name | `squarefeets_crm` | `docker-compose.yml`, `DATABASE_URL` | Optional |
| Database user | `squarefeets` | `docker-compose.yml`, `DATABASE_URL` | **YES** |
| Database password | `squarefeets` | `docker-compose.yml`, `DATABASE_URL` | **YES** |
| Full database URL | `postgresql://squarefeets:squarefeets@localhost:5432/squarefeets_crm?schema=public` | `DATABASE_URL` in `apps/api/.env` | **YES** |
| JWT secret (signs logins) | `change-me-to-a-long-random-string` | `JWT_SECRET` in `apps/api/.env` | **YES** |
| Login validity | `7d` (7 days) | `JWT_EXPIRES_IN` in `apps/api/.env` | Optional |
| API address | `http://localhost:4000/api` | `API_PORT` (API), `NEXT_PUBLIC_API_URL` (web) | Your domain |
| Website address | `http://localhost:3000` | `WEB_ORIGIN` in `apps/api/.env` | Your domain |
| Uploaded documents folder | `apps/api/uploads` | `UPLOAD_DIR` in `apps/api/.env` | Optional |
| Git repository | `https://github.com/ai-emarketers/squarefeets_crm.git` (branch `main`) | `git remote -v` | — |

**Git access:** the repository belongs to the GitHub account/organisation `ai-emarketers`. To clone or push on a
new computer, sign in with a GitHub account that has access to it (GitHub may ask you to sign in in the browser,
or for a *Personal Access Token* instead of a password). Never write GitHub passwords or tokens into this
project or this file.

**Other team members:** only the Owner has a password after seeding. Members you add in
*Settings → Team* start as "Invited" and need a password set before they can sign in (see section 6).

---

## 2. Install these first (one time per computer)

| Software | Version | Download | Check it works |
| --- | --- | --- | --- |
| Node.js | 20 LTS or newer | https://nodejs.org | `node -v` |
| Git | any recent | https://git-scm.com | `git --version` |
| Docker Desktop | any recent | https://www.docker.com/products/docker-desktop | `docker -v` (Docker Desktop must be **running**) |
| VS Code (optional) | any | https://code.visualstudio.com | — |

Docker only provides the PostgreSQL database. If you already have PostgreSQL 14+ installed, you can skip Docker
and point `DATABASE_URL` at your own database instead.

**Windows only — PowerShell "running scripts is disabled" error.** Run once, then reopen the terminal:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
```

(Or type `npm.cmd` instead of `npm` in every command below, or use *Command Prompt* instead of PowerShell.)

---

## 3. Get the code

```bash
git clone https://github.com/ai-emarketers/squarefeets_crm.git
cd squarefeets_crm
```

To bring an existing copy up to date later: `git pull`.

---

## 4. First-time setup (run in the project folder, in order)

```bash
# 1. Install all packages (root, API and web) — takes a few minutes
npm run install:all

# 2. Create the settings files from the templates
#    Windows:
copy apps\api\.env.example apps\api\.env
copy apps\web\.env.example apps\web\.env.local
#    macOS / Linux:
#    cp apps/api/.env.example apps/api/.env
#    cp apps/web/.env.example apps/web/.env.local

# 3. Start the database (Docker Desktop must be running)
npm run db:up

# 4. Create the database tables
npm run db:migrate        # if asked for a migration name, type: init

# 5. Load the demo data and the Owner login
npm run db:seed
```

Step 5 prints `Done. Sign in with anil@sharmaproperty.in / ChangeMe@123`.

> **Warning:** `npm run db:seed` **deletes all data** in the database before loading the demo data. Run it only
> on a fresh install or when you really want to start over.

---

## 5. Run the CRM (every day)

Open **two** terminals in the project folder:

```bash
# Terminal 1 — API (port 4000). Wait for: "SquareFeets CRM API running on http://localhost:4000/api"
npm run dev:api

# Terminal 2 — website (port 3000). Wait for: "Ready"
npm run dev:web
```

Then open **http://localhost:3000** and sign in with the Owner login from section 1.

- Check the API alone: http://localhost:4000/api/health should reply `ok`.
  (http://localhost:4000/api by itself shows "Cannot GET /api" — that is normal.)
- Stop either server with `Ctrl + C`. Stop the database with `npm run db:down` (your data is kept).
- After restarting the computer: start Docker Desktop, then `npm run db:up`, then the two terminals above.

---

## 6. Give a team member a login

1. Sign in as the Owner and add the person in **Settings → Team** (name, role, phone, **email**).
2. Set their password (the Owner or an Admin can do this). In PowerShell, with the API running:

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/auth/login `
  -ContentType 'application/json' -Body '{"email":"anil@sharmaproperty.in","password":"ChangeMe@123"}'
$h = @{ Authorization = "Bearer $($login.token)" }
Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/team/Priya%20Nair/password" -Headers $h `
  -ContentType 'application/json' -Body '{"password":"Their-New-Pass1","email":"priya@example.com"}'
```

Replace the Owner password if you changed it, `Priya%20Nair` with the member's name exactly as shown in
Settings (spaces written as `%20`), and the password/email with theirs (password: at least 8 characters).
They can now sign in at http://localhost:3000; what they see depends on their role's permissions in
*Settings → Roles & permissions*.

**Change your own password:** `POST /api/auth/password` with `{"current":"...","next":"..."}` (same pattern as above).

---

## 7. Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev:api` / `npm run dev:web` | Run the API / website in development mode |
| `npm run db:up` / `npm run db:down` | Start / stop the PostgreSQL container |
| `npm run db:migrate` | Apply schema changes to the database |
| `npm run db:seed` | **Wipe** and reload the demo data |
| `npm run db:studio` | Browse and edit the database tables in the browser |
| `npm run typecheck` | Check both apps for code errors |
| `npm run build` | Production build of both apps |

---

## 8. Before going live (production checklist)

1. **Database:** use a managed PostgreSQL (or your server's) with a **strong unique password**; put its URL in
   `DATABASE_URL`. Do not expose port 5432 to the internet.
2. **JWT secret:** set `JWT_SECRET` to a long random value, e.g. generate one with
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
   Changing it later signs everyone out.
3. **Owner password:** set `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` **before** seeding, or change the
   password after the first login (section 6). Do not use `ChangeMe@123` in production.
4. **Do not run `db:seed` on the live database** (it deletes everything). Apply schema changes with
   `npx prisma migrate deploy` (run inside `apps/api`).
5. **Addresses:** set `WEB_ORIGIN` (API) to your website address, and `NEXT_PUBLIC_API_URL` (web, at build time)
   to your API address ending in `/api`. Serve both over **HTTPS**.
6. **Build & start:** `npm run build`, then `npm --prefix apps/api run start:prod` and
   `npm --prefix apps/web run start`.
7. **Backups:** back up the database (`pg_dump`) and the `UPLOAD_DIR` folder regularly.
8. **Secrets stay out of Git:** `.env` files are ignored by `.gitignore` — keep it that way.

---

## 9. Troubleshooting

| Message | Fix |
| --- | --- |
| `running scripts is disabled on this system` | See section 2 (Windows) |
| `Environment variable not found: DATABASE_URL` | `apps/api/.env` is missing — redo step 2 of section 4 (check it is not named `.env.txt`) |
| `Can't reach database server at localhost:5432` | Start Docker Desktop, then `npm run db:up` |
| `docker is not recognized` | Install / start Docker Desktop and reopen the terminal |
| Login page: `Failed to fetch` | The API is not running — start `npm run dev:api` (and check its terminal for errors) |
| Login page: `Invalid email or password` | Wrong login, or the database was never seeded — `npm run db:seed` on a fresh install |
| `Can't reach the CRM server` after login | API stopped or crashed — check terminal 1 |
| `Port 3000/4000 is already in use` | An old server is still running — close that terminal, or change `API_PORT` / the web port |
