// Export approval module (also used by StateService for the web app's sync).
import { Module } from '@nestjs/common';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

// ExportsModule: Nest module — wires this feature's controller and service together.
@Module({ controllers: [ExportsController], providers: [ExportsService], exports: [ExportsService] })
export class ExportsModule {}
