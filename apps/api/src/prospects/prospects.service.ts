// Prospects service — data access for people who buy / rent / own (the customer master).
// All the heavy lifting (column/JSON split, masking, create/update/delete) lives in the generic CrudService;
// this class only says WHICH Prisma model it works on and how new ids are made.
import { Injectable } from '@nestjs/common';
import { CrudService } from '../crud/crud.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../auth/permissions.service';
import { AuthUser } from '../auth/auth.decorators';

// Prospect records.
@Injectable()
export class ProspectsService extends CrudService {
  // Name of the Prisma delegate (prisma.prospect) this service reads and writes.
  protected model = 'prospect';
  constructor(prisma: PrismaService, perms: PermissionsService) { super(prisma, perms); }

  // Hook called by CrudService.create() right before the row is inserted.
  protected async beforeCreate(data: any, _user: AuthUser) {
    // Prospect ids look like c1, c2 …. The UI normally sends its own id; this only runs for API clients that don't.
    if (!data.id) data.id = `c${await this.prisma.next('prospect', 5)}`;
    return data;
  }

  // A prospect can't be deleted while requirements, visits, deals, open follow-ups or owned properties refer to them.
  protected async beforeRemove(row: any) {
    this.refuseIfUsed('Prospect', row.id, [
      [await this.prisma.requirement.count({ where: { cid: row.id } }), 'requirement(s)'],
      [await this.prisma.visit.count({ where: { cid: row.id } }), 'visit(s)'],
      [await this.prisma.deal.count({ where: { cid: row.id } }), 'deal(s)'],
      [await this.prisma.followUp.count({ where: { done: false, who: row.name } }), 'open follow-up(s)'],
      [await this.prisma.property.count({ where: { owner: row.name } }), 'property(ies) listing them as owner'],
    ]);
  }
}
