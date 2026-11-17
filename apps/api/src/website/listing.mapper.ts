// Pure functions that turn a CRM Project or standalone Property into the payload the website plugin (sf-crm-sync) expects.
// No database or network access here, so everything is unit-tested in test/website.test.ts.

/** Website-only fields the team edits in the CRM ("Website content" section). Stored in the record's `data.web.content`. */
export interface WebContent {
  priceLabel?: string; priceNote?: string; featured?: boolean; description?: string; summary?: string;
  floors?: string; bestFor?: string; sfScore?: string | number;
  strengths?: string[]; considerations?: string[];
  nearby?: { name: string; detail: string }[];
  reviews?: { name: string; rating: number; text: string }[];
  virtualTour?: string;
}

/** What gets sent to WordPress. Image fields hold WordPress media ids (the service uploads the files first). */
export interface ListingPayload {
  crmRef: string;                 // e.g. "project:p1" or "property:RS001" — lets the plugin find the post again
  postId?: number;                // WordPress post id once published before
  status: 'publish' | 'draft';
  title: string; content: string; excerpt: string;
  listing: 'for-sale' | 'for-rent';
  propertyType: string; locality: string;
  meta: Record<string, string>;
  amenities: string[];
  configurations: { label: string; variant: string; area: string; bed: string; bath: string; balc: string; price: string; psf: string; note: string }[];
  nearby: { name: string; detail: string }[];
  reviews: { name: string; rating: number; text: string }[];
  floorPlans: { label: string; variant: string; image: number }[];
  photos: number[];               // first = cover image
  brochureId?: number;
}

/** "68 L" -> 6800000, "1.5 Cr" -> 15000000, "55,000" -> 55000. Returns 0 when it cannot be read. */
export function parseMoney(v: any): number {
  const s = String(v ?? '').replace(/[₹,\s]/g, '').toLowerCase();
  const m = s.match(/^([0-9]*\.?[0-9]+)(cr|crore|l|lac|lakh|lakhs|k)?/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const mult = { cr: 1e7, crore: 1e7, l: 1e5, lac: 1e5, lakh: 1e5, lakhs: 1e5, k: 1e3 }[m[2] as string] || 1;
  return Math.round(n * mult);
}

/** 6800000 -> "₹68 L", 15000000 -> "₹1.5 Cr", 55000 -> "₹55,000". */
export function fmtMoney(rupees: number): string {
  if (!rupees) return '';
  if (rupees >= 1e7) return '₹' + String(+(rupees / 1e7).toFixed(2)) + ' Cr';
  if (rupees >= 1e5) return '₹' + String(+(rupees / 1e5).toFixed(2)) + ' L';
  return '₹' + rupees.toLocaleString('en-IN');
}

const clean = (v: any) => (v === null || v === undefined ? '' : String(v).trim());
const lines = (a?: string[]) => (a || []).map(clean).filter(Boolean);
const num = (v: any) => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };

/** Escapes text and turns blank-line separated paragraphs into <p> tags (the description is plain text in the CRM). */
export function toHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return clean(text).split(/\n{2,}/).filter(Boolean).map((p) => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join('\n');
}

/** Property type term on the website: Apartment, Villa, Office or Land (the terms the theme seeds). */
export function websiteType(cat: string, sub: string): string {
  const s = (cat + ' ' + sub).toLowerCase();
  if (s.includes('land') || s.includes('plot')) return 'Land';
  if (s.includes('office') || s.includes('commercial') || s.includes('shop') || s.includes('retail') || s.includes('warehouse')) return 'Office';
  if (s.includes('villa') || s.includes('house') || s.includes('bungalow')) return 'Villa';
  return 'Apartment';
}

function amenityNames(ids: string[] = [], custom: string[] = [], master: { id: string; label: string }[] = []): string[] {
  const byId = new Map(master.map((a) => [a.id, a.label]));
  return Array.from(new Set([...(ids || []).map((id) => byId.get(id) || '').filter(Boolean), ...lines(custom)]));
}

export interface MapContext {
  web: WebContent;
  postId?: number;
  publish: boolean;
  amenityMaster: { id: string; label: string }[];
  photos: number[];               // WordPress media ids, cover first
  floorPlanMedia: Record<string, number>; // "3 BHK|Type A" -> media id
  brochureId?: number;
  units?: any[];                  // Available units in the project (used for "from" prices)
}

