// Tests for the CRM -> website listing mapper (pure functions, no database). Run: npm run test:website (from apps/api)
import * as assert from 'assert';
import { fmtMoney, mapProject, mapProperty, MapContext, parseMoney, parseNearby, parseReviews, toHtml, websiteType } from '../src/website/listing.mapper';

const ctx = (over: Partial<MapContext> = {}): MapContext => ({ web: {}, publish: true, amenityMaster: [{ id: 'gym', label: 'Gym' }, { id: 'garden', label: 'Garden' }], photos: [], floorPlanMedia: {}, ...over });

// ---- money
assert.strictEqual(parseMoney('68 L'), 6800000);
assert.strictEqual(parseMoney('₹1.5 Cr'), 15000000);
assert.strictEqual(parseMoney('55,000'), 55000);
assert.strictEqual(parseMoney(''), 0);
assert.strictEqual(parseMoney('call'), 0);
assert.strictEqual(fmtMoney(6800000), '₹68 L');
assert.strictEqual(fmtMoney(15000000), '₹1.5 Cr');
assert.strictEqual(fmtMoney(55000), '₹55,000');

// ---- text and type
assert.strictEqual(toHtml('A & B\n\nsecond <b>'), '<p>A &amp; B</p>\n<p>second &lt;b&gt;</p>');
assert.strictEqual(websiteType('Residential', 'Flat / Apartment'), 'Apartment');
assert.strictEqual(websiteType('Residential', 'Independent house'), 'Villa');
assert.strictEqual(websiteType('Commercial', 'Office space'), 'Office');
assert.strictEqual(websiteType('Land', 'Plot'), 'Land');

// ---- project
const project: any = {
  id: 'p1', name: 'Merlin Verve', dev: 'Merlin Group', type: 'Apartment complex', status: 'uc', complete: 'Dec 2027', cm: 'Dec', cy: '2027',
  towers: '6', configs: ['2 BHK', '3 BHK'], sale: true, rent: false, saleFrom: '68 L', saleTo: '1.5 Cr',
  addr: { street: 'Sector V', landmark: 'Near Technopolis', pin: '700091' }, place: { name: 'Sector V', lat: 22.57, lng: 88.43 },
  amenities: ['gym'], customAmen: ['Rooftop deck'], layouts: [{ cfg: '2 BHK', name: 'Type A', area: '920', baths: '2', units: '40' }, { cfg: '3 BHK', name: '', area: '1,200', baths: '3', units: '20' }],
};
const units: any[] = [
  { purpose: 'sale', status: 'Available', bhk: 2, priceL: 75 }, { purpose: 'sale', status: 'Available', bhk: 2, priceL: 68 },
  { purpose: 'sale', status: 'Sold', bhk: 2, priceL: 60 }, { purpose: 'sale', status: 'Available', bhk: 3, priceL: 110 },
];
const pp = mapProject(project, ctx({ units, photos: [11, 12], brochureId: 99, web: { priceNote: 'Pre-launch', featured: true, strengths: ['Metro nearby', ' '], sfScore: 7.8 } }));
assert.strictEqual(pp.crmRef, 'project:p1');
assert.strictEqual(pp.status, 'publish');
assert.strictEqual(pp.listing, 'for-sale');
assert.strictEqual(pp.meta.price, '6800000');
assert.strictEqual(pp.meta.developer, 'Merlin Group');
assert.strictEqual(pp.meta.towers_note, '6 Towers');
assert.strictEqual(pp.meta.possession, 'Dec 2027');
assert.strictEqual(pp.meta.bhk_config, '2·3');
assert.strictEqual(pp.meta.featured, '1');
assert.strictEqual(pp.meta.strengths, 'Metro nearby');
assert.strictEqual(pp.meta.sf_score, '7.8');
assert.strictEqual(pp.meta.area_sqft, '920–1200');
assert.strictEqual(pp.meta.latitude, '22.57');
assert.deepStrictEqual(pp.amenities, ['Gym', 'Rooftop deck']);
assert.strictEqual(pp.configurations.length, 2);
assert.strictEqual(pp.configurations[0].price, '₹68 L onwards'); // cheapest AVAILABLE 2 BHK, the sold one is ignored
assert.strictEqual(pp.configurations[1].price, '₹1.1 Cr onwards');
assert.deepStrictEqual(pp.photos, [11, 12]);
assert.strictEqual(pp.brochureId, 99);
assert.strictEqual(mapProject(project, ctx({ publish: false })).status, 'draft');
// rent-only project
assert.strictEqual(mapProject({ ...project, sale: false, rent: true, rentFrom: '28,000' }, ctx()).meta.price, '28000');
assert.strictEqual(mapProject({ ...project, sale: false, rent: true }, ctx()).listing, 'for-rent');
// ready project
assert.strictEqual(mapProject({ ...project, status: 'ready' }, ctx()).meta.possession, 'Ready');
// no layouts: falls back to the configs list
assert.strictEqual(mapProject({ ...project, layouts: [] }, ctx()).configurations.length, 2);

// ---- standalone property
const prop: any = { id: 'RS010', purpose: 'sale', cat: 'Residential', sub: 'Flat / Apartment', title: '3 BHK in Ballygunge', loc: 'Ballygunge', bhk: 3, area: 1450, priceL: 180, quotedL: 175, data: { baths: '3', features: ['Lift', 'Gym'], pstatus: 'Ready for Possession', addr: { flat: '4B', street: 'Gariahat Rd', pin: '700019' } } };
const pr = mapProperty(prop, ctx({ photos: [5] }));
assert.strictEqual(pr.crmRef, 'property:RS010');
assert.strictEqual(pr.meta.price, '17500000'); // quoted price wins over the owner's price
assert.strictEqual(pr.meta.beds, '3');
assert.strictEqual(pr.meta.possession, 'Ready');
assert.strictEqual(pr.meta.address, '4B, Gariahat Rd');
assert.strictEqual(pr.configurations[0].label, '3 BHK');
assert.deepStrictEqual(pr.amenities, ['Lift', 'Gym']);
const rent = mapProperty({ ...prop, purpose: 'rent', rentK: 55, priceL: null, quotedL: null }, ctx());
assert.strictEqual(rent.listing, 'for-rent');
assert.strictEqual(rent.meta.price, '55000');

// ---- text-typed website fields (how the CRM form stores them)
assert.deepStrictEqual(parseNearby('Phoolbagan Metro | 800 m · 3 min drive\n\nCity Centre 2'), [{ name: 'Phoolbagan Metro', detail: '800 m · 3 min drive' }, { name: 'City Centre 2', detail: '' }]);
assert.deepStrictEqual(parseReviews('Ravi | 5 | Smooth process\nAsha | 9 | Helpful\nNo text |'), [{ name: 'Ravi', rating: 5, text: 'Smooth process' }, { name: 'Asha', rating: 5, text: 'Helpful' }]);
const typed = mapProject(project, ctx({ web: { strengths: 'Metro nearby\nGood school belt', nearby: 'Metro | 800 m' } }));
assert.strictEqual(typed.meta.strengths, 'Metro nearby\nGood school belt');
assert.deepStrictEqual(typed.nearby, [{ name: 'Metro', detail: '800 m' }]);
// property details kept under data.form are used
const viaForm = mapProperty({ ...prop, data: { form: { baths: '2', features: ['Lift'], addr: { street: 'Park St' } } } }, ctx());
assert.strictEqual(viaForm.meta.baths, '2');
assert.deepStrictEqual(viaForm.amenities, ['Lift']);

console.log('website mapper tests passed');
