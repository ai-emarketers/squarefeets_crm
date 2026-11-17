// A small PDF writer with no extra packages (the project avoids dependencies for mail and files too).
// It can draw rectangles, lines, text in an embedded TrueType font (so the ₹ sign works) and JPEG photos, over several A4 pages.
// Fonts are the small DejaVu Sans subsets in apps/api/assets/fonts (regular + bold). Text outside those glyphs is shown as "?".
import { deflateSync } from 'zlib';
import { readFileSync } from 'fs';
import * as path from 'path';

/** Folder with the bundled fonts: apps/api/assets/fonts (src/share -> ../../assets in dev, dist/share -> ../../assets after `nest build`). */
export const FONT_DIR = path.resolve(__dirname, '..', '..', 'assets', 'fonts');

// ---------- TrueType font reader (only what a PDF needs: glyph lookup, widths, a few metrics) ----------
export class TtfFont {
  readonly upm: number; readonly ascent: number; readonly descent: number; readonly bbox: number[]; readonly capHeight: number;
  private tables: Record<string, [number, number]> = {};
  private cmap = new Map<number, number>();
  private adv: number[] = [];
  readonly used = new Map<number, number>(); // glyph id -> unicode, filled while text is drawn (for widths and copy/search)
  constructor(readonly raw: Buffer, readonly name: string) {
    const n = raw.readUInt16BE(4);
    for (let i = 0; i < n; i++) { const o = 12 + i * 16; this.tables[raw.toString('latin1', o, o + 4)] = [raw.readUInt32BE(o + 8), raw.readUInt32BE(o + 12)]; }
    const head = this.t('head'), hhea = this.t('hhea');
    this.upm = raw.readUInt16BE(head + 18);
    this.bbox = [raw.readInt16BE(head + 36), raw.readInt16BE(head + 38), raw.readInt16BE(head + 40), raw.readInt16BE(head + 42)];
    this.ascent = raw.readInt16BE(hhea + 4); this.descent = raw.readInt16BE(hhea + 6);
    this.capHeight = Math.round(this.ascent * 0.72);
    const nh = raw.readUInt16BE(hhea + 34), hmtx = this.t('hmtx'); const numGlyphs = raw.readUInt16BE(this.t('maxp') + 4);
    let last = 0;
    for (let g = 0; g < numGlyphs; g++) { if (g < nh) last = raw.readUInt16BE(hmtx + g * 4); this.adv.push(last); }
    this.readCmap();
  }
  private t(tag: string) { const e = this.tables[tag]; if (!e) throw new Error(`Font ${this.name} has no ${tag} table`); return e[0]; }
  private readCmap() {
    const raw = this.raw, base = this.t('cmap'), n = raw.readUInt16BE(base + 2);
    let best = -1, bestRank = -1;
    for (let i = 0; i < n; i++) { // prefer Windows full Unicode, then Windows BMP, then Unicode platform
      const p = raw.readUInt16BE(base + 4 + i * 8), e = raw.readUInt16BE(base + 6 + i * 8), off = raw.readUInt32BE(base + 8 + i * 8);
      const rank = p === 3 && e === 10 ? 3 : p === 3 && e === 1 ? 2 : p === 0 ? 1 : 0; if (rank > bestRank) { best = off; bestRank = rank; }
    }
    if (best < 0) throw new Error('Font has no usable cmap');
    const s = base + best, fmt = raw.readUInt16BE(s);
    if (fmt === 4) {
      const segX2 = raw.readUInt16BE(s + 6), seg = segX2 / 2, endO = s + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
      for (let i = 0; i < seg; i++) {
        const end = raw.readUInt16BE(endO + i * 2), start = raw.readUInt16BE(startO + i * 2), delta = raw.readInt16BE(deltaO + i * 2), ro = raw.readUInt16BE(rangeO + i * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let g: number;
          if (ro === 0) g = (c + delta) & 0xffff;
          else { const p = rangeO + i * 2 + ro + (c - start) * 2; g = p + 2 <= raw.length ? raw.readUInt16BE(p) : 0; if (g) g = (g + delta) & 0xffff; }
          if (g) this.cmap.set(c, g);
        }
      }
    } else if (fmt === 12) {
      const groups = raw.readUInt32BE(s + 12);
      for (let i = 0; i < groups; i++) { const o = s + 16 + i * 12, a = raw.readUInt32BE(o), b = raw.readUInt32BE(o + 4), g = raw.readUInt32BE(o + 8); for (let c = a; c <= b; c++) this.cmap.set(c, g + (c - a)); }
    } else throw new Error('Unsupported cmap format ' + fmt);
  }
  /** Glyph for a character; "?" when the font has none (and a space for line breaks and tabs). */
  glyph(ch: string): { gid: number; cp: number } {
    let cp = ch.codePointAt(0) || 63; if (cp === 9 || cp === 10 || cp === 13 || cp === 0xa0) cp = 32;
    let g = this.cmap.get(cp); if (!g) { cp = 63; g = this.cmap.get(cp) || 0; }
    return { gid: g, cp };
  }
  /** Width of a glyph in 1/1000 em (the unit PDF uses). */
  w1000(gid: number) { return Math.round(((this.adv[gid] || 0) * 1000) / this.upm); }
  width(s: string, size: number) { let w = 0; for (const ch of s) w += this.adv[this.glyph(ch).gid] || 0; return (w * size) / this.upm; }
}

