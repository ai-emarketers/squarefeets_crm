// Global so Team, Exports and Auth can log without importing this module everywhere.
import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

// AuditModule: Nest module — wires this feature's controller and service together.
@Global()
@Module({ controllers: [AuditController], providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
