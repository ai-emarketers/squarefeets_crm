/** Smart matching — direct port of matchesFor()/leadReq()/findAlerts() from the prototype. Works on flat API objects. */
// Commercial sub-types a requirement can ask for.
export const COMM_SUBS = ['Office', 'Retail', 'Showroom', 'Warehouse'];

// Classify a property into plot / warehouse / office / retail / house / flat from its category and wording.
export function ptKind(cat: string, sub?: string, title?: string) {
  if (cat === 'Land') return 'plot';
  const s = String(sub || title || '');
  if (cat === 'Commercial') return /warehouse|godown/i.test(s) ? 'warehouse' : /office/i.test(s) ? 'office' : 'retail';
  return /villa|bungalow|independent house/i.test(s) ? 'house' : 'flat';
}
// Classify a requirement's wanted type into plot / comm / house / flat / any.
export function reqKind(r: any) {
  const t = r.type || '';
  return t === 'Plot' ? 'plot' : t === 'Commercial' ? 'comm' : /house|villa/i.test(t) ? 'house' : /flat|apartment/i.test(t) ? 'flat' : 'any';
}
// Human label of a property's kind (Plot, Commercial, Villa, Independent house, Apartment / Flat) used for type matching.
export function propKindLabel(p: any) {
  if (p.cat === 'Land') return 'Plot';
  if (p.cat === 'Commercial') return 'Commercial';
  return ptKind(p.cat, p.sub, p.title) === 'house' ? (/villa/i.test(p.sub || p.title || '') ? 'Villa' : 'Independent house') : 'Apartment / Flat';
}
// Which commercial sub-type (Office/Retail/Showroom/Warehouse) a property is, if any.
const commSubOf = (p: any) => COMM_SUBS.find((x) => new RegExp(x, 'i').test(p.sub || p.title || '')) || '';
// Does the property's kind satisfy the requirement's type? (house and villa count as the same)
function typeOK(r: any, p: any) {
  if (!r.type) return true;
  const pt = propKindLabel(p);
  if (r.type === pt) return true;
  if (/house|villa/i.test(r.type) && /house|villa/i.test(pt)) return true;
  return false;
}

// One match: the property, its score (0-100) and a list of [reason, points, matched?] used by the UI badges.
export interface MatchResult { p: any; score: number; why: [string, number, boolean][] }

// Scoring: locality 30 + budget 40 (25 within ±10%) + BHK 30 (15 if ±1) or area 30 (15 within ±15%). Only scores >= 40 are kept, best first.
export function matchesFor(r: any, props: any[]): MatchResult[] {
  const k = reqKind(r);                      // kind of requirement

  const locs: string[] = r.locs || [];
  return props
    // Hard filters first: same purpose (sale/rent), still Available, right type, and commercial sub-type not contradicting.
    .filter((p) => p.purpose === r.purpose && p.status === 'Available' && typeOK(r, p) && !(k === 'comm' && r.csub && commSubOf(p) && commSubOf(p) !== r.csub))
    .map((p) => {
      // price to compare with the budget: sale price (lakhs) or monthly rent (thousands)
      const val = p.purpose === 'sale' ? p.priceL : p.rentK;
      let s = 0;
      const why: [string, number, boolean][] = [];
      // 1) Locality (30): no preference, or any wanted locality appears in the property's location text.
      if (!locs.length || locs.some((l) => String(p.loc || '').toLowerCase().includes(l.toLowerCase()))) { s += 30; why.push(['Locality', 30, true]); } else why.push(['Locality', 0, false]);
      // 2) Budget (40): inside min-max = full marks, within 10% flex = partial.
      const mn = Number(r.min) || 0, mx = Number(r.max) || 1e9;
      if (val >= mn && val <= mx) { s += 40; why.push(['Budget', 40, true]); }
      else if (val >= mn * 0.9 && val <= mx * 1.1) { s += 25; why.push(['Budget (within flex)', 25, true]); }
      else why.push(['Budget', 0, false]);
      // 3) Size: BHK for homes (30, or 15 when off by one), area range for plots/commercial.
      if (k === 'flat' || k === 'house') {
        if (!Number(r.bhk)) { s += 30; why.push(['BHK (any)', 30, true]); }
        else if (p.bhk === Number(r.bhk)) { s += 30; why.push(['BHK', 30, true]); }
        else if (Math.abs(p.bhk - Number(r.bhk)) === 1) { s += 15; why.push(['BHK (±1)', 15, true]); }
        else why.push(['BHK', 0, false]);
      } else {
        const a = p.sbu || p.area || 0;
        const lo = Number(r.amin) || 0, hi = Number(r.amax) || 1e9;
        if (!r.amin && !r.amax) { s += 30; why.push(['Area (any)', 30, true]); }
        else if (a >= lo && a <= hi) { s += 30; why.push(['Area', 30, true]); }
        else if (a >= lo * 0.85 && a <= hi * 1.15) { s += 15; why.push(['Area (±15%)', 15, true]); }
        else why.push(['Area', 0, false]);
      }
      // Facing is shown as an informational tick/cross and does not change the score.
      if (r.pface && r.pface !== 'Any') why.push(['Facing ' + r.pface, 0, p.facing === r.pface]);
      return { p, score: s, why } as MatchResult;
    })
    .filter((m) => m.score >= 40)            // drop weak matches

    .sort((a, b) => b.score - a.score);
}

/** A lead that carries a basic budget behaves like a requirement ("LEAD-l1"). */
export function leadReq(l: any) {
  const b = l.basic || {};
  if (!b.max && !b.min) return null;
  return {
    id: 'LEAD-' + l.id, lead: l.id, cid: null, purpose: l.intent === 'buy' ? 'sale' : 'rent', type: b.type || '', csub: b.csub || '',
    locs: b.locText ? [b.locText] : [], min: b.min || 0, max: b.max || 0, bhk: b.bhk || 0, area: 'Any', status: 'Active', who: l.name,
  };
}
