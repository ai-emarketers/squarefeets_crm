// The "matched properties" PDF: a summary page (what the client asked for + every match) followed by one page per property
// (photo, facts, why it matches, amenities, documents that come with the message). Pure layout: all values are passed in.
import { Page, Pdf, jpegInfo } from './pdf';

/** One matched property, already formatted for display. */
export interface PdfProperty {
  id: string; title: string; loc: string; unit: string; project: string; developer: string;
  price: string;                       // e.g. "₹1.35 Cr" or "₹45k / month"
  bhk: string;                         // short label for the thumbnail, e.g. "3 BHK"
  summary: string;                     // one line of facts for the summary card
  facts: [string, string][];           // label/value pairs for the details grid (up to 6)
  score?: number;                      // match percent 0-100 (left out when the properties were not matched to a requirement)
  reasons: { ok: boolean; text: string }[]; // why it matches (or not)
  amenities: string[];
  docs: string[];                      // names of the documents sent with this property
  photo?: Buffer;                      // JPEG cover, when the property has a shareable photo (none: no picture is drawn)
  gallery?: Buffer[];                  // further JPEG photos; they get their own gallery page(s)
}
/** Everything the PDF shows. */
export interface MatchesPdfData {
  org: { name: string; rera: string; city: string };
  broker: { name: string; phone: string; email: string };
  client: string; reqId: string; date: string;
  matched: boolean;                    // true when the properties were matched to a requirement (shows match %, reasons and the requirement)
  reqChips: string[];                  // "3 BHK Apartment / Flat", "Salt Lake", "₹1.2–1.5 Cr" ...
  note?: string;                       // optional short message from the realtor
  properties: PdfProperty[];
}

const BLUE = '#2B4FD8', INK = '#1B1F2A', MUT = '#6B7280', LINE = '#E3E6EC', BG = '#F4F6FA', OK = '#16794C', OKB = '#E4F5EC', WARN = '#B45309', WARNB = '#FEF3E2', SOFT = '#DDE3F5', PALE = '#D7DEFA';
const M = 40;

function header(p: Page, d: MatchesPdfData, sub: string) {
  p.rect(0, p.h - 70, p.w, 70, { fill: BLUE });
  p.text(M, p.h - 34, d.org.name, { font: 'B', size: 15, color: '#FFFFFF' });
  p.text(M, p.h - 52, [d.org.rera && 'RERA ' + d.org.rera, d.org.city].filter(Boolean).join('  ·  '), { size: 8.5, color: PALE });
  p.text(p.w - M, p.h - 34, sub, { font: 'B', size: 10, color: '#FFFFFF', align: 'r' });
  p.text(p.w - M, p.h - 52, d.date, { size: 8.5, color: PALE, align: 'r' });
}
function footer(p: Page, d: MatchesPdfData, n: number, total: number) {
  p.line(M, 58, p.w - M, 58);
  p.text(M, 42, ['Your contact: ' + d.broker.name, d.broker.phone, d.broker.email].filter(Boolean).join('  ·  '), { size: 8.5, color: MUT });
  p.text(p.w - M, 42, `Page ${n} of ${total}`, { size: 8.5, color: MUT, align: 'r' });
  p.text(M, 28, 'Prices and availability are indicative and subject to change.', { size: 7.5, color: MUT });
}
/** Row of rounded chips starting at (x, y); wraps inside maxX. Returns the y of the next free baseline. */
function chips(p: Page, items: string[], x0: number, y: number, maxX: number, fill = BG, color = INK) {
  let x = x0;
  for (const s of items) {
    const w = p.width(s, 'R', 9) + 16;
    if (x + w > maxX && x > x0) { x = x0; y -= 24; }
    p.rect(x, y - 4, w, 18, { fill, r: 9 }); p.text(x + 8, y + 1, s, { size: 9, color }); x += w + 6;
  }
  return y - 24;
}
function badge(p: Page, score: number | undefined, xRight: number, y: number, size = 9) {
  if (score === undefined) return;
  const full = score >= 80, s = `${score}% match`, w = p.width(s, 'B', size) + 16;
  p.rect(xRight - w, y - 6, w, size + 9, { fill: full ? OKB : WARNB, r: (size + 9) / 2 });
  p.text(xRight - w / 2, y, s, { font: 'B', size, color: full ? OK : WARN, align: 'c' });
}
const clip = (p: Page, s: string, maxW: number, font: 'R' | 'B', size: number) => { let t = s; while (t.length > 1 && p.width(t, font, size) > maxW) t = t.slice(0, -2); return t === s ? s : t.trimEnd() + '…'; };

