// Deals controller — exposes REST endpoints at /api/deals.
//   GET /deals · GET /deals/:id · POST /deals · PATCH /deals/:id · DELETE /deals/:id
// The five handlers are inherited from CrudController; this class only fixes the URL and the permission module.
import { Controller } from '@nestjs/common';
import { CrudController } from '../crud/crud.controller';
import { Perm } from '../auth/auth.decorators';
import { DealsService } from './deals.service';

@Controller('deals')
// PermGuard checks the caller's role has read (GET) / write (other verbs) access to the "deals" module.
@Perm('deals')
export class DealsController extends CrudController {
  constructor(svc: DealsService) { super(svc); }
}
