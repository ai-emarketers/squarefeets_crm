// Prospects module — wires the controller and service together so Nest can inject them.
// The service is exported because StateService (bootstrap/sync) uses it too.
import { Module } from '@nestjs/common';
import { ProspectsController } from './prospects.controller';
import { ProspectsService } from './prospects.service';

// ProspectsModule: Nest module — wires this feature's controller and service together.
@Module({ controllers: [ProspectsController], providers: [ProspectsService], exports: [ProspectsService] })
export class ProspectsModule {}
