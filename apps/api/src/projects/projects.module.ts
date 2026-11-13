// Projects module — wires the controller and service together so Nest can inject them.
// The service is exported because StateService (bootstrap/sync) uses it too.
import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({ controllers: [ProjectsController], providers: [ProjectsService], exports: [ProjectsService] })
export class ProjectsModule {}
