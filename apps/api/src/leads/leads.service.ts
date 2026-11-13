// Leads service — data access for raw enquiries that are not yet prospects.
// All the heavy lifting (column/JSON split, masking, create/update/delete) lives in the generic CrudService;
// this class only says WHICH Prisma model it works on and how new ids are made.
import { Injectable } from '@nestjs/common';
import { CrudService } from '../crud/crud.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../auth/permissions.service';
import { AuthUser } from '../auth/auth.decorators';

// Lead records.
@Injectable()
export class LeadsService extends CrudService {
  // Name of the Prisma delegate (prisma.lead) this service reads and writes.
  protected model = 'lead';
  constructor(prisma: PrismaService, perms: PermissionsService) { super(prisma, perms); }

  // Hook called by CrudService.create() right before the row is inserted.
  protected async beforeCreate(data: any, _user: AuthUser) {
    // Lead ids look like l1, l2 …. The UI normally sends its own id; this only runs for API clients that don't.
    if (!data.id) data.id = `l${await this.prisma.next('lead', 7)}`;
    return data;
  }

  // A converted lead (now a prospect) or one with open follow-ups can't be deleted.
  protected async beforeRemove(row: any) {
    const converted = row.stage === 'Converted' || !!(row.data as any)?.prospectId;
    this.refuseIfUsed('Lead', row.id, [
      [converted ? 1 : 0, 'prospect created from it (converted)'],
      [await this.prisma.followUp.count({ where: { done: false, who: row.name } }), 'open follow-up(s)'],
    ]);
  }
}
