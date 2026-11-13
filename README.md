# SquareFeets Realty CRM

Real-estate CRM for independent brokers and small teams (India-focused): projects, property inventory, leads,
prospects, requirements & smart matching, visits & calendar, follow-ups, deals, brokerage & invoices, document
vault, CSV/Excel import & export, AI capture, team & role permissions.

| Layer    | Stack                                                      |
|----------|------------------------------------------------------------|
| Frontend | Next.js 14 (App Router) · React 18 · TypeScript            |
| Backend  | Node.js · NestJS 10 · Prisma 5 · JWT auth · Multer uploads |
| Database | PostgreSQL 16 (Docker Compose)                             |

```
squarefeets_crm/
├─ apps/
│  ├─ api/                NestJS API
│  │  ├─ prisma/          schema.prisma · seed.ts · seed-data.json (demo data from the prototype)
│  │  └─ src/
│  │     ├─ auth/         login, JWT, role × module permission guards
│  │     ├─ crud/         generic document-style CRUD base (columns + JSONB `data`)
│  │     ├─ projects · properties · leads · prospects · requirements(+matching) · visits · followups · deals · brokerage
│  │     ├─ state/        GET /bootstrap · POST /sync  (what the web app uses)
│  │     ├─ files/        document upload / download
│  │     └─ team/         set sign-in passwords
│  └─ web/                Next.js app
│     └─ src/
│        ├─ app/          /login · everything else is served by the CRM shell ([[...slug]])
│        ├─ engine/       crm-engine.ts (all prototype screens) · sync.ts (API bridge)
│        └─ lib/api.ts    fetch helper + token handling
├─ docker-compose.yml     PostgreSQL
└─ docs/ARCHITECTURE.md
```

## Run it locally (Windows / macOS / Linux)

Prerequisites: **Node.js 20+**, **Docker Desktop** (or any PostgreSQL 14+), Git.

```bash
cd D:\projects\squarefeets_crm

# 1. configuration
copy .env.example apps\api\.env            # macOS/Linux: cp .env.example apps/api/.env
copy apps\web\.env.example apps\web\.env.local

# 2. dependencies
npm run install:all

# 3. database
npm run db:up                               # starts PostgreSQL in Docker
npm run db:migrate                          # first run: name the migration "init", then commit apps/api/prisma/migrations
#   (quick alternative without migration files:  npm run db:push)
npm run db:seed                             # loads the prototype's demo data

# 4. start (two terminals)
npm run dev:api                             # http://localhost:4000/api
npm run dev:web                             # http://localhost:3000
```

Sign in with **anil@sharmaproperty.in / ChangeMe@123** (from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `apps/api/.env`).
Change the password and `JWT_SECRET` before any real use. Re-running `npm run db:seed` resets the demo data.

Useful scripts: `npm run db:studio` (browse the database), `npm run typecheck`, `npm run build`.

## How the data flows

* `GET /api/bootstrap` returns the signed-in user's profile + every collection in the shapes the UI uses
  (phone numbers/emails are masked unless the role has the *See full phone numbers* permission).
* Every edit in the UI is diffed in the browser and sent to `POST /api/sync` (puts/deletes per collection). The API
  checks the role's read/write level per module and returns anything it refused, which the UI reports.
* Typed columns hold the searchable fields; everything else is kept in a JSONB `data` column per record.
* Document files are uploaded to `POST /api/files/upload` (stored under `UPLOAD_DIR`) and opened through the API.
* A normal REST surface also exists for each module (`/api/projects`, `/api/properties`, `/api/leads`,
  `/api/prospects`, `/api/requirements`, `/api/visits`, `/api/followups`, `/api/deals`, `/api/brokerage`,
  `/api/matches/pending`, `/api/matches/:requirementId`) for integrations and for the future React rewrite of each screen.

## Roles & permissions

Roles: Owner (full access), Admin, Manager, Agent, Field staff. The role × module matrix (none / read / write) and the
action permissions (export, import, see numbers, masters, approve exports) are the ones from the prototype, stored in
`Organization.perms` and editable in **Settings**. They are enforced by the API (guards) and by the UI.

## Known limitations (read before production)

* **Single organisation per deployment** (no tenant column). Multi-tenant SaaS needs an `orgId` on every table.
* The UI engine is the prototype's view layer carried over unchanged so that no screen is lost; it renders HTML strings
  and is not yet split into React components. Move one screen at a time into `apps/web/src/features/` using the REST API.
* Document-request links for outside parties (`/upload/<deal>/<token>`) open inside the signed-in app only; a public,
  token-based upload endpoint is still to be built.
* Business rules (deal stages, brokerage maths, import analysis) run in the browser engine; the API stores the result and
  enforces permissions, but does not re-validate those rules yet.
* There are no automated tests yet.

## Reading the code

Every source file carries inline comments that explain what it does and why (API modules, Prisma schema, seed script,
web pages, the API client, the sync adapter and the UI engine). JSON files (`package.json`, `tsconfig` in some tools)
cannot hold comments, so their purpose is described here:

| File | Purpose |
| --- | --- |
| `package.json` (root) | Workspace scripts: `install:all`, `db:up/down/migrate/push/seed/studio`, `dev:api`, `dev:web`, `build`, `typecheck` |
| `apps/api/package.json` | NestJS/Prisma dependencies and API scripts (`start:dev`, `build`, `prisma:*`) |
| `apps/web/package.json` | Next.js/React dependencies and web scripts (`dev`, `build`, `typecheck`) |
| `apps/api/nest-cli.json` | Nest build settings (source root `src`) |
| `apps/api/tsconfig*.json` | TypeScript settings for the API (decorators enabled, output to `dist`) |
| `apps/api/prisma/seed-data.json` | Demo data extracted from the prototype, loaded by `seed.ts` |
| `.vscode/*.json` | Recommended extensions and format-on-save settings |

Start with `docs/ARCHITECTURE.md`, then read `apps/api/src/app.module.ts` (how the API is assembled),
`apps/api/src/crud/crud.service.ts` (the generic data layer), `apps/api/src/state/state.service.ts` (bootstrap/sync),
and `apps/web/src/engine/sync.ts` (how the browser saves).
