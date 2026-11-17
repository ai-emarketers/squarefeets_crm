// InboundService — receives leads from the Squarefeets website (enquiry form and brochure downloads) and saves them as CRM leads.
//
// The website plugin (wordpress/sf-crm-leads) posts here. There is no signed-in user, so the call is protected by a shared secret:
//   WEBSITE_LEAD_SECRET   (Railway variable on the api service; the same value is typed into the plugin's settings page)
// The same enquiry sent twice (retries) creates one lead. A repeat enquiry from a known phone number or email adds a note to the
// existing lead instead of a duplicate. Without the variable the endpoint answers 503.
import { BadRequestException, HttpException, HttpStatus, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface WebsiteLeadBody {
  kind?: 'enquiry' | 'brochure' | string; enquiryId?: string | number; name?: string; phone?: string; email?: string;
  intent?: string; message?: string; propertyTitle?: string; propertyUrl?: string; crmRef?: string; site?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (v: any, n: number) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const tenDigits = (v: any) => { const d = String(v ?? '').replace(/\D/g, '').slice(-10); return /^[6-9]\d{9}$/.test(d) ? d : ''; };
const DAY = (d: Date) => `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getFullYear()}`;

@Injectable()
export class InboundService {
  private hits: number[] = []; // request times in the last minute (a brake on floods, even with the right secret)
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  /** Compares secrets in constant time (hashing first so the lengths match). */
  private secretOk(given: string) {
    const want = process.env.WEBSITE_LEAD_SECRET || '';
    const h = (s: string) => createHash('sha256').update(s).digest();
    return !!given && timingSafeEqual(h(given), h(want));
  }

  async websiteLead(secret: string | undefined, b: WebsiteLeadBody) {
    if (!process.env.WEBSITE_LEAD_SECRET) throw new ServiceUnavailableException('Website lead intake is not set up.');
    if (!this.secretOk(String(secret || ''))) throw new UnauthorizedException('Bad secret.');
    const now = Date.now(); this.hits = this.hits.filter((t) => now - t < 60_000);
    if (this.hits.length >= 120) throw new HttpException('Too many requests.', HttpStatus.TOO_MANY_REQUESTS);
    this.hits.push(now);

    const name = clip(b?.name, 120); const phone = tenDigits(b?.phone); const email = EMAIL_RE.test(clip(b?.email, 160)) ? clip(b?.email, 160).toLowerCase() : '';
    if (!name) throw new BadRequestException('name is required');
    if (!phone && !email) throw new BadRequestException('a valid phone number or email is required');
    const kind = b?.kind === 'brochure' ? 'brochure' : 'enquiry';
    const message = clip(b?.message, 2000); const title = clip(b?.propertyTitle, 200); const url = /^https?:\/\//.test(String(b?.propertyUrl || '')) ? clip(b?.propertyUrl, 500) : '';
    const eid = clip(b?.enquiryId, 60) ? `${clip(b?.site, 60) || 'web'}:${clip(b?.enquiryId, 60)}` : '';
    const today = new Date(); const day = DAY(today); const iso = today.toISOString().slice(0, 10);
    const what = kind === 'brochure' ? `Downloaded the brochure${title ? ' for ' + title : ''}` : `Website enquiry${title ? ' about ' + title : ''}`;

    // 1) the same enquiry again (the website retries when it gets no answer): nothing to do
    if (eid) {
      const same = await this.prisma.lead.findFirst({ where: { data: { path: ['website', 'enquiryId'], equals: eid } }, select: { id: true } });
      if (same) return { id: same.id, duplicate: true, created: false };
    }
    // 2) a known person asking again: add a note to their lead
    const leads = await this.prisma.lead.findMany({ select: { id: true, phone: true, data: true, act: true } });
    const known = leads.find((l) => (phone && tenDigits(l.phone) === phone) || (email && String((l.data as any)?.email || '').toLowerCase() === email));
    if (known) {
      const act = [['Website', `${what}${message ? ': ' + message.slice(0, 200) : ''}`, day], ...(Array.isArray(known.act) ? (known.act as any[]) : [])];
      await this.prisma.lead.update({ where: { id: known.id }, data: { act: act as any } });
      await this.audit.log('Website', 'inbound.website-lead', known.id, { kind, repeat: true });
      return { id: known.id, duplicate: true, created: false };
    }
    // 3) a new lead. Someone who is already a prospect still becomes a lead, tagged so the team sees it.
    const prospects = await this.prisma.prospect.findMany({ select: { id: true, phone: true, name: true } });
    const client = prospects.find((p) => phone && tenDigits(p.phone) === phone);
    const intent = /rent|lease/i.test(clip(b?.intent, 60)) ? 'rent' : 'buy'; const sell = /sell|list/i.test(clip(b?.intent, 60));
    let id = ''; // next free id (skips ids already used, e.g. by imported data)
    for (;;) { id = `l${await this.prisma.next('lead', 7)}`; if (!(await this.prisma.lead.findUnique({ where: { id }, select: { id: true } }))) break; }
    const tags = ['Website', ...(kind === 'brochure' ? ['Brochure download'] : []), ...(sell ? ['Seller'] : []), ...(client ? ['Existing client'] : [])];
    await this.prisma.lead.create({
      data: {
        id, name, phone: phone ? '+91 ' + phone : '', source: 'Website', intent, stage: 'Lead', sub: '', budget: '',
        want: sell ? 'Wants to sell or let a property' : title ? (kind === 'brochure' ? 'Brochure: ' : 'Enquiry: ') + title : message.slice(0, 80) || 'Website enquiry',
        assigned: '', tags,
        act: [['System', `Lead created from the website — ${what}`, day], ...(message ? [['Note', message.slice(0, 300), day]] : []), ...(client ? [['System', `Phone number matches existing client ${client.name} (${client.id})`, day]] : [])] as any,
        links: url ? ([{ url, type: 'Website listing', note: title, at: iso }] as any) : ([] as any),
        basic: {} as any,
        data: { created: iso, email, waSame: true, website: { enquiryId: eid, kind, crmRef: clip(b?.crmRef, 60), propertyUrl: url } } as any,
      },
    });
    await this.audit.log('Website', 'inbound.website-lead', id, { kind });
    return { id, duplicate: false, created: true };
  }
}
