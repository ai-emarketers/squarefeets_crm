// FollowUps module — wires the controller and service together so Nest can inject them.
// The service is exported because StateService (bootstrap/sync) uses it too.
import { Module } from '@nestjs/common';
import { FollowUpsController } from './followups.controller';
import { FollowUpsService } from './followups.service';

@Module({ controllers: [FollowUpsController], providers: [FollowUpsService], exports: [FollowUpsService] })
export class FollowUpsModule {}