// ---------- helpers ----------
const hex2 = (n: number) => ('0' + Math.round(Math.max(0, Math.min(255, n))).toString(16)).slice(-2);
/** "#2B4FD8" -> "0.169 0.310 0.847" (a PDF colour triple). */
export function rgb(h: string) { const v = h.replace('#', ''); return [0, 2, 4].map((i) => (parseInt(v.slice(i, i + 2), 16) / 255).toFixed(3)).join(' '); }
const num = (n: number) => (Math.round(n * 100) / 100).toString();
/** A PDF text string: plain ASCII in parentheses, anything else as UTF-16BE hex. */
function pdfStr(s: string) {
  if (/^[\x20-\x7e]*$/.test(s)) return '(' + s.replace(/[\\()]/g, '\\$&') + ')';
  const b = Buffer.from('﻿' + s, 'utf16le'); b.swap16(); return '<' + b.toString('hex') + '>';
}

/** Read width/height/colour channels of a baseline or progressive JPEG; null when the bytes are not a JPEG. */
export function jpegInfo(b: Buffer) {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7), comps: b[i + 9] };
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue; }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

export type Align = 'l' | 'r' | 'c';
export interface TextOpts { font?: 'R' | 'B'; size?: number; color?: string; align?: Align }
const FN = { R: 'F1', B: 'F2' } as const;

