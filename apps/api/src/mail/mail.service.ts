// MailService — sends the matched-properties email. Two ways, picked from the Railway variables:
//   1) Brevo HTTP API (free plan: 300 emails a day): BREVO_API_KEY + MAIL_FROM_EMAIL (a sender verified in Brevo). Uses HTTPS, so it
//      works on every Railway plan. Preferred, and it wins when both are set.
//   2) SMTP (e.g. Gmail): SMTP_USER + SMTP_PASS (an app password), optional SMTP_HOST (default smtp.gmail.com) and SMTP_PORT (default 465, TLS).
//      Railway's Free, Trial and Hobby plans block SMTP ports, so this only works on a Pro plan or on another host. Optional for both: MAIL_FROM_EMAIL, MAIL_FROM_NAME, MAIL_ORG_ADDRESS (footer line).
// With neither configured the endpoint answers 503.
import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.decorators';
import { SendMatchesMailDto } from './mail.dto';
import { fmtLakh, fmtRentK, matchesHtml, matchesText, MailProperty } from './mail.template';
import { MailAttachment, sendSmtp } from './smtp';

export { MailAttachment };
/** One outgoing email, independent of the provider (Resend, SMTP or Brevo). */
export interface OutMail {
  to: string; toName: string; fromName: string; fromEmail: string; replyTo: string; replyToName: string;
  subject: string; html: string; text: string; attachments?: MailAttachment[];
}

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
  configured() { return this.resendOn() || this.smtpOn() || this.brevoOn(); }

  /** Resend API (free: 100 emails a day). RESEND_API_KEY only; the sender defaults to onboarding@resend.dev, which Resend delivers to the account owner's own email. */
  private resendOn() { return !!process.env.RESEND_API_KEY; }
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
    const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER || 'onboarding@resend.dev';
    const brokerEmail = u.email || fromEmail;
    const data = {
      clientName: pros.name, orgName, brokerName: u.name, brokerEmail, orgAddress: process.env.MAIL_ORG_ADDRESS || '',
      reqSummary: b.reqSummary || '', properties,
      intro: (b.intro || '').trim() || `Based on what you told us${b.reqSummary ? ' (' + b.reqSummary + ')' : ''}, these are the best matches right now.`,
    };
    const subject = (b.subject || '').trim() || `${properties.length} ${properties.length === 1 ? 'home' : 'homes'} that match what you asked for`;
    const html = matchesHtml(data); const text = matchesText(data); const fromName = u.name + ' · ' + orgName;
    await this.deliver({ to, toName: pros.name, fromName, fromEmail, replyTo: brokerEmail, replyToName: u.name, subject, html, text });
    this.sent.set(key, (this.sent.get(key) || 0) + 1);
    await this.audit.log(u.name, 'Emailed matches', pros.name, { prospect: pros.id, properties: properties.map((p) => p.id) });
    return { ok: true, sent: properties.length, to: to.replace(/^(.).*(@.*)$/, '$1•••$2') };
  }

  /** Today's send count check for one user: throws 429 once the daily limit is reached. */
  checkLimit(u: AuthUser) {
    const key = u.id + ':' + new Date().toISOString().slice(0, 10);
    if ((this.sent.get(key) || 0) >= PER_USER_DAILY) throw new HttpException('Daily email limit reached for your account.', HttpStatus.TOO_MANY_REQUESTS);
  }
  /** Count one sent email against the user's daily limit. */
  bump(u: AuthUser) { const key = u.id + ':' + new Date().toISOString().slice(0, 10); this.sent.set(key, (this.sent.get(key) || 0) + 1); }
  /** Sender address used when the caller has none of its own. */
  defaultFrom() { return process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER || 'onboarding@resend.dev'; }

  /** Hand one email (with optional attachments) to whichever provider is configured: Resend, SMTP or Brevo. Throws readable errors. */
  async deliver(m: OutMail) {
    if (!this.configured()) throw new ServiceUnavailableException('Email is not set up yet. Ask the admin to add the email settings.');
    const atts = m.attachments || [];
    if (this.resendOn()) {
      const res = await (globalThis as any).fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ from: `${m.fromName.replace(/[<>"]/g, '')} <${m.fromEmail}>`, to: [m.to], reply_to: m.replyTo, subject: m.subject, html: m.html, text: m.text,
          ...(atts.length ? { attachments: atts.map((a) => ({ filename: a.name, content: a.content.toString('base64') })) } : {}) }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => ''); console.error('[mail] Resend refused', res.status, t.slice(0, 300));
        throw new BadRequestException(res.status === 401 || res.status === 403 && /api key/i.test(t) ? 'The email service rejected the API key.'
          : res.status === 403 ? 'Resend only delivers to the email you signed up with until a domain is verified.' : 'The email service could not send this message.');
      }
    } else if (!this.brevoOn() && this.smtpOn()) {
      // SMTP (Gmail …): the From address must be the logged-in mailbox (or an alias Gmail allows).
      try {
        await sendSmtp({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT) || 465, user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS!,
          from: m.fromEmail, fromName: m.fromName, to: m.to, toName: m.toName, replyTo: m.replyTo, replyToName: m.replyToName, subject: m.subject, html: m.html, text: m.text, attachments: atts });
      } catch (e: any) {
        console.error('[mail] SMTP failed:', e?.message);
        const msg = String(e?.message || '');
        throw new BadRequestException(/535|534|auth/i.test(msg) ? 'The mail server rejected the login. Check the app password.'
          : /Cannot connect|ETIMEDOUT|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|closed the connection/i.test(msg) ? 'Cannot reach the mail server. Railway’s Trial and Hobby plans block SMTP, so use a Brevo API key instead (BREVO_API_KEY + MAIL_FROM_EMAIL).'
          : 'The mail server could not send this message: ' + msg.slice(0, 120));
      }
    } else {
      const res = await (globalThis as any).fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', headers: { 'api-key': process.env.BREVO_API_KEY!, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: { name: m.fromName, email: m.fromEmail }, replyTo: { email: m.replyTo, name: m.replyToName }, to: [{ email: m.to, name: m.toName }], subject: m.subject, htmlContent: m.html, textContent: m.text,
          ...(atts.length ? { attachment: atts.map((a) => ({ name: a.name, content: a.content.toString('base64') })) } : {}) }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => ''); console.error('[mail] Brevo refused', res.status, t.slice(0, 300));
        throw new BadRequestException(res.status === 401 ? 'The email service rejected the API key.' : 'The email service could not send this message. Check the sender is verified in Brevo' + (atts.length ? ' and that the attachments are not too large.' : '.'));
      }
    }
  }
}
