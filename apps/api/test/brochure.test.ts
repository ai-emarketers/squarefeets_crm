// Tests for brochure reading: clean-up of the model's answer, the stronger-model rule, and the service with a fake OpenRouter.
// Run: npm run test:brochure (from apps/api)
import 'reflect-metadata';
import * as assert from 'assert';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { brochureNeedsFallback, cfgLabel, matchAmenities, normalizeBrochure, shortMoney } from '../src/capture/brochure.parse';
import { BrochureService } from '../src/capture/brochure.service';

const master = [{ id: 'clubhouse', label: 'Clubhouse' }, { id: 'swimming_pool', label: 'Swimming Pool' }, { id: 'gym', label: 'Gym' }, { id: 'jogging_track', label: 'Jogging Track' }, { id: 'security', label: '24x7 Security' }];

// ---- small helpers
assert.strictEqual(shortMoney(6800000), '68 L'); assert.strictEqual(shortMoney(15000000), '1.5 Cr'); assert.strictEqual(shortMoney(null), '');
assert.strictEqual(cfgLabel('3bhk'), '3 BHK'); assert.strictEqual(cfgLabel(' 2 Bhk '), '2 BHK'); assert.strictEqual(cfgLabel('Office'), 'Office');
const am = matchAmenities(['Swimming pool', 'Fully equipped gymnasium', 'Rooftop sky lounge', 'club house', 'Jogging track', 'swimming pool'], master);
assert.deepStrictEqual(am.ids, ['swimming_pool', 'jogging_track']);           // exact and word matches, no repeats
assert.deepStrictEqual(am.custom, ['Fully equipped gymnasium', 'Rooftop sky lounge', 'club house']); // not matched: kept as custom text

// ---- a typical under-construction project
const r = normalizeBrochure({
  name: 'PS Vaanya', developer: 'PS Group', projectType: 'Residential Complex', rera: 'WBRERA/P/NOR/2024/001234', possession: 'December 2027', readyToMove: false,
  projectSize: { value: 4.5, unit: 'acres' }, towers: 3, floors: 'G + 19', totalUnits: '312', configs: ['2 bhk', '3 BHK'],
  priceFromRupees: 8700000, priceToRupees: 15000000, priceNote: '2, 3 & 4 BHK · G+19',
  layouts: [{ config: '3 BHK', name: 'Tower 4 · Unit A', carpetSqft: '1,185', baths: 3, unitsCount: 40 }, { config: '4 BHK', name: 'Type C', carpetSqft: 1851, baths: 4, unitsCount: null }, { config: '', name: '', carpetSqft: null }],
  amenities: ['Swimming pool', 'Rooftop sky lounge'], address: { street: '17, Pagladanga Road', landmark: 'Near Phoolbagan', locality: 'Kolkata East', pin: '700 054', city: 'Kolkata', state: 'West Bengal' },
  summary: 'Three towers in Kolkata.', description: 'First paragraph.\n\n\n\nSecond paragraph.', nearby: [{ name: 'Phoolbagan Metro', detail: '800 m' }, { name: 'City Centre 2' }, { name: '' }], confidence: 0.9, warnings: ['Price list not included'],
}, master);
const f = r.fields;
assert.strictEqual(f.name, 'PS Vaanya'); assert.strictEqual(f.dev, 'PS Group'); assert.strictEqual(f.type, 'Residential Complex');
assert.deepStrictEqual([f.status, f.cm, f.cy], ['uc', 'Dec', '2027']);
assert.deepStrictEqual([f.size, f.sizeUnit, f.towers, f.units], ['4.5', 'acres', '3', '312']);
assert.deepStrictEqual(f.configs, ['2 BHK', '3 BHK', '4 BHK']); // listed ones first, then any only seen in layouts
assert.deepStrictEqual([f.saleFrom, f.saleTo], ['87 L', '1.5 Cr']);
assert.deepStrictEqual(f.layouts, [{ cfg: '3 BHK', name: 'Tower 4 · Unit A', area: '1185', baths: '3', units: '40' }, { cfg: '4 BHK', name: 'Type C', area: '1851', baths: '4', units: '' }]);
assert.deepStrictEqual(f.amenities, ['swimming_pool']); assert.deepStrictEqual(f.customAmen, ['Rooftop sky lounge']);
assert.deepStrictEqual(f.addr, { street: '17, Pagladanga Road', landmark: 'Near Phoolbagan', pin: '700054', city: 'Kolkata', state: 'West Bengal' });
assert.strictEqual(f.web!.floors, 'G + 19'); assert.strictEqual(f.web!.description, 'First paragraph.\n\nSecond paragraph.'); assert.strictEqual(f.web!.nearby, 'Phoolbagan Metro | 800 m\nCity Centre 2');
assert.deepStrictEqual(r.warnings, ['Price list not included']); assert.strictEqual(r.locality, 'Kolkata East'); assert.strictEqual(r.confidence, 0.9);

// ---- ready project, nothing invented from empty answers
const ready = normalizeBrochure({ name: 'Rosedale Garden', readyToMove: true, possession: 'Ready to move', priceFromRupees: 7200000, priceToRupees: 7200000 }, master);
assert.strictEqual(ready.fields.status, 'ready'); assert.strictEqual(ready.fields.cm, undefined); assert.strictEqual(ready.fields.saleTo, undefined); // same price at both ends: only "from"
const empty = normalizeBrochure({ name: '', layouts: [], amenities: [], address: { pin: '123' }, confidence: 'x' } as any, master);
assert.deepStrictEqual(empty.fields, {}); assert.strictEqual(empty.confidence, 0.5);
assert.ok(normalizeBrochure({ possession: 'Soon' }, master).warnings[0].includes('Possession date could not be read'));