/** One A4 page: drawing commands are collected and written when the document is built. */
export class Page {
  readonly ops: string[] = []; readonly images: { name: string; id: number }[] = [];
  constructor(private doc: Pdf, readonly w: number, readonly h: number) {}
  /** Rectangle (rounded when r > 0) with an optional fill and stroke. y is the BOTTOM edge, measured from the page bottom. */
  rect(x: number, y: number, w: number, h: number, o: { fill?: string; stroke?: string; r?: number; lw?: number } = {}) {
    const r = Math.min(o.r || 0, w / 2, h / 2), k = r * 0.5523, p = this.ops;
    if (o.fill) p.push(rgb(o.fill) + ' rg'); if (o.stroke) p.push(rgb(o.stroke) + ' RG', num(o.lw || 0.8) + ' w');
    if (r > 0) {
      p.push(`${num(x + r)} ${num(y)} m`, `${num(x + w - r)} ${num(y)} l`, `${num(x + w - r + k)} ${num(y)} ${num(x + w)} ${num(y + r - k)} ${num(x + w)} ${num(y + r)} c`,
        `${num(x + w)} ${num(y + h - r)} l`, `${num(x + w)} ${num(y + h - r + k)} ${num(x + w - r + k)} ${num(y + h)} ${num(x + w - r)} ${num(y + h)} c`,
        `${num(x + r)} ${num(y + h)} l`, `${num(x + r - k)} ${num(y + h)} ${num(x)} ${num(y + h - r + k)} ${num(x)} ${num(y + h - r)} c`,
        `${num(x)} ${num(y + r)} l`, `${num(x)} ${num(y + r - k)} ${num(x + r - k)} ${num(y)} ${num(x + r)} ${num(y)} c`, 'h');
    } else p.push(`${num(x)} ${num(y)} ${num(w)} ${num(h)} re`);
    p.push(o.fill && o.stroke ? 'B' : o.fill ? 'f' : 's');
  }
  line(x1: number, y1: number, x2: number, y2: number, color = '#E3E6EC', lw = 0.8) { this.ops.push(`${rgb(color)} RG ${num(lw)} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`); }
  /** Width of a string in points. */
  width(s: string, font: 'R' | 'B' = 'R', size = 10) { return this.doc.font(font).width(s, size); }
  /** Draw one line of text; (x, y) is the left/right/centre point on the baseline. */
  text(x: number, y: number, s: string, o: TextOpts = {}) {
    const f = this.doc.font(o.font || 'R'), size = o.size || 10; let hexs = '', w = 0;
    for (const ch of s) { const g = f.glyph(ch); f.used.set(g.gid, g.cp); w += f.w1000(g.gid); hexs += ('0000' + g.gid.toString(16)).slice(-4); }
    const width = (w * size) / 1000, px = o.align === 'r' ? x - width : o.align === 'c' ? x - width / 2 : x;
    this.ops.push(`${rgb(o.color || '#1B1F2A')} rg BT /${FN[o.font || 'R']} ${num(size)} Tf ${num(px)} ${num(y)} Td <${hexs}> Tj ET`);
  }
  /** Split text into lines no wider than maxW. */
  wrap(s: string, maxW: number, font: 'R' | 'B' = 'R', size = 10): string[] {
    const out: string[] = []; let cur = '';
    for (const word of String(s).split(/\s+/).filter(Boolean)) {
      const t = cur ? cur + ' ' + word : word;
      if (cur && this.width(t, font, size) > maxW) { out.push(cur); cur = word; } else cur = t;
    }
    if (cur) out.push(cur); return out;
  }
  /** Place a JPEG inside the box, scaled to cover it (cropped by a clip so nothing spills out). */
  jpeg(img: Buffer, x: number, y: number, w: number, h: number) {
    const info = jpegInfo(img); if (!info) return false;
    const id = this.doc.addJpeg(img, info), name = 'Im' + id; if (!this.images.some((i) => i.id === id)) this.images.push({ name, id });
    const s = Math.max(w / info.w, h / info.h), dw = info.w * s, dh = info.h * s;
    this.ops.push(`q ${num(x)} ${num(y)} ${num(w)} ${num(h)} re W n ${num(dw)} 0 0 ${num(dh)} ${num(x + (w - dw) / 2)} ${num(y + (h - dh) / 2)} cm /${name} Do Q`);
    return true;
  }
}

/** The document: add pages, draw on them, then build() returns the PDF bytes. */
export class Pdf {
  readonly pages: Page[] = []; private fonts: Record<'R' | 'B', TtfFont>; private jpegs: { id: number; data: Buffer; info: { w: number; h: number; comps: number } }[] = [];
  constructor(private meta: { title: string; author: string }, fonts?: { R: Buffer; B: Buffer }) {
    this.fonts = {
      R: new TtfFont(fonts?.R || readFileSync(path.join(FONT_DIR, 'DejaVuSans.subset.ttf')), 'DejaVuSans'),
      B: new TtfFont(fonts?.B || readFileSync(path.join(FONT_DIR, 'DejaVuSans-Bold.subset.ttf')), 'DejaVuSans-Bold'),
    };
  }
  font(f: 'R' | 'B') { return this.fonts[f]; }
  addPage() { const p = new Page(this, 595.28, 841.89); this.pages.push(p); return p; }
  /** Register a JPEG once (the same Buffer used on several pages is stored a single time). */
  addJpeg(data: Buffer, info: { w: number; h: number; comps: number }) { const have = this.jpegs.find((j) => j.data === data); if (have) return have.id; const id = 1000 + this.jpegs.length; this.jpegs.push({ id, data, info }); return id; }

