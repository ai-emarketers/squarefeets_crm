// FollowUps module — wires the controller and service together so Nest can inject them.
// The service is exported because StateService (bootstrap/sync) uses it too.
import { Module } from '@nestjs/common';
import { FollowUpsController } from './followups.controller';
import { FollowUpsService } from './followups.service';

// FollowUpsModule: Nest module — wires this feature's controller and service together.
@Module({ controllers: [FollowUpsController], providers: [FollowUpsService], exports: [FollowUpsService] })
export class FollowUpsModule {}
