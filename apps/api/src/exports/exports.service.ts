// ExportsService — export approval workflow, checked on the server.
//   Pending --(approver)--> Approved | Rejected      Approved --(requester)--> Downloaded
// Who may do what:
//   • ask for an export  : anyone who has the matching export action (exportProperties / exportLeads / exportProspects)
//   • approve / reject   : users with the 'approveExports' action — never on their own request (except the Owner)
//   • mark as downloaded : only the person who asked, only after approval
// Note: the CSV itself is still built in the browser from data the user can already see, so this is an approval
// workflow + audit trail, not a technical barrier against a user copying data they can already open on screen.
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../auth/permissions.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.decorators';

/** export kind -> the action permission needed to export it (same names as Settings → role permissions). */
export const EXPORT_ACTIONS: Record<string, string> = { properties: 'exportProperties', leads: 'exportLeads', prospects: 'exportProspects' };

// Export requests: create, approve/reject, mark downloaded.
@Injectable()
export class ExportsService {
  constructor(private prisma: PrismaService, private perms: PermissionsService, private audit: AuditService) {}

  /** Database row -> the shape the web app uses (S.exportReq items). */
  toClient(r: any) {
    return {
      id: r.id, kind: r.kind, f: r.filters ?? {}, n: r.rowCount, by: r.requestedBy,
      at: r.requestedAt.toISOString().slice(0, 10), status: r.status,
      decidedBy: r.decidedBy ?? '', decidedAt: r.decidedAt ? r.decidedAt.toISOString() : '',
    };
  }

  /** Approvers see every request; everyone else sees only their own. Newest first. */
  async list(user: AuthUser) {
    const all = await this.perms.can(user, 'approveExports');
    const rows = await this.prisma.exportRequest.findMany({ where: all ? {} : { requestedBy: user.name }, orderBy: { requestedAt: 'desc' }, take: 300 });
    return rows.map((r) => this.toClient(r));
  }

  /** File a new request (status Pending). The requester is always the signed-in user, whatever the client sends. */
  async create(user: AuthUser, b: { id?: string; kind: string; filters?: any; rowCount?: number }) {
    const action = EXPORT_ACTIONS[b.kind];
    if (!action) throw new BadRequestException('Unknown export type.');
    if (!(await this.perms.can(user, action))) throw new ForbiddenException(`You are not allowed to export ${b.kind}.`);
    const id = (b.id && String(b.id).slice(0, 40)) || 'ex' + Date.now();
    if (await this.prisma.exportRequest.findUnique({ where: { id } })) throw new ConflictException('This export request already exists.');
    const r = await this.prisma.exportRequest.create({ data: { id, kind: b.kind, filters: (b.filters ?? {}) as any, rowCount: Math.max(0, Math.floor(Number(b.rowCount) || 0)), requestedBy: user.name } });
    await this.audit.log(user.name, 'export.request', id, { kind: b.kind, rows: r.rowCount });
    return this.toClient(r);
  }

  /** Approve or reject a Pending request. */
  async decide(user: AuthUser, id: string, status: 'Approved' | 'Rejected') {
    if (!(await this.perms.can(user, 'approveExports'))) throw new ForbiddenException('You are not allowed to approve exports.');
    if (status !== 'Approved' && status !== 'Rejected') throw new BadRequestException('Decision must be Approved or Rejected.');
    const r = await this.prisma.exportRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Export request not found.');
    if (r.status !== 'Pending') throw new BadRequestException(`This request was already ${r.status.toLowerCase()}.`);
    if (r.requestedBy === user.name && user.role !== 'Owner') throw new ForbiddenException('You cannot decide your own request.');
    const u = await this.prisma.exportRequest.update({ where: { id }, data: { status, decidedBy: user.name, decidedAt: new Date() } });
    await this.audit.log(user.name, 'export.decide', id, { status, requestedBy: r.requestedBy, kind: r.kind, rows: r.rowCount });
    return this.toClient(u);
  }

  /** The requester records that they downloaded the approved export. */
  async markDownloaded(user: AuthUser, id: string) {
    const r = await this.prisma.exportRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Export request not found.');
    if (r.requestedBy !== user.name) throw new ForbiddenException('Only the person who asked can download this export.');
    if (r.status !== 'Approved') throw new BadRequestException('This export is not approved.');
    const u = await this.prisma.exportRequest.update({ where: { id }, data: { status: 'Downloaded' } });
    return this.toClient(u);
  }

  /**
   * The web app keeps requests as one array and sends the whole array when anything changes (/api/sync → kv.exportReq).
   * Turn that into real operations: new id → create, status change → decide / markDownloaded, anything else is ignored.
   * Refusals are reported per request through `reject` so the app can warn the user.
   */
  async syncFromClient(user: AuthUser, items: any[], reject: (id: string, reason: string) => void) {
    if (!Array.isArray(items)) return;
    const stored = new Map((await this.prisma.exportRequest.findMany({ where: { id: { in: items.map((i) => String(i?.id)) } } })).map((r) => [r.id, r]));
    for (const it of items) {
      if (!it?.id) continue;
      const id = String(it.id);
      const cur = stored.get(id);
      try {
        if (!cur) await this.create(user, { id, kind: it.kind, filters: it.f, rowCount: it.n });
        else if (it.status !== cur.status) {
          if (cur.status === 'Pending' && (it.status === 'Approved' || it.status === 'Rejected')) await this.decide(user, id, it.status);
          else if (cur.status === 'Approved' && it.status === 'Downloaded') await this.markDownloaded(user, id);
          // any other status jump (e.g. a user marking their own request Approved) is ignored — the server copy is the truth
          else reject(id, `Request is ${cur.status}; the change was ignored`);
        }
      } catch (e: any) { reject(id, e?.message || 'failed'); }
    }
  }
}
