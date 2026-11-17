// ShareService — sends matched properties to a client as a PDF plus the properties' shareable documents.
//   email:    the PDF and the documents are attached (what does not fit under the size limit goes as download links).
//   whatsapp: a wa.me link cannot carry files, so the message holds expiring links to the PDF and to each document.
// Everything is read from the database. Only documents marked Shareable on the chosen properties can ever leave (never deal, KYC or owner papers).
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.decorators';
import { MailAttachment, MailService } from '../mail/mail.service';
import { fmtLakh, fmtRentK } from '../mail/mail.template';
import { leadReq, matchesFor } from '../requirements/matching';
import { uploadRoot } from '../files/files.util';
import { buildMatchesPdf, PdfProperty } from './matches-pdf';
import { shareHtml, shareText } from './share.mail';
import { ShareMatchesDto } from './share.dto';
import { linkDays, signToken } from './share.token';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_GALLERY = 11;                          // extra photos per property in the PDF gallery
const GALLERY_BUDGET = 2.5 * 1024 * 1024;        // total gallery photo bytes per PDF (keeps the email small)
const MAX_DOCS = 30;                              // documents per send
const MAX_PHOTO = 3 * 1024 * 1024;                // biggest photo drawn into the PDF
const maxAttachBytes = () => Math.max(1, Number(process.env.MAIL_MAX_ATTACH_MB) || 4) * 1024 * 1024; // total attachment size per email (Brevo's limit is the lowest)
const num = (n: unknown) => Math.round(Number(n) || 0).toLocaleString('en-IN');
const flat = (row: any) => { const { data, ...rest } = row || {}; return { ...(data || {}), ...rest }; };
const safeFile = (s: string) => String(s || 'file').replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || 'file';
const niceAmen = (s: string) => { const t = String(s).replace(/_/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); };

/** A shareable document of one of the chosen properties, checked to exist on disk. */
export interface ShareDoc { id: string; propId: string; name: string; cat: string; size: number; mime: string; abs: string }
/** Everything gathered from the database for one send. */
export interface ShareCtx {
  channel: 'email' | 'whatsapp'; clientId: string; isLead: boolean; client: string; email: string; reqId: string; spec: string; matched: boolean;
  org: any; broker: { name: string; phone: string; email: string }; props: PdfProperty[]; propIds: string[]; docs: ShareDoc[]; skipped: number;
}

@Injectable()
export class ShareService {
  constructor(private prisma: PrismaService, private audit: AuditService, private mail: MailService) {}

