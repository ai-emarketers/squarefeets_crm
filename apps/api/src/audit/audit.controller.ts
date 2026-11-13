// GET /api/audit?limit=30 — recent activity for the Team screen. Needs read access to the Team module.
import { Controller, Get, Query } from '@nestjs/common';
import { Perm } from '../auth/auth.decorators';
import { AuditService } from './audit.service';

// Audit log endpoint: GET /api/audit.
@Controller('audit')
@Perm('team')
export class AuditController {
  constructor(private audit: AuditService) {}
  // Latest audit entries (newest first); `limit` caps how many.
  @Get() list(@Query('limit') limit?: string) { return this.audit.recent(Number(limit)); }
}
