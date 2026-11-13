// Visits controller — exposes REST endpoints at /api/visits.
//   GET /visits · GET /visits/:id · POST /visits · PATCH /visits/:id · DELETE /visits/:id
// The five handlers are inherited from CrudController; this class only fixes the URL and the permission module.
import { Controller } from '@nestjs/common';
import { CrudController } from '../crud/crud.controller';
import { Perm } from '../auth/auth.decorators';
import { VisitsService } from './visits.service';

@Controller('visits')
// PermGuard checks the caller's role has read (GET) / write (other verbs) access to the "visits" module.
@Perm('visits')
export class VisitsController extends CrudController {
  constructor(svc: VisitsService) { super(svc); }
}
