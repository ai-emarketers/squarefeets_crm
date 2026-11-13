# Architecture notes

## Why `bootstrap` + `sync`
The approved prototype keeps one in-memory state object and re-renders on every action. To keep 100% of its behaviour,
the UI engine is mounted unchanged inside Next.js and its state is hydrated from `GET /api/bootstrap`. After each action the
engine calls `ADAPTER.save(S)` (src/engine/sync.ts), which diffs the state against the last acknowledged snapshot and sends only
the changed records to `POST /api/sync`.

* Collections → tables: projects, props→Property, leads, prospects, reqs→Requirement, visits, fus→FollowUp, deals, brok→Brokerage.
* Small collections (alerts, viewLog, exportLog, imports, mreq, roles) → `KvStore` JSON rows.
* Export approval requests → `ExportRequest` table; sensitive actions (team changes, password resets, export decisions) → `AuditLog` table.
  See `docs/DB-CHANGES.md`.
* org / perms / masters → `Organization`; amenities → `Amenity`; team → `User`; documents → `FileRecord` (+ files on disk).
* List order: new records get an `_o` key between their neighbours so newest-first lists keep their order after reload.
* Primary keys are the human codes (`RS001`, `DEAL-0142`, `VIS-3392` …) so URLs are stable and readable.
* `CrudService` maps flat client objects to columns + JSONB `data` and merges updates; masked values coming back from the
  client never overwrite stored real numbers.

## Team, exports and audit (server rules)
* `TeamService` owns every rule about members (owner protection, no self-lockout, unique e-mail, role list). The REST endpoints
  (`/api/team …`) and the web app's `/api/sync` both call it, so they cannot disagree.
* `ExportsService` owns the approval workflow (`/api/exports/requests …`). The web app still sends `exportReq` through `/api/sync`;
  the server turns each change into a checked operation and ignores forged status changes.
* `AuditService` (global module) records who did what; `GET /api/audit` feeds the Team screen's "Recent activity".
* Sign-in tokens carry their issue time; resetting a password or deactivating a member sets `User.sessionsValidFrom`, which
  immediately invalidates that member's older tokens.

## Migrating a screen to React
1. Pick a screen (e.g. Leads). Create `apps/web/src/features/leads/`.
2. Use the REST endpoint (`/api/leads`) or the bootstrap data via a small data hook.
3. Remove the screen's `*View` function and its `ACTS` entries from `crm-engine.ts` and route to the new page.
