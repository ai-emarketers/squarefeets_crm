// Inbound module: leads that arrive from outside the CRM (currently the website).
import { Module } from '@nestjs/common';
import { InboundController } from './inbound.controller';
import { InboundService } from './inbound.service';

@Module({ controllers: [InboundController], providers: [InboundService] })
export class InboundModule {}
