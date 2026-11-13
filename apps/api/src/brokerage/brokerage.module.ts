// Brokerage module — wires the controller and service together so Nest can inject them.
// The service is exported because StateService (bootstrap/sync) uses it too.
import { Module } from '@nestjs/common';
import { BrokerageController } from './brokerage.controller';
import { BrokerageService } from './brokerage.service';

@Module({ controllers: [BrokerageController], providers: [BrokerageService], exports: [BrokerageService] })
export class BrokerageModule {}
