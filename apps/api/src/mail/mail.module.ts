// Mail module: sends emails to clients (currently the matched-properties email).
import { Module } from '@nestjs/common';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

// MailModule: Nest module — wires this feature's controller and service together.
@Module({ controllers: [MailController], providers: [MailService] })
export class MailModule {}
