// Projects service — data access for building projects / developments (e.g. "Merlin Verve").
// All the heavy lifting (column/JSON split, masking, create/update/delete) lives in the generic CrudService;
// this class only says WHICH Prisma model it works on and how new ids are made.
import { Injectable } from '@nestjs/common';
import { CrudService } from '../crud/crud.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../auth/permissions.service';
import { AuthUser } from '../auth/auth.decorators';

@Injectable()
export class ProjectsService extends CrudService {
  // Name of the Prisma delegate (prisma.project) this service reads and writes.
  protected model = 'project';
  constructor(prisma: PrismaService, perms: PermissionsService) { super(prisma, perms); }

  // Hook called by CrudService.create() right before the row is inserted.
  protected async beforeCreate(data: any, _user: AuthUser) {
    // Project ids look like p1, p2 … (same as the UI). The UI normally sends its own id; this only runs for API clients that don't.
    if (!data.id) data.id = `p${await this.prisma.next('project', 6)}`;
    return data;
  }

  // A project can't be deleted while properties are listed in it.
  protected async beforeRemove(row: any) {
    this.refuseIfUsed('Project', row.id, [[await this.prisma.property.count({ where: { projectId: row.id } }), 'property(ies) in this project']]);
  }
}
