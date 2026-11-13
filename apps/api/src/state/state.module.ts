// Bootstrap + sync module: imports every data module so StateService can read/write all collections.
import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { PropertiesModule } from '../properties/properties.module';
import { LeadsModule } from '../leads/leads.module';
import { ProspectsModule } from '../prospects/prospects.module';
import { RequirementsModule } from '../requirements/requirements.module';
import { VisitsModule } from '../visits/visits.module';
import { FollowUpsModule } from '../followups/followups.module';
import { DealsModule } from '../deals/deals.module';
import { BrokerageModule } from '../brokerage/brokerage.module';
import { TeamModule } from '../team/team.module';
import { ExportsModule } from '../exports/exports.module';
import { StateController } from './state.controller';
import { StateService } from './state.service';

@Module({
  imports: [ProjectsModule, PropertiesModule, LeadsModule, ProspectsModule, RequirementsModule, VisitsModule, FollowUpsModule, DealsModule, BrokerageModule, TeamModule, ExportsModule],
  controllers: [StateController],
  providers: [StateService],
})
export class StateModule {}
