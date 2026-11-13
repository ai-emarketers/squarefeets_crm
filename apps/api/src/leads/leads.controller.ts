// Leads controller — exposes REST endpoints at /api/leads.
//   GET /leads · GET /leads/:id · POST /leads · PATCH /leads/:id · DELETE /leads/:id
// The five handlers are inherited from CrudController; this class only fixes the URL and the permission module.
import { Controller } from '@nestjs/common';
import { CrudController } from '../crud/crud.controller';
import { Perm } from '../auth/auth.decorators';
import { LeadsService } from './leads.service';

// REST endpoints under /api/leads.
@Controller('leads')
// PermGuard checks the caller's role has read (GET) / write (other verbs) access to the "leads" module.
@Perm('leads')
export class LeadsController extends CrudController {
  constructor(svc: LeadsService) { super(svc); }
}