// ---- stronger model rule
assert.strictEqual(brochureNeedsFallback(null), true);
assert.strictEqual(brochureNeedsFallback({ name: 'X' }, normalizeBrochure({ name: 'X', confidence: 0.4 }, master)), true);       // unsure
assert.strictEqual(brochureNeedsFallback({}, normalizeBrochure({ confidence: 0.9 }, master)), true);                              // found nothing
assert.strictEqual(brochureNeedsFallback({ name: 'X' }, normalizeBrochure({ name: 'X', confidence: 0.9 }, master)), false);

// ---- service with a fake OpenRouter and fake database
async function run() {
  process.env.OPENROUTER_API_KEY = 'k'; delete process.env.OPENROUTER_BROCHURE_MODEL; delete process.env.OPENROUTER_BROCHURE_FALLBACK_MODEL; delete process.env.OPENROUTER_PDF_ENGINE;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sf-brochure-')); process.env.UPLOAD_DIR = dir;
  await fs.mkdir(path.join(dir, 'proj'), { recursive: true }); await fs.writeFile(path.join(dir, 'proj', 'b.pdf'), Buffer.from('%PDF-saved'));
  const calls: any[] = []; const replies: any[] = [];
  (global as any).fetch = async (_u: string, init: any) => {
    const body = JSON.parse(init.body); calls.push(body);
    const part = body.messages[0].content[1]; assert.strictEqual(part.type, 'file'); assert.ok(part.file.file_data.startsWith('data:application/pdf;base64,'));
    assert.strictEqual(body.provider.data_collection, 'deny');
    return { ok: true, status: 200, statusText: 'OK', json: async () => ({ choices: [{ message: { content: JSON.stringify(replies.shift()) } }], usage: { cost: 0.01 } }) };
  };
  const prisma: any = {
    amenity: { findMany: async () => master },
    fileRecord: { findUnique: async ({ where }: any) => ({ b1: { id: 'b1', scope: 'proj:p1', name: 'My Brochure.pdf', mime: 'application/pdf', path: 'proj/b.pdf' }, d1: { id: 'd1', scope: 'deal:x', name: 'x.pdf', mime: 'application/pdf', path: 'proj/b.pdf' } } as any)[where.id] || null },
  };
  const logged: any[] = []; const svc = new BrochureService(prisma, { log: async (...a: any[]) => { logged.push(a); } } as any);
  const user: any = { id: 'u1', name: 'Anil' }; const pdf = { buffer: Buffer.from('%PDF-1.4'), mimetype: 'application/pdf', originalname: 'ps-vaanya.pdf' };

  // a good answer from the first model
  replies.push({ name: 'PS Vaanya', confidence: 0.9, layouts: [{ config: '3 BHK', carpetSqft: 1185 }] });
  let out = await svc.fromPdf(pdf, undefined, user);
  assert.strictEqual(calls[0].model, 'google/gemini-2.5-flash'); assert.strictEqual(out.usedFallback, false); assert.strictEqual(out.fields.name, 'PS Vaanya'); assert.strictEqual(out.costUsd, 0.01);
  assert.strictEqual(calls[0].plugins, undefined);

  // an unsure answer: the stronger model is asked and used
  calls.length = 0; replies.push({ name: 'X', confidence: 0.3 }); replies.push({ name: 'PS Vaanya', confidence: 0.9, layouts: [{ config: '3 BHK', carpetSqft: 1185 }] });
  out = await svc.fromPdf(pdf, undefined, user);
  assert.deepStrictEqual(calls.map((c) => c.model), ['google/gemini-2.5-flash', 'anthropic/claude-sonnet-5.5']); assert.strictEqual(out.usedFallback, true); assert.strictEqual(out.costUsd, 0.02);

  // a brochure already saved on a project, and the optional PDF engine setting
  calls.length = 0; process.env.OPENROUTER_PDF_ENGINE = 'native'; replies.push({ name: 'PS Vaanya', confidence: 0.9, layouts: [{ config: '2 BHK' }] });
  out = await svc.fromPdf(undefined, 'b1', user);
  assert.deepStrictEqual(calls[0].plugins, [{ id: 'file-parser', pdf: { engine: 'native' } }]); assert.strictEqual(calls[0].messages[0].content[1].file.filename, 'My Brochure.pdf');
  delete process.env.OPENROUTER_PDF_ENGINE;

  // refusals
  await assert.rejects(() => svc.fromPdf({ ...pdf, mimetype: 'image/png' }, undefined, user), /must be a PDF/);
  await assert.rejects(() => svc.fromPdf(undefined, undefined, user), /Choose a PDF/);
  await assert.rejects(() => svc.fromPdf(undefined, 'd1', user), /Only project brochures/);   // a deal document is not a project brochure
  await assert.rejects(() => svc.fromPdf(undefined, 'nope', user), /not found/);
  delete process.env.OPENROUTER_API_KEY;
  await assert.rejects(() => svc.fromPdf(pdf, undefined, user), /not set up/);
  assert.ok(logged.length === 3 && logged.every((l) => !JSON.stringify(l).includes('Vaanya')));  // the audit log never holds brochure content
  await fs.rm(dir, { recursive: true, force: true });
  console.log('brochure tests passed');
}
run().catch((e) => { console.error(e); process.exit(1); });