  build(): Buffer {
    const objs: Buffer[] = []; const reserve = () => { objs.push(Buffer.alloc(0)); return objs.length; };
    const set = (id: number, body: string | Buffer) => { objs[id - 1] = Buffer.isBuffer(body) ? body : Buffer.from(body, 'latin1'); };
    const stream = (dict: string, data: Buffer) => Buffer.concat([Buffer.from(`<< ${dict} /Length ${data.length} >>\nstream\n`, 'latin1'), data, Buffer.from('\nendstream', 'latin1')]);
    const add = (body: string | Buffer) => { const id = reserve(); set(id, body); return id; };
    const catalog = reserve(), pagesId = reserve(), info = reserve();
    // fonts: Type0 (Identity-H) wrapping a CIDFontType2 that embeds the whole (small) TrueType file
    const fontIds: Record<string, number> = {};
    for (const key of ['R', 'B'] as const) {
      const f = this.fonts[key]; const gids = [...f.used.keys()].sort((a, b) => a - b);
      const file = add(stream(`/Length1 ${f.raw.length} /Filter /FlateDecode`, deflateSync(f.raw)));
      const scale = (v: number) => Math.round((v * 1000) / f.upm);
      const desc = add(`<< /Type /FontDescriptor /FontName /${f.name} /Flags 4 /FontBBox [${f.bbox.map(scale).join(' ')}] /ItalicAngle 0 /Ascent ${scale(f.ascent)} /Descent ${scale(f.descent)} /CapHeight ${scale(f.capHeight)} /StemV 80 /FontFile2 ${file} 0 R >>`);
      const widths = gids.map((g) => `${g} [${f.w1000(g)}]`).join(' ');
      const cid = add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${f.name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${desc} 0 R /CIDToGIDMap /Identity /DW 600 /W [${widths}] >>`);
      let cm = '/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Adobe-Identity-UCS def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange\n';
      for (let i = 0; i < gids.length; i += 100) {
        const chunk = gids.slice(i, i + 100); cm += `${chunk.length} beginbfchar\n`;
        for (const g of chunk) { const cp = f.used.get(g)!, u = cp > 0xffff ? Buffer.from(String.fromCodePoint(cp), 'utf16le').swap16().toString('hex') : ('0000' + cp.toString(16)).slice(-4); cm += `<${('0000' + g.toString(16)).slice(-4)}> <${u}>\n`; }
        cm += 'endbfchar\n';
      }
      cm += 'endcmap CMapName currentdict /CMap defineresource pop end end';
      const tou = add(stream('/Filter /FlateDecode', deflateSync(Buffer.from(cm, 'latin1'))));
      fontIds[key] = add(`<< /Type /Font /Subtype /Type0 /BaseFont /${f.name} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${tou} 0 R >>`);
    }
    const imgObj: Record<number, number> = {};
    for (const j of this.jpegs) imgObj[j.id] = add(stream(`/Type /XObject /Subtype /Image /Width ${j.info.w} /Height ${j.info.h} /ColorSpace /${j.info.comps === 1 ? 'DeviceGray' : j.info.comps === 4 ? 'DeviceCMYK' : 'DeviceRGB'} /BitsPerComponent 8 /Filter /DCTDecode` + (j.info.comps === 4 ? ' /Decode [1 0 1 0 1 0 1 0]' : ''), j.data));
    const kids: number[] = [];
    for (const p of this.pages) {
      const content = add(stream('/Filter /FlateDecode', deflateSync(Buffer.from(p.ops.join('\n'), 'latin1'))));
      const xo = p.images.length ? ` /XObject << ${p.images.map((i) => `/${i.name} ${imgObj[i.id]} 0 R`).join(' ')} >>` : '';
      kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(p.w)} ${num(p.h)}] /Contents ${content} 0 R /Resources << /Font << /F1 ${fontIds.R} 0 R /F2 ${fontIds.B} 0 R >>${xo} >> >>`));
    }
    set(pagesId, `<< /Type /Pages /Count ${kids.length} /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] >>`);
    set(catalog, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    set(info, `<< /Title ${pdfStr(this.meta.title)} /Author ${pdfStr(this.meta.author)} /Creator (SquareFeets CRM) /Producer (SquareFeets CRM) >>`);
    // file: header, numbered objects, cross-reference table, trailer
    const parts: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')]; const offs: number[] = []; let pos = parts[0].length;
    objs.forEach((o, i) => { offs.push(pos); const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), o, Buffer.from('\nendobj\n', 'latin1')]); parts.push(b); pos += b.length; });
    let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`; for (const o of offs) xref += ('0000000000' + o).slice(-10) + ' 00000 n \n';
    parts.push(Buffer.from(`${xref}trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${pos}\n%%EOF\n`, 'latin1'));
    return Buffer.concat(parts);
  }
}
