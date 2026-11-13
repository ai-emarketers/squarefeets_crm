// Visits module — wires the controller and service together so Nest can inject them.
// The service is exported because StateService (bootstrap/sync) uses it too.
import { Module } from '@nestjs/common';
import { VisitsController } from './visits.controller';
import { VisitsService } from './visits.service';

// VisitsModule: Nest module — wires this feature's controller and service together.
@Module({ controllers: [VisitsController], providers: [VisitsService], exports: [VisitsService] })
export class VisitsModule {}
