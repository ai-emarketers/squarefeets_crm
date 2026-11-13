import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../auth/permissions.service';
import { AuthService } from '../auth/auth.service';
import { AuthUser } from '../auth/auth.decorators';
import { ProjectsService } from '../projects/projects.service';
import { PropertiesService } from '../properties/properties.service';
import { LeadsService } from '../leads/leads.service';
import { ProspectsService } from '../prospects/prospects.service';
import { RequirementsService } from '../requirements/requirements.service';
import { VisitsService } from '../visits/visits.service';
import { FollowUpsService } from '../followups/followups.service';
import { DealsService } from '../deals/deals.service';
import { BrokerageService } from '../brokerage/brokerage.service';
import { CrudService } from '../crud/crud.service';
import { deepMask } from '../common/mask';
import { removeFile } from '../files/files.util';

// StateService — the bridge between the web app's in-memory state and the database.
//  - bootstrap(): read everything the signed-in user may see.
//  - apply():     write the changes the web app sends back (with permission checks).

/** Collection name used by the web app  ->  [service key, permission module, primary key]  (in dependency order). */
const COLLECTIONS: [string, string, string, string][] = [
  ['projects', 'projects', 'projects', 'id'],
  ['props', 'properties', 'properties', 'id'],
  ['leads', 'leads', 'leads', 'id'],
  ['prospects', 'prospects', 'prospects', 'id'],
  ['reqs', 'requirements', 'requirements', 'id'],
  ['visits', 'visits', 'visits', 'id'],
  ['fus', 'visits', 'followups', 'id'],
  ['deals', 'deals', 'deals', 'id'],
  ['brok', 'brokerage', 'brokerage', 'deal'],
];
/** Small collections stored as JSON in KvStore. */
const KV_KEYS = ['mreq', 'alerts', 'viewLog', 'exportReq', 'exportLog', 'imports', 'roles'];
// Organization keys stored in real columns; any other org key is kept in the `settings` JSON.
const ORG_COLUMNS = ['name', 'rera', 'gstin', 'city', 'state', 'country', 'bank', 'persona', 'notif'];

@Injectable()
export class StateService {
  // service lookup by key (projects, properties, leads, ...), used to loop over COLLECTIONS generically
  private svc: Record<string, CrudService>;
  constructor(
    private prisma: PrismaService, private perms: PermissionsService, private auth: AuthService,
    projects: ProjectsService, properties: PropertiesService, leads: LeadsService, prospects: ProspectsService,
    requirements: RequirementsService, visits: VisitsService, followups: FollowUpsService, deals: DealsService, brokerage: BrokerageService,
  ) {
    this.svc = { projects, properties, leads, prospects, requirements, visits, followups, deals, brokerage } as any;
  }