  /** Read the client, requirement, properties and documents and shape them for the PDF. Throws readable 400/404 errors. */
  async gather(u: AuthUser, b: ShareMatchesDto): Promise<ShareCtx> {
    const db: any = this.prisma;
    let pros: any = null, lead: any = null;
    if (b.prospectId) { pros = await db.prospect.findUnique({ where: { id: b.prospectId } }); if (!pros) throw new NotFoundException('Client not found.'); }
    else if (b.leadId) { lead = await db.lead.findUnique({ where: { id: b.leadId } }); if (!lead) throw new NotFoundException('Lead not found.'); }
    else throw new BadRequestException('Choose a client first.');
    // the requirement the matches belong to (a lead with a budget acts like a requirement)
    let req: any = null;
    if (pros && b.requirementId) {
      const r = await db.requirement.findUnique({ where: { id: b.requirementId } });
      if (!r || r.cid !== pros.id) throw new NotFoundException('Requirement not found for this client.'); req = flat(r);
    } else if (lead) req = leadReq(lead);
    // properties: still Available, in the order the realtor picked them
    const ids = [...new Set(b.propertyIds)];
    const rows: any[] = await db.property.findMany({ where: { id: { in: ids }, status: 'Available' } });
    if (!rows.length) throw new BadRequestException('None of the chosen properties is available any more.');
    const order = new Map(ids.map((id, i) => [id, i])); rows.sort((x, y) => (order.get(x.id) ?? 0) - (order.get(y.id) ?? 0));
    const fl = rows.map(flat);
    const projIds = [...new Set(rows.map((r) => r.projectId).filter(Boolean))] as string[];
    const projs: any[] = projIds.length ? await db.project.findMany({ where: { id: { in: projIds } } }) : [];
    const amen: any[] = await db.amenity.findMany();
    const label = new Map<string, string>(amen.map((a) => [a.id, a.label]));
    const org = (await db.organization.findFirst()) || {};
    const me = await db.user.findUnique({ where: { id: u.id } });
    const broker = { name: u.name, phone: (me && (me.corpPhone || me.phone)) || '', email: u.email || (me && me.email) || '' };
    // match scores and reasons, computed here (never taken from the browser)
    const matches = new Map<string, any>(req ? matchesFor(req, fl).map((m: any) => [m.p.id, m]) : []);
    // documents + photos
    const files: any[] = await db.fileRecord.findMany({ where: { scope: { in: rows.map((r) => 'prop:' + r.id) }, shared: true, NOT: { path: '' } }, orderBy: { createdAt: 'asc' } });
    const photos = new Map<string, Buffer>(), gallery = new Map<string, Buffer[]>(); let galleryBytes = 0; const docs: ShareDoc[] = []; let skipped = 0;
    const want = b.documentIds ? new Set(b.documentIds) : null;
    for (const f of files) {
      const abs = path.resolve(uploadRoot(), f.path); if (!abs.startsWith(uploadRoot())) continue; // never read outside the upload folder
      const pid = String(f.scope).slice(5);
      if (f.cat === 'Photos' && /jpe?g/i.test(f.mime)) { // first JPEG = cover, the rest = gallery pages (kept within a size budget)
        try {
          const st = await fs.stat(abs);
          if (st.size <= MAX_PHOTO && (!photos.has(pid) || (gallery.get(pid) || []).length < MAX_GALLERY && galleryBytes + st.size <= GALLERY_BUDGET)) {
            const buf = await fs.readFile(abs);
            if (!photos.has(pid)) photos.set(pid, buf); else { gallery.set(pid, [...(gallery.get(pid) || []), buf]); galleryBytes += st.size; }
          }
        } catch { /* photo missing: skip it */ }
        continue;
      }
      if (want && !want.has(f.id)) continue;
      try { const st = await fs.stat(abs); if (!st.isFile()) throw new Error('not a file'); if (docs.length < MAX_DOCS) docs.push({ id: f.id, propId: pid, name: f.name, cat: f.cat, size: st.size, mime: f.mime, abs }); }
      catch { skipped++; } // the record exists but the file is gone
    }
    // shape each property for the PDF
    const props: PdfProperty[] = rows.map((r, i) => {
      const p = fl[i], proj = projs.find((x) => x.id === r.projectId) || {}, m = matches.get(r.id);
      const price = r.purpose === 'sale' ? fmtLakh(r.priceL || 0) : fmtRentK(r.rentK || 0);
      const size = p.sbu || r.area, carpet = p.carpet;
      const residential = r.cat === 'Residential' && r.bhk;
      const status = proj.status === 'uc' ? 'Under construction' + (proj.complete ? ' · ' + proj.complete : '') : proj.status === 'ready' ? 'Ready to move' : '';
      const facts: [string, string][] = ([
        residential ? ['Bedrooms', r.bhk + ' BHK'] : ['Type', r.sub || r.cat],
        size ? [carpet ? 'Carpet / saleable' : 'Area', (carpet ? num(carpet) + ' / ' : '') + num(size) + ' sq ft'] : null,
        r.furn ? ['Furnishing', r.furn] : null, status ? ['Status', status] : null,
        proj.dev ? ['Developer', proj.dev] : null, proj.name ? ['RERA', proj.rera || 'Not registered yet'] : null,
      ] as any[]).filter(Boolean);
      const own = Array.isArray(p.features) ? p.features : [];
      const amenities = [...(proj.amenities || []), ...own, ...(proj.customAmen || [])].map((a: string) => label.get(a) || niceAmen(a));
      return {
        id: r.id, title: r.title, loc: r.loc, unit: r.unit || '', project: proj.name || '', developer: proj.dev || '', price,
        bhk: residential ? r.bhk + ' BHK' : r.cat, summary: [residential ? r.bhk + ' BHK' : r.sub || r.cat, size ? num(size) + ' sq ft' : '', r.furn].filter(Boolean).join(' · '),
        facts, score: m ? m.score : undefined, reasons: m ? this.reasons(m.why, r, req, price, size) : [],
        amenities: [...new Set(amenities)], photo: photos.get(r.id), gallery: gallery.get(r.id),
        docs: docs.filter((d) => d.propId === r.id).map((d) => d.name + '  ·  ' + d.cat),
      };
    });
    const spec = req ? this.spec(req) : '';
    return { channel: b.channel, clientId: (pros || lead).id, isLead: !!lead, client: (pros || lead).name, email: String((pros && pros.email) || '').trim(), reqId: req ? (req.id || '') : '',
      spec, matched: !!req, org, broker, props, propIds: rows.map((r) => r.id), docs, skipped };
  }

