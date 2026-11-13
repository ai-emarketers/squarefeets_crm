# Screens by module

Every module and the screens it has. Routes are paths on the website (for example `/leads/l1`).
Edit and delete follow the rules in the setup guide: nothing that other records depend on can be deleted.

| Module | List | Add | Detail | Edit | Delete / other actions |
|---|---|---|---|---|---|
| Dashboard | `/dashboard` | — | — | — | Today's schedule, matches, pipeline, alerts |
| Projects | `/projects` | `/projects/new` | `/projects/:id` | `/projects/:id/edit` | Delete (blocked while properties use it) |
| Properties | `/properties` | `/properties/new` | `/properties/:id` | `/properties/:id/edit` | Delete, share documents, location / address / amenity pickers (`/pick/...`) |
| Leads | `/leads` | "Add lead" dialog | `/leads/:id` | Edit dialog | Delete, convert to prospect |
| Prospects | `/prospects` | "Add prospect" dialog | `/prospects/:id` | Edit dialog | Delete |
| Requirements | `/requirements` | `/requirements/new` | `/requirements/:id` | Edit form | Delete |
| Matches | `/matches` | — | — | — | Share, schedule visit |
| Visits | `/visits` (calendar + list) | "Schedule visit" dialog | `/visits/:id` | Edit dialog | Reschedule, outcome, delete |
| Follow-ups | `/followups` | "Add follow-up" dialog | — | Edit dialog | Mark done, delete |
| Deals | `/deals` | `/deals/new` | `/deals/:id` | Inline on the deal page | Offers, parties, documents, mark sold / lost, delete |
| Brokerage | `/brokerage` | (created with a deal) | `/brokerage/:deal` | Inline (split, deductions) | Record payment, invoice, waive / write off |
| AI capture | `/capture` | — | — | — | Turn text / call / screenshot into a lead |
| Import | `/import` | — | — | — | CSV import |
| Export | `/export` | — | — | — | CSV export; request / approve / download when approval is on (decisions are checked and logged on the server) |
| Masters | `/masters` | add item | — | — | Dropdown lists, amenities, change requests |
| **Team** | `/team` | "Add member" dialog | — | Edit dialog | Set / reset password, deactivate, remove, phone-number access, last sign-in, roles & permissions matrix, recent activity |
| **My account** | `/account` | — | — | — | Change your own password, sign out |
| Settings | `/settings` | — | — | Organisation, region, notifications | Portal switches, export-approval switch, view log |
| Public upload | `/upload/...` | — | — | — | Document upload page opened from a request link (no sign-in) |

Added in the screen review: **Team**, **My account**, the **export-approval queue** (and its switch in Settings), and a
**notifications list** built from real data. Before that, the Team page and roles matrix had their actions in the code but no screen.
