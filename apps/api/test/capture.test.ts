// Tests for screenshot capture: normalising the model's answer, deciding when to use the stronger model, and the service
// (with a fake OpenRouter and a fake database). The four sample chats mirror real screenshots from the team.
// Run: npm run test:capture (from apps/api)
import 'reflect-metadata';
import * as assert from 'assert';
import { cleanPhone, extractJson, needsFallback, normalizeCapture } from '../src/capture/capture.parse';
import { CaptureService } from '../src/capture/capture.service';

// ---- phone numbers
assert.strictEqual(cleanPhone('+91 98300 12345'), '9830012345');
assert.strictEqual(cleanPhone('098300-12345'), '9830012345');
assert.strictEqual(cleanPhone('12345'), '');
assert.strictEqual(cleanPhone('5830012345'), ''); // Indian mobiles start with 6-9
assert.strictEqual(cleanPhone(''), '');

// ---- JSON extraction
assert.deepStrictEqual(extractJson('```json\n{"items":[]}\n```'), { items: [] });
assert.deepStrictEqual(extractJson('Here you go: {"items":[],"confidence":0.9} thanks'), { items: [], confidence: 0.9 });
assert.strictEqual(extractJson('no json here'), null);
assert.strictEqual(extractJson('{broken'), null);

// ---- sample 1: a broker's message listing three properties, name cut off in the header, no phone shown
const s1 = normalizeCapture({
  contactName: 'Sanjeev Shroff O E...', phone: '', confidence: 0.9, warnings: [],
  items: [
    { type: 'offer', deal: 'rent', category: 'Commercial', subType: 'Office space', areaValue: 673, areaUnit: 'sqft', project: 'Landmark Building', unit: '8th floor', locality: 'Minto Park Crossing', summary: 'Fully furnished, no car park, only corporates / MNC.' },
    { type: 'offer', deal: 'sale', category: 'Residential', subType: 'Flat', bhk: 3, areaValue: 1476, areaUnit: 'sqft', project: 'Ecospace Residencia', unit: 'Tower A, 3rd floor, Apartment 0302', locality: 'New Town', summary: '1 car park.' },
    { type: 'offer', deal: 'rent', category: 'Commercial', subType: 'Office space', areaValue: 926, areaUnit: 'sqft', project: 'Ambuja Ecospace Business Towers', unit: 'Tower B, 5th floor, 5B, Unit 8', locality: '', summary: 'Unfurnished, one open car park, only corporates / MNC.' },
  ],
});
assert.strictEqual(s1.items.length, 3);
assert.deepStrictEqual(s1.items.map((i) => [i.intent, i.isProperty, i.kind, i.area]), [['rent', true, 'Commercial', '673'], ['buy', true, 'Residential', '1476'], ['rent', true, 'Commercial', '926']]);
assert.strictEqual(s1.items[1].bhk, '3');
assert.strictEqual(s1.items[1].project, 'Ecospace Residencia');
assert.strictEqual(s1.items[0].max, ''); // no rent was mentioned, nothing is invented
assert.strictEqual(s1.phone, '');
assert.ok(s1.warnings.some((w) => /cut off/.test(w)));
assert.strictEqual(needsFallback({ items: [], confidence: 0.9 }), false);

// ---- sample 2: a flat forwarded with a floor plan; price "approx 3.20 cr" -> 320 lakh
const s2 = normalizeCapture({ contactName: 'RCCV Sanjeev Aga...', items: [{ type: 'offer', deal: 'sale', category: 'Residential', subType: 'Flat', areaValue: 2400, areaUnit: 'sqft', project: 'Jiva Homes', unit: 'Tower-1, Flat 5C', budgetMax: 32000000, summary: 'Carpet 1640 sq ft, super built-up about 2400 sq ft, 2 parking, approx price.' }], confidence: 0.85 });
assert.strictEqual(s2.items[0].max, '320');
assert.strictEqual(s2.items[0].area, '2400');

