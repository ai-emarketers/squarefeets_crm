# QA agent

Automated tests for the whole CRM. Safe for a dev database: everything it creates is deleted again.

## 1. API + data-rules suite (command line)
Start the API and the website, then from the repo root:

```bash
npm run qa            # or: node tools/qa-agent/qa-agent.mjs
```

Environment overrides: `API_URL`, `WEB_URL`, `QA_EMAIL`, `QA_PASSWORD`. Needs Node 18+, no packages.
It writes `tools/qa-agent/report.md` and exits with code 1 if any check fails (usable in CI).

It checks: health · login/logout security · bootstrap data integrity · create / edit / duplicate-guard / delete for
projects, properties, leads, prospects, requirements, visits, follow-ups · every "linked data cannot be deleted"
rule (and that seeded linked records survive) · settings, amenities, team members and role permissions (a real
Agent user is created, signs in, is checked for masking and owner-only actions, then removed) · garbage and
special-character input · parallel load · every web page and the `/api` proxy.

## 2. UI smoke test (browser)
Sign in at http://localhost:3000, open the browser console (F12) and paste the contents of `ui-smoke.js`.
It opens every screen, detail page and Edit/Delete dialog and returns `{ total, passed, failed, jsErrors }`.
It never confirms a delete, so no data changes.