  // ------------------------------------------------------------------------------------------------ bootstrap
  // Build the full snapshot for this user.
  async bootstrap(user: AuthUser) {
    const profile = await this.auth.profile(user.id);
    const see = profile.seeNumbers;                   // may this user see full phone numbers?
    const out: any = { profile, me: user.name };
    // Every collection: empty when the role has no access to its module, otherwise the list.
    for (const [coll, mod, svcKey] of COLLECTIONS) {
      const rows: any[] = profile.levels[mod] === 'none' ? [] : await this.svc[svcKey].list(user);
      // the UI keeps its own list order (newest-first lists etc.) in `_o`
      out[coll] = rows.map((r, i) => [r, i] as const).sort((a, b) => (a[0]._o ?? a[1]) - (b[0]._o ?? b[1]) || a[1] - b[1]).map((x) => x[0]);
    }
    // Organisation profile (columns + settings JSON merged), permission matrix, masters (dropdown lists), amenities.
    const org = (await this.prisma.organization.findUnique({ where: { id: 'org' } })) as any;
    out.org = org ? { ...(org.settings || {}), name: org.name, rera: org.rera, gstin: org.gstin, city: org.city, state: org.state, country: org.country, bank: org.bank, persona: org.persona, notif: org.notif } : {};
    out.perms = org?.perms || {};
    out.masters = org?.masters || {};
    out.amen = await this.prisma.amenity.findMany({ orderBy: { cat: 'asc' } });
    // Team members shown in Settings and used for assignee dropdowns.
    out.team = (await this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } })).map((u) => this.teamOut(u, see));
    // Small JSON collections (mask requests, alerts, view log, export requests/log, imports, roles).
    const kv = await this.prisma.kvStore.findMany();
    for (const k of KV_KEYS) out[k] = (kv.find((x) => x.key === k)?.value as any) ?? [];
    // Document metadata grouped by scope (e.g. 'prop:RS001'); the binary is fetched separately via /api/files.
    out.files = {};
    for (const f of await this.prisma.fileRecord.findMany({ orderBy: { createdAt: 'asc' } })) {
      if (f.scope.includes('__draft')) continue; // files uploaded into a form that was never saved
      (out.files[f.scope] ||= []).push(this.fileOut(f));
    }
    // Final safety net: mask any phone/email that slipped through when the user may not see numbers.
    return see ? out : deepMask(out);
  }

  // Shape a user row like the prototype's team member object (never includes the password hash).
  teamOut(u: any, see: boolean) {
    const o: any = { name: u.name, role: u.role, phone: u.phone, corp: u.corpPhone, alt: u.altPhone, email: u.email || '', status: u.status, leads: 0, seeNumbers: u.seeNumbers };
    return o;
  }
  // Shape a FileRecord row like the prototype's file object; hasBlob says whether a real upload exists.
  fileOut(f: any) {
    const { data, scope, mime, shared, path, createdAt, ...rest } = f;
    return { ...(data || {}), ...rest, type: mime, share: shared, hasBlob: !!path };
  }

  // ------------------------------------------------------------------------------------------------ sync
  /**
   * changes = { projects: { put: [doc], del: [id] }, …, org: {…}, perms: {…}, masters: {…}, amen: { put, del },
   *             team: { put, del }, kv: { alerts: [...] }, files: { put: [{scope, …}], del: [id] } }
   * Returns the list of rejected operations (permission or validation) so the client can warn and reload.
   */
  async apply(user: AuthUser, changes: any) {
    // Operations that failed (permission/validation) are collected instead of aborting the whole sync.
    const rejected: { c: string; id?: string; reason: string }[] = [];
    // Run one operation; on error record it in `rejected` and carry on.
    const guard = async (c: string, fn: () => Promise<any>, id?: string) => {
      try { await fn(); } catch (e: any) { rejected.push({ c, id, reason: e?.message || 'failed' }); }
    };
    // 1) Upserts in dependency order (projects before properties before leads ...), only with write access.
    for (const [coll, mod, svcKey, pk] of COLLECTIONS) {
      const ch = changes?.[coll]; if (!ch?.put?.length) continue;
      if ((await this.perms.level(user, mod)) !== 'write') { rejected.push({ c: coll, reason: `No write access to ${mod}` }); continue; }
      for (const doc of ch.put) await guard(coll, () => this.svc[svcKey].upsert(doc, user), doc?.[pk]);
    }
    // 2) Deletes in reverse order so children go before parents.
    for (const [coll, mod, svcKey, pk] of [...COLLECTIONS].reverse()) {
      const ch = changes?.[coll]; if (!ch?.del?.length) continue;
      if ((await this.perms.level(user, mod)) !== 'write') { rejected.push({ c: coll, reason: `No write access to ${mod}` }); continue; }
      for (const id of ch.del) await guard(coll, () => this.svc[svcKey].remove(String(id), user), id);
    }
    // 3) Organisation profile, role permissions and masters.
    if (changes?.org || changes?.perms || changes?.masters) await guard('org', () => this.saveOrg(user, changes));
    // 4) Amenity master list.
    if (changes?.amen) await guard('amen', () => this.saveAmen(user, changes.amen));
    // 5) Team members.
    if (changes?.team) await guard('team', () => this.saveTeam(user, changes.team));
    // 6) Small JSON collections (whitelisted keys only).
    if (changes?.kv) for (const k of Object.keys(changes.kv)) if (KV_KEYS.includes(k)) await guard(k, () => this.prisma.kvStore.upsert({ where: { key: k }, create: { key: k, value: changes.kv[k] }, update: { value: changes.kv[k] } }));
    // 7) Document metadata (adds/removes).
    if (changes?.files) await guard('files', () => this.saveFiles(user, changes.files));
    this.perms.invalidate();   // permission matrix may have changed — drop the cache
    return { ok: rejected.length === 0, rejected };
  }

  // Save organisation settings. Profile needs team-write; role matrix is owner-only; masters need the 'masters' action.
  private async saveOrg(user: AuthUser, c: any) {
    const data: any = {};
    if (c.org) {
      if ((await this.perms.level(user, 'team')) !== 'write') throw new ForbiddenException('No write access to settings');
      const settings: any = {};
      for (const k of Object.keys(c.org)) { if (ORG_COLUMNS.includes(k)) data[k] = c.org[k]; else settings[k] = c.org[k]; }
      data.settings = settings;
    }
    if (c.perms) { if (user.role !== 'Owner') throw new ForbiddenException('Only the owner can change role permissions'); data.perms = c.perms; }
    if (c.masters) { if (!(await this.perms.can(user, 'masters'))) throw new ForbiddenException('You cannot edit masters'); data.masters = c.masters; }
    await this.prisma.organization.upsert({ where: { id: 'org' }, create: { id: 'org', ...data }, update: data });
  }

  // Add/rename/remove amenities (needs the 'masters' action permission).
  private async saveAmen(user: AuthUser, ch: any) {
    if (!(await this.perms.can(user, 'masters'))) throw new ForbiddenException('You cannot edit masters');
    for (const a of ch.put || []) await this.prisma.amenity.upsert({ where: { id: a.id }, create: { id: a.id, label: a.label, cat: a.cat }, update: { label: a.label, cat: a.cat } });
    for (const id of ch.del || []) await this.prisma.amenity.deleteMany({ where: { id } });
  }

  // Add/edit/remove team members. The Owner row can only be edited by the Owner and can never be deleted.
  private async saveTeam(user: AuthUser, ch: any) {
    if ((await this.perms.level(user, 'team')) !== 'write') throw new ForbiddenException('No write access to team');
    for (const t of ch.put || []) {
      const existing = await this.prisma.user.findUnique({ where: { name: t.name } });
      if (existing?.role === 'Owner' && user.role !== 'Owner') continue; // only the owner edits the owner
      const data = { name: t.name, role: existing?.role === 'Owner' ? 'Owner' : t.role || 'Agent', phone: String(t.phone || ''), corpPhone: String(t.corp || ''), altPhone: String(t.alt || ''), email: t.email ? String(t.email).toLowerCase() : null, status: t.status || 'Active', seeNumbers: !!t.seeNumbers };
      // keep the stored number if the client sent back a masked one
      for (const k of ['phone', 'corpPhone', 'altPhone']) if ((data as any)[k].includes('•') && existing) (data as any)[k] = (existing as any)[k];
      if (existing) await this.prisma.user.update({ where: { id: existing.id }, data });
      else await this.prisma.user.create({ data: { ...data, status: t.status || 'Invited' } });
    }
    for (const name of ch.del || []) await this.prisma.user.deleteMany({ where: { name, role: { not: 'Owner' } } });
  }

  // Save document metadata. The scope prefix (prop/proj/lead/...) decides which module's write permission is needed.
  private async saveFiles(user: AuthUser, ch: any) {
    const SCOPE_MODULE: Record<string, string> = { prop: 'properties', proj: 'projects', pros: 'prospects', lead: 'leads', deal: 'deals', brok: 'brokerage', visit: 'visits', req: 'requirements' };
    for (const f of ch.put || []) {
      const mod = SCOPE_MODULE[String(f?.scope || '').split(':')[0]];
      if (mod && (await this.perms.level(user, mod)) !== 'write') throw new ForbiddenException(`No write access to ${mod} documents`);
      const { id, scope, name, cat, size, type, st, valid, share, thumb, url, hasBlob, ...rest } = f;
      if (!id || !scope) continue;
      const data: any = { name: name || 'file', cat: cat || 'Other', size: Number(size) || 0, mime: type || '', st: st || 'Uploaded', valid: valid || '', shared: !!share, scope, data: rest };
      await this.prisma.fileRecord.upsert({ where: { id }, create: { id, ...data }, update: data });
    }
    // Deleting a document also removes the uploaded file from disk.
    for (const id of ch.del || []) {
      const row = await this.prisma.fileRecord.findUnique({ where: { id } });
      if (row) { await this.prisma.fileRecord.delete({ where: { id } }); await removeFile(row.path); }
    }
  }
}
