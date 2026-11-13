// Email endpoints: POST /api/mail/matches sends the matched-properties email, GET /api/mail/status says whether email is set up.
import { Body, Controller, Get, Post } from '@nestjs/common';
import { Act, AuthUser, CurrentUser, Perm } from '../auth/auth.decorators';
import { SendMatchesMailDto } from './mail.dto';
import { MailService } from './mail.service';

// Needs write access to requirements (the Matches screen) and permission to see contact details.
@Controller('mail')
@Perm('requirements')
export class MailController {
  constructor(private svc: MailService) {}
  // Is Brevo configured? (the web app hides the Email option when it is not)
  @Get('status') status() { return { configured: this.svc.configured() }; }
  // Email the chosen matched properties to a client.
  @Post('matches') @Act('seeNumbers') matches(@Body() b: SendMatchesMailDto, @CurrentUser() u: AuthUser) { return this.svc.sendMatches(u, b); }
}
