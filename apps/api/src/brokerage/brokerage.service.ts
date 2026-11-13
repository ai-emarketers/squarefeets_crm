// Brokerage service — data access for brokerage (commission) records, one per deal.
// All the heavy lifting (column/JSON split, masking, create/update/delete) lives in the generic CrudService;
// this class only says WHICH Prisma model it works on and how new ids are made.
import { Injectable } from '@nestjs/common';
import { CrudService } from '../crud/crud.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../auth/permissions.service';
import { AuthUser } from '../auth/auth.decorators';

// Brokerage records (one per deal).
@Injectable()
export class BrokerageService extends CrudService {
  // Name of the Prisma delegate (prisma.brokerage) this service reads and writes.
  protected model = 'brokerage';
  // Brokerage rows are keyed by the deal id (column `deal`), not by `id`.
  protected get pk() { return 'deal'; }
  // This table has no createdAt column, so order by last update.
  protected orderBy: any = { updatedAt: 'asc' };
  constructor(prisma: PrismaService, perms: PermissionsService) { super(prisma, perms); }

  // Hook called by CrudService.create() right before the row is inserted.
  protected async beforeCreate(data: any, _user: AuthUser) {
    // No id generation: the caller must send `deal` (the id of the deal this record belongs to).
    return data;
  }

  // A brokerage record with payments can't be deleted (an empty one is removed together with its deal).
  protected async beforeRemove(row: any) {
    this.refuseIfUsed('Brokerage of', row.deal, [[Array.isArray(row.pay) ? row.pay.length : 0, 'payment(s)']]);
  }
}
