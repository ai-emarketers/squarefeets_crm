// Team module: REST endpoints + TeamService (also used by StateService for the web app's sync).
import { Module } from '@nestjs/common';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

// TeamModule: Nest module — wires this feature's controller and service together.
@Module({ controllers: [TeamController], providers: [TeamService], exports: [TeamService] })
export class TeamModule {}
