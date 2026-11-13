/* Seeds the demo data from the SquareFeets prototype (dates are shifted so "today" in the demo = the day you seed). */
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProjectsService } from '../src/projects/projects.service';
import { PropertiesService } from '../src/properties/properties.service';
import { LeadsService } from '../src/leads/leads.service';
import { ProspectsService } from '../src/prospects/prospects.service';
import { RequirementsService } from '../src/requirements/requirements.service';
import { VisitsService } from '../src/visits/visits.service';
import { FollowUpsService } from '../src/followups/followups.service';
import { DealsService } from '../src/deals/deals.service';
import { BrokerageService } from '../src/brokerage/brokerage.service';

// Demo data extracted from the prototype (see seed-data.json) — one big object with every collection.
const seed: any = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-data.json'), 'utf8'));
// Standalone PrismaService (no Nest app is started for seeding).
const prisma = new PrismaService();
// Fake PermissionsService: the seeder may see real (unmasked) phone numbers.
const perms: any = { canSeeNumbers: async () => true };
// Pretend the seeder is the Owner when calling service.create().
const owner: any = { id: 'seed', name: 'Seed', role: 'Owner' };

// --- date shifting: the prototype's fixed demo 'today' is moved to the day you run the seed ---
const DAY = 86400000;
const toUTC = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
// number of days between the prototype's base date and today
const now = new Date();
const shiftDays = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - toUTC(seed.baseDate)) / DAY);
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** Shift every yyyy-mm-dd (and yyyy-mm-ddThh:mm) in the seed by the same number of days. */
function shift(v: any): any {
  // a date / datetime string: move it by shiftDays, keep any time part
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4}-\d{2}-\d{2})(T.*)?$/);
    return m ? isoDate(toUTC(m[1]) + shiftDays * DAY) + (m[2] || '') : v;
  }
  if (Array.isArray(v)) return v.map(shift);   // recurse into arrays

  // recurse into objects
  if (v && typeof v === 'object') { const o: any = {}; for (const k of Object.keys(v)) o[k] = shift(v[k]); return o; }
  return v;
}

// Insert a list of seed rows through the real services (so ids/columns/data-split behave exactly as in the API).
async function many(svc: any, rows: any[]) {
  // spread createdAt one second apart so default ordering matches the prototype's list order
  const t0 = Date.now() - rows.length * 1000;
  for (let i = 0; i < rows.length; i++) {
    // `_o` remembers the original position for the UI's sort
    const row = await svc.create({ ...shift(rows[i]), _o: i }, owner);
    const pk = svc.pk;
    // keep the prototype's list order (lists are ordered by createdAt)
    await svc.db.update({ where: { [pk]: row[pk] }, data: svc.hasCreated === false ? {} : { createdAt: new Date(t0 + i * 1000) } }).catch(() => undefined);
  }
}

// Entry point: wipes everything, then re-creates org, team, all collections, KV data, documents and counters.
async function main() {
  console.log(`Seeding demo data (dates shifted by ${shiftDays} days)…`);
  // first admin sign-in; override with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in .env
  const email = (process.env.SEED_ADMIN_EMAIL || 'anil@sharmaproperty.in').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe@123';

  // wipe (idempotent re-seed)
  for (const m of ['kvStore', 'fileRecord', 'brokerage', 'deal', 'followUp', 'visit', 'requirement', 'prospect', 'lead', 'property', 'project', 'amenity', 'counter', 'user', 'organization']) {
    await (prisma as any)[m].deleteMany({});
  }

  // --- organisation: profile columns + role permissions + masters; the rest goes into `settings` JSON ---
  const { settings, name, rera, gstin, city, state, country, bank, persona, notif, ...orgRest } = seed.org;
  await prisma.organization.create({
    data: { id: 'org', name, rera, gstin, city, state, country, bank, persona, notif, perms: seed.perms, masters: seed.masters, settings: orgRest },
  });
  // --- amenity master list ---
  await prisma.amenity.createMany({ data: seed.amen.map((a: any) => ({ id: a.id, label: a.label, cat: a.cat })) });

  // --- team: only the Owner gets a password; other members are invited without one ---
  const hash = await bcrypt.hash(password, 10);
  for (const t of seed.team) {
    await prisma.user.create({
      data: { name: t.name, role: t.role, email: t.role === 'Owner' ? email : t.email || null, phone: t.phone, corpPhone: t.corp || '', altPhone: t.alt || '', status: t.status || 'Active', seeNumbers: !!t.seeNumbers, passwordHash: t.role === 'Owner' ? hash : null },
    });
  }

  // --- build each data service by hand (no DI container) ---
  const s = (C: any) => new C(prisma, perms);
  const projects = s(ProjectsService), properties = s(PropertiesService), leads = s(LeadsService), prospects = s(ProspectsService);
  const reqs = s(RequirementsService), visits = s(VisitsService), fus = s(FollowUpsService), deals = s(DealsService), brok = s(BrokerageService);
  // --- insert collections in dependency order ---
  await many(projects, seed.projects);
  await many(properties, seed.props);
  await many(leads, seed.leads);
  await many(prospects, seed.prospects);
  await many(reqs, seed.reqs);
  await many(visits, seed.visits);
  await many(fus, seed.fus);
  await many(deals, seed.deals);
  await many(brok, seed.brok);

  // --- small JSON collections (mask requests, alerts, view/export logs, imports, roles) ---
  for (const k of ['mreq', 'alerts', 'viewLog', 'exportReq', 'exportLog', 'imports', 'roles']) {
    await prisma.kvStore.create({ data: { key: k, value: shift(seed[k] ?? []) } });
  }
  // --- document metadata (no binaries are seeded) ---
  for (const scope of Object.keys(seed.files)) {
    for (const f of shift(seed.files[scope])) {
      const { id, name, cat, size, type, st, valid, share, thumb, url, ...rest } = f;
      await prisma.fileRecord.create({ data: { id, scope, name, cat, size: size || 0, mime: type || '', st: st || 'Uploaded', valid: valid || '', shared: !!share, data: rest } });
    }
  }

  // counters = last used number, so the REST API continues the sequence
  // helper: highest number used so far in an id list (e.g. l12 -> 12)
  const maxNum = (rows: any[], re: RegExp) => Math.max(0, ...rows.map((r) => Number((String(r.id).match(re) || [])[1]) || 0));
  const counters: Record<string, number> = {
    project: maxNum(seed.projects, /^p(\d+)$/), lead: maxNum(seed.leads, /^l(\d+)$/), prospect: maxNum(seed.prospects, /^c(\d+)$/),
    requirement: maxNum(seed.reqs, /^REQ-(\d+)$/), visit: maxNum(seed.visits, /^VIS-(\d+)$/), followup: maxNum(seed.fus, /^f(\d+)$/), deal: maxNum(seed.deals, /^DEAL-(\d+)$/),
  };
  // property ids have per-prefix counters (RS/RR/CS/CR/LS/LR)
  for (const pre of ['RS', 'RR', 'CS', 'CR', 'LS', 'LR']) counters['property-' + pre] = maxNum(seed.props.filter((p: any) => p.id.startsWith(pre)), /^[A-Z]{2}(\d+)$/);
  for (const key of Object.keys(counters)) await prisma.counter.create({ data: { key, n: counters[key] } });

  console.log(`Done. Sign in with ${email} / ${password}`);
}

// Run, report errors with a non-zero exit code, always close the DB connection.
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
