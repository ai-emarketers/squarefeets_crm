// FollowUps controller — exposes REST endpoints at /api/followups.
//   GET /followups · GET /followups/:id · POST /followups · PATCH /followups/:id · DELETE /followups/:id
// The five handlers are inherited from CrudController; this class only fixes the URL and the permission module.
import { Controller } from '@nestjs/common';
import { CrudController } from '../crud/crud.controller';
import { Perm } from '../auth/auth.decorators';
import { FollowUpsService } from './followups.service';

// REST endpoints under /api/followups.
@Controller('followups')
// PermGuard checks the caller's role has read (GET) / write (other verbs) access to the "visits" module.
@Perm('visits')
export class FollowUpsController extends CrudController {
  constructor(svc: FollowUpsService) { super(svc); }
}
