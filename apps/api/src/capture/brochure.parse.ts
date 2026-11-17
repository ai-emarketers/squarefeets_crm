// Pure helpers for reading a project brochure: the prompt, and the clean-up of the model's answer into the fields of the CRM's
// project form (what the "Fill the form from the brochure" card applies). No network or database; tested in test/brochure.test.ts.
import { extractJson } from './capture.parse';

export const BROCHURE_PROMPT = `You read Indian real-estate project brochures (PDF) and return the project details as JSON for a CRM.
Return ONE JSON object, no other text, with exactly these keys:
{
 "name": "project name only, e.g. PS Vaanya",
 "developer": "developer / promoter company",
 "projectType": "one of: Residential Complex, Township, Single Tower, Commercial Complex, Industrial Park, Warehouse, Mixed Development, Independent house, Other",
 "rera": "RERA / WBRERA registration number as printed",
 "possession": "possession or completion date as written, e.g. \\"Dec 2027\\"",
 "readyToMove": true or false,
 "projectSize": { "value": number or null, "unit": "acres" | "bigha" | "katha" | "sq ft" | "sq m" | "hectares" },
 "towers": number or null,
 "floors": "e.g. G + 19",
 "totalUnits": number or null,
 "configs": ["2 BHK", "3 BHK"],
 "priceFromRupees": number or null,   // starting price in full rupees, only if the brochure states one
 "priceToRupees": number or null,
 "priceNote": "short line such as \\"2, 3 & 4 BHK · G+19\\"",
 "layouts": [ { "config": "3 BHK", "name": "Type A or Tower 4 · Unit A", "carpetSqft": number or null, "baths": number or null, "unitsCount": number or null } ],
 "amenities": ["short amenity names"],
 "address": { "street": "", "landmark": "", "locality": "area of Kolkata e.g. New Town", "pin": "6-digit PIN", "city": "", "state": "" },
 "summary": "one factual sentence under 155 characters",
 "description": "2-3 short factual paragraphs separated by a blank line, plain English, no hype words",
 "nearby": [ { "name": "place", "detail": "distance or time" } ],
 "confidence": number from 0 to 1,
 "warnings": ["anything unclear, unreadable or missing that a person should check"]
}
Rules:
- Use only facts written in the brochure. Never guess or invent. Use "", null or [] when something is not stated.
- Pages may be scanned and rotated: read them in whatever orientation the text runs.
- Unit-plan pages carry small area tables like "CARPET AREA 1851 sq.ft.". Copy numbers digit by digit. If a number is not clearly legible, leave it null and add a warning. Never reuse one unit's numbers for another.
- One layouts row per distinct unit layout. If there are several layouts of the same BHK, name them (Type A, Type B or the brochure's own names, e.g. "Tower 4 · Unit A").
- Areas: prefer carpet area in sq ft. Convert sq m to sq ft (x 10.764) only if no sq ft figure is given.
- Prices in full rupees: 87 lakh = 8700000, 1.2 crore = 12000000.
- Output JSON only.`;

export interface RawBrochure {
  name?: string; developer?: string; projectType?: string; rera?: string; possession?: string; readyToMove?: boolean;
  projectSize?: { value?: number | string | null; unit?: string };
  towers?: number | string | null; floors?: string; totalUnits?: number | string | null; configs?: string[];
  priceFromRupees?: number | string | null; priceToRupees?: number | string | null; priceNote?: string;
  layouts?: { config?: string; name?: string; carpetSqft?: number | string | null; baths?: number | string | null; unitsCount?: number | string | null }[];
  amenities?: string[]; address?: { street?: string; landmark?: string; locality?: string; pin?: string; city?: string; state?: string };
  summary?: string; description?: string; nearby?: { name?: string; detail?: string }[]; confidence?: number | string; warnings?: string[];
}

/** The fields the project form can apply. Only fields the brochure actually gave are present. */
export interface BrochureFields {
  name?: string; dev?: string; type?: string; rera?: string; status?: 'ready' | 'uc'; cm?: string; cy?: string;
  size?: string; sizeUnit?: string; towers?: string; units?: string; configs?: string[]; saleFrom?: string; saleTo?: string;
  amenities?: string[]; customAmen?: string[];
  layouts?: { cfg: string; name: string; area: string; baths: string; units: string }[];
  addr?: { street?: string; landmark?: string; pin?: string; city?: string; state?: string };
  web?: { description?: string; summary?: string; floors?: string; priceNote?: string; nearby?: string };
}
export interface BrochureResult { fields: BrochureFields; warnings: string[]; confidence: number; locality: string }

const str = (v: any) => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim());
const num = (v: any): number | null => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) && n > 0 ? n : null; };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 6800000 -> "68 L", 15000000 -> "1.5 Cr" (the format of the project price fields). */
export function shortMoney(rupees: number | null): string {
  if (!rupees) return '';
  return rupees >= 1e7 ? `${+(rupees / 1e7).toFixed(2)} Cr` : `${+(rupees / 1e5).toFixed(2)} L`;
}

