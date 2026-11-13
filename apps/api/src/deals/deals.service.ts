// Deals service — data access for sale / lease deals from negotiation to closing.
// All the heavy lifting (column/JSON split, masking, create/update/delete) lives in the generic CrudService;
// this class only says WHICH Prisma model it works on and how new ids are made.
import { Injectable } from '@nestjs/common';
import { CrudService } from '../crud/crud.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../auth/permissions.service';
import { AuthUser } from '../auth/auth.decorators';

// Deal records.
@Injectable()
export class DealsService extends CrudService {
  // Name of the Prisma delegate (prisma.deal) this service reads and writes.
  protected model = 'deal';
  constructor(prisma: PrismaService, perms: PermissionsService) { super(prisma, perms); }

  // Hook called by CrudService.create() right before the row is inserted.
  protected async beforeCreate(data: any, _user: AuthUser) {
    // Deal ids look like DEAL-0146 (4-digit padded). The UI normally sends its own id; this only runs for API clients that don't.
    if (!data.id) data.id = `DEAL-${String(await this.prisma.next('deal', 146)).padStart(4, '0')}`;
    return data;
  }

  // Closed (won) deals and deals with brokerage payments or invoices are kept for the records.
  protected async beforeRemove(row: any) {
    const b: any = await this.prisma.brokerage.findUnique({ where: { deal: row.id } });
    this.refuseIfUsed('Deal', row.id, [
      [row.stage === 'closed_won' ? 1 : 0, 'closed (won) deal'],
      [Array.isArray(b?.pay) ? b.pay.length : 0, 'brokerage payment(s)'],
      [b?.data?.inv ? 1 : 0, 'issued brokerage invoice'],
    ]);
  }
}
