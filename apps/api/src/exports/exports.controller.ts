// Export approval endpoints (/api/exports/requests …). Permission rules are enforced inside ExportsService.
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/auth.decorators';
import { CreateExportRequestDto, DecisionDto } from './exports.dto';
import { ExportsService } from './exports.service';

@Controller('exports/requests')
export class ExportsController {
  constructor(private svc: ExportsService) {}
  @Get() list(@CurrentUser() u: AuthUser) { return this.svc.list(u); }
  @Post() create(@Body() b: CreateExportRequestDto, @CurrentUser() u: AuthUser) { return this.svc.create(u, { id: b.id, kind: b.kind, filters: b.filters, rowCount: b.rowCount }); }
  @Post(':id/decision') decide(@Param('id') id: string, @Body() b: DecisionDto, @CurrentUser() u: AuthUser) { return this.svc.decide(u, id, b.status); }
  @Post(':id/downloaded') downloaded(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.markDownloaded(u, id); }
}
