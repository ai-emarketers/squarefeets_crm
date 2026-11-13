// Projects controller — exposes REST endpoints at /api/projects.
//   GET /projects · GET /projects/:id · POST /projects · PATCH /projects/:id · DELETE /projects/:id
// The five handlers are inherited from CrudController; this class only fixes the URL and the permission module.
import { Controller } from '@nestjs/common';
import { CrudController } from '../crud/crud.controller';
import { Perm } from '../auth/auth.decorators';
import { ProjectsService } from './projects.service';

@Controller('projects')
// PermGuard checks the caller's role has read (GET) / write (other verbs) access to the "projects" module.
@Perm('projects')
export class ProjectsController extends CrudController {
  constructor(svc: ProjectsService) { super(svc); }
}
