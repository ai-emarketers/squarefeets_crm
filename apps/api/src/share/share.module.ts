// Share module: sends matched properties to a client as a PDF with their documents (email attachments, WhatsApp links).
import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';

@Module({ imports: [MailModule], controllers: [ShareController], providers: [ShareService] })
export class ShareModule {}