  /** "3 BHK, Salt Lake, ₹1.2 Cr – ₹1.5 Cr" */
  private spec(r: any) { return this.chips(r).join(', '); }
  private chips(r: any): string[] {
    const bud = r.min || r.max ? (r.purpose === 'sale' ? fmtLakh(Number(r.min) || 0) + ' – ' + fmtLakh(Number(r.max) || 0) : fmtRentK(Number(r.min) || 0) + ' – ' + fmtRentK(Number(r.max) || 0)) : '';
    return [r.type, (r.locs || []).join(', '), bud, Number(r.bhk) ? r.bhk + ' BHK' : '', r.area && r.area !== 'Any' ? String(r.area) : '', r.parking && r.parking !== 'Not needed' ? String(r.parking) : '']
      .filter((x) => x && String(x).trim());
  }
  /** Turn the matcher's [label, points, ok] list into sentences a client can read. */
  private reasons(why: [string, number, boolean][], p: any, r: any, price: string, size: number) {
    const out: { ok: boolean; text: string }[] = [];
    for (const [lab, , ok] of why) {
      if (lab === 'Locality') out.push({ ok, text: ok ? `${p.loc} is in your preferred area` : `${p.loc} is outside your preferred areas` });
      else if (lab === 'Budget') out.push({ ok, text: ok ? `Price ${price} is inside your budget` : `Price ${price} is outside your budget` });
      else if (lab.startsWith('Budget (')) out.push({ ok: true, text: `Price ${price} is just outside your budget (within 10%)` });
      else if (lab === 'BHK') out.push({ ok, text: ok ? `${p.bhk} BHK, as requested` : `${p.bhk} BHK, you asked for ${r.bhk} BHK` });
      else if (lab.startsWith('BHK (±')) out.push({ ok: true, text: `${p.bhk} BHK, close to the ${r.bhk} BHK you asked for` });
      else if (lab === 'Area') out.push({ ok, text: ok ? `${num(size)} sq ft is inside your size range` : `${num(size)} sq ft is outside your size range` });
      else if (lab.startsWith('Area (±')) out.push({ ok: true, text: `${num(size)} sq ft is close to your size range` });
      else if (lab.startsWith('Facing')) out.push({ ok, text: ok ? lab : 'Not ' + lab.toLowerCase() });
    }
    return out;
  }

