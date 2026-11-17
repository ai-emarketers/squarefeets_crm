// Tests for website lead intake (secret check, validation, one lead per enquiry, repeat visitors, existing clients).
// Runs with a small in-memory stand-in for the database. Run: npm run test:inbound (from apps/api)
import 'reflect-metadata';
import * as assert from 'assert';
import { InboundService } from '../src/inbound/inbound.service';

const leads: any[] = []; const prospects: any[] = []; let counter = 6; const audit: any[] = [];
const prisma: any = {
  next: async () => ++counter,
  lead: {
    findFirst: async ({ where }: any) => { const e = where.data.equals; const l = leads.find((x) => x.data?.website?.enquiryId === e); return l ? { id: l.id } : null; },
    findMany: async () => leads.map((l) => ({ ...l })),
    findUnique: async ({ where }: any) => (leads.find((l) => l.id === where.id) ? { id: where.id } : null),
    create: async ({ data }: any) => { leads.push({ ...data }); return data; },
    update: async ({ where, data }: any) => { Object.assign(leads.find((l) => l.id === where.id), data); },
  },
  prospect: { findMany: async () => prospects },
};
const svc = new InboundService(prisma, { log: async (...a: any[]) => { audit.push(a); } } as any);
const S = 'top-secret-value';

async function run() {
  // no secret configured -> not set up
  delete process.env.WEBSITE_LEAD_SECRET;
  await assert.rejects(() => svc.websiteLead(S, { name: 'A', phone: '9830012345' }), /not set up/);
  process.env.WEBSITE_LEAD_SECRET = S;
  // wrong or missing secret
  await assert.rejects(() => svc.websiteLead('nope', { name: 'A', phone: '9830012345' }), /Bad secret/);
  await assert.rejects(() => svc.websiteLead(undefined, { name: 'A', phone: '9830012345' }), /Bad secret/);
  // validation
  await assert.rejects(() => svc.websiteLead(S, { phone: '9830012345' }), /name is required/);
  await assert.rejects(() => svc.websiteLead(S, { name: 'Ravi', phone: '12345', email: 'nope' }), /valid phone number or email/);

  // a new enquiry about a property
  let r = await svc.websiteLead(S, { kind: 'enquiry', enquiryId: 55, site: 'sf', name: ' Ravi Kumar ', phone: '+91 98300 12345', email: 'Ravi@Example.com', intent: 'Buy', message: 'Please call me about 3 BHK', propertyTitle: 'Merlin Verve', propertyUrl: 'https://squarefeetsrealty.com/properties/merlin-verve/', crmRef: 'project:p1' });
  assert.deepStrictEqual(r, { id: 'l7', duplicate: false, created: true });
  const l = leads[0];
  assert.strictEqual(l.name, 'Ravi Kumar'); assert.strictEqual(l.phone, '+91 9830012345'); assert.strictEqual(l.source, 'Website'); assert.strictEqual(l.intent, 'buy');
  assert.strictEqual(l.want, 'Enquiry: Merlin Verve'); assert.deepStrictEqual(l.tags, ['Website']);
  assert.strictEqual(l.data.email, 'ravi@example.com'); assert.strictEqual(l.data.website.crmRef, 'project:p1'); assert.strictEqual(l.links[0].type, 'Website listing');
  assert.ok(l.act[0][1].startsWith('Lead created from the website')); assert.strictEqual(l.act[1][1], 'Please call me about 3 BHK');

  // the website retries the same enquiry: still one lead
  r = await svc.websiteLead(S, { kind: 'enquiry', enquiryId: 55, site: 'sf', name: 'Ravi Kumar', phone: '9830012345' });
  assert.deepStrictEqual(r, { id: 'l7', duplicate: true, created: false }); assert.strictEqual(leads.length, 1);

  // the same person comes back later (different enquiry, same number): a note on the old lead
  r = await svc.websiteLead(S, { kind: 'brochure', enquiryId: 60, site: 'sf', name: 'Ravi K', phone: '98300 12345', propertyTitle: 'Rosedale Garden' });
  assert.deepStrictEqual(r, { id: 'l7', duplicate: true, created: false }); assert.strictEqual(leads.length, 1);
  assert.strictEqual(leads[0].act[0][0], 'Website'); assert.ok(leads[0].act[0][1].includes('Downloaded the brochure for Rosedale Garden'));

  // same person found by email when no phone was given
  r = await svc.websiteLead(S, { enquiryId: 61, site: 'sf', name: 'Ravi', email: 'RAVI@example.com' });
  assert.strictEqual(r.duplicate, true);

  // a brochure download from a new person, renting, existing client by phone
  prospects.push({ id: 'c9', name: 'Meera Kapoor', phone: '+91 98300 54321' });
  r = await svc.websiteLead(S, { kind: 'brochure', enquiryId: 70, site: 'sf', name: 'Meera K', phone: '9830054321', intent: 'Rent', propertyTitle: 'Godrej Meridien' });
  assert.strictEqual(r.created, true); const m = leads[1];
  assert.strictEqual(m.intent, 'rent'); assert.deepStrictEqual(m.tags, ['Website', 'Brochure download', 'Existing client']); assert.strictEqual(m.want, 'Brochure: Godrej Meridien');
  assert.ok(m.act.some((a: any) => a[1].includes('existing client Meera Kapoor (c9)')));

  // a seller, email only, with a bad link
  r = await svc.websiteLead(S, { enquiryId: 80, site: 'sf', name: 'Bimal Roy', email: 'bimal@example.com', intent: 'Sell my property', propertyUrl: 'javascript:alert(1)' });
  const s = leads[2]; assert.deepStrictEqual(s.tags, ['Website', 'Seller']); assert.strictEqual(s.phone, ''); assert.deepStrictEqual(s.links, []);

  // ids skip numbers already taken
  counter = 6; leads.push({ id: 'l7' }); // l7 and l8.. are taken by the entries above; the next free id is used
  r = await svc.websiteLead(S, { enquiryId: 90, site: 'sf', name: 'New Person', phone: '9000011111' });
  assert.ok(!['l7'].includes(r.id) && r.created);
  // the audit log never holds names, phone numbers or messages
  assert.ok(audit.length >= 4 && audit.every((a) => !/Ravi|Meera|Bimal|9830/.test(JSON.stringify(a))));

  // flood brake
  for (let i = 0; i < 130; i++) { try { await svc.websiteLead(S, { enquiryId: 1000 + i, site: 'f', name: 'F', phone: '9' + String(100000000 + i) }); } catch (e: any) { assert.match(String(e.message), /Too many/); return console.log('inbound tests passed'); } }
  assert.fail('flood brake did not trigger');
}
run().catch((e) => { console.error(e); process.exit(1); });
