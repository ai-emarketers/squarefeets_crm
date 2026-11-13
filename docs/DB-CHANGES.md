# Database & API changes — Team, My account, export approvals

This release adds server-side rules behind the Team, My account and Export screens. It needs **one database migration**.

## What changed in the database

Migration: `apps/api/prisma/migrations/20261113120000_team_exports_audit/migration.sql`

| Change | Why |
|---|---|
| `User.lastLoginAt` (new, nullable) | "Last sign-in" column on the Team screen. Set on every successful sign-in. |
| `User.sessionsValidFrom` (new, nullable) | Sign-in tokens issued before this moment are refused. Set when a password is reset or a member is deactivated, so old logins die at once (even if the member is re-activated later). |
| `ExportRequest` (new table) | Export approval requests, replacing the `exportReq` JSON blob in `KvStore`. Columns: id, kind, filters, rowCount, requestedBy, requestedAt, status, decidedBy, decidedAt. |
| `AuditLog` (new table) | Append-only record of team changes, password resets/changes and export requests/decisions. Never stores passwords or phone numbers. |

The migration only **adds** columns and tables. Existing export requests are **copied** from `KvStore` (`key = 'exportReq'`) into
`ExportRequest`, and then that one KvStore row is removed. Nothing else is touched, so it is safe on a database that already has data.

## How it reaches each environment

* **Railway:** nothing to do. The API start command already runs `npx prisma migrate deploy`, so the migration is applied
  automatically when the new version deploys (before the API starts). Check the API deploy log for
  `Applying migration 20261113120000_team_exports_audit`.
* **Your PC (local development):** with Docker/Postgres running, from `apps/api`:
  ```powershell
  npx prisma migrate deploy      # applies the new migration to your local database
  npx prisma generate            # refreshes the TypeScript client (npm install also does this)
  ```
  Then restart `npm run dev`. If you re-seed (`npm run prisma:seed`) everything is wiped and rebuilt, including the new tables.

## New / changed API endpoints

| Endpoint | Who | Notes |
|---|---|---|
| `GET /api/team` | Team read | no sensitive fields; now includes `lastLoginAt` |
| `POST /api/team` | Team write | add a member |
| `PATCH /api/team/:name` | Team write | edit (send only the fields to change) |
| `POST /api/team/:name/status` | Team write | `{ "status": "Active" \| "Disabled" }` |
| `DELETE /api/team/:name` | Team write | remove a member |
| `POST /api/team/:name/password` | Owner / Admin | `{ password, email? }`; now 400 (not 403) for a short password; no longer re-activates a Disabled member |
| `POST /api/auth/password` | signed-in user | wrong current password is now **400**, not 401 |
| `GET /api/exports/requests` | signed-in | approvers see all, others their own |
| `POST /api/exports/requests` | needs the export action | file a request |
| `POST /api/exports/requests/:id/decision` | `approveExports` | `{ "status": "Approved" \| "Rejected" }`; not on your own request (Owner excepted) |
| `POST /api/exports/requests/:id/downloaded` | the requester | only after approval |
| `GET /api/audit?limit=30` | Team read | recent activity, newest first |

Rules enforced on the server (also when the web app saves through `/api/sync`): the Owner cannot be edited by others, deactivated or
removed; nobody can deactivate/remove/re-role themselves; roles must be Admin, Manager, Agent or Field staff; e-mail must be valid and unique;
the member's current sign-ins end on password reset or deactivation.

**Limit to know about:** export CSV files are still built in the browser from data the person can already see. Approval is a tracked,
permission-checked workflow with an audit trail — it is not a technical barrier against copying data already on screen.

## Checks

```powershell
cd apps\api
npm run typecheck          # TypeScript across the whole API
npm run test:services      # 14 rule tests (team, exports, auth) using an in-memory stand-in for the database
```
