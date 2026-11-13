// Brokerage controller — exposes REST endpoints at /api/brokerage.
//   GET /brokerage · GET /brokerage/:id · POST /brokerage · PATCH /brokerage/:id · DELETE /brokerage/:id
// The five handlers are inherited from CrudController; this class only fixes the URL and the permission module.
import { Controller } from '@nestjs/common';
import { CrudController } from '../crud/crud.controller';
import { Perm } from '../auth/auth.decorators';
import { BrokerageService } from './brokerage.service';

@Controller('brokerage')
// PermGuard checks the caller's role has read (GET) / write (other verbs) access to the "brokerage" module.
@Perm('brokerage')
export class BrokerageController extends CrudController {
  constructor(svc: BrokerageService) { super(svc); }
}
