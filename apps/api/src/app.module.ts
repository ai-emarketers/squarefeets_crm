// Root module: lists every feature module of the API. Nest builds the dependency graph from here.
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { PropertiesModule } from './properties/properties.module';
import { LeadsModule } from './leads/leads.module';
import { ProspectsModule } from './prospects/prospects.module';
import { RequirementsModule } from './requirements/requirements.module';
import { VisitsModule } from './visits/visits.module';
import { FollowUpsModule } from './followups/followups.module';
import { DealsModule } from './deals/deals.module';
import { BrokerageModule } from './brokerage/brokerage.module';
import { TeamModule } from './team/team.module';
import { ExportsModule } from './exports/exports.module';
import { AuditModule } from './audit/audit.module';
import { FilesModule } from './files/files.module';
import { MailModule } from './mail/mail.module';
import { StateModule } from './state/state.module';
import { CaptureModule } from './capture/capture.module';
import { HealthController } from './health.controller';

// AppModule: root module — config, database, every feature module, and the global auth guards.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // loads apps/api/.env into process.env
    PrismaModule, AuditModule, AuthModule,    // global infrastructure: database, audit log, authentication
    // one module per business area
    ProjectsModule, PropertiesModule, LeadsModule, ProspectsModule, RequirementsModule, VisitsModule,
    FollowUpsModule, DealsModule, BrokerageModule, TeamModule, ExportsModule, FilesModule, MailModule, CaptureModule,
    StateModule, // bootstrap + sync endpoints used by the web app (depends on the modules above)
  ],
  controllers: [HealthController],
})
// AppModule: Nest module — wires this feature's controller and service together.
export class AppModule {}
