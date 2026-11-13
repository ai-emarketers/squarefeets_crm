// Prospects controller — exposes REST endpoints at /api/prospects.
//   GET /prospects · GET /prospects/:id · POST /prospects · PATCH /prospects/:id · DELETE /prospects/:id
// The five handlers are inherited from CrudController; this class only fixes the URL and the permission module.
import { Controller } from '@nestjs/common';
import { CrudController } from '../crud/crud.controller';
import { Perm } from '../auth/auth.decorators';
import { ProspectsService } from './prospects.service';

@Controller('prospects')
// PermGuard checks the caller's role has read (GET) / write (other verbs) access to the "prospects" module.
@Perm('prospects')
export class ProspectsController extends CrudController {
  constructor(svc: ProspectsService) { super(svc); }
}