/** CRM Project -> website listing. Units inside the project are not listed separately; they feed configuration prices. */
export function mapProject(p: any, c: MapContext): ListingPayload {
  const addr = (p.addr || {}) as any; const place = (p.place || {}) as any;
  const sale = p.sale !== false; const units = (c.units || []).filter((u) => u.status === 'Available');
  const bhkPrice = (cfg: string) => {
    const bhk = parseInt(cfg, 10);
    const prices = units.filter((u) => u.purpose === 'sale' && u.bhk === bhk && u.priceL).map((u) => u.priceL * 1e5);
    return prices.length ? fmtMoney(Math.min(...prices)) + ' onwards' : '';
  };
  const layouts: any[] = Array.isArray(p.layouts) ? p.layouts : [];
  const areas = layouts.map((l) => num(l.area)).filter(Boolean);
  const rows = layouts.length ? layouts : (p.configs || []).map((cfg: string) => ({ cfg, name: '', area: '', baths: '', units: '' }));
  const fromPrice = parseMoney(sale ? p.saleFrom : p.rentFrom);
  const possession = p.status === 'ready' ? 'Ready' : clean(p.complete || [p.cm, p.cy].filter(Boolean).join(' '));
  const meta: Record<string, string> = {
    price: fromPrice ? String(fromPrice) : '', price_label: clean(c.web.priceLabel), price_note: clean(c.web.priceNote),
    featured: c.web.featured ? '1' : '0',
    address: [addr.tower, addr.street, addr.landmark].map(clean).filter(Boolean).join(', '), pin_code: clean(addr.pin || place.pin),
    area_sqft: areas.length ? (Math.min(...areas) === Math.max(...areas) ? String(areas[0]) : `${Math.min(...areas)}–${Math.max(...areas)}`) : '',
    beds: '', baths: '',
    bhk_config: (p.configs || []).map((x: string) => parseInt(x, 10)).filter(Boolean).join('·'),
    towers: clean(c.web.floors), towers_note: p.towers ? `${p.towers} Tower${Number(p.towers) === 1 ? '' : 's'}` : '',
    developer: clean(p.dev), possession,
    latitude: place.lat !== undefined ? String(place.lat) : '', longitude: place.lng !== undefined ? String(place.lng) : '',
    virtual_tour: clean(c.web.virtualTour), best_for: clean(c.web.bestFor), sf_score: clean(c.web.sfScore),
  };
  return withLists(meta, c.web, {
    crmRef: 'project:' + p.id, postId: c.postId, status: c.publish ? 'publish' : 'draft',
    title: clean(p.name), content: toHtml(c.web.description || ''), excerpt: clean(c.web.summary),
    listing: sale ? 'for-sale' : 'for-rent', propertyType: websiteType('Residential', p.type || ''),
    locality: clean(place.name || addr.street), meta,
    amenities: amenityNames(p.amenities, p.customAmen, c.amenityMaster),
    configurations: rows.map((l: any) => ({
      label: clean(l.cfg), variant: clean(l.name), area: clean(l.area), bed: String(parseInt(l.cfg, 10) || ''), bath: clean(l.baths), balc: '',
      price: bhkPrice(l.cfg), psf: '', note: '',
    })),
    nearby: (c.web.nearby || []).filter((n) => clean(n.name)), reviews: (c.web.reviews || []).filter((r) => clean(r.text)),
    floorPlans: layouts.map((l) => ({ label: clean(l.cfg), variant: clean(l.name), image: c.floorPlanMedia[clean(l.cfg) + '|' + clean(l.name)] || 0 })).filter((f) => f.image),
    photos: c.photos, brochureId: c.brochureId,
  });
}

/** Adds the "one point per line" assessment lists to the payload meta. */
function withLists(meta: Record<string, string>, web: WebContent, out: ListingPayload): ListingPayload {
  meta.strengths = lines(web.strengths).join('\n');
  meta.considerations = lines(web.considerations).join('\n');
  return out;
}

/** CRM standalone Property (no projectId) -> website listing. */
export function mapProperty(p: any, c: MapContext): ListingPayload {
  const d = p.data || {}; const addr = d.addr || {}; const place = d.place || {}; const sale = p.purpose === 'sale';
  const price = sale ? Math.round((p.quotedL || p.priceL || 0) * 1e5) : Math.round((p.rentK || 0) * 1e3);
  const area = d.sbu || p.area || 0;
  const meta: Record<string, string> = {
    price: price ? String(price) : '', price_label: clean(c.web.priceLabel), price_note: clean(c.web.priceNote),
    featured: c.web.featured ? '1' : '0',
    address: [addr.flat, addr.tower, addr.street].map(clean).filter(Boolean).join(', ') || clean(p.loc), pin_code: clean(addr.pin),
    area_sqft: area ? String(Math.round(num(area))) : '', beds: p.bhk ? String(p.bhk) : '', baths: clean(d.baths),
    bhk_config: p.bhk ? String(p.bhk) : '', towers: clean(c.web.floors), towers_note: '', developer: '',
    possession: d.pstatus === 'Under Construction' ? clean([d.cm, d.cy].filter(Boolean).join(' ')) || 'Under construction' : 'Ready',
    latitude: place.lat !== undefined ? String(place.lat) : '', longitude: place.lng !== undefined ? String(place.lng) : '',
    virtual_tour: clean(c.web.virtualTour), best_for: clean(c.web.bestFor), sf_score: clean(c.web.sfScore),
  };
  return withLists(meta, c.web, {
    crmRef: 'property:' + p.id, postId: c.postId, status: c.publish ? 'publish' : 'draft',
    title: clean(p.title), content: toHtml(c.web.description || ''), excerpt: clean(c.web.summary),
    listing: sale ? 'for-sale' : 'for-rent', propertyType: websiteType(p.cat || '', p.sub || ''),
    locality: clean(p.loc), meta,
    amenities: Array.from(new Set(lines(d.features))),
    configurations: [{ label: p.bhk ? `${p.bhk} BHK` : clean(p.sub), variant: '', area: area ? String(Math.round(num(area))) : '', bed: p.bhk ? String(p.bhk) : '', bath: clean(d.baths), balc: clean(d.balconies), price: fmtMoney(price), psf: '', note: '' }],
    nearby: (c.web.nearby || []).filter((n) => clean(n.name)), reviews: (c.web.reviews || []).filter((r) => clean(r.text)),
    floorPlans: [], photos: c.photos, brochureId: c.brochureId,
  });
}
