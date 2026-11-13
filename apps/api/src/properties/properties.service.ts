// Properties service — data access + listing-id generation for property listings.
import { Injectable } from '@nestjs/common';
import { CrudService } from '../crud/crud.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../auth/permissions.service';
import { AuthUser } from '../auth/auth.decorators';

/** Listing ids follow the prototype: (R|C|L) + (S|R) + 3 digits — RS001 residential sale, CR001 commercial rent, LS001 land sale. */
@Injectable()
export class PropertiesService extends CrudService {
  // Prisma delegate used by the generic CRUD base class (prisma.property).
  protected model = 'property';
  constructor(prisma: PrismaService, perms: PermissionsService) { super(prisma, perms); }

  // Build the next listing id. Drafts get DR<n>; real listings get prefix + zero-padded counter.
  async newId(cat: string, purpose: string, draft: boolean) {
    if (draft) return `DR${await this.prisma.next('property-draft', 1)}`; // draft ids: DR1, DR2...
    // prefix: first letter = category (Residential/Commercial/Land), second = Sale or Rent
    const pre = (cat === 'Residential' ? 'R' : cat === 'Commercial' ? 'C' : 'L') + (purpose === 'sale' ? 'S' : 'R');
    for (;;) {
      const n = await this.prisma.next('property-' + pre, 1);       // atomic counter per prefix
      const id = pre + String(n).padStart(3, '0');                  // e.g. RS007
      // guard against a clash with an id that already exists (e.g. imported data)
      if (!(await this.prisma.property.findUnique({ where: { id } }))) return id;
    }
  }

  // Before a new listing is inserted, generate its id when the client did not provide one.
  protected async beforeCreate(data: any, _user: AuthUser) {
    if (!data.id) data.id = await this.newId(data.cat || 'Residential', data.purpose || 'sale', data.status === 'Draft');
    return data;
  }

  /** A draft gets its real listing id when it is first published. */
  async update(id: string, body: any, user: AuthUser, replace = false) {
    const before = await this.raw(id);
    // Draft -> any other status = publishing: allocate a proper RS/CR/LS id and re-key the row.
    if (before.status === 'Draft' && body?.status && body.status !== 'Draft') {
      const data = this.split(body, before, replace);
      data.id = await this.newId(body.cat || before.cat, body.purpose || before.purpose, false);
      const row = await this.db.update({ where: { id }, data });
      return this.out(row, await this.perms.canSeeNumbers(user));
    }
    // Normal edit: use the generic implementation.
    return super.update(id, body, user, replace);
  }

  // A property can't be deleted while visits, deals or open follow-ups refer to it.
  protected async beforeRemove(row: any) {
    this.refuseIfUsed('Property', row.id, [
      [await this.prisma.visit.count({ where: { prop: row.id } }), 'visit(s)'],
      [await this.prisma.deal.count({ where: { prop: row.id } }), 'deal(s)'],
      [await this.prisma.followUp.count({ where: { done: false, note: { startsWith: row.id + ' · ' } } }), 'open follow-up(s)'],
    ]);
  }
}
