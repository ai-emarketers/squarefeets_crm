// FollowUps service — data access for follow-up tasks (call / WhatsApp / visit reminders); governed by the "visits" permission.
// All the heavy lifting (column/JSON split, masking, create/update/delete) lives in the generic CrudService;
// this class only says WHICH Prisma model it works on and how new ids are made.
import { Injectable } from '@nestjs/common';
import { CrudService } from '../crud/crud.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../auth/permissions.service';
import { AuthUser } from '../auth/auth.decorators';

// Follow-up records.
@Injectable()
export class FollowUpsService extends CrudService {
  // Name of the Prisma delegate (prisma.followUp) this service reads and writes.
  protected model = 'followUp';
  constructor(prisma: PrismaService, perms: PermissionsService) { super(prisma, perms); }

  // Hook called by CrudService.create() right before the row is inserted.
  protected async beforeCreate(data: any, _user: AuthUser) {
    // Follow-up ids look like f1, f2 …. The UI normally sends its own id; this only runs for API clients that don't.
    if (!data.id) data.id = `f${await this.prisma.next('followup', 7)}`;
    return data;
  }
}
