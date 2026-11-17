// Tests for sending matched properties as a PDF + documents (email attachments, WhatsApp links). Runs without a database or network:
// a tiny in-memory stand-in replaces Prisma, and the mail provider is a stub that records what it was asked to send.
// Run:  npm run test:share   (from apps/api)
import 'reflect-metadata';
import * as assert from 'assert';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';
import { ShareService } from '../src/share/share.service';
import { signToken, verifyToken } from '../src/share/share.token';
import { buildMatchesPdf } from '../src/share/matches-pdf';
import { buildMime } from '../src/mail/smtp';

process.env.JWT_SECRET = 'test-secret';
const UP = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-up-')); process.env.UPLOAD_DIR = UP;
const put = (rel: string, bytes: number) => { const abs = path.join(UP, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, Buffer.alloc(bytes, 7)); };
put('prop/RS001/a.pdf', 2000); put('prop/RS001/b.pdf', 3000); put('prop/RS001/big.pdf', 1.5 * 1024 * 1024); put('prop/RS001/unshared.pdf', 100); put('deal/D1/kyc.pdf', 100); put('prop/RS004/c.pdf', 500);

let seq = 0; const files: any[] = [
  { id: 'f1', scope: 'prop:RS001', name: 'Floor_plan.pdf', cat: 'Floor plan / layout', mime: 'application/pdf', shared: true, path: 'prop/RS001/a.pdf', createdAt: 1 },
  { id: 'f2', scope: 'prop:RS001', name: 'Tax.pdf', cat: 'Property tax receipt', mime: 'application/pdf', shared: true, path: 'prop/RS001/b.pdf', createdAt: 2 },
  { id: 'f3', scope: 'prop:RS001', name: 'Owner_PAN.pdf', cat: 'Owner ID proof', mime: 'application/pdf', shared: false, path: 'prop/RS001/unshared.pdf', createdAt: 3 },
  { id: 'f4', scope: 'deal:D1', name: 'KYC.pdf', cat: 'KYC', mime: 'application/pdf', shared: true, path: 'deal/D1/kyc.pdf', createdAt: 4 },
  { id: 'f5', scope: 'prop:RS001', name: 'Sample_only.pdf', cat: 'Brochure', mime: 'application/pdf', shared: true, path: '', createdAt: 5 },
  { id: 'f6', scope: 'prop:RS004', name: 'Brochure.pdf', cat: 'Brochure', mime: 'application/pdf', shared: true, path: 'prop/RS004/c.pdf', createdAt: 6 },
];
const props = [
  { id: 'RS001', purpose: 'sale', cat: 'Residential', sub: 'Flat / Apartment', title: '3 BHK Apartment', projectId: 'p1', unit: 'Tower 3', loc: 'Sector V, Salt Lake', bhk: 3, area: 1450, furn: 'Semi-furnished', priceL: 135, status: 'Available', data: { sbu: 1450, carpet: 1180 } },
  { id: 'RS004', purpose: 'sale', cat: 'Residential', sub: 'Flat / Apartment', title: '3 BHK Apartment', projectId: 'p1', unit: 'Tower 3', loc: 'Sector V, Salt Lake', bhk: 3, area: 1480, furn: '', priceL: 141, status: 'Available', data: {} },
  { id: 'RS009', purpose: 'sale', cat: 'Residential', sub: 'Flat / Apartment', title: 'Sold flat', projectId: 'p1', unit: '', loc: 'Salt Lake', bhk: 3, area: 1400, furn: '', priceL: 130, status: 'Sold', data: {} },
];
// Does a row satisfy a Prisma-style `where` (equality, { in: [...] }, NOT)? The service's real queries are run through this.
const match = (row: any, where: any): boolean => Object.entries(where || {}).every(([k, v]: any) => {
  if (k === 'NOT') return !match(row, v);
  if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
  return row[k] === v;
});
const table = (rows: any[]) => ({ findUnique: async ({ where }: any) => rows.find((r) => match(r, where)) || null, findMany: async ({ where }: any = {}) => rows.filter((r) => match(r, where)), findFirst: async () => rows[0] || null });
const db: any = {
  prospect: table([{ id: 'c1', name: 'Priya Nair', email: 'priya.n@email.com', data: {} }, { id: 'c2', name: 'No Email', email: '', data: {} }]),
  lead: table([{ id: 'l1', name: 'Rohit Banerjee', intent: 'buy', basic: { min: 120, max: 150, bhk: 3, locText: 'Salt Lake' }, data: {} }]),
  requirement: table([{ id: 'REQ-1', cid: 'c1', purpose: 'sale', type: 'Apartment / Flat', locs: ['Salt Lake'], min: 120, max: 150, bhk: 3, data: { area: '1,200–1,600 sq ft', parking: '1 covered' } }]),
  property: table(props), amenity: table([{ id: 'gym', label: 'Gym' }]),
  project: table([{ id: 'p1', name: 'Merlin Verve', dev: 'Merlin Group', rera: 'WBRERA/P/1', status: 'uc', complete: 'Dec 2027', amenities: ['gym', 'clubhouse'], customAmen: [] }]),
  organization: table([{ name: 'Sharma Property Consultants', rera: 'WBRERA/A/1', city: 'Kolkata' }]),
  user: table([{ id: 'u1', name: 'Anil Sharma', phone: '+91 98630 34001', corpPhone: '', email: 'anil@x.in', status: 'Active', role: 'Owner' }, { id: 'u2', name: 'Gone', status: 'Disabled', role: 'Agent' }]),
  fileRecord: table(files),
};
const sent: any[] = []; let configured = true;
const mail: any = { configured: () => configured, checkLimit: () => {}, bump: () => {}, defaultFrom: () => 'noreply@x.in', deliver: async (m: any) => { sent.push(m); } };
const audit: any = { log: async () => { seq++; } };
const svc = new ShareService(db, audit, mail);
const me: any = { id: 'u1', name: 'Anil Sharma', role: 'Owner', email: 'anil@x.in' };
const body = (o: any = {}) => ({ channel: 'email', prospectId: 'c1', requirementId: 'REQ-1', propertyIds: ['RS001', 'RS004'], ...o }) as any;