  /** The matched-properties PDF for this send (`chips` = what the client asked for, shown on page 1). */
  private pdfWith(c: ShareCtx, chips: string[]) {
    return buildMatchesPdf({
      org: { name: c.org.name || process.env.MAIL_FROM_NAME || 'SquareFeets Realty', rera: c.org.rera || '', city: c.org.city || '' }, broker: c.broker, client: c.client, reqId: c.reqId,
      matched: c.matched, date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }), reqChips: chips, properties: c.props,
    });
  }

  /** Where download links point: PUBLIC_WEB_URL if set, else the website address the browser reported, else the forwarded request host. */
  origin(fromBody: string | undefined, req?: any) {
    const ok = (s?: string) => { try { const u = new URL(String(s)); return /^https?:$/.test(u.protocol) ? u.origin : ''; } catch { return ''; } };
    const proto = String(req?.headers?.['x-forwarded-proto'] || req?.protocol || 'https').split(',')[0].trim(), host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').split(',')[0].trim();
    return ok(process.env.PUBLIC_WEB_URL) || ok(fromBody) || (host ? ok(proto + '://' + host) : '');
  }
  private url(origin: string, payload: Record<string, unknown>) { return origin + '/api/share/f/' + signToken(payload); }

  /** POST /share/matches — dispatch by channel. */
  async send(u: AuthUser, b: ShareMatchesDto, req?: any) {
    const c = await this.gather(u, b);
    const chips = c.matched ? await this.chipsFor(b, c) : [];
    return b.channel === 'email' ? this.sendEmail(u, b, c, chips, this.origin(b.origin, req)) : this.whatsapp(u, b, c, this.origin(b.origin, req));
  }
  private async chipsFor(b: ShareMatchesDto, c: ShareCtx) {
    const db: any = this.prisma; let r: any = null;
    if (b.prospectId && b.requirementId) r = flat(await db.requirement.findUnique({ where: { id: b.requirementId } }));
    else if (b.leadId) r = leadReq(await db.lead.findUnique({ where: { id: b.leadId } }));
    return r ? this.chips(r) : [];
  }

  private async sendEmail(u: AuthUser, b: ShareMatchesDto, c: ShareCtx, chips: string[], origin: string) {
    if (!this.mail.configured()) throw new BadRequestException('Email is not set up yet. Ask the admin to add the email settings.');
    if (c.isLead) throw new BadRequestException('Leads have no email address. Convert the lead to a prospect first, or send on WhatsApp.');
    if (!EMAIL_RE.test(c.email)) throw new BadRequestException(`${c.client} has no email address saved.`);
    this.mail.checkLimit(u);
    const pdf = this.pdfWith(c, chips);
    const attachments: MailAttachment[] = [{ name: `Matched properties - ${safeFile(c.client)}.pdf`, content: pdf, type: 'application/pdf' }];
    let total = pdf.length; const linked: { name: string; url: string }[] = []; const many = c.propIds.length > 1;
    for (const d of c.docs) {
      const shown = many ? `${d.propId} - ${safeFile(d.name)}` : safeFile(d.name);
      if (total + d.size <= maxAttachBytes() && attachments.length < 20) { attachments.push({ name: shown, content: await fs.readFile(d.abs), type: d.mime }); total += d.size; }
      else if (origin) linked.push({ name: shown, url: this.url(origin, { k: 'doc', f: d.id }) });
    }
    const unsent = c.docs.length - (attachments.length - 1) - linked.length; // too big and no public address to link to
    if (unsent > 0) throw new BadRequestException('The documents are too large to attach and the website address is not known, so they cannot be linked. Remove some documents or ask the admin to set PUBLIC_WEB_URL.');
    const org = c.org.name || process.env.MAIL_FROM_NAME || 'SquareFeets Realty', fromEmail = this.mail.defaultFrom(), brokerEmail = c.broker.email || fromEmail;
    const data = { clientName: c.client, orgName: org, brokerName: c.broker.name, brokerEmail, brokerPhone: c.broker.phone, orgAddress: process.env.MAIL_ORG_ADDRESS || '', days: linkDays(), propertyCount: c.props.length,
      intro: (b.note || '').trim() || (c.matched && c.spec ? `Based on what you told us (${c.spec}), these are the best matches right now.` : 'Here are the properties we talked about.'),
      attached: attachments.map((a) => a.name), linked };
    const subject = (b.subject || '').trim() || `${c.props.length} ${c.props.length === 1 ? 'property' : 'properties'} ${c.matched ? 'that match what you asked for' : 'for you'}`;
    await this.mail.deliver({ to: c.email, toName: c.client, fromName: c.broker.name + ' · ' + org, fromEmail, replyTo: brokerEmail, replyToName: c.broker.name, subject, html: shareHtml(data), text: shareText(data), attachments });
    this.mail.bump(u);
    await this.audit.log(u.name, 'Emailed matches PDF', c.client, { client: c.clientId, properties: c.propIds, documents: c.docs.map((d) => d.id), attached: attachments.length, linked: linked.length });
    return { ok: true, sent: c.props.length, attached: attachments.length, documents: attachments.length - 1 + linked.length, linked: linked.length, skipped: c.skipped, to: c.email.replace(/^(.).*(@.*)$/, '$1•••$2') };
  }

  private async whatsapp(u: AuthUser, b: ShareMatchesDto, c: ShareCtx, origin: string) {
    if (!origin) throw new BadRequestException('The website address is not known, so download links cannot be made. Ask the admin to set PUBLIC_WEB_URL.');
    const pdfUrl = this.url(origin, { k: 'pdf', u: u.id, c: b.prospectId || '', l: b.leadId || '', r: b.requirementId || '', p: c.propIds, ...(b.documentIds ? { d: b.documentIds } : {}) });
    const many = c.propIds.length > 1;
    const docs = c.docs.map((d) => ({ id: d.id, name: many ? `${d.propId} - ${safeFile(d.name)}` : safeFile(d.name), url: this.url(origin, { k: 'doc', f: d.id }) }));
    const first = c.client.split(' ')[0] || c.client, org = c.org.name || 'SquareFeets Realty', n = c.props.length;
    const lines = [`Hi ${first}, this is ${c.broker.name} from ${org}.`, ''];
    if ((b.note || '').trim()) lines.push(b.note!.trim(), '');
    lines.push(c.matched ? `${n === 1 ? 'Here is 1 property that matches' : `Here are ${n} properties that match`} what you asked for${c.spec ? ` (${c.spec})` : ''}.` : `${n === 1 ? 'Here is 1 property' : `Here are ${n} properties`} for you.`, '',
      '*Property details (PDF):*', pdfUrl);
    if (docs.length) { lines.push('', '*Documents:*'); docs.forEach((d) => lines.push(`${d.name}`, d.url)); }
    lines.push('', 'Would you like to see any of them? Reply here and I will set up a visit.');
    await this.audit.log(u.name, 'Prepared WhatsApp matches share', c.client, { client: c.clientId, properties: c.propIds, documents: c.docs.map((d) => d.id) });
    return { ok: true, message: lines.join('\n'), pdfUrl, docs, days: linkDays(), skipped: c.skipped };
  }

  /** Public download behind a link: returns what to send, or null when the link is not valid (the caller answers 404 for every reason). */
  async resolve(p: Record<string, any>): Promise<{ kind: 'pdf'; name: string; buf: Buffer } | { kind: 'doc'; name: string; mime: string; abs: string } | null> {
    const db: any = this.prisma;
    if (p.k === 'doc') {
      const f = await db.fileRecord.findUnique({ where: { id: String(p.f || '') } });
      if (!f || !f.shared || !f.path || !String(f.scope).startsWith('prop:')) return null; // unshared since the link was made
      const abs = path.resolve(uploadRoot(), f.path); if (!abs.startsWith(uploadRoot())) return null;
      try { if (!(await fs.stat(abs)).isFile()) return null; } catch { return null; }
      return { kind: 'doc', name: f.name, mime: f.mime, abs };
    }
    if (p.k === 'pdf') {
      const me = await db.user.findUnique({ where: { id: String(p.u || '') } });
      if (!me || me.status !== 'Active') return null;                                       // the sender was deactivated
      const b: any = { channel: 'whatsapp', prospectId: p.c || undefined, leadId: p.l || undefined, requirementId: p.r || undefined, propertyIds: Array.isArray(p.p) ? p.p.slice(0, 10) : [], documentIds: Array.isArray(p.d) ? p.d.slice(0, 60) : undefined };
      try {
        const c = await this.gather({ id: me.id, name: me.name, role: me.role, email: me.email || undefined }, b);
        return { kind: 'pdf', name: `Matched properties - ${safeFile(c.client)}.pdf`, buf: this.pdfWith(c, c.matched ? await this.chipsFor(b, c) : []) };
      } catch { return null; }
    }
    return null;
  }
}
