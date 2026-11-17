// POST /api/inbound/website-lead — the website posts every enquiry and brochure download here.
// Public route (no sign-in): the shared secret in the X-Webhook-Secret header is the protection (see InboundService).
import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { Public } from '../auth/auth.decorators';
import { InboundService, WebsiteLeadBody } from './inbound.service';

@Controller('inbound')
export class InboundController {
  constructor(private svc: InboundService) {}
  @Public() @Post('website-lead') @HttpCode(200)
  websiteLead(@Headers('x-webhook-secret') secret: string, @Body() body: WebsiteLeadBody) { return this.svc.websiteLead(secret, body); }
}
