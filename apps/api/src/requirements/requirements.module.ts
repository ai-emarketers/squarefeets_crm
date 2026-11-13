// Registers requirement CRUD + matching endpoints and exports the service for reuse.
import { Module } from '@nestjs/common';
import { MatchesController, RequirementsController } from './requirements.controller';
import { RequirementsService } from './requirements.service';

// RequirementsModule: Nest module — wires this feature's controller and service together.
@Module({ controllers: [RequirementsController, MatchesController], providers: [RequirementsService], exports: [RequirementsService] })
export class RequirementsModule {}
