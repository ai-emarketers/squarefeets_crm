// REST endpoints for property listings: /api/properties (CRUD inherited from CrudController).
import { Controller } from '@nestjs/common';
import { CrudController } from '../crud/crud.controller';
import { Perm } from '../auth/auth.decorators';
import { PropertiesService } from './properties.service';

@Controller('properties')   // URL prefix -> /api/properties
@Perm('properties')         // access is governed by the "properties" row of the permission matrix
export class PropertiesController extends CrudController {
  constructor(svc: PropertiesService) { super(svc); } // hand the service to the generic base controller
}
