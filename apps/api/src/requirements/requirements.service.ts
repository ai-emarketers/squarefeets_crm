// Requirements service — buyer/tenant requirements plus server-side matching against available properties.
import { Injectable } from '@nestjs/common';
import { CrudService } from '../crud/crud.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../auth/permissions.service';
import { AuthUser } from '../auth/auth.decorators';
import { leadReq, matchesFor } from './matching';

// Requirement records.
@Injectable()
export class RequirementsService extends CrudService {
  // Prisma delegate (prisma.requirement).
  protected model = 'requirement';
  constructor(prisma: PrismaService, perms: PermissionsService) { super(prisma, perms); }

  // New requirements get ids REQ-2037, REQ-2038... (counter starts at 2037 like the prototype).
  protected async beforeCreate(data: any, _user: AuthUser) {
    if (!data.id) data.id = `REQ-${await this.prisma.next('requirement', 2037)}`;
    return data;
  }

  // Flatten DB rows (merge `data` JSON) without masking — matching needs the real values.
  private flat(rows: any[]) { return rows.map((r) => this.out(r, true)); }

  /** Every pending requirement: active prospect requirements + leads (not yet converted) with a basic budget. */
  async pending() {
    const [reqs, leads, prospects] = await Promise.all([
      this.prisma.requirement.findMany({ where: { status: 'Active' }, orderBy: { createdAt: 'asc' } }),
      this.prisma.lead.findMany({ where: { stage: { not: 'Converted' } }, orderBy: { createdAt: 'asc' } }),
      this.prisma.prospect.findMany(),
    ]);
    // id -> name map so each requirement can show who it belongs to
    const pname = new Map(prospects.map((p) => [p.id, p.name]));
    const a = this.flat(reqs).map((r: any) => ({ ...r, who: pname.get(r.cid) || '—', tag: 'Prospect' }));
    // leads become pseudo-requirements through leadReq(); leads without a budget are skipped
    const b = this.flat(leads).map((l: any) => leadReq(l)).filter(Boolean).map((r: any) => ({ ...r, tag: 'Lead' }));
    return [...a, ...b];
  }

  // Scored matches for one requirement id (or "LEAD-<leadId>") against all Available properties.
  async matches(id: string) {
    const props = (await this.prisma.property.findMany({ where: { status: 'Available' } })).map((p) => this.out(p, true));
    let r: any;
    if (id.startsWith('LEAD-')) {                 // a lead acting as a requirement
      const l = await this.prisma.lead.findUnique({ where: { id: id.slice(5) } });
      r = l ? leadReq(this.out(l, true)) : null;
    } else {                                      // a normal requirement row
      const row = await this.prisma.requirement.findUnique({ where: { id } });
      r = row ? this.out(row, true) : null;
    }
    if (!r) return [];
    // return only id + score + the reasons (the client already has the property objects)
    return matchesFor(r, props).map((m) => ({ id: m.p.id, score: m.score, why: m.why }));
  }

  /** Active requirement match counts, used by the dashboard tile. */
  async activeMatchCount() {
    const props = (await this.prisma.property.findMany({ where: { status: 'Available' } })).map((p) => this.out(p, true));
    const reqs = await this.prisma.requirement.findMany({ where: { status: 'Active' } });
    return reqs.reduce((n, r) => n + matchesFor(this.out(r, true), props).length, 0);
  }
}
