import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../auth/permissions.service';
import { AuthUser } from '../auth/auth.decorators';
import { deepMask, mergeKeepReal } from '../common/mask';

// Description of one column of a Prisma model, read from Prisma's data-model metadata (DMMF).
type FieldInfo = { name: string; type: string; kind: string; isList: boolean; isRequired: boolean };

/**
 * Generic document-style CRUD over a Prisma model.
 *  - Columns declared in schema.prisma are written to their columns; every other key lands in the `data` JSONB column.
 *  - On the way out `data` is flattened back, so the API speaks the same flat object shapes as the prototype.
 *  - Phone / email values are masked for users without the "see full numbers" permission and masked values
 *    coming back from the client never overwrite the stored real ones.
 */
export abstract class CrudService {
  // Name of the Prisma delegate this service works on (set by each subclass).
  protected abstract model: string; // e.g. 'project'
  // Default sort for list(): oldest first. Subclasses may override.
  protected orderBy: any = { createdAt: 'asc' };
  // Whether the table has a `data` JSONB column that holds the free-form (non-column) fields.
  protected hasData = true;

  // Prisma gives DB access, PermissionsService tells us whether the user may see full phone numbers.
  constructor(protected prisma: PrismaService, protected perms: PermissionsService) {}

  // Shortcut to the Prisma delegate, e.g. prisma.lead.
  protected get db(): any { return (this.prisma as any)[this.model]; }
  // Real columns of the model (scalars/enums) — anything else the client sends goes into `data`.
  protected get fields(): FieldInfo[] {
    const m = Prisma.dmmf.datamodel.models.find((x) => x.name.toLowerCase() === this.model.toLowerCase());
    return (m?.fields || []).filter((f) => f.kind === 'scalar' || f.kind === 'enum') as any;
  }
  // Primary-key column name; subclasses override when it is not `id` (e.g. Brokerage uses `deal`).
  protected get pk(): string { return 'id'; }

  // ---- hooks -------------------------------------------------------------------------------------------------
  // Runs before insert — subclasses use it to generate ids (L-1, DEAL-0142...) and defaults.
  protected async beforeCreate(data: any, _user: AuthUser): Promise<any> { return data; }
  // Runs after insert — e.g. create side-effect rows.
  protected async afterCreate(_row: any, _user: AuthUser): Promise<void> {}
  // Runs after update — e.g. react to a status change.
  protected async afterUpdate(_row: any, _before: any, _user: AuthUser): Promise<void> {}
  // Runs before delete — subclasses refuse the delete while other records still point at this one.
  protected async beforeRemove(_row: any, _user: AuthUser): Promise<void> {}
  // Throw a readable 400 listing where a record is still used (same wording idea as the web app's "can't delete" dialog).
  protected refuseIfUsed(label: string, id: string, uses: [number, string][]) {
    const list = uses.filter(([n]) => n > 0).map(([n, what]) => `${n} ${what}`);
    if (list.length) throw new BadRequestException(`${label} ${id} can't be deleted — it is still used: ${list.join('; ')}`);
  }

  // ---- public API --------------------------------------------------------------------------------------------
  // All rows, flattened and (if needed) masked.
  async list(user: AuthUser, where: any = {}) {
    const rows = await this.db.findMany({ where, orderBy: this.orderBy });
    const see = await this.perms.canSeeNumbers(user);
    return rows.map((r: any) => this.out(r, see));
  }
  // One row by primary key (404 if missing).
  async get(id: string, user: AuthUser) {
    const row = await this.db.findUnique({ where: { [this.pk]: id } });
    if (!row) throw new NotFoundException(`${this.model} ${id} not found`);
    return this.out(row, await this.perms.canSeeNumbers(user));
  }
  // One raw DB row (unmasked, with `data` still nested) — for internal use only, never returned to the client.
  async raw(id: string) {
    const row = await this.db.findUnique({ where: { [this.pk]: id } });
    if (!row) throw new NotFoundException(`${this.model} ${id} not found`);
    return row;
  }
  // Insert: split the flat object into columns + data, run the hook, save, return the flattened row.
  async create(body: any, user: AuthUser) {
    let data = this.split(body || {}, null);
    data = await this.beforeCreate(data, user);
    let row: any;
    try { row = await this.db.create({ data }); }
    catch (e: any) { throw new BadRequestException(e?.message?.split('\n').slice(-3).join(' ') || 'Could not save'); }
    await this.afterCreate(row, user);
    return this.out(row, await this.perms.canSeeNumbers(user));
  }
  // Partial update: merge with the stored row (never overwriting real numbers with masked ones).
  // replace = true when the web app sends the whole document (sync): removed fields are removed in the DB too.
  async update(id: string, body: any, user: AuthUser, replace = false) {
    const before = await this.raw(id);
    const data = this.split(body || {}, before, replace);
    delete data[this.pk];
    let row: any;
    try { row = await this.db.update({ where: { [this.pk]: id }, data }); }
    catch (e: any) { throw new BadRequestException(e?.message?.split('\n').slice(-3).join(' ') || 'Could not save'); }
    await this.afterUpdate(row, before, user);
    return this.out(row, await this.perms.canSeeNumbers(user));
  }
  /** Create-or-update by primary key (used by the state sync endpoint). */
  async upsert(doc: any, user: AuthUser) {
    // A sync document must be an object that carries its own primary key — otherwise a stray/garbage entry would
    // silently create an empty record with an auto-generated id.
    if (!doc || typeof doc !== 'object' || Array.isArray(doc) || !doc[this.pk]) throw new BadRequestException(`Record is missing its ${this.pk}`);
    const id = doc[this.pk];
    const { _new, ...clean } = doc;
    const exists = id && (await this.db.findUnique({ where: { [this.pk]: String(id) } }));
    // The web app flags records it has just created with _new. If that id is already taken, another user created a
    // record with the same id in the meantime: refuse instead of silently overwriting their record.
    if (exists && _new) throw new BadRequestException(`${id} was just created by someone else — reload the page and add it again`);
    if (exists) return this.update(String(id), clean, user, true);
    return this.create(clean, user);
  }
  // Delete a row (after the beforeRemove hook).
  async remove(id: string, user: AuthUser) {
    const row = await this.raw(id);
    await this.beforeRemove(row, user);
    await this.db.delete({ where: { [this.pk]: id } });
    return { ok: true };
  }