// ---- sample 3: forwarded land, "Total 11 acres" -> square feet; PDFs only as attachments
const s3 = normalizeCapture({ contactName: 'BNI D Rajesh Dhari...', items: [{ type: 'offer', deal: 'sale', category: 'Land', subType: 'Plot', areaValue: 11, areaUnit: 'acre', locality: 'Rajarhat Road, opposite Capital City, near S.A. Exports' }], confidence: 0.7, warnings: ['Two PDF attachments are not readable from a screenshot'] });
assert.strictEqual(s3.items[0].area, String(11 * 43560));
assert.strictEqual(s3.items[0].kind, 'Land');
assert.strictEqual(s3.warnings.length, 2); // the model's warning + the cut-off name

// ---- sample 4: an investor looking to buy; budget "50 lakhs to 3 crore" -> 50 to 300 lakh
const s4 = normalizeCapture({ contactName: 'ICBI 4 Harmeet Singh Sethi', items: [{ type: 'need', deal: 'sale', category: 'Commercial', subType: 'Pre-leased office or retail', budgetMin: 5000000, budgetMax: 30000000, summary: 'Wants a pre-leased commercial space with 9% ROI and at least 6 years of lease left.' }], confidence: 0.9 });
assert.deepStrictEqual([s4.items[0].intent, s4.items[0].isProperty, s4.items[0].min, s4.items[0].max], ['buy', false, '50', '300']);
// rent budgets are in thousands per month
assert.strictEqual(normalizeCapture({ items: [{ type: 'need', deal: 'rent', category: 'Commercial', budgetMax: 45000 }] }).items[0].max, '45');
// a phone number that is on screen but invalid is flagged and dropped
const bad = normalizeCapture({ phone: '12345', items: [] });
assert.strictEqual(bad.phone, ''); assert.ok(bad.warnings.some((w) => /valid mobile/.test(w)));

// ---- explicit intent (what the sender wants) decides buy/rent and has-property / wants-property
const ints = normalizeCapture({ contactName: 'Sanjeev Shroff', items: [
  { intent: 'wants_to_rent_out', evidence: 'RENT - fully furnished office space 673 sq ft', category: 'Commercial', areaValue: 673, areaUnit: 'sqft' },
  { intent: 'wants_to_sell', evidence: 'SALE - Ecospace Residencia 3BHK', category: 'Residential', bhk: 3, areaValue: 1476, areaUnit: 'sqft' },
  { intent: 'wants_to_buy', evidence: 'I am looking to purchase any preleased commercial space', category: 'Commercial', budgetMin: 5000000, budgetMax: 30000000 },
  { intent: 'Wants to rent', category: 'Commercial', budgetMax: 45000 },
] });
assert.deepStrictEqual(ints.items.map((i) => [i.intent, i.isProperty]), [['rent', true], ['buy', true], ['buy', false], ['rent', false]]);
assert.strictEqual(ints.items[0].evidence, 'RENT - fully furnished office space 673 sq ft');
assert.deepStrictEqual([ints.items[2].min, ints.items[2].max, ints.items[3].max], ['50', '300', '45']);
// the intent wins over a conflicting older type/deal pair
assert.strictEqual(normalizeCapture({ items: [{ intent: 'wants_to_sell', type: 'need', deal: 'rent' }] }).items[0].isProperty, true);
// the prompt carries the rules and the examples the model needs
import { PROMPT } from '../src/capture/capture.parse';
assert.ok(PROMPT.includes('wants_to_rent_out') && PROMPT.includes('A listing that starts with the word RENT') && PROMPT.includes('EXAMPLES'));

// ---- when the stronger model is used
assert.strictEqual(needsFallback(null), true);
assert.strictEqual(needsFallback({ confidence: 0.9 } as any), true);          // no items array
assert.strictEqual(needsFallback({ items: [], confidence: 0.4 }), true);       // unsure
assert.strictEqual(needsFallback({ items: [], confidence: 0.9, phone: '98300' }), true); // number seen but invalid
assert.strictEqual(needsFallback({ items: [{}], confidence: 0.9, phone: '9830012345' }), false);