let passed = 0;
async function t(name: string, fn: () => Promise<void> | void) { try { await fn(); passed++; console.log('  ok  ' + name); } catch (e: any) { process.exitCode = 1; console.log('  FAIL ' + name + '\n       ' + (e && e.message)); } }
const rejects = async (p: Promise<any>, re?: RegExp) => { try { await p; } catch (e: any) { if (re) assert.match(String(e.message), re); return; } assert.fail('expected a rejection'); };
const pageCount = (b: Buffer) => (b.toString('latin1').match(/\/Type \/Page\b(?!s)/g) || []).length;
const smtp = (extra: any) => ({ host: 'h', port: 1, user: 'u', pass: 'p', from: 'a@x.in', fromName: 'A', to: 'b@x.in', toName: 'B', replyTo: 'a@x.in', replyToName: 'A', subject: 's', html: '<p>x</p>', text: 'x', ...extra });
const pdfProp = (id: string) => ({ id, title: 'T ' + id, loc: 'Salt Lake', unit: '', project: 'P', developer: '', price: '₹1.35 Cr', bhk: '3 BHK', summary: '3 BHK', facts: [['A', 'b']] as [string, string][], score: 90, reasons: [{ ok: true, text: 'Price ₹1.35 Cr ✓' }], amenities: ['Gym'], docs: ['a.pdf'] });
const JPG = Buffer.from('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', 'base64'); // a 320x200 test photo
const pdfBase = { org: { name: 'Org', rera: '', city: '' }, broker: { name: 'A', phone: '', email: '' }, client: 'Priya', reqId: 'R', matched: true, date: 'x', reqChips: ['3 BHK'] };