/** Build the PDF and return its bytes. */
export function buildMatchesPdf(d: MatchesPdfData): Buffer {
  const pdf = new Pdf({ title: 'Matched properties for ' + d.client, author: d.org.name });
  const cardH = 80, gap = 12;
  // ---- summary page(s)
  let p = pdf.addPage(); header(p, d, d.matched ? 'Property matches' : 'Properties');
  p.text(M, p.h - 110, d.matched ? 'Matched properties for' : 'Properties selected for', { size: 11, color: MUT });
  p.text(M, p.h - 136, clip(p, d.client, p.w - 2 * M, 'B', 24), { font: 'B', size: 24 });
  p.text(M, p.h - 158, d.matched && d.reqId ? `Prepared by ${d.broker.name} for requirement ${d.reqId}` : `Prepared by ${d.broker.name}`, { size: 9.5, color: MUT });
  let y = p.h - 178;
  if (d.matched && d.reqChips.length) {
    // measure the chips first so the grey box fits them
    let rows = 1, x = M + 14; for (const s of d.reqChips) { const w = p.width(s, 'R', 9) + 22; if (x + w > p.w - M - 10 && x > M + 14) { rows++; x = M + 14; } x += w; }
    const bh = 36 + rows * 24; p.rect(M, y - bh, p.w - 2 * M, bh, { fill: BG, r: 8 });
    p.text(M + 14, y - 20, 'WHAT YOU ASKED FOR', { font: 'B', size: 8, color: MUT }); chips(p, d.reqChips, M + 14, y - 44, p.w - M - 10, '#FFFFFF'); y -= bh + 16;
  }
  if (d.note) {
    const lines = p.wrap(d.note, p.w - 2 * M - 28, 'R', 10).slice(0, 6), bh = 30 + lines.length * 14;
    p.rect(M, y - bh, p.w - 2 * M, bh, { fill: '#FFFFFF', stroke: LINE, r: 8 });
    p.text(M + 14, y - 20, 'A note from ' + d.broker.name, { font: 'B', size: 9, color: MUT }); lines.forEach((l, i) => p.text(M + 14, y - 36 - i * 14, l, { size: 10 }));
    y -= bh + 16;
  }
  const n = d.properties.length;
  p.text(M, y - 12, d.matched ? `${n} ${n === 1 ? 'property matches' : 'properties match'} your requirement` : `${n} ${n === 1 ? 'property' : 'properties'} for you`, { font: 'B', size: 13 }); y -= 30;
  const summaryPages: Page[] = [p];
  d.properties.forEach((pr) => {
    if (y - cardH < 200) { p = pdf.addPage(); summaryPages.push(p); header(p, d, 'Property matches (continued)'); y = p.h - 100; }
    const top = y; p.rect(M, top - cardH, p.w - 2 * M, cardH, { fill: '#FFFFFF', stroke: LINE, r: 8 });
    if (!(pr.photo && p.jpeg(pr.photo, M + 10, top - cardH + 10, 70, cardH - 20))) { p.rect(M + 10, top - cardH + 10, 70, cardH - 20, { fill: SOFT, r: 6 }); p.text(M + 45, top - 44, pr.bhk || pr.id, { font: 'B', size: 10, color: BLUE, align: 'c' }); }
    const tx = M + 92, maxW = p.w - 2 * M - 92 - 120;
    p.text(tx, top - 24, clip(p, `${pr.title}  ·  ${pr.id}`, maxW, 'B', 11.5), { font: 'B', size: 11.5 });
    p.text(tx, top - 41, clip(p, [pr.loc, pr.project].filter(Boolean).join('  ·  '), maxW, 'R', 9), { size: 9, color: MUT });
    p.text(tx, top - 60, clip(p, pr.summary, maxW, 'R', 9), { size: 9 });
    p.text(p.w - M - 14, top - 28, pr.price, { font: 'B', size: 15, color: BLUE, align: 'r' }); badge(p, pr.score, p.w - M - 14, top - 56);
    y -= cardH + gap;
  });
  const last = summaryPages[summaryPages.length - 1];
  p.text(M, y - 8, 'Details, amenities and documents for each property are on the next pages.', { size: 9.5, color: MUT });
  last.rect(M, 110, last.w - 2 * M, 64, { fill: BLUE, r: 8 });
  last.text(M + 16, 150, 'Like any of these? Book a visit', { font: 'B', size: 12, color: '#FFFFFF' });
  last.text(M + 16, 130, clip(last, `Reply on WhatsApp or call ${d.broker.name}${d.broker.phone ? ' on ' + d.broker.phone : ''}. Visits can be set up at your convenience.`, last.w - 2 * M - 32, 'R', 8.5), { size: 8.5, color: PALE });
  // ---- one page per property
  for (const pr of d.properties) {
    p = pdf.addPage(); header(p, d, 'Property details');
    p.text(M, p.h - 108, clip(p, [pr.id, pr.project].filter(Boolean).join('  ·  '), 300, 'R', 9.5), { size: 9.5, color: MUT });
    p.text(M, p.h - 134, clip(p, pr.title, p.w - 2 * M - 170, 'B', 22), { font: 'B', size: 22 });
    p.text(M, p.h - 153, clip(p, [pr.loc, pr.unit].filter(Boolean).join('  ·  '), p.w - 2 * M - 170, 'R', 10), { size: 10, color: MUT });
    p.text(p.w - M, p.h - 134, pr.price, { font: 'B', size: 24, color: BLUE, align: 'r' }); badge(p, pr.score, p.w - M, p.h - 156, 10);
    let y = p.h - 190;
    if (pr.photo) { if (p.jpeg(pr.photo, M, y - 170, p.w - 2 * M, 170)) y -= 200; }
    const cw = (p.w - 2 * M) / 3, facts = pr.facts.slice(0, 6);
    facts.forEach(([k, v], i) => { const cx = M + (i % 3) * cw, cy = y - Math.floor(i / 3) * 44; p.text(cx, cy, k.toUpperCase(), { font: 'B', size: 7.5, color: MUT }); p.text(cx, cy - 16, clip(p, v, cw - 10, 'R', 10), { size: 10 }); });
    y -= Math.ceil(facts.length / 3) * 44 + 18;
    if (pr.reasons.length) {
      p.text(M, y, 'Why it matches your requirement', { font: 'B', size: 12 }); y -= 22;
      for (const r of pr.reasons.slice(0, 6)) {
        p.rect(M, y - 4, 16, 16, { fill: r.ok ? OKB : WARNB, r: 8 }); p.text(M + 8, y, r.ok ? '✓' : '!', { font: 'B', size: 9, color: r.ok ? OK : WARN, align: 'c' });
        p.text(M + 26, y, clip(p, r.text, p.w - 2 * M - 26, 'R', 10), { size: 10 }); y -= 20;
      }
      y -= 10;
    }
    if (pr.amenities.length && y > 200) { p.text(M, y, 'Amenities', { font: 'B', size: 12 }); y = chips(p, pr.amenities.slice(0, 16), M, y - 26, p.w - M) - 16; }
    if (y > 120) {
      p.text(M, y, 'Documents included with this message', { font: 'B', size: 12 }); y -= 12;
      if (!pr.docs.length) p.text(M, y - 18, 'No separate documents for this property.', { size: 9.5, color: MUT });
      const room = Math.max(1, Math.floor((y - 84) / 30)), shown = pr.docs.length > room ? room - 1 : pr.docs.length;
      pr.docs.slice(0, shown).forEach((nm, i) => { const top = y - 10 - i * 30; p.rect(M, top - 24, p.w - 2 * M, 24, { fill: BG, r: 6 }); p.text(M + 12, top - 16, clip(p, nm, p.w - 2 * M - 24, 'R', 9.5), { size: 9.5 }); });
      if (pr.docs.length > shown) p.text(M, y - 10 - shown * 30 - 12, `+ ${pr.docs.length - shown} more attached`, { size: 9.5, color: MUT });
    }
  }
  // ---- photo gallery pages (only for properties that have more photos)
  const GW = (595.28 - 2 * M - 14) / 2, GH = 168;
  for (const pr of d.properties) {
    const g = (pr.gallery || []).filter((x) => jpegInfo(x));
    for (let n = 0; n < g.length; n += 6) {
      p = pdf.addPage(); header(p, d, 'Photos');
      p.text(M, p.h - 108, clip(p, pr.title, p.w - 2 * M, 'B', 16), { font: 'B', size: 16 });
      g.slice(n, n + 6).forEach((img, i) => p.jpeg(img, M + (i % 2) * (GW + 14), p.h - 140 - GH - Math.floor(i / 2) * (GH + 14), GW, GH));
    }
  }
  pdf.pages.forEach((pg, i) => footer(pg, d, i + 1, pdf.pages.length));
  return pdf.build();
}