  // ---- (de)serialisation -------------------------------------------------------------------------------------
  // DB row -> flat client object: spread `data` next to the columns, then mask phones/emails if required.
  out(row: any, seeNumbers: boolean) {
    if (!row) return row;
    const { data, ...rest } = row;
    const flat = this.hasData ? { ...(data || {}), ...rest } : rest;
    return seeNumbers ? flat : deepMask(flat);
  }
  // Convert a client value to the column's type (numbers from text boxes, booleans, string arrays...).
  protected coerce(f: FieldInfo, v: any) {
    if (v === undefined) return undefined;          // not sent -> leave unchanged

    // null clears optional columns but is ignored for required ones
    if (v === null) return f.isRequired ? undefined : null;
    switch (f.type) {
      case 'Int': { if (v === '') return f.isRequired ? 0 : null; const n = Math.round(Number(v)); return Number.isFinite(n) ? n : f.isRequired ? 0 : null; }
      case 'Float': { if (v === '') return f.isRequired ? 0 : null; const n = Number(v); return Number.isFinite(n) ? n : f.isRequired ? 0 : null; }
      case 'Boolean': return v === true || v === 'true' || v === 1;
      case 'String': return f.isList ? (Array.isArray(v) ? v.map(String) : []) : String(v);
      default: return v;
    }
  }
  /** Split a flat client object into column values + the `data` JSON bucket. */
  protected split(body: any, existing: any | null, replace = false) {
    const cols = this.fields;                              // real columns

    const names = new Set(cols.map((c) => c.name));
    const out: any = {};                                   // values for real columns
    const extra: any = {};
    // Walk every key the client sent.
    for (const k of Object.keys(body)) {
      // timestamps are managed by the database
      if (k === 'createdAt' || k === 'updatedAt') continue;
      const v = body[k];
      if (names.has(k)) {                                  // it is a real column

        const f = cols.find((c) => c.name === k)!;
        if (f.type === 'Json') out[k] = mergeKeepReal(existing ? existing[k] : undefined, v, replace) ?? (f.isRequired ? {} : Prisma.JsonNull);
        else { const c = this.coerce(f, v); if (c !== undefined) out[k] = c; }
      } else if (k !== 'data') extra[k] = v;               // unknown key -> goes into the JSONB bucket
    }
    // Merge the extra keys over what is already stored in `data`.
    if (this.hasData) {
      const base = existing?.data && typeof existing.data === 'object' ? existing.data : {};
      const incoming = { ...(body.data && typeof body.data === 'object' ? body.data : {}), ...extra };
      const merged = mergeKeepReal(base, incoming, replace);
      // keys the client explicitly sends as undefined/null clear nothing; explicit removal is done via null
      for (const k of Object.keys(merged)) if (merged[k] === null && k in incoming) delete merged[k];
      out.data = merged;
    }
    // Full replace: optional columns the client no longer sends are cleared (required ones keep their value).
    if (replace && existing) {
      for (const f of cols) {
        if (f.name === this.pk || f.name === 'data' || f.name === 'createdAt' || f.name === 'updatedAt') continue;
        if (!(f.name in body) && !f.isRequired) out[f.name] = f.type === 'Json' ? Prisma.JsonNull : null;
      }
    }
    return out;
  }
}
