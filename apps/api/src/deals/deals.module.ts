// Deals module — wires the controller and service together so Nest can inject them.
// The service is exported because StateService (bootstrap/sync) uses it too.
import { Module } from '@nestjs/common';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';

// DealsModule: Nest module — wires this feature's controller and service together.
@Module({ controllers: [DealsController], providers: [DealsService], exports: [DealsService] })
export class DealsModule {}
