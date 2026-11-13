// AuditService — append-only record of sensitive actions (who did what to whom, and when).
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /** Write one entry. Never throws: a logging problem must not block the action being logged. Never pass passwords in `detail`. */
  async log(actor: string, action: string, target = '', detail: Record<string, unknown> = {}) {
    try {
      await this.prisma.auditLog.create({ data: { actor, action, target, detail: detail as any } });
    } catch (e: any) {
      console.error('[audit] could not record', action, '-', e?.message);
    }
  }

  /** Newest entries first, in the shape the web app shows. */
  async recent(limit = 30) {
    const n = Math.min(Math.max(Number(limit) || 30, 1), 200);
    const rows = await this.prisma.auditLog.findMany({ orderBy: { at: 'desc' }, take: n });
    return rows.map((r) => ({ id: r.id, at: r.at.toISOString(), actor: r.actor, action: r.action, target: r.target, detail: r.detail }));
  }
}
