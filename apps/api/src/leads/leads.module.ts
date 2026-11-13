// Leads module — wires the controller and service together so Nest can inject them.
// The service is exported because StateService (bootstrap/sync) uses it too.
import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

// LeadsModule: Nest module — wires this feature's controller and service together.
@Module({ controllers: [LeadsController], providers: [LeadsService], exports: [LeadsService] })
export class LeadsModule {}