// ---- service: fake OpenRouter + fake database
async function run() {
  process.env.OPENROUTER_API_KEY = 'test-key'; delete process.env.OPENROUTER_MODEL; delete process.env.OPENROUTER_FALLBACK_MODEL;
  const calls: string[] = []; const replies: any[] = [];
  (global as any).fetch = async (_url: string, init: any) => {
    const body = JSON.parse(init.body); calls.push(body.model);
    assert.strictEqual(body.provider.data_collection, 'deny');           // chats hold phone numbers: no provider may keep them
    assert.ok(body.messages[0].content[1].image_url.url.startsWith('data:image/png;base64,'));
    const r = replies.shift();
    return { ok: true, status: 200, statusText: 'OK', json: async () => ({ choices: [{ message: { content: JSON.stringify(r) } }], usage: { cost: 0.001 } }) };
  };
  const prisma: any = {
    lead: { findMany: async () => [{ id: 'l1', name: 'Harmeet Singh Sethi', phone: '+91 98300 12345' }, { id: 'l2', name: 'Someone Else', phone: '+91 90000 00000' }] },
    prospect: { findMany: async () => [{ id: 'c1', name: 'Sanjeev Shroff O Ecospace', phone: '' }] },
  };
  const logged: any[] = []; const audit: any = { log: async (...a: any[]) => { logged.push(a); } };
  const svc = new CaptureService(prisma, audit); const user: any = { id: 'u1', name: 'Anil' }; const png = { buffer: Buffer.from('x'), mimetype: 'image/png', size: 1 };

  // confident answer: only the cheap model is called
  replies.push({ contactName: 'ICBI 4 Harmeet Singh Sethi', phone: '+91 98300 12345', confidence: 0.9, items: [{ type: 'need', deal: 'sale', category: 'Commercial', budgetMax: 30000000 }] });
  let out = await svc.fromScreenshot(png, user);
  assert.deepStrictEqual(calls, ['anthropic/claude-haiku-5.5']);
  assert.strictEqual(out.usedFallback, false);
  assert.deepStrictEqual(out.duplicates.map((d) => [d.id, d.by]), [['l1', 'phone']]);   // same phone number as an existing lead

  // unsure answer: the stronger model is asked and its answer is used; costs add up
  calls.length = 0;
  replies.push({ contactName: 'Sanjeev Shroff O E...', confidence: 0.3, items: [] });
  replies.push({ contactName: 'Sanjeev Shroff O E...', confidence: 0.9, items: [{ type: 'offer', deal: 'rent', category: 'Commercial', areaValue: 673, areaUnit: 'sqft' }] });
  out = await svc.fromScreenshot(png, user);
  assert.deepStrictEqual(calls, ['anthropic/claude-haiku-5.5', 'anthropic/claude-sonnet-5.5']);
  assert.strictEqual(out.usedFallback, true); assert.strictEqual(out.model, 'anthropic/claude-sonnet-5.5'); assert.strictEqual(out.items.length, 1); assert.strictEqual(out.costUsd, 0.002);
  assert.deepStrictEqual(out.duplicates.map((d) => [d.id, d.by]), [['c1', 'name']]);    // a cut-off name still finds the saved contact

  // fallback switched off
  calls.length = 0; process.env.OPENROUTER_FALLBACK_MODEL = 'off';
  replies.push({ confidence: 0.2, items: [] });
  out = await svc.fromScreenshot(png, user);
  assert.deepStrictEqual(calls, ['anthropic/claude-haiku-5.5']); assert.strictEqual(out.usedFallback, false);
  delete process.env.OPENROUTER_FALLBACK_MODEL;

  // refusals
  await assert.rejects(() => svc.fromScreenshot({ ...png, mimetype: 'image/heic' }, user), /PNG, JPG or WebP/);
  delete process.env.OPENROUTER_API_KEY;
  await assert.rejects(() => svc.fromScreenshot(png, user), /not set up/);
  // the audit log never holds the chat text
  assert.ok(logged.length === 3 && logged.every((l) => !JSON.stringify(l).includes('Harmeet')));
  console.log('capture tests passed');
}
run().catch((e) => { console.error(e); process.exit(1); });
