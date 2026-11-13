// Wires the properties controller + service together; exported so other modules (state sync) can reuse the service.
import { Module } from '@nestjs/common';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';

// PropertiesModule: Nest module — wires this feature's controller and service together.
@Module({ controllers: [PropertiesController], providers: [PropertiesService], exports: [PropertiesService] })
export class PropertiesModule {}
