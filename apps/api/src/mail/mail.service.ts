// MailService — sends the matched-properties email. Two ways, picked from the Railway variables:
//   1) SMTP (e.g. Gmail): SMTP_USER + SMTP_PASS (an app password), optional SMTP_HOST (default smtp.gmail.com) and SMTP_PORT (default 465, TLS).
//   2) Brevo HTTP API (free plan: 300 emails a day): BREVO_API_KEY + MAIL_FROM_EMAIL (a sender verified in Brevo).
// SMTP wins when both are set. Optional for both: MAIL_FROM_EMAIL, MAIL_FROM_NAME, MAIL_ORG_ADDRESS (footer line).
// With neither configured the endpoint answers 503.
import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.decorators';
import { SendMatchesMailDto } from './mail.dto';
import { fmtLakh, fmtRentK, matchesHtml, matchesText, MailProperty } from './mail.template';
import { sendSmtp } from './smtp';

// A loose email check (the real test is whether Brevo accepts it).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Most emails one user may send per day (protects against misuse and keeps the free plan's 300/day for everyone).
const PER_USER_DAILY = 60;

@Injectable()
export class MailService {
  // In-memory count of sends per user per day (resets when the API restarts, which is fine as a safety net).
  private sent = new Map<string, number>();
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  /** True when an API key is configured (the web app uses this to show or hide the Email option). */
  configured() { return this.smtpOn() || this.brevoOn(); }
  /** SMTP is set up (user + password given). */
  private smtpOn() { return !!process.env.SMTP_USER && !!process.env.SMTP_PASS; }
  /** Brevo API is set up (key + a verified sender). */
  private brevoOn() { return !!process.env.BREVO_API_KEY && !!process.env.MAIL_FROM_EMAIL; }

  /** Send the matches email. Throws a clear error when email is not set up, the client has no email, or Brevo refuses. */
  async sendMatches(u: AuthUser, b: SendMatchesMailDto) {
    if (!this.configured()) throw new ServiceUnavailableException('Email is not set up yet. Ask the admin to add the email settings.');
    const key = u.id + ':' + new Date().toISOString().slice(0, 10);
    if ((this.sent.get(key) || 0) >= PER_USER_DAILY) throw new HttpException('Daily email limit reached for your account.', HttpStatus.TOO_MANY_REQUESTS);
    const pros = await this.prisma.prospect.findUnique({ where: { id: b.prospectId } });
    if (!pros) throw new NotFoundException('Client not found.');
    const to = String(pros.email || '').trim();
    if (!EMAIL_RE.test(to)) throw new BadRequestException(`${pros.name} has no email address saved.`);
    const rows = await this.prisma.property.findMany({ where: { id: { in: b.propertyIds }, status: 'Available' } });
    if (!rows.length) throw new BadRequestException('None of the chosen properties is available any more.');
    const order = new Map(b.propertyIds.map((id, i) => [id, i]));
    const properties: MailProperty[] = rows.sort((x, y) => (order.get(x.id) ?? 0) - (order.get(y.id) ?? 0)).map((p) => {
      const d: any = p.data || {}; const size = d.sbu || p.area;
      const facts = [p.cat === 'Residential' && p.bhk ? p.bhk + ' BHK' : '', size ? Math.round(Number(size)).toLocaleString('en-IN') + ' sq ft' : ''].filter(Boolean).join(' · ');
      const sc = b.scores && Number(b.scores[p.id]);
      return { id: p.id, title: p.title, loc: p.loc, facts, price: p.purpose === 'sale' ? fmtLakh(p.priceL || 0) : fmtRentK(p.rentK || 0), score: sc >= 0 && sc <= 100 ? sc : undefined };
    });
    const org = await this.prisma.organization.findFirst();
    const orgName = (org as any)?.name || process.env.MAIL_FROM_NAME || 'SquareFeets Realty';
    const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER!;
    const brokerEmail = u.email || fromEmail;
    const data = {
      clientName: pros.name, orgName, brokerName: u.name, brokerEmail, orgAddress: process.env.MAIL_ORG_ADDRESS || '',
      reqSummary: b.reqSummary || '', properties,
      intro: (b.intro || '').trim() || `Based on what you told us${b.reqSummary ? ' (' + b.reqSummary + ')' : ''}, these are the best matches right now.`,
    };
    const subject = (b.subject || '').trim() || `${properties.length} ${properties.length === 1 ? 'home' : 'homes'} that match what you asked for`;
    const html = matchesHtml(data); const text = matchesText(data); const fromName = u.name + ' · ' + orgName;
    if (this.smtpOn()) {
      // SMTP (Gmail …): the From address must be the logged-in mailbox (or an alias Gmail allows).
      try {
        await sendSmtp({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT) || 465, user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS!,
          from: fromEmail, fromName, to, toName: pros.name, replyTo: brokerEmail, replyToName: u.name, subject, html, text });
      } catch (e: any) {
        console.error('[mail] SMTP failed:', e?.message);
        throw new BadRequestException(/535|534|auth/i.test(String(e?.message)) ? 'The mail server rejected the login. Check the app password.' : 'The mail server could not send this message: ' + String(e?.message || '').slice(0, 120));
      }
    } else {
      const res = await (globalThis as any).fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', headers: { 'api-key': process.env.BREVO_API_KEY!, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: { name: fromName, email: fromEmail }, replyTo: { email: brokerEmail, name: u.name }, to: [{ email: to, name: pros.name }], subject, htmlContent: html, textContent: text }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => ''); console.error('[mail] Brevo refused', res.status, t.slice(0, 300));
        throw new BadRequestException(res.status === 401 ? 'The email service rejected the API key.' : 'The email service could not send this message. Check the sender is verified in Brevo.');
      }
    }
    this.sent.set(key, (this.sent.get(key) || 0) + 1);
    await this.audit.log(u.name, 'Emailed matches', pros.name, { prospect: pros.id, properties: properties.map((p) => p.id) });
    return { ok: true, sent: properties.length, to: to.replace(/^(.).*(@.*)$/, '$1•••$2') };
  }
}
