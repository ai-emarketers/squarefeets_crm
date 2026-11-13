// Visits service — data access for property visits scheduled for prospects.
// All the heavy lifting (column/JSON split, masking, create/update/delete) lives in the generic CrudService;
// this class only says WHICH Prisma model it works on and how new ids are made.
import { Injectable } from '@nestjs/common';
import { CrudService } from '../crud/crud.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../auth/permissions.service';
import { AuthUser } from '../auth/auth.decorators';

@Injectable()
export class VisitsService extends CrudService {
  // Name of the Prisma delegate (prisma.visit) this service reads and writes.
  protected model = 'visit';
  constructor(prisma: PrismaService, perms: PermissionsService) { super(prisma, perms); }

  // Hook called by CrudService.create() right before the row is inserted.
  protected async beforeCreate(data: any, _user: AuthUser) {
    // Visit ids look like VIS-3392. The UI normally sends its own id; this only runs for API clients that don't.
    if (!data.id) data.id = `VIS-${await this.prisma.next('visit', 3395)}`;
    return data;
  }
}