/** "3bhk", "3 Bhk" -> "3 BHK". Other labels (e.g. "Office") are kept as written. */
export function cfgLabel(v: any): string {
  const t = str(v); const m = t.match(/^(\d)\s*bhk$/i);
  return m ? `${m[1]} BHK` : t;
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !['and', 'the', 'area', 'room'].includes(w));
/** Splits amenity names into ones that match the CRM's amenity list (returned as ids) and ones that do not (kept as custom text). */
export function matchAmenities(names: string[], master: { id: string; label: string }[]): { ids: string[]; custom: string[] } {
  const ids: string[] = []; const custom: string[] = [];
  for (const raw of names.map(str).filter(Boolean)) {
    const w = words(raw);
    const hit = master.find((m) => { const lw = words(m.label); return str(m.label).toLowerCase() === raw.toLowerCase() || (lw.length > 0 && w.length > 0 && (lw.every((x) => w.includes(x)) || w.every((x) => lw.includes(x)))); });
    if (hit) { if (!ids.includes(hit.id)) ids.push(hit.id); } else if (!custom.some((c) => c.toLowerCase() === raw.toLowerCase())) custom.push(raw.slice(0, 60));
  }
  return { ids, custom };
}

/** Turns the model's JSON into project-form fields. */
export function normalizeBrochure(raw: RawBrochure, master: { id: string; label: string }[]): BrochureResult {
  const f: BrochureFields = {}; const warnings = (raw.warnings || []).map(str).filter(Boolean);
  const set = <K extends keyof BrochureFields>(k: K, v: BrochureFields[K] | '' | undefined | null) => { if (v !== '' && v !== undefined && v !== null && !(Array.isArray(v) && !v.length)) (f as any)[k] = v; };
  set('name', str(raw.name).slice(0, 120)); set('dev', str(raw.developer).slice(0, 120)); set('type', str(raw.projectType)); set('rera', str(raw.rera).slice(0, 80));

  // possession: ready now, or month and year when under construction
  const poss = str(raw.possession);
  if (raw.readyToMove === true || /\b(ready to move|ready for possession|immediate)\b/i.test(poss)) set('status', 'ready');
  else if (poss) {
    set('status', 'uc');
    const m = poss.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i); const y = poss.match(/\b(20\d{2})\b/);
    if (m) set('cm', MONTHS[['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[1].toLowerCase())]);
    if (y) set('cy', y[1]);
    if (!m && !y) warnings.push('Possession date could not be read as a month and year: ' + poss);
  }
  const ps = raw.projectSize || {}; const sv = num(ps.value);
  if (sv) { set('size', String(+sv.toFixed(2))); set('sizeUnit', str(ps.unit)); }
  set('towers', num(raw.towers) ? String(Math.round(num(raw.towers)!)) : ''); set('units', num(raw.totalUnits) ? String(Math.round(num(raw.totalUnits)!)) : '');

  const layouts = (raw.layouts || []).map((l) => ({ cfg: cfgLabel(l.config), name: str(l.name).slice(0, 40), area: num(l.carpetSqft) ? String(Math.round(num(l.carpetSqft)!)) : '', baths: num(l.baths) ? String(Math.round(num(l.baths)!)) : '', units: num(l.unitsCount) ? String(Math.round(num(l.unitsCount)!)) : '' })).filter((l) => l.cfg || l.area).slice(0, 30);
  set('layouts', layouts);
  const configs = Array.from(new Set([...(raw.configs || []).map(cfgLabel), ...layouts.map((l) => l.cfg)].filter(Boolean)));
  set('configs', configs);

  const lo = num(raw.priceFromRupees), hi = num(raw.priceToRupees);
  set('saleFrom', shortMoney(lo)); if (hi && hi !== lo) set('saleTo', shortMoney(hi));

  const am = matchAmenities((raw.amenities || []).slice(0, 60), master); set('amenities', am.ids); set('customAmen', am.custom);

  const a = raw.address || {}; const pin = str(a.pin).replace(/\D/g, '');
  const addr = { street: str(a.street).slice(0, 200), landmark: str(a.landmark).slice(0, 120), pin: pin.length === 6 ? pin : '', city: str(a.city).slice(0, 60), state: str(a.state).slice(0, 60) };
  if (Object.values(addr).some(Boolean)) f.addr = Object.fromEntries(Object.entries(addr).filter(([, v]) => v)) as BrochureFields['addr'];

  const nearby = (raw.nearby || []).filter((n) => str(n.name)).slice(0, 20).map((n) => str(n.name).slice(0, 80) + (str(n.detail) ? ' | ' + str(n.detail).slice(0, 80) : '')).join('\n');
  const web = { description: String(raw.description || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 4000), summary: str(raw.summary).slice(0, 300), floors: str(raw.floors).slice(0, 40), priceNote: str(raw.priceNote).slice(0, 140), nearby };
  if (Object.values(web).some(Boolean)) f.web = Object.fromEntries(Object.entries(web).filter(([, v]) => v)) as BrochureFields['web'];

  const c = parseFloat(String(raw.confidence));
  return { fields: f, warnings, confidence: Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0.5, locality: str(a.locality) };
}

/** The stronger model is asked when the answer is unreadable, unsure, or hardly found anything. */
export function brochureNeedsFallback(raw: RawBrochure | null, r?: BrochureResult): boolean {
  if (!raw || typeof raw !== 'object') return true;
  if (r) {
    if (r.confidence < 0.6) return true;
    if (!r.fields.name && !(r.fields.layouts || []).length) return true;
  }
  return false;
}

export const parseBrochureJson = (text: string): RawBrochure | null => extractJson(text) as RawBrochure | null;