(async () => {
  console.log('Share links');
  await t('a signed token verifies and carries its data', () => { const k = signToken({ k: 'doc', f: 'f1' }); assert.equal(verifyToken(k)!.f, 'f1'); });
  await t('an expired token is rejected', () => { const k = signToken({ k: 'doc' }, 7, 1000); assert.equal(verifyToken(k, 1000 + 7 * 86400 - 1)?.k, 'doc'); assert.equal(verifyToken(k, 1000 + 7 * 86400 + 1), null); });
  await t('a tampered token or signature is rejected', () => {
    const [b, s] = signToken({ k: 'doc', f: 'f1' }).split('.'); const evil = Buffer.from(JSON.stringify({ k: 'doc', f: 'f4', e: 9999999999 })).toString('base64url');
    assert.equal(verifyToken(evil + '.' + s), null); assert.equal(verifyToken(b + '.' + s.slice(0, -2) + 'AA'), null); assert.equal(verifyToken(b), null); assert.equal(verifyToken(''), null); assert.equal(verifyToken('a.b.c'), null);
  });
  await t('a token signed with another secret, or a login JWT, is rejected', () => {
    const good = signToken({ k: 'doc', f: 'f1' }); process.env.JWT_SECRET = 'other'; assert.equal(verifyToken(good), null);
    const bad = signToken({ k: 'doc', f: 'f1' }); process.env.JWT_SECRET = 'test-secret'; assert.equal(verifyToken(bad), null);
    assert.equal(verifyToken('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSIsImV4cCI6OTk5OTk5OTk5OX0.abc'), null);
  });

  console.log('PDF');
  await t('one summary page plus one page per property; valid structure', () => {
    const b = buildMatchesPdf({ ...pdfBase, properties: [pdfProp('a'), pdfProp('b'), pdfProp('c')] });
    assert.equal(b.slice(0, 5).toString(), '%PDF-'); assert.ok(b.toString('latin1').trimEnd().endsWith('%%EOF')); assert.equal(pageCount(b), 4);
    const s = b.toString('latin1'); const xr = Number(/startxref\n(\d+)/.exec(s)![1]); assert.ok(s.slice(xr).startsWith('xref'));
  });
  await t('a JPEG photo is embedded (summary thumbnail and the property page); a non-JPEG is ignored', () => {
    const b = buildMatchesPdf({ ...pdfBase, properties: [{ ...pdfProp('a'), photo: JPG }, { ...pdfProp('b'), photo: Buffer.from('not a jpeg') }] });
    const s = b.toString('latin1'); assert.equal(pageCount(b), 3); assert.equal((s.match(/\/Subtype \/Image/g) || []).length, 1, 'the one valid photo is stored once, however often it is drawn'); assert.ok(s.includes('/DCTDecode'));
    if (process.env.WRITE_SAMPLE) fs.writeFileSync(process.env.WRITE_SAMPLE, b);
  });
  await t('no photo at all: no image is drawn; extra photos get gallery pages (6 per page)', () => {
    const none = buildMatchesPdf({ ...pdfBase, properties: [pdfProp('a')] });
    assert.equal((none.toString('latin1').match(/\/Subtype \/Image/g) || []).length, 0); const base = pageCount(none);
    const g = buildMatchesPdf({ ...pdfBase, properties: [{ ...pdfProp('a'), photo: JPG, gallery: [JPG, JPG, JPG, JPG, JPG, JPG, JPG] }] });
    assert.equal(pageCount(g), base + 2, '7 gallery photos = 2 gallery pages'); assert.ok(g.toString('latin1').includes('/DCTDecode'));
  });
  await t('many properties spill onto extra summary pages', () => {
    const b = buildMatchesPdf({ ...pdfBase, matched: false, properties: Array.from({ length: 10 }, (_, i) => pdfProp('P' + i)) });
    assert.ok(pageCount(b) > 11, 'summary should need more than one page for 10 properties: ' + pageCount(b));
  });
  await t('characters the font lacks do not break the file', () => {
    const b = buildMatchesPdf({ ...pdfBase, broker: { name: 'অনিল', phone: '', email: '' }, client: 'প্রিয়া Nair', matched: false, properties: [] });
    assert.equal(b.slice(0, 5).toString(), '%PDF-');
  });

  console.log('Email attachments (SMTP MIME)');
  await t('without files the message stays multipart/alternative', () => {
    const m = buildMime(smtp({}), 'BND'); assert.ok(m.includes('multipart/alternative; boundary="BND"')); assert.ok(!m.includes('multipart/mixed'));
  });
  await t('with files it is multipart/mixed and the file survives base64', () => {
    const data = Buffer.from(Array.from({ length: 5000 }, (_, i) => i % 256));
    const m = buildMime(smtp({ attachments: [{ name: 'Floor "plan"\r\nBcc: evil@x.in.pdf', content: data, type: 'application/pdf' }] }), 'BND');
    assert.ok(m.includes('multipart/mixed; boundary="BND-mixed"')); assert.ok(m.includes('Content-Disposition: attachment; filename="=?UTF-8?B?')); assert.ok(!/\r\nBcc:/i.test(m), 'header injection through the file name');
    const part = m.split('--BND-mixed')[2]; const b64 = part.split('\r\n\r\n')[1].replace(/\r\n/g, '').trim(); assert.ok(Buffer.from(b64, 'base64').equals(data));
    assert.ok(m.trimEnd().endsWith('--BND-mixed--'));
  });

  console.log('Share service');
  await t('only Shareable documents of the chosen properties are picked (never other scopes, unshared, or missing files)', async () => {
    const c = await svc.gather(me, body({ documentIds: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'nope'] }));
    assert.deepEqual(c.docs.map((d) => d.id).sort(), ['f1', 'f2', 'f6']);
  });
  await t('document ids left out means every shareable document; an empty list means none', async () => {
    assert.deepEqual((await svc.gather(me, body())).docs.map((d) => d.id).sort(), ['f1', 'f2', 'f6']);
    assert.equal((await svc.gather(me, body({ documentIds: [] }))).docs.length, 0);
  });
  await t('properties that are not Available are dropped, and none left is an error', async () => {
    assert.deepEqual((await svc.gather(me, body({ propertyIds: ['RS001', 'RS009'] }))).propIds, ['RS001']);
    await rejects(svc.gather(me, body({ propertyIds: ['RS009'] })), /available/);
  });
  await t('match score and reasons come from the server, and the PDF is built', async () => {
    const c = await svc.gather(me, body()); assert.equal(c.props[0].score, 100); assert.ok(c.props[0].reasons.some((r) => /inside your budget/.test(r.text)));
    assert.ok(c.props[0].amenities.includes('Gym') && c.props[0].amenities.includes('Clubhouse')); assert.equal(pageCount((svc as any).pdfWith(c, [])), 3);
  });
  await t('email: the PDF comes first, then each document as an attachment', async () => {
    sent.length = 0; const r: any = await svc.send(me, body({ origin: 'https://crm.example.in' }));
    assert.equal(sent.length, 1); const m = sent[0]; assert.equal(m.to, 'priya.n@email.com'); assert.match(m.attachments[0].name, /^Matched properties - Priya Nair\.pdf$/); assert.equal(m.attachments[0].content.slice(0, 5).toString(), '%PDF-');
    assert.deepEqual(m.attachments.slice(1).map((a: any) => a.name).sort(), ['RS001 - Floor_plan.pdf', 'RS001 - Tax.pdf', 'RS004 - Brochure.pdf']); assert.equal(r.linked, 0); assert.equal(r.attached, 4);
    assert.ok(m.html.includes('Floor_plan.pdf')); assert.ok(r.to.startsWith('p•••@'));
  });
  await t('email: documents over the size limit go as links instead', async () => {
    files.push({ id: 'f7', scope: 'prop:RS001', name: 'Big.pdf', cat: 'Brochure', mime: 'application/pdf', shared: true, path: 'prop/RS001/big.pdf', createdAt: 7 });
    process.env.MAIL_MAX_ATTACH_MB = '1'; sent.length = 0; const r: any = await svc.send(me, body({ origin: 'https://crm.example.in' }));
    assert.equal(r.linked, 1); assert.ok(!sent[0].attachments.some((a: any) => /Big/.test(a.name))); assert.match(sent[0].text, /https:\/\/crm\.example\.in\/api\/share\/f\//);
    await rejects(svc.send(me, body({ origin: 'ftp://nope' })), /too large/);
    delete process.env.MAIL_MAX_ATTACH_MB; files.pop();
  });
  await t('email: refuses when not set up, for leads, and for a client without an email', async () => {
    configured = false; await rejects(svc.send(me, body()), /not set up/); configured = true;
    await rejects(svc.send(me, body({ prospectId: undefined, leadId: 'l1', requirementId: undefined })), /Leads have no email/);
    await rejects(svc.send(me, body({ prospectId: 'c2', requirementId: undefined })), /no email address/);
  });
  await t('whatsapp: a short message with a PDF link and one link per document', async () => {
    const r: any = await svc.send(me, body({ channel: 'whatsapp', origin: 'https://crm.example.in', note: 'See you Saturday' }));
    assert.match(r.message, /^Hi Priya, this is Anil Sharma from Sharma Property Consultants\./); assert.ok(r.message.includes('See you Saturday')); assert.ok(r.message.includes(r.pdfUrl)); assert.equal(r.docs.length, 3);
    for (const d of r.docs) assert.ok(r.message.includes(d.url));
    const p = verifyToken(r.pdfUrl.split('/').pop())!; assert.equal(p.k, 'pdf'); assert.deepEqual(p.p, ['RS001', 'RS004']);
    assert.equal(verifyToken(r.docs[0].url.split('/').pop())!.k, 'doc'); assert.ok(!r.message.includes('3 BHK Apartment'), 'no per-property plain text any more');
  });
  await t('whatsapp: works for a lead, and needs a website address', async () => {
    const r: any = await svc.send(me, body({ channel: 'whatsapp', prospectId: undefined, leadId: 'l1', requirementId: undefined, origin: 'https://crm.example.in' })); assert.match(r.message, /^Hi Rohit/);
    await rejects(svc.send(me, body({ channel: 'whatsapp' })), /website address/);
  });
  await t('a PDF link opens the PDF, a document link opens the file', async () => {
    const r: any = await svc.send(me, body({ channel: 'whatsapp', origin: 'https://crm.example.in' }));
    const pdf: any = await svc.resolve(verifyToken(r.pdfUrl.split('/').pop())!); assert.equal(pdf.kind, 'pdf'); assert.equal(pdf.buf.slice(0, 5).toString(), '%PDF-'); assert.equal(pageCount(pdf.buf), 3);
    const doc: any = await svc.resolve(verifyToken(r.docs[0].url.split('/').pop())!); assert.equal(doc.kind, 'doc'); assert.ok(fs.existsSync(doc.abs));
  });
  await t('a document link stops working once the file is unshared or moved out of a property, and never leaves the upload folder', async () => {
    const tok = verifyToken(signToken({ k: 'doc', f: 'f1' }))!; assert.ok(await svc.resolve(tok));
    files[0].shared = false; assert.equal(await svc.resolve(tok), null); files[0].shared = true;
    files[0].scope = 'deal:X'; assert.equal(await svc.resolve(tok), null); files[0].scope = 'prop:RS001';
    files[0].path = '../../etc/passwd'; assert.equal(await svc.resolve(tok), null); files[0].path = 'prop/RS001/a.pdf';
    assert.equal(await svc.resolve(verifyToken(signToken({ k: 'doc', f: 'f4' }))!), null, 'a deal/KYC file can never be linked');
  });
  await t('a PDF link stops working when its sender is deactivated, and unknown kinds are refused', async () => {
    assert.equal(await svc.resolve(verifyToken(signToken({ k: 'pdf', u: 'u2', c: 'c1', l: '', r: 'REQ-1', p: ['RS001'] }))!), null);
    assert.equal(await svc.resolve(verifyToken(signToken({ k: 'zip', f: 'f1' }))!), null);
  });

  console.log(process.exitCode ? '\nSome tests FAILED' : `\nAll ${passed} tests passed`);
})();
