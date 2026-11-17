/* eslint-disable */
/**
 * SquareFeets CRM — UI engine.
 * This is the complete, unchanged view layer of the approved prototype (every screen, form, modal and workflow),
 * ported into a mountable module. It no longer keeps data in the browser: it is hydrated from the NestJS API
 * (BOOT = GET /api/bootstrap) and persists every change through ADAPTER.save (POST /api/sync).
 *
 * Sections follow the prototype: helpers · seed defaults (UI defaults only, replaced by BOOT) · ui components ·
 * documents · drafts · dashboard · projects · properties · leads/prospects · requirements & matches · visits ·
 * deals & brokerage · export/masters/capture/team/settings · modals · router · actions · import wizard.
 * Migration path: lift one screen at a time out of this file into a React component under src/features/.
 */
// Types shared with sync.ts (the state shape, the adapter the engine talks to, click handlers).
import type { ActHandler, Boot, EngineAdapter, EngineState, Rec } from './engine-types';

// Entry point: mounts the whole CRM UI into `host`, wires events, and returns a function that tears it down again.
export function startCrm(host: HTMLElement, BOOT: Boot, ADAPTER: EngineAdapter): () => void {
// Cleanup callbacks: every document/window listener registered by the engine is removed again when the page unmounts.
const _off: Array<() => void> = [];
// document.addEventListener wrapper that remembers how to undo itself (see _off).
const _doc = { addEventListener: (t: string, f: any, o?: any) => { document.addEventListener(t, f, o); _off.push(() => document.removeEventListener(t, f, o)); } };
// window.addEventListener wrapper with the same auto-cleanup.
const _win = { addEventListener: (t: string, f: any, o?: any) => { window.addEventListener(t, f, o); _off.push(() => window.removeEventListener(t, f, o)); } };
/* ------------------------------------------------------------ helpers */
// HTML-escape text before putting it into a template string (prevents XSS from user-entered data).
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// SVG path data for every icon used in the UI, keyed by icon name.
const IC: Record<string, string> = {
  dash: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  proj: 'M4 21V5l8-3 8 3v16M9 21v-4h6v4M8 9h2M14 9h2M8 13h2M14 13h2',
  prop: 'M3 21h18M5 21V8l7-5 7 5v13M10 21v-6h4v6',
  lead: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M2 20a7 7 0 0 1 14 0M17 4a3.5 3.5 0 0 1 0 7M22 20a7 7 0 0 0-4-6.3',
  req: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6',
  match: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
  cal: 'M4 6h16v15H4zM4 10h16M8 3v5M16 3v5',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 6v6l4 2',
  deal: 'M3 12l5-5 4 3 4-4 5 5M3 12v6h18v-6M8 18v-4M12 18v-6M16 18v-3',
  rupee: 'M6 4h12M6 9h12M9 4c6 0 6 8 0 8H6l8 8',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3H9.8l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9c.6.5 1.3.9 2 1.2l.4 2.6h4.4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.3-4.3',
  plus: 'M12 5v14M5 12h14', check: 'M5 12l5 5L20 7', close: 'M6 6l12 12M18 6L6 18', down: 'M6 9l6 6 6-6',
  menu: 'M4 7h16M4 12h16M4 17h16', edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  chat: 'M21 12a8 8 0 0 1-11.7 7L4 20l1.1-4.3A8 8 0 1 1 21 12',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16', file: 'M14 3H6v18h12V7zM14 3v4h4',
  back: 'M15 6l-6 6 6 6', img: 'M3 3h18v18H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M21 15l-5-5L5 21',
  locate: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4M12 2v3M12 19v3M2 12h3M19 12h3',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 8v5M12 16h.01',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6', sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M12 2v2M12 20v2M2 12h2M20 12h2'
};
// Render an icon by name as an inline <svg> of the given size.
const ico = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none"><path d="${IC[n] || ''}"></path></svg>`;
// Filled map-pin SVG used on location cards.
const pinFill = (s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="var(--p)" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0"></path><circle cx="12" cy="10" r="3" fill="#fff" stroke="none"></circle></svg>`;
// 'Anil Sharma' -> 'AS' (avatar initials).
const initials = (n) => String(n).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
// Read a nested value by dotted path, e.g. get(S,'d.property.title').
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
// Write a nested value by dotted path, creating missing objects on the way.
const setp = (o, p, v) => { const k = p.split('.'); let a = o; for (let i = 0; i < k.length - 1; i++) { if (a[k[i]] == null) a[k[i]] = {}; a = a[k[i]]; } a[k[k.length - 1]] = v; };
// Deep copy through JSON (used when opening edit drafts).
const clone = (x) => JSON.parse(JSON.stringify(x));
// Format a price in lakhs: 150 -> ₹1.5 Cr, 85 -> ₹85 L.
const fmtL = (v) => (v >= 100 ? '₹' + (v / 100).toFixed(2).replace(/\.?0+$/, '') + ' Cr' : '₹' + v + ' L');
// Format a monthly rent given in thousands: 25 -> ₹25,000/mo.
const fmtRent = (k) => '₹' + Math.round(k * 1000).toLocaleString('en-IN') + '/mo';
// Price text of a property: sale price or monthly rent depending on its purpose.
const fmtPrice = (p) => (p.purpose === 'sale' ? fmtL(p.priceL) : fmtRent(p.rentK));
// Display names of the two listing purposes.
const PURPOSE = { sale: 'Sale', rent: 'Rent/Lease' };
// Today's date at midnight (the real date — the demo no longer uses a fixed one).
const today = (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); })();
// Month names used by the calendar and date labels.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Weekday short names (Sunday first, matching Date.getDay()).
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Date -> 'yyyy-mm-dd' text (local time, no timezone shifts).
function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
// 'yyyy-mm-dd' text -> Date.
function parseISO(s) { const a = String(s).split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); }
// New Date = d plus n days.
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
// Monday of the week that contains d (calendar weeks start on Monday).
function weekStart(d) { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
// '14:30' -> 870 minutes since midnight (used to position visits on the calendar).
function mins(t) { const a = String(t).split(':').map(Number); return a[0] * 60 + (a[1] || 0); }
// '14:30' -> '2:30 PM'.
function fmt12(t) { const a = String(t).split(':').map(Number); return ((a[0] % 12) || 12) + ':' + String(a[1] || 0).padStart(2, '0') + (a[0] < 12 ? ' am' : ' pm'); }
// Date -> 'Mon 5 Oct' style label.
function dayLbl(d) { return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3); }
// Rebuild a visit's display text ('Mon 5 Oct · 2:30 PM') from its date and time.
function syncWhen(v) { v.when = dayLbl(parseISO(v.date)) + ' · ' + fmt12(v.time); }
// Short en-IN date, e.g. '05 Oct'.
const dstr = (d) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
/* ---- v4 core: roles, permissions, dates, fuzzy helpers */
/* Role/permission helpers read the server-provided profile; date helpers; fuzzy matching for 'did you mean'. */
// Role columns of the permission matrix (same order as the API).
const ROLES = ['Admin', 'Manager', 'Agent', 'Field staff'];
// Month abbreviation -> month index, for parsing typed dates.
const SHORTM = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
// Date plus n months, clamping the day (31 Jan + 1 month = 28/29 Feb).
function addMonths(d, n) { const x = new Date(d); const day = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n); const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); x.setDate(Math.min(day, last)); return x; }
// Lease end date from a start date and a number of months.
const leaseEndOf = (s, m) => (s && Number(m) > 0 ? iso(addDays(addMonths(parseISO(s), Number(m)), -1)) : '');
// Accept many typed date formats and return 'yyyy-mm-dd' (or '' when it cannot be understood).
function normDate(s) { if (!s) return ''; s = String(s).trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})/); if (m && SHORTM[m[2]] != null) return iso(new Date(2026, SHORTM[m[2]], Number(m[1]))); return ''; }
// 'yyyy-mm-dd' -> 'Mon 5 Oct 2026' for display.
const dateTxt = (s) => (s ? dayLbl(parseISO(s)) + ' ' + parseISO(s).getFullYear() : '—');
// Whole months between today and a given year/month.
const monthsFromToday = (y, m) => (y - today.getFullYear()) * 12 + (m - today.getMonth());
// The signed-in team member object.
const ME = () => S.team.find((t) => t.name === S.me) || S.team[0];
// Position of the signed-in user's role in ROLES.
const roleIdx = () => Math.max(0, ROLES.indexOf(ME().role));
// The server-computed permission profile (levels per module + allowed actions) delivered by /bootstrap.
const PROFILE = () => S.profile || { levels: {}, actions: {} };
// Access level ('none' | 'read' | 'write') for a module.
const lvlOf = (m) => (m ? PROFILE().levels[m] || 'none' : 'write');
// Can the user read this module?
const canR = (m) => (m ? lvlOf(m) !== 'none' : true);
// Can the user create/edit in this module?
const canW = (m) => (m ? lvlOf(m) === 'write' : true);
// Is a named action (import, export..., seeNumbers) allowed for this user?
const canA = (a) => !!PROFILE().actions[a];
// True if the user may export at least one kind of data.
const canExportAny = () => canA('exportProperties') || canA('exportLeads') || canA('exportProspects');
// Permission module of the screen currently being rendered.
let curMod = '';
/* tiny edit-distance for "Did you mean…?" */
// Levenshtein edit distance between two words (used for 'did you mean' suggestions).
function lev(a, b) { a = a.toLowerCase(); b = b.toLowerCase(); const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let prev = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; } return prev[n]; }
// Suggest the closest known name for a mistyped one (e.g. a project or locality).
function didYouMean(q, list) { q = String(q || '').trim(); if (q.length < 3) return null; const ql = q.toLowerCase(); let best = null, bd = 99; list.forEach((x) => { const xl = x.toLowerCase(); if (xl === ql) return; const d = lev(ql, xl); const lim = Math.max(1, Math.min(3, Math.floor(Math.max(ql.length, xl.length) / 4))); if (d <= lim && d < bd) { bd = d; best = x; } }); return best; }
// Rebuild a visible number from a masked one for display after 'reveal' approval.
const maskedFull = (m) => { let k = 0; return String(m || '').replace(/•+/g, (g) => { k++; const seed = g.length * 7 + String(m).length * 13 + k * 31; let s = ''; for (let i = 0; i < g.length; i++) s += String((seed * (i + 3) + k * 5) % 10); return s; }); };
// Current time as an ISO string, for audit logs.
const nowStamp = () => { const d = new Date(); return d.toISOString(); };
// ISO timestamp -> readable en-IN date and time.
const fmtStamp = (s) => { try { return new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return s; } };
// Trigger a browser download of generated text (CSV, invoice HTML...).
const dlFile = (name, text, type) => { try { const b = new Blob([text], { type: type || 'text/plain' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(u); }, 400); return true; } catch (e) { return false; } };
// Quote one CSV value, doubling any quotes inside.
const csvCell = (c) => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"';
// Rows (arrays) -> CSV text.
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\n');
// State list for address pickers.
const INDIAN_STATES = ['Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];
// Small blue badge helper.
const spark = (t) => `<span class="badge blue">${t}</span>`;

/* ------------------------------------------------------------ seed data */
/* UI defaults + the state object S. Real data arrives from the API (BOOT) and overwrites these. */
// Amenity categories.
const CATS = ['Society', 'Safety', 'Utility', 'Recreation', 'Convenience', 'Commercial'];
// Default amenity list (replaced by the server's list at start-up).
const AMEN0 = [
  ['lift', 'Lift', 'Society'], ['power_backup', 'Power backup', 'Society'], ['gated', 'Gated community', 'Society'], ['clubhouse', 'Clubhouse', 'Society'],
  ['community_hall', 'Community hall', 'Society'], ['intercom', 'Intercom', 'Society'], ['parking_visitor', 'Visitor parking', 'Society'], ['ev_charging', 'EV charging', 'Society'],
  ['security', '24×7 security', 'Safety'], ['cctv', 'CCTV', 'Safety'], ['fire_safety', 'Fire safety', 'Safety'], ['video_door', 'Video door phone', 'Safety'],
  ['rainwater', 'Rainwater harvesting', 'Utility'], ['stp', 'Sewage treatment plant', 'Utility'], ['water_24x7', '24×7 water', 'Utility'], ['piped_gas', 'Piped gas', 'Utility'], ['solar', 'Solar power', 'Utility'],
  ['gym', 'Gym', 'Recreation'], ['swimming_pool', 'Swimming pool', 'Recreation'], ['play_area', "Kids' play area", 'Recreation'], ['garden', 'Garden', 'Recreation'], ['jogging_track', 'Jogging track', 'Recreation'],
  ['indoor_games', 'Indoor games room', 'Recreation'], ['badminton', 'Badminton court', 'Recreation'], ['tennis', 'Tennis court', 'Recreation'], ['yoga', 'Yoga / meditation area', 'Recreation'],
  ['shopping', 'Shopping centre', 'Convenience'], ['atm', 'ATM', 'Convenience'], ['laundry', 'Laundry', 'Convenience'],
  ['cafeteria', 'Cafeteria', 'Commercial'], ['conference_room', 'Conference room', 'Commercial'], ['loading_dock', 'Loading dock', 'Commercial'], ['truck_access', 'Truck access', 'Commercial'], ['fire_noc', 'Fire NOC', 'Commercial']
].map((a) => ({ id: a[0], label: a[1], cat: a[2] }));

// Sample places for the location picker (stand-in for a maps service).
const PLACES = [
  { name: 'Sector V', sub: 'Salt Lake, Kolkata, West Bengal 700091', pin: '700091', city: 'Kolkata', state: 'West Bengal' },
  { name: 'Action Area II', sub: 'New Town, Kolkata, West Bengal 700156', pin: '700156', city: 'Kolkata', state: 'West Bengal' },
  { name: 'Rajarhat Main Road', sub: 'Rajarhat, Kolkata, West Bengal 700135', pin: '700135', city: 'Kolkata', state: 'West Bengal' },
  { name: 'Ballygunge Place', sub: 'Ballygunge, Kolkata, West Bengal 700019', pin: '700019', city: 'Kolkata', state: 'West Bengal' },
  { name: 'Alipore Road', sub: 'Alipore, Kolkata, West Bengal 700027', pin: '700027', city: 'Kolkata', state: 'West Bengal' },
  { name: 'Garia Station Road', sub: 'Garia, Kolkata, West Bengal 700084', pin: '700084', city: 'Kolkata', state: 'West Bengal' }
];

// THE application state. Everything the UI shows lives in this one object; BOOT (from /api/bootstrap) is merged over these UI defaults. Every change calls saveState() which diffs and syncs to the server.
// Handle of the pending auto-dismiss timer for the toast message.
let toastTimer: any;
// Functions that later sections deliberately wrap/replace are held in rebindable variables (initialised from the hoisted declarations).
let modalExtra: (...a: any[]) => any = modalExtra0;
let afterInput: (...a: any[]) => any = afterInput0;
let reqForm: (...a: any[]) => any = reqForm0;
let render: (...a: any[]) => any = render0;
const S: EngineState = {
  amen: AMEN0,
  projects: [
    { id: 'p1', name: 'Merlin Verve', dev: 'Merlin Group', type: 'Apartment complex', rera: 'WBRERA/P/KOL/2024/000123', status: 'uc', complete: 'Dec 2027', size: '16', towers: '6', units: '480', configs: ['2 BHK', '3 BHK', '4 BHK'], sale: true, rent: true, saleFrom: '68 L', saleTo: '1.5 Cr', rentFrom: '28,000', rentTo: '45,000', place: PLACES[0], addr: { tower: 'Tower 1–6', street: 'Sector V, Salt Lake', landmark: 'Near Technopolis', pin: '700091', city: 'Kolkata', state: 'West Bengal' }, amenities: ['clubhouse', 'swimming_pool', 'gym', 'jogging_track', 'play_area', 'security'], brochure: 'Merlin_Verve_brochure.pdf' },
    { id: 'p2', name: 'Rosedale Garden', dev: 'Rosedale Developers', type: 'Township', rera: 'WBRERA/P/KOL/2022/000871', status: 'ready', complete: '', size: '8', towers: '4', units: '210', configs: ['2 BHK', '3 BHK'], sale: true, rent: true, saleFrom: '72 L', saleTo: '1.2 Cr', rentFrom: '24,000', rentTo: '38,000', place: PLACES[1], addr: { tower: '', street: 'Action Area I, New Town', landmark: '', pin: '700160', city: 'Kolkata', state: 'West Bengal' }, amenities: ['clubhouse', 'garden', 'security', 'lift'], brochure: '' },
    { id: 'p3', name: 'Ideal Grandeur', dev: 'Ideal Group', type: 'Apartment complex', rera: '', status: 'near', complete: 'Mar 2027', size: '5.5', towers: '3', units: '180', configs: ['2 BHK', '3 BHK'], sale: true, rent: false, saleFrom: '65 L', saleTo: '95 L', rentFrom: '', rentTo: '', place: PLACES[1], addr: { tower: '', street: 'Action Area II, New Town', landmark: '', pin: '700156', city: 'Kolkata', state: 'West Bengal' }, amenities: ['gym', 'security', 'garden'], brochure: '' },
    { id: 'p4', name: '12A, Rajarhat Rd (standalone)', dev: '', type: 'Independent house', rera: '', status: 'ready', complete: '', size: '', towers: '1', units: '1', configs: ['4 BHK'], sale: false, rent: true, saleFrom: '', saleTo: '', rentFrom: '55,000', rentTo: '55,000', place: PLACES[2], addr: { tower: '12A', street: 'Rajarhat Main Road', landmark: '', pin: '700135', city: 'Kolkata', state: 'West Bengal' }, amenities: ['garden'], brochure: '' },
    { id: 'p5', name: 'Godrej Meridien', dev: 'Godrej Properties', type: 'Apartment complex', rera: 'WBRERA/P/KOL/2023/000455', status: 'uc', complete: 'Jun 2028', size: '3.2', towers: '2', units: '96', configs: ['4 BHK'], sale: true, rent: false, saleFrom: '3.8 Cr', saleTo: '5 Cr', rentFrom: '', rentTo: '', place: PLACES[4], addr: { tower: '', street: 'Alipore Road', landmark: '', pin: '700027', city: 'Kolkata', state: 'West Bengal' }, amenities: ['swimming_pool', 'clubhouse', 'cctv'], brochure: '' }
  ],
  props: [
    { id: 'RS001', purpose: 'sale', cat: 'Residential', title: '3 BHK Apartment', projectId: 'p1', unit: 'Tower 3, 7th floor', loc: 'Sector V, Salt Lake', bhk: 3, area: 1450, furn: 'Semi-furnished', priceL: 135, quotedL: 138, status: 'Available', source: 'Owner', owner: 'S. Ghosh' },
    { id: 'RS002', purpose: 'sale', cat: 'Residential', title: '2 BHK Flat · Primary', projectId: 'p3', unit: 'Tower 1, 4th floor', loc: 'Action Area II, New Town', bhk: 2, area: 980, furn: 'Unfurnished', priceL: 68, quotedL: 68, status: 'Available', source: 'Developer', owner: '—' },
    { id: 'RS003', purpose: 'sale', cat: 'Residential', title: '4 BHK Independent Floor', projectId: 'p5', unit: 'Alipore Road', loc: 'Alipore', bhk: 4, area: 2600, furn: 'Semi-furnished', priceL: 420, quotedL: 425, status: 'On hold', source: 'Broker', owner: 'R. Sen' },
    { id: 'RS004', purpose: 'sale', cat: 'Residential', title: '3 BHK Apartment', projectId: 'p1', unit: 'Tower 3, 11th floor', loc: 'Sector V, Salt Lake', bhk: 3, area: 1480, furn: 'Unfurnished', priceL: 141, quotedL: 144, status: 'Available', source: 'Owner', owner: 'P. Dey' },
    { id: 'RR001', purpose: 'rent', cat: 'Residential', title: '2 BHK Flat', projectId: null, unit: 'Ballygunge Place', loc: 'Ballygunge', bhk: 2, area: 1050, furn: 'Furnished', rentK: 38, status: 'Available', source: 'Portal', owner: 'K. Basu' },
    { id: 'RR002', purpose: 'rent', cat: 'Residential', title: '2 BHK Flat', projectId: 'p1', unit: 'Tower 2, 6th floor', loc: 'Sector V, Salt Lake', bhk: 2, area: 1020, furn: 'Semi-furnished', rentK: 32, status: 'Available', source: 'Owner', owner: 'A. Iyer' },
    { id: 'RR003', purpose: 'rent', cat: 'Residential', title: '1 BHK Flat', projectId: null, unit: 'Garia Station Rd', loc: 'Garia', bhk: 1, area: 520, furn: 'Unfurnished', rentK: 14.5, status: 'Rented/Leased', source: 'Owner', owner: 'M. Khan' },
    { id: 'CR001', purpose: 'rent', cat: 'Commercial', title: 'Office Space', projectId: null, unit: 'Sector V', loc: 'Sector V, Salt Lake', bhk: 0, area: 850, furn: 'Semi-furnished', rentK: 85, status: 'Available', source: 'Owner', owner: 'T. Dutta' },
    { id: 'LS001', purpose: 'sale', cat: 'Land', title: 'Plot · 5 Katha', projectId: null, unit: 'Rajarhat', loc: 'Rajarhat', bhk: 0, area: 3600, furn: '—', priceL: 55, quotedL: 58, status: 'Sold', source: 'Referral', owner: 'A. Iyer' }
  ],
  leads: [
    { id: 'l1', name: 'Sunita Agarwal', phone: '+91 98••• ••210', source: '99acres', intent: 'buy', stage: 'Prospect', sub: 'Properties offered', budget: '₹1.0–1.3 Cr', want: '2 BHK · New Town', assigned: 'Anil Sharma', tags: ['NRI'], act: [['Call', 'Asked for 2 BHK New Town options', 'Yesterday'], ['System', 'Lead created from 99acres', '3 days ago']] },
    { id: 'l2', name: 'Kavita Shah', phone: '+91 97••• ••455', source: 'Magicbricks', intent: 'buy', stage: 'Contacted', sub: '', budget: '₹1.1–1.4 Cr', want: '3 BHK · Salt Lake', assigned: 'Anil Sharma', tags: ['Urgent'], act: [['Call', 'Connected — call back for options', '2 days ago']] },
    { id: 'l3', name: 'Rohit Banerjee', phone: '+91 90••• ••108', source: 'Friend & Family', intent: 'rent', stage: 'Qualified', sub: '', budget: '₹30–40k/mo', want: '2 BHK · Ballygunge', assigned: 'Anil Sharma', tags: [], act: [['WhatsApp', 'Shared 2 BHK rentals', 'Today']] },
    { id: 'l4', name: 'Amit Desai', phone: '+91 99••• ••882', source: 'Direct Reference', intent: 'buy', stage: 'Lead', sub: '', budget: '₹40–60 L', want: 'Plot · Rajarhat', assigned: 'Anil Sharma', tags: ['NRI', 'Investor'], act: [] },
    { id: 'l5', name: 'Neha Kapoor', phone: '+91 98••• ••360', source: '99acres', intent: 'rent', stage: 'Prospect', sub: 'Requirement gathering', budget: '₹80k–1 L/mo', want: 'Office · Sector V', assigned: 'Anil Sharma', tags: [], act: [['Note', 'Needs 800–1,000 sq ft near metro', 'Today']] },
    { id: 'l6', name: 'Manish Roy', phone: '+91 91••• ••700', source: 'Associate Broker', intent: 'buy', stage: 'Not qualified', sub: '', budget: '—', want: 'Farmhouse', assigned: 'Anil Sharma', tags: [], act: [['Note', 'Requirement outside our areas', '5 days ago']] }
  ],
  prospects: [
    { id: 'c1', name: 'Priya Nair', type: 'Buyer', nri: false, city: 'Kolkata', source: '99acres', assigned: 'Anil Sharma', phone: '+91 98••• ••731', email: 'priya.n@email.com', lang: 'English', notes: 'Wants near Sector V metro' },
    { id: 'c2', name: 'Sunita Agarwal', type: 'Buyer', nri: true, city: 'Dubai', source: '99acres', assigned: 'Anil Sharma', phone: '+91 98••• ••210', email: 's.agarwal@email.com', lang: 'Hindi', notes: '' },
    { id: 'c3', name: 'Rohit Banerjee', type: 'Tenant', nri: false, city: 'Kolkata', source: 'Friend & Family', assigned: 'Anil Sharma', phone: '+91 90••• ••108', email: '', lang: 'Bengali', notes: '' },
    { id: 'c4', name: 'S. Ghosh', type: 'Owner', nri: false, city: 'Kolkata', source: 'Direct Reference', assigned: 'Anil Sharma', phone: '+91 98••• ••015', email: '', lang: 'Bengali', notes: 'Owns RS001' }
  ],
  reqs: [
    { id: 'REQ-2031', cid: 'c1', purpose: 'sale', type: 'Apartment / Flat', locs: ['Salt Lake', 'New Town'], min: 120, max: 150, bhk: 3, area: '1,200–1,600 sq ft', parking: '1 covered · must-have', timeline: '1–2 months', status: 'Active', notes: 'Wants near Sector V metro' },
    { id: 'REQ-2034', cid: 'c3', purpose: 'rent', type: 'Apartment / Flat', locs: ['Ballygunge'], min: 30, max: 40, bhk: 2, area: '900–1,100 sq ft', parking: 'Not needed', timeline: 'Immediate', status: 'Active', notes: '' },
    { id: 'REQ-2036', cid: 'c2', purpose: 'sale', type: 'Apartment / Flat', locs: ['New Town'], min: 60, max: 80, bhk: 2, area: '900–1,100 sq ft', parking: '1 open', timeline: '3–6 months', status: 'On hold', notes: 'NRI — visits next month' }
  ],
  visits: [
    { id: 'VIS-3392', cid: 'c3', prop: 'RR002', date: '2026-09-28', time: '16:00', dur: 45, status: 'Scheduled', agent: 'Anil Sharma', notes: 'Owner will be present', log: ['Visit scheduled'] },
    { id: 'VIS-3387', cid: 'c1', prop: 'RS001', date: '2026-09-29', time: '10:30', dur: 45, status: 'Confirmed', agent: 'Anil Sharma', notes: 'Meet at Sector V metro gate', log: ['Rescheduled 1:00 PM → 3:00 PM → 10:30 AM', 'WhatsApp confirmation sent', 'Visit scheduled'] },
    { id: 'VIS-3390', cid: 'c2', prop: 'RS002', date: '2026-09-29', time: '10:45', dur: 60, status: 'Scheduled', agent: 'Anil Sharma', notes: '', log: ['Visit scheduled'] },
    { id: 'VIS-3393', cid: 'c1', prop: 'RS004', date: '2026-09-29', time: '17:30', dur: 45, status: 'Scheduled', agent: 'Anil Sharma', notes: '', log: ['Visit scheduled'] },
    { id: 'VIS-3391', cid: 'c3', prop: 'RR001', date: '2026-09-30', time: '12:00', dur: 45, status: 'Scheduled', agent: 'Anil Sharma', notes: '', log: ['Visit scheduled'] },
    { id: 'VIS-3394', cid: 'c2', prop: 'RS001', date: '2026-10-02', time: '15:00', dur: 60, status: 'Scheduled', agent: 'Anil Sharma', notes: 'NRI prospect — video call if she is away', log: ['Visit scheduled'] },
    { id: 'VIS-3370', cid: 'c1', prop: 'RS004', date: '2026-09-25', time: '11:00', dur: 45, status: 'Completed', agent: 'Anil Sharma', notes: 'Liked east balcony', log: ['Outcome: Interested'] }
  ],
  fus: [
    { id: 'f1', who: 'Kavita Shah', kind: 'Call', note: 'Asked for 2 BHK New Town options', due: 'overdue', when: '2 days ago', done: false },
    { id: 'f2', who: 'Priya Nair', kind: 'Visit', note: 'RS001 · 3 BHK, Salt Lake Sector V', due: 'today', when: '10:30', done: false },
    { id: 'f3', who: 'Rohit Banerjee', kind: 'Call', note: 'Share 2 BHK Ballygunge rentals', due: 'today', when: '12:00', done: false },
    { id: 'f4', who: 'Amit Desai (NRI)', kind: 'WhatsApp', note: 'Send brochure on WhatsApp', due: 'today', when: '15:00', done: false },
    { id: 'f5', who: 'Neha Kapoor', kind: 'WhatsApp', note: 'Send Sector V office list', due: 'upcoming', when: 'Tue 30 Sep · 14:00', done: false },
    { id: 'f6', who: 'Anil Sharma', kind: 'Call', note: 'Discuss offer feedback with Priya Nair', due: 'upcoming', when: 'Fri 2 Oct · 11:00', done: false }
  ],
  deals: [
    { id: 'DEAL-0142', cid: 'c1', prop: 'RS001', kind: 'sale', stage: 'agreement', ask: 128, close: 130, token: { on: true, amt: '2,00,000', date: '02 Sep', note: '' }, agr: { on: true, date: '10 Sep', note: '' }, reg: { on: false, date: '', note: '' }, bType: '%', bBuyer: 1, bOwner: 1, handled: 'Anil Sharma', lostReason: '', log: [['Buyer offered ₹1.28 Cr', 'seller countered ₹1.35 Cr'], ['Agreed at ₹1.30 Cr', 'verbal']], expected: '2026-10-28', stageSince: '2026-09-10', upd: '2026-09-27',
      offers: [{ by: 'buyer', amt: 128, terms: 'Cash · possession in 60 days', status: 'Countered', at: '25 Aug' }, { by: 'seller', amt: 135, terms: 'Furnishings excluded', status: 'Countered', at: '27 Aug' }, { by: 'buyer', amt: 130, terms: 'Home loan · 90 days', status: 'Accepted', at: '31 Aug' }],
      loan: { required: true, bank: 'HDFC Bank', amt: '9000000', stage: 'Sanctioned', applied: '12 Sep', sanctioned: '22 Sep', disbursed: '', contact: 'R. Menon · +91 98••• ••512' },
      tasks: [{ t: 'Collect signed agreement copy', due: '2026-09-30', done: false }, { t: 'Book registration slot', due: '2026-10-05', done: false }, { t: 'Share token receipt with buyer', due: '2026-09-11', done: true }],
      parties: [{ role: 'Buyer', name: 'Priya Nair', phone: '+91 98••• ••731' }, { role: 'Owner', name: 'S. Ghosh', phone: '+91 98••• ••015' }, { role: 'Lawyer', name: 'Adv. S. Mukherjee', phone: '+91 98••• ••771' }, { role: 'Bank contact', name: 'R. Menon (HDFC)', phone: '+91 98••• ••512' }],
      timeline: [['Agreement signed', 'Anil Sharma', '10 Sep'], ['Token paid ₹2,00,000', 'Anil Sharma', '02 Sep'], ['Deal created at ₹1.28 Cr ask', 'Anil Sharma', '25 Aug']] },
    { id: 'DEAL-0145', cid: 'c3', prop: 'RR001', kind: 'rent', stage: 'negotiation', ask: 34, close: 36, token: { on: false, amt: '', date: '', note: '' }, agr: { on: false, date: '', note: '' }, reg: { on: false, date: '', note: '' }, bType: 'fixed', bBuyer: 36000, bOwner: 36000, handled: 'Anil Sharma', lostReason: '', log: [['Tenant offered ₹34,000', 'owner asks ₹38,000']], expected: '2026-10-05', stageSince: '2026-09-14', upd: '2026-09-18',
      offers: [{ by: 'buyer', amt: 34, terms: 'Move-in 1 Oct · 11-month lease', status: 'Countered', at: '16 Sep' }, { by: 'seller', amt: 38, terms: 'Two months lock-in', status: 'Open', at: '18 Sep' }] },
    { id: 'DEAL-0139', cid: 'c2', prop: 'RS002', kind: 'sale', stage: 'closed_won', ask: 66, close: 68, token: { on: true, amt: '1,00,000', date: '12 Aug', note: '' }, agr: { on: true, date: '21 Aug', note: '' }, reg: { on: true, date: '09 Sep', note: '' }, bType: '%', bBuyer: 1, bOwner: 1, handled: 'Anil Sharma', lostReason: '', log: [], expected: '2026-09-09', closedOn: '2026-09-09', stageSince: '2026-09-09', upd: '2026-09-09' },
    { id: 'DEAL-0131', cid: 'c3', prop: 'RR003', kind: 'rent', stage: 'closed_won', ask: 14, close: 14.5, token: { on: false, amt: '', date: '', note: '' }, agr: { on: true, date: '18 Aug', note: '' }, reg: { on: false, date: '', note: '' }, bType: 'fixed', bBuyer: 14500, bOwner: 14500, handled: 'Anil Sharma', lostReason: '', log: [], expected: '2026-08-20', closedOn: '2026-08-20', stageSince: '2026-08-20', upd: '2026-08-20' },
    { id: 'DEAL-0128', cid: 'c2', prop: 'RS003', kind: 'sale', stage: 'lost', ask: 400, close: 410, token: { on: false, amt: '', date: '', note: '' }, agr: { on: false, date: '', note: '' }, reg: { on: false, date: '', note: '' }, bType: '%', bBuyer: 1, bOwner: 1, handled: 'Anil Sharma', lostReason: 'Price gap', log: [['Buyer stuck at ₹4.00 Cr', 'owner would not go below ₹4.25 Cr']], expected: '2026-09-05', stageSince: '2026-09-05', upd: '2026-09-05' }
  ],
  brok: [
    { deal: 'DEAL-0142', due: '2026-10-30', pay: [{ amt: 130000, from: 'buyer', date: '2026-09-15', mode: 'UPI', ref: '4029…', note: '' }] },
    { deal: 'DEAL-0139', due: '2026-09-15', pay: [{ amt: 68000, from: 'buyer', date: '2026-09-12', mode: 'NEFT', ref: '8871…', note: '' }] },
    { deal: 'DEAL-0131', due: '2026-08-31', pay: [{ amt: 14500, from: 'buyer', date: '2026-08-20', mode: 'UPI', ref: '2210…', note: '' }, { amt: 14500, from: 'owner', date: '2026-08-22', mode: 'UPI', ref: '2218…', note: '' }] }
  ],
  team: [
    { name: 'Anil Sharma', role: 'Owner', phone: '+91 98••• ••001', status: 'Active', leads: 0 }
  ],
  roles: [['Own leads only', [0, 1, 1]], ['All leads', [1, 1, 0]], ['Export data', [1, 1, 0]], ['Hide owner details', [0, 0, 1]], ['Broker network sharing', [1, 1, 0]]],
  /* ui state */
  f: { projects: 'all', props: 'all', leads: 'All', prospects: 'all', deals: 'all', brok: 'all', reqs: 'all', visits: 'all', matches: 'all' },
  q: {}, modal: null, toast: '', nav: false, d: {}, ctx: null, tab: {}, am: { q: '', cat: 'All', open: true, notice: '' }, loc: { q: '', focus: false, note: '' }, pq: { q: '', open: false }
};
S.visits.forEach(syncWhen);
S.cal = { mode: window.innerWidth < 700 ? 'day' : 'week', anchor: iso(today) };
S.err = {};
if (S.leads[0] && !S.leads[0].links) { S.leads[0].links = [{ url: 'https://www.99acres.com/search/property/buy/new-town-kolkata', type: 'Portal listing', note: 'Enquiry came from this listing page', at: '2026-09-25' }]; if (S.leads[1]) S.leads[1].links = [{ url: 'https://www.instagram.com/p/Cx1234abcd/', type: 'Social media post', note: 'Reel on Merlin Verve', at: '2026-09-26' }]; }
S.leads.forEach((l) => { if (l.stage === 'Contacted') l.stage = 'Lead'; if (l.stage === 'Prospect') l.stage = 'Converted'; });
/* ---- v4 seed adjustments */
S.me = 'Anil Sharma';
S.team = [
  { name: 'Anil Sharma', role: 'Owner', phone: '+91 98••• ••001', corp: '+91 98••• ••001', alt: '+91 98••• ••990', email: 'anil@sharmaproperty.in', status: 'Active', leads: 0, seeNumbers: true }
];
S.perms = {
  mods: [['properties', 'Properties (inventory)'], ['projects', 'Projects'], ['leads', 'Leads'], ['prospects', 'Prospects'], ['requirements', 'Requirements & matches'], ['visits', 'Visits & follow-ups'], ['deals', 'Deals'], ['brokerage', 'Brokerage'], ['team', 'Team & settings']],
  lv: { properties: ['write', 'write', 'write', 'write'], projects: ['write', 'write', 'read', 'read'], leads: ['write', 'write', 'write', 'none'], prospects: ['write', 'write', 'write', 'none'], requirements: ['write', 'write', 'write', 'none'], visits: ['write', 'write', 'write', 'write'], deals: ['write', 'write', 'write', 'none'], brokerage: ['write', 'write', 'read', 'none'], team: ['write', 'read', 'none', 'none'] },
  act: [['exportProperties', 'Export properties', [1, 1, 0, 0]], ['exportLeads', 'Export leads', [1, 1, 0, 0]], ['exportProspects', 'Export prospects', [1, 1, 0, 0]], ['approveExports', 'Approve export requests', [1, 1, 0, 0]], ['import', 'Import data from CSV', [1, 1, 0, 0]], ['seeNumbers', 'See full phone numbers & emails', [1, 1, 1, 0]], ['masters', 'Edit masters (types, amenities, groups)', [1, 0, 0, 0]]]
};
S.masters = {
  projectTypes: ['Residential Complex', 'Township', 'Single Tower', 'Commercial Complex', 'Industrial Park', 'Warehouse', 'Mixed Development', 'Independent house', 'Other'],
  features: ['Modular kitchen', 'Wardrobes', 'Air conditioning', 'Geyser', 'Chimney', 'Gas pipeline', 'Vastu compliant', 'Corner unit', 'Park facing', 'Wi-Fi ready', 'Water purifier', 'Inverter / UPS'],
  brokerGroups: ['BNI', 'RERA-registered agents', 'WhatsApp · Salt Lake brokers', 'WhatsApp · New Town brokers'],
  sizeUnits: ['acres', 'bigha', 'katha', 'sq ft', 'sq m', 'hectares']
};
S.mreq = [];
S.alerts = [];
S.viewLog = [{ who: 'Anil Sharma', what: 'Owner number', rec: 'RS003', at: '2026-09-26T10:42:00' }, { who: 'Anil Sharma', what: 'Prospect number', rec: 'Rohit Banerjee', at: '2026-09-27T16:05:00' }];
S.exportReq = [];
S.exportLog = [{ who: 'Anil Sharma', what: 'Properties', n: 9, at: '2026-09-26T11:20:00' }];
S.cap = { text: '', stage: 0, parsed: null, checks: [], src: 'text', img: '', imgName: '', target: 'lead', listening: false, items: [], idx: 0, busy: false, srcLabel: '', warn: [], dups: [], model: '' };
S.exp = { kind: 'properties', from: '', to: '', min: '', max: '', source: 'all', status: 'all' };
S.tab.rev = {};
S.d.docCat = {};
S.d.dsel = {};
S.d.docq = '';
(function () {
  S.projects.forEach((p) => { if (p.type === 'Apartment complex') p.type = 'Residential Complex'; if (p.type === 'Tower') p.type = 'Single Tower'; if (p.status === 'near') p.status = 'uc'; if (p.size) p.sizeUnit = 'acres'; p.layouts = []; p.charges = []; p.photos = p.photos || 0; });
  const p1 = S.projects.find((p) => p.id === 'p1');
  p1.layouts = [{ cfg: '2 BHK', name: 'Type A', area: '1,020', baths: '2', units: '160' }, { cfg: '3 BHK', name: 'Type B', area: '1,450', baths: '3', units: '240' }, { cfg: '3 BHK', name: 'Type C (corner)', area: '1,480', baths: '3', units: '40' }, { cfg: '4 BHK', name: 'Type D', area: '2,100', baths: '4', units: '40' }];
  p1.charges = [{ name: 'ADC (Additional Development Charges)', rate: '150', from: '2026-04-01' }, { name: 'Club charges', rate: '60', from: '2026-04-01' }];
  S.props.forEach((p, i) => { p.created = p.created || iso(addDays(today, -70 + i * 7)); });
  Object.assign(S.props.find((p) => p.id === 'RS001'), { carpet: 1180, bu: 1300, sbu: 1450, sub: 'Flat / Apartment' });
  S.prospects.forEach((c, i) => { c.created = c.created || iso(addDays(today, -60 + i * 9)); c.waOk = c.waOk !== false; });
  S.prospects.find((c) => c.id === 'c4').waOk = false;
  // Patch one lead (found by id) with the given fields.
  const setL = (id, o) => Object.assign(S.leads.find((l) => l.id === id), o);
  S.leads.forEach((l, i) => { l.created = l.created || iso(addDays(today, -40 + i * 6)); });
  setL('l1', { stage: 'Converted', basic: { locText: 'New Town', min: 100, max: 130, bhk: 2 } });
  setL('l2', { stage: 'Lead', basic: { locText: 'Salt Lake', min: 110, max: 140, bhk: 3 } });
  setL('l3', { basic: { locText: 'Ballygunge', min: 30, max: 40, bhk: 2 } });
  setL('l4', { basic: { locText: 'Rajarhat', min: 40, max: 60, bhk: 0 } });
  setL('l5', { stage: 'Converted', basic: { locText: 'Sector V', min: 80, max: 100, bhk: 0 } });
  setL('l6', { basic: { locText: '', min: 0, max: 0, bhk: 0 } });
  // Patch one deal (found by id) with the given fields.
  const set = (id, o) => Object.assign(S.deals.find((d) => d.id === id), o);
  set('DEAL-0142', { ask: 138, bid: 130, openedBy: 'Anil Sharma', closedBy: 'Anil Sharma', closedByEdited: true, created: '2026-08-25', timeline: undefined, agreedOn: '2026-09-01', handled: undefined, notes: '' });
  set('DEAL-0145', { ask: 38, bid: 34, close: '', openedBy: 'Anil Sharma', closedBy: 'Anil Sharma', created: '2026-09-14', leaseStart: '2026-10-01', tenure: 11, depMonths: 2, handled: undefined, notes: '' });
  set('DEAL-0139', { ask: 70, bid: 66, openedBy: 'Anil Sharma', closedBy: 'Anil Sharma', created: '2026-08-05', agreedOn: '2026-08-10', handled: undefined, notes: '' });
  set('DEAL-0131', { ask: 15, bid: 14, openedBy: 'Anil Sharma', closedBy: 'Anil Sharma', created: '2025-10-28', agreedOn: '2025-11-05', closedOn: '2025-11-12', stageSince: '2025-11-12', expected: '2025-11-12', upd: '2025-11-12', agr: { on: true, date: '2025-11-10', note: '' }, leaseStart: '2025-11-12', tenure: 11, depMonths: 2, handled: undefined, notes: '' });
  set('DEAL-0128', { ask: 425, bid: 400, openedBy: 'Anil Sharma', closedBy: 'Anil Sharma', created: '2026-08-20', handled: undefined, notes: '' });
})();
S.d.disc = { side: 'buyer', amt: '', reason: '' }; S.d.invSide = 'buyer'; S.d.dshare = { to: {}, via: 'WhatsApp' };
// Local counters used by the prototype for id generation (the API now generates the real ids).
let seq = { RS: 5, RR: 4, CR: 2, LS: 2, CS: 1, CR2: 1 };
/* ------------------------------------------------------------ ui components */
/* Small HTML-string helpers (badges, chips, fields, buttons, page frame) used by every screen. */
// Format a number as Indian rupees with lakh/crore grouping.
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');
// Coloured pill, e.g. badge('Available','ok').
const badge = (t, k = '') => `<span class="badge ${k}">${esc(t)}</span>`;
// Clickable filter chip button.
const chip = (label, on, attrs) => `<button type="button" class="chip${on ? ' on' : ''}" ${attrs}>${label}</button>`;
// Group of single-select chips bound to a state path.
const chipSet = (p, opts, cur) => `<div class="chips">${opts.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return chip(esc(l), String(cur) === String(v), `data-act="setf" data-p="${p}" data-v="${esc(v)}"`); }).join('')}</div>`;
// Group of multi-select chips bound to a state path.
const chipMulti = (p, opts, cur) => `<div class="chips">${opts.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return chip(esc(l), (cur || []).includes(v), `data-act="togf" data-p="${p}" data-v="${esc(v)}"`); }).join('')}</div>`;
// Segmented control (pill-style single choice) for filters.
const seg = (items, cur, k) => `<div class="seg" role="group">${items.map(([v, l]) => `<button type="button" class="${cur === v ? 'on' : ''}" data-act="filt" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
// All / Sale / Rent-Lease segmented control.
const purposeSeg = (k) => seg([['all', 'All'], ['sale', 'Sale'], ['rent', 'Rent/Lease']], S.f[k], k);
// Sale / Rent-Lease selector inside forms.
const purposeSet = (p, cur) => `<div class="seg" role="group">${[['sale', 'Sale'], ['rent', 'Rent/Lease']].map(([v, l]) => `<button type="button" class="${cur === v ? 'on' : ''}" data-act="setf" data-p="${p}" data-v="${v}">${l}</button>`).join('')}</div>`;
// Form field renderer: label + input/select/textarea bound to a state path, with error text and prefix/suffix support.
function fld(label, p, o: Rec = {}) {
  const v = get(S, p); const id = 'f_' + p.replace(/\./g, '_'); let ctl; const er = S.err && S.err[p];
  const aria = !label ? ` aria-label="${esc(o.aria || p.split('.').pop().replace(/([A-Z])/g, ' $1').toLowerCase())}"` : '';
  if (o.opts) ctl = `<div class="inp sel"><select id="${id}" data-f="${p}" ${o.rer ? 'data-render="1"' : ''}${aria}>${o.opts.map((x) => { const a = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(a[0])}" ${String(v) === String(a[0]) ? 'selected' : ''}>${esc(a[1])}</option>`; }).join('')}</select></div>`;
  else if (o.rows) ctl = `<textarea id="${id}" data-f="${p}" rows="${o.rows}" placeholder="${esc(o.ph || '')}"${aria}>${esc(v || '')}</textarea>`;
  else ctl = `<div class="inp">${o.pre ? `<span class="pre">${o.pre}</span>` : ''}<input id="${id}" data-f="${p}" type="${o.type || 'text'}" value="${esc(v == null ? '' : v)}" placeholder="${esc(o.ph || '')}" ${o.rer ? 'data-render="1"' : ''}${aria}>${o.suf ? `<span class="suf">${o.suf}</span>` : ''}</div>`;
  return `<label class="fld${er ? ' err' : ''}" ${o.style ? `style="${o.style}"` : ''}>${label ? `<span class="l">${label}${o.req ? ' <span class="req">*</span>' : ''}</span>` : ''}${ctl}${er ? `<span class="emsg" role="alert">${esc(er)}</span>` : o.hint ? `<small>${o.hint}</small>` : ''}</label>`;
}
// Small bold label above a control.
const lbl = (t) => `<div style="font-size:13px;font-weight:500">${t}</div>`;
// Custom checkbox button.
const chk = (on, label, attrs) => `<button type="button" class="chk" ${attrs}><span class="cb${on ? ' on' : ''}">${on ? ico('check', 14) : ''}</span><span>${label}</span></button>`;
// Key/value list block used on detail pages.
const kv = (rows) => `<div class="kv">${rows.map(([k, v]) => `<div><b>${k}</b><span>${v}</span></div>`).join('')}</div>`;
// Grey placeholder box (stands in for maps and photos).
const ph = (h, label = '', extra = '') => `<div class="ph" style="height:${h}px;${extra}">${ico('img', 20)}${label}</div>`;
// Info / success / warning / error banner.
const note = (t, k = '') => `<div class="note ${k}">${ico(k === 'ok' ? 'check' : 'info', 18)}<div>${t}</div></div>`;
// Button or link-button markup (variants via o.k and o.c).
const btn = (t, o: Rec = {}) => (o.href ? `<a class="btn ${o.k || ''} ${o.c || ''}" href="${o.href}">${o.i ? ico(o.i, 18) : ''}${t}</a>` : `<button type="button" class="btn ${o.k || ''} ${o.c || ''}" ${o.a || ''}>${o.i ? ico(o.i, 18) : ''}${t}</button>`);
// Standard page frame: title, subtitle, header actions and body.
const page = (title, sub, actions, body) => `<div class="head"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="grow"></div><div class="head">${actions || ''}</div></div>${body}`;
// White card container.
const card = (inner, cls = '') => `<div class="card ${cls}">${inner}</div>`;
// Unused placeholder kept from the prototype.
const searchBox = (key, placeholder) => `<label class="search" style="flex:1 1 150px;max-width:260px;min-width:0">${ico('search', 18)}<input id="sb_${String(key).replace(/\W/g, '_')}" data-f="${key}" data-render="1" value="${esc(get(S, key) || '')}" placeholder="${esc(placeholder || 'Search')}" aria-label="${esc(placeholder || 'Search')}" autocomplete="off"></label>`;
// Empty-state block with a message and optional action.
const empty = (t, s, a?) => `<div style="padding:48px 16px;text-align:center;display:flex;flex-direction:column;gap:10px;align-items:center"><div style="width:72px;height:72px;border-radius:50%;background:var(--line2);border:1px dashed var(--field);display:flex;align-items:center;justify-content:center;color:var(--muted)">${ico('search', 28)}</div><h2>${t}</h2><div class="sub" style="max-width:380px">${s}</div>${a || ''}</div>`;
// Tab strip bound to S.tab[k].
const tabsBar = (k, items, cur) => `<div class="tabs" role="tablist">${items.map(([v, l]) => `<button type="button" role="tab" class="${cur === v ? 'on' : ''}" data-act="tab" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
// Badge coloured by property status.
const statusBadge = (s) => badge(s, { Available: 'ok', 'On hold': 'warn', Sold: '', 'Rented/Leased': '', Draft: 'blue', Confirmed: 'ok', Scheduled: 'blue', Completed: '', Cancelled: 'err' }[s] || '');
// Badge for a project's status (Ready / Under construction).
const projStatus = (s) => (s === 'ready' ? badge('Ready for operation', 'ok') : badge('Under construction', 'warn'));
// Find a project by id.
const projById = (id) => S.projects.find((p) => p.id === id);
// Find a property by id.
const propById = (id) => S.props.find((p) => p.id === id);
// Find a prospect by id.
const prosById = (id) => S.prospects.find((p) => p.id === id);
// 'RS001 · 3 BHK in …' label for dropdowns.
const propLabel = (p) => `${p.id} · ${p.title}`;

// Sidebar items: [route, label, icon, permission module].
const NAV = [['dashboard', 'Dashboard', 'dash', ''], ['projects', 'Projects', 'proj', 'projects'], ['properties', 'Properties', 'prop', 'properties'], ['leads', 'Leads', 'lead', 'leads'], ['prospects', 'Prospects', 'user', 'prospects'], ['requirements', 'Requirements', 'req', 'requirements'], ['matches', 'Matches', 'match', 'requirements'], ['visits', 'Visits', 'cal', 'visits'], ['followups', 'Follow-ups', 'clock', 'visits'], ['deals', 'Deals', 'deal', 'deals'], ['brokerage', 'Brokerage', 'rupee', 'brokerage'], ['capture', 'AI capture', 'match', 'leads'], ['team', 'Team', 'users', 'team'], ['settings', 'Settings', 'gear', '']];
// Whether a sidebar item should be shown for this user's permissions.
const navOk = (n) => (n[0] === 'capture' ? canW('leads') : !n[3] || canR(n[3]));
// Route -> permission module, used to block screens the role cannot open.
const ROUTE_MOD = { projects: 'projects', properties: 'properties', leads: 'leads', prospects: 'prospects', requirements: 'requirements', matches: 'requirements', visits: 'visits', followups: 'visits', deals: 'deals', brokerage: 'brokerage', capture: 'leads', team: 'team' };

// Keyword search helpers: every word typed must appear somewhere in the record (any text/number field, or in the extra text given).
const hay = (o, extra = '') => (Object.values(o || {}).filter((v) => typeof v === 'string' || typeof v === 'number' || (Array.isArray(v) && v.every((x) => typeof x === 'string'))).join(' ') + ' ' + extra).toLowerCase();
const kw = (h, q) => { const t = String(q || '').toLowerCase().split(/\s+/).filter(Boolean); return t.every((w) => h.includes(w)); };
// Search box state path + placeholder for each list screen.
const LISTQ = { projects: ['q.projects', 'Search projects…'], properties: ['q.props', 'Search properties by ID, locality, owner…'], leads: ['q.leads', 'Search leads by name or requirement…'], prospects: ['q.prospects', 'Search prospects…'], deals: ['q.deals', 'Search deals by ID, prospect, property…'], brokerage: ['q.brok', 'Search brokerage by deal, prospect…'], requirements: ['q.reqs', 'Search clients, locality, requirement ID…'], matches: ['q.matches', 'Search a client or requirement…'], visits: ['q.visits', 'Search visits by client, property, status…'], followups: ['q.fus', 'Search follow-ups by name, note, type…'], team: ['q.team', 'Search team by name, role, email…'] };
// Label of the 'back' link on each detail screen.
const BACK = { projects: 'Projects', properties: 'Properties', leads: 'Leads', prospects: 'Prospects', requirements: 'Requirements', visits: 'Visits', deals: 'Deals', brokerage: 'Brokerage' };
// Results of the top-bar global search across projects, properties, leads and prospects.
function globalResults() {
  // Global search: nothing is searched until the user has typed something. Every word must match somewhere in the record.
  const q = (S.q.gs || '').trim().toLowerCase(); if (!q) return [];
  const r = [];
  S.props.forEach((p) => { if (kw(hay(p), q)) r.push(['Property', propLabel(p), '#/properties/' + p.id]); });
  S.projects.forEach((p) => { if (kw(hay(p, p.place ? p.place.sub : ''), q)) r.push(['Project', p.name, '#/projects/' + p.id]); });
  S.leads.forEach((p) => { if (kw(hay(p), q)) r.push(['Lead', p.name, '#/leads/' + p.id]); });
  S.prospects.forEach((p) => { if (kw(hay(p), q)) r.push(['Prospect', p.name, '#/prospects/' + p.id]); });
  S.reqs.forEach((x) => { if (kw(reqHay(x), q)) r.push(['Requirement', x.id + ' · ' + reqWho(x), '#/requirements/' + x.id]); });
  S.visits.forEach((v) => { const pr = propById(v.prop); if (kw(hay(v, (prosById(v.cid) || {}).name + ' ' + (pr ? pr.title + ' ' + pr.loc : '')), q)) r.push(['Visit', v.id + ' · ' + ((prosById(v.cid) || {}).name || '') + ' · ' + (v.when || v.date), '#/visits/' + v.id]); });
  S.deals.forEach((d) => { if (kw(hay(d, (prosById(d.cid) || {}).name), q)) r.push(['Deal', d.id + ' · ' + ((prosById(d.cid) || {}).name || ''), '#/deals/' + d.id]); });
  S.team.forEach((t) => { if (kw(hay(t), q)) r.push(['Team', t.name + ' · ' + t.role, '#/team']); });
  return r.slice(0, 12);
}
// App chrome (sidebar, top bar, search, 'New' menu) wrapped around the current screen's body.
function shell(R, body) {
  const on = R.a; const lq = null; const gs = globalResults();
  const sp = lq ? lq[0] : 'q.gs'; const sph = lq ? lq[1] : 'Search properties, projects, leads, prospects, requirements, visits, deals…';
  const back = R.b && BACK[R.a] ? `<a class="back" href="#/${R.a}">${ico('back', 16)} ${BACK[R.a]}</a>` : '';
  const navs = NAV.filter(navOk);
  const bn = [['dashboard', 'Home', 'dash'], ['properties', 'Properties', 'prop'], ['leads', 'Leads', 'lead'], ['deals', 'Deals', 'deal']].filter((n) => navOk(NAV.find((m) => m[0] === n[0])));
  const me = ME();
  const newItems = [['Project', 'newProject', 'projects'], ['Property', 'newProperty', 'properties'], ['Lead', 'modal:lead', 'leads'], ['Prospect', 'modal:prospect', 'prospects'], ['Requirement', 'newReq', 'requirements'], ['AI capture', 'newCapture', 'leads'], ['Follow-up', 'modal:fu', 'visits'], ['Visit', 'modal:visit', 'visits'], ['Deal', 'newDeal', 'deals']].filter((x) => canW(x[2]));
  return `<div class="app${S.nav ? ' navopen' : ''}">
  <aside class="side" aria-label="Main navigation">
    <div class="brand"><div class="logo">SF</div><div><div style="font-weight:600;font-size:14px;line-height:1.2">SquareFeets Realty</div><div class="sub" style="font-size:12px">CRM</div></div></div>
    ${navs.map((n) => `<a class="nav${on === n[0] ? ' on' : ''}" href="#/${n[0]}">${ico(n[2], 20)}${n[1]}</a>`).join('')}
    <div class="grow"></div>
    ${canA('import') ? `<a class="nav${on === 'import' ? ' on' : ''}" href="#/import">${ico('upload', 20)}Import data</a>` : ''}
    ${canExportAny() ? `<a class="nav${on === 'export' ? ' on' : ''}" href="#/export">${ico('download', 20)}Export data</a>` : ''}
    ${canA('masters') ? `<a class="nav${on === 'masters' ? ' on' : ''}" href="#/masters">${ico('shield', 20)}Masters</a>` : ''}
    <a class="nav${on === 'account' ? ' on' : ''}" href="#/account">${ico('user', 20)}My account</a>
    <button type="button" class="nav" data-act="logout" style="border:0;background:none;width:100%;text-align:left;font:inherit">${ico('close', 20)}Sign out</button>
  </aside>
  <div class="main">
    <header class="top">
      <button type="button" class="btn sec sm menu-btn" data-act="navToggle" aria-label="Open menu">${ico('menu', 20)}</button>
      <div style="position:relative;flex:1;min-width:0;max-width:560px" data-popwrap="1"><label class="search">${ico('search', 18)}<input id="gs" data-f="${sp}" data-render="1" value="${esc(get(S, sp) || '')}" placeholder="${sph}" aria-label="${sph}" autocomplete="off"><kbd class="hide-m" style="font-family:inherit;font-size:11px;color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:1px 6px">/</kbd></label>
      ${gs.length ? `<div class="pop">${gs.map((x) => `<a class="opt" href="${x[2]}" data-act="clearGs" style="display:flex;gap:12px;min-height:48px;padding:8px 14px;border-bottom:1px solid var(--line2);align-items:center">${badge(x[0])}<span>${esc(x[1])}</span></a>`).join('')}</div>` : ''}</div>
      <div class="grow"></div>
      ${newItems.length ? `<div style="position:relative" data-popwrap="1"><button type="button" class="btn sm" data-act="newMenu" aria-label="Create new">${ico('plus', 16)}<span class="hide-m">New</span></button>
      ${S.newMenuOpen ? `<div class="pop" style="left:auto;right:0;width:220px">${newItems.map((x) => `<button type="button" data-act="${x[1].startsWith('modal:') ? 'openModal' : x[1]}" data-m="${x[1].replace('modal:', '')}">${esc(x[0])}</button>`).join('')}</div>` : ''}</div>` : ''}
      <button type="button" class="btn sec sm" data-act="openModal" data-m="notif" aria-label="Notifications" style="width:40px;padding:0;position:relative">${ico('bell', 18)}<span style="position:absolute;top:6px;right:6px;width:8px;height:8px;border-radius:4px;background:var(--err)"></span></button>
      <div class="av hide-m" title="${esc(me.name)} · ${esc(me.role)}">${initials(me.name)}</div>
    </header>
    <main class="content">${back}${body}</main>
  </div><nav class="bnav" aria-label="Quick navigation">${bn.map((n) => `<a href="#/${n[0]}" class="${on === n[0] ? 'on' : ''}">${ico(n[2], 22)}${n[1]}</a>`).join('')}<button type="button" data-act="navToggle" aria-label="More">${ico('menu', 22)}More</button></nav></div>${modalHtml()}${S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : ''}`;
}
// 'Not available' screen shown when the role has no access to a module.
const noAccess = (what) => page('Not available', '', '', card(`<div style="padding:24px 8px;display:flex;flex-direction:column;gap:10px;align-items:flex-start"><h2>${esc(what || 'This area')} is not available</h2>${btn('Go to dashboard', { href: '#/dashboard' })}</div>`));
/* ------------------------------------------------------------ documents: store, panel, hub */
// Document categories offered for each record type (property, project, prospect, lead, deal...).
const DOC_CATS = {
  prop: ['Sale deed / Title deed', 'Ownership proof', 'Property tax receipt', 'Owner ID proof', 'Encumbrance certificate', 'Society NOC / share certificate', 'RERA certificate', 'Occupancy certificate', 'Khata / Mutation', 'Electricity / water bill', 'Floor plan / layout', 'Brochure', 'Agreement', 'Photos', 'Other'],
  proj: ['RERA certificate', 'Approved plan', 'Commencement certificate', 'Occupancy certificate', 'Price list', 'Payment plan', 'Other'],
  pros: ['PAN card', 'Address proof', 'Passport-size photo', 'Passport', 'OCI / visa', 'Income proof', 'Bank statement', 'Loan pre-approval', 'Power of attorney', 'Owner ID proof', 'Ownership proof', 'Other'],
  lead: ['ID proof', 'Enquiry attachment', 'Other'],
  deal: ['Token receipt', 'Agreement to sell', 'Sale deed', 'Rent agreement', 'Registration receipt', 'Loan sanction letter', 'NOC (society / builder)', 'Society NOC', 'KYC — buyer', 'KYC — owner', 'KYC — tenant', 'KYC — landlord', 'Security deposit receipt', 'Police verification', 'Property tax receipt', 'Payment proof', 'Legal / title opinion', 'Other'],
  brok: ['Invoice', 'Payment proof / receipt', 'Referral agreement', 'Other'],
  visit: ['Site photos', 'Visit notes', 'Feedback form', 'Other'],
  req: ['Attachment', 'Reference listing', 'Other']
};
// Privacy hints shown above each documents panel.
const DOC_NOTE = { prop: 'Owner ID and title papers stay private. Only files ticked “Shareable” can go out to prospects.', proj: 'Tick “Shareable” for files you are happy to send with the project.', pros: 'KYC is private — visible only to you and admins.', lead: 'Private to you.', deal: 'Visible on the deal. Tick “Share with parties” for files the other side may see.', brok: 'Invoices and payment proofs for this deal.', visit: 'Photos and notes from the visit.', req: 'Reference material for this requirement.' };
// Display name of each document scope type.
const TYPE_LABEL = { prop: 'Property', proj: 'Project', pros: 'Prospect', lead: 'Lead', deal: 'Deal', brok: 'Brokerage', visit: 'Visit', req: 'Requirement' };
// 'prop:RS001' -> 'prop'.
const scopeType = (s) => s.split(':')[0];
// 'prop:RS001' -> 'RS001'.
const scopeId = (s) => s.slice(s.indexOf(':') + 1);
// The list of document records stored under a scope.
const filesOf = (s) => S.files[s] || (S.files[s] = []);
// Bytes -> '1.2 MB' / '340 KB'.
const fmtSize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
// Allowed upload file extensions.
const okType = /\.(pdf|jpe?g|jfif|jpe|png|webp|heic|heif|gif|bmp|avif|tiff?|docx?|xlsx?|csv|txt)$/i;
// Is this document an image (so a thumbnail can be shown)?
const isImg = (f) => /^image\//.test(f.type || '') || /\.(jpe?g|jfif|jpe|png|webp|heic|heif|gif|bmp|avif|tiff?)$/i.test(f.name);
// Photos of a property/project: cover = the first one that has a picture to show.
const photosOf = (scope) => filesOf(scope).filter((f) => f.cat === 'Photos' && isImg(f));
const coverBox = (scope, h, w, empty) => { const c = photosOf(scope).find((f) => f.thumb || f.url); const n = photosOf(scope).length; if (!c) return `<div class="noimg" style="${w ? 'width:' + w + 'px;flex:none;' : ''}height:${h}px">${ico('img', 28)}<span>No image</span></div>`; return `<div class="noimg has" style="${w ? 'width:' + w + 'px;flex:none;' : ''}height:${h}px">${c ? `<img src="${c.thumb || c.url}" alt="Cover photo" onerror="this.parentNode.classList.remove('has');this.outerHTML='<span>No image</span>'" style="width:100%;height:100%;object-fit:cover">${n > 1 ? `<span class="badge" style="position:absolute;right:8px;bottom:8px">${n} photos</span>` : ''}` : ico('img', 20) + (n ? n + ' photo' + (n === 1 ? '' : 's') + ' (loading…)' : empty)}</div>`; };
// Can documents of this scope type be shared externally?
const canShare = (t) => ['prop', 'proj', 'deal'].includes(t);
// Wording of the 'share' tick box for a scope type.
const shareLabel = (t) => (t === 'deal' ? 'Share with parties' : 'Shareable with prospects');
// Whether a new document starts as shareable (e.g. brochures yes, title papers no).
const defaultShare = (t, cat) => (t === 'prop' && ['Floor plan / layout', 'Brochure', 'Property tax receipt', 'Photos'].includes(cat)) || (t === 'proj' && ['Brochure', 'Price list', 'Payment plan', 'Approved plan'].includes(cat));
// Which party (buyer/tenant/owner...) a deal document category belongs to.
function dealSide(cat) { if (['KYC — buyer', 'KYC — tenant', 'Loan sanction letter', 'Token receipt', 'Security deposit receipt', 'Police verification'].includes(cat)) return 'buyer'; if (['KYC — owner', 'KYC — landlord', 'NOC (society / builder)', 'Society NOC', 'Property tax receipt'].includes(cat)) return 'seller'; return 'common'; }
// Badge showing 'expires in N days' / 'expired' for dated documents.
function expiryBadge(v) { if (!v) return ''; const n = daysBetween(iso(today), v); return n < 0 ? badge('Expired ' + (-n) + ' days ago', 'err') : n <= 30 ? badge('Expires in ' + n + ' days', 'warn') : badge('Valid till ' + dayLbl(parseISO(v))); }
// Badge for a document's verification status.
const docStatusBadge = (s) => badge(s, s === 'Verified' ? 'ok' : s === 'Needs replacement' ? 'err' : 'warn');
// Icon for a file (image or generic).
const fileIcon = (f) => ico(isImg(f) ? 'img' : 'file', 22);
// Create a sample file record (used for seed defaults).
function sf(id, name, cat, size, st, o?) { return Object.assign({ id, name, cat, size, type: name.endsWith('.jpg') ? 'image/jpeg' : 'application/pdf', st, share: false, valid: '', by: 'Anil Sharma', at: '2026-09-18', thumb: null, url: null, sample: true }, o || {}); }
S.files = {
  'prop:RS001': [sf('sd1', 'Sale_deed_RS001.pdf', 'Sale deed / Title deed', 2516582, 'Verified'), sf('sd2', 'Property_tax_2025-26.pdf', 'Property tax receipt', 317440, 'Verified', { share: true }), sf('sd3', 'Owner_PAN_SGhosh.jpg', 'Owner ID proof', 184320, 'Verified'), sf('sd4', 'Floor_plan_3BHK.pdf', 'Floor plan / layout', 1153434, 'Uploaded', { share: true }), sf('sd5', 'Society_NOC.pdf', 'Society NOC / share certificate', 402653, 'Uploaded', { valid: '2026-10-15' })],
  'prop:RS002': [sf('sd6', 'Ideal_Grandeur_brochure.pdf', 'Brochure', 3355443, 'Verified', { share: true }), sf('sd7', 'Tax_receipt_RS002.pdf', 'Property tax receipt', 290816, 'Uploaded', { share: true })],
  'prop:RR001': [sf('sd8', 'Ownership_proof_KBasu.pdf', 'Ownership proof', 921600, 'Verified'), sf('sd9', 'Owner_Aadhaar_masked.jpg', 'Owner ID proof', 201728, 'Verified'), sf('sd10', 'CESC_bill_Aug.pdf', 'Electricity / water bill', 131072, 'Uploaded')],
  'proj:p1': [sf('sd11', 'RERA_WBRERA_P_KOL_2024_000123.pdf', 'RERA certificate', 655360, 'Verified'), sf('sd13', 'Sanctioned_plan.pdf', 'Approved plan', 2097152, 'Uploaded', { share: true })],
  'pros:c1': [sf('sd14', 'PAN_Priya_Nair.pdf', 'PAN card', 204800, 'Verified'), sf('sd15', 'Aadhaar_masked_Priya.pdf', 'Address proof', 262144, 'Verified'), sf('sd16', 'Photo_Priya.jpg', 'Passport-size photo', 98304, 'Uploaded')],
  'pros:c2': [sf('sd17', 'PAN_Sunita.pdf', 'PAN card', 190464, 'Verified'), sf('sd18', 'Passport_scan_Sunita.pdf', 'Passport', 1310720, 'Uploaded', { valid: '2026-11-05' }), sf('sd19', 'OCI_card_Sunita.pdf', 'OCI / visa', 843776, 'Uploaded', { valid: '2026-10-20' })],
  'deal:DEAL-0142': [sf('sd20', 'Token_receipt_0142.pdf', 'Token receipt', 245760, 'Verified', { at: '2026-09-02' }), sf('sd21', 'Agreement_to_sell_signed.pdf', 'Agreement to sell', 1887436, 'Uploaded', { at: '2026-09-10' }), sf('sd22', 'HDFC_sanction_letter.pdf', 'Loan sanction letter', 512000, 'Verified', { at: '2026-09-22' }), sf('sd23', 'KYC_buyer_Priya.pdf', 'KYC — buyer', 468992, 'Verified', { at: '2026-09-02' })],
  'brok:DEAL-0139': [sf('sd24', 'INV-2026-0139-B.pdf', 'Invoice', 148480, 'Verified', { at: '2026-09-10' })],
  'visit:VIS-3370': [sf('sd25', 'Site_photos_balcony.jpg', 'Site photos', 2202009, 'Uploaded', { at: '2026-09-25' })]
};
S.d.shareSel = {};
// Find a document by scope and id.
function fileById(scope, fid) { return filesOf(scope).find((f) => f.id === fid); }
// Checklist of documents a record needs (depends on type/kind/stage).
function requiredDocs(scope) {
  const t = scopeType(scope); const id = scopeId(scope);
  if (t === 'prop') { const p = id === '__draft' ? { purpose: S.d.property.purpose, projectId: S.d.property.projectId } : propById(id); if (!p) return []; const pr = p.projectId ? projById(p.projectId) : null; const b = p.purpose === 'sale' ? ['Sale deed / Title deed', 'Property tax receipt', 'Owner ID proof', 'Encumbrance certificate', 'Society NOC / share certificate'] : ['Ownership proof', 'Owner ID proof', 'Electricity / water bill', 'Society NOC / share certificate']; if (pr && pr.status !== 'ready' && p.purpose === 'sale') b.push('RERA certificate'); return b; }
  if (t === 'proj') { const pr = id === '__draft' ? S.d.project : projById(id); const b = ['RERA certificate', 'Approved plan']; if (pr && pr.status === 'ready') b.push('Occupancy certificate'); return b; }
  if (t === 'pros') { const c = prosById(id); if (!c) return []; if (c.type === 'Owner') return ['Owner ID proof', 'Ownership proof']; const b = ['PAN card', 'Address proof', 'Passport-size photo']; if (c.nri) b.push('Passport', 'OCI / visa'); return b; }
  if (t === 'brok') return ['Invoice', 'Payment proof / receipt'];
  return [];
}
// Has a usable document of this category already been uploaded?
const haveDoc = (scope, c) => filesOf(scope).some((f) => f.cat === c && f.st !== 'Needs replacement');
// Record summary (title/owner) shown at the top of a documents panel.
function recInfo(scope) {
  const t = scopeType(scope); const id = scopeId(scope);
  if (t === 'prop') { const p = propById(id); return p ? { label: propLabel(p), href: '#/properties/' + id } : null; }
  if (t === 'proj') { const p = projById(id); return p ? { label: p.name, href: '#/projects/' + id } : null; }
  if (t === 'pros') { const p = prosById(id); return p ? { label: p.name, href: '#/prospects/' + id } : null; }
  if (t === 'lead') { const p = S.leads.find((x) => x.id === id); return p ? { label: p.name, href: '#/leads/' + id } : null; }
  if (t === 'deal') { const d = S.deals.find((x) => x.id === id); return d ? { label: id + ' · ' + prosById(d.cid).name, href: '#/deals/' + id } : null; }
  if (t === 'brok') { const d = S.deals.find((x) => x.id === id); return d ? { label: id + ' · brokerage', href: '#/brokerage/' + id } : null; }
  if (t === 'visit') { const v = S.visits.find((x) => x.id === id); return v ? { label: id + ' · ' + prosById(v.cid).name, href: '#/visits/' + id } : null; }
  if (t === 'req') { const r = S.reqs.find((x) => x.id === id); return r ? { label: id + ' · ' + prosById(r.cid).name, href: '#/requirements/' + id } : null; }
  return null;
}
// Dropdown options for the 'related record' when uploading.
function recOptions(type) {
  return { prop: S.props.map((p) => [p.id, propLabel(p)]), proj: S.projects.map((p) => [p.id, p.name]), pros: S.prospects.map((p) => [p.id, p.name]), lead: S.leads.map((p) => [p.id, p.name]), deal: S.deals.map((d) => [d.id, d.id + ' · ' + prosById(d.cid).name]), brok: S.brok.map((b) => [b.deal, b.deal]) }[type] || [];
}
// Handle chosen/dropped files: validate type & size, create records, upload to the API.
function addFiles(scope, list, cat, el) {
  const arr = filesOf(scope); const t = scopeType(scope); let ok = 0; const bad = [];
  (Array.from(list || []) as File[]).forEach((f) => {
    if (f.size > 10 * 1048576) { bad.push(f.name + ' is over 10 MB'); return; }
    if (!okType.test(f.name)) { bad.push(f.name + ' — file type not supported'); return; }
    if (arr.some((x) => x.name === f.name && x.size === f.size)) { bad.push(f.name + ' is already uploaded'); return; }
    const c = cat || 'Other';
    const rec = { id: 'f' + Date.now() + Math.random().toString(36).slice(2, 6), name: f.name, size: f.size, type: f.type || '', cat: c, st: 'Uploaded', share: defaultShare(t, c), valid: '', by: 'Anil Sharma', at: iso(today), thumb: null, url: null, sample: false };
    try { if (typeof URL !== 'undefined' && URL.createObjectURL) rec.url = URL.createObjectURL(f); } catch (e) { }
    arr.push(rec); ok++; try { ADAPTER.upload(rec, f, scope); } catch (e) { }
    if (isImg(rec) && f.size < 3 * 1048576 && typeof FileReader !== 'undefined') { const r = new FileReader(); r.onload = () => { rec.thumb = r.result; render(); }; r.readAsDataURL(f); }
    if (t === 'deal') { const d = S.deals.find((x) => x.id === scopeId(scope)); if (d) { const row = d.docs.find((x) => x.name === c); if (row) { row.fid = row.fid || rec.id; if (['Pending', 'Requested'].includes(row.st)) row.st = 'Received'; row.rec = iso(today); } dlog(d, 'Uploaded ' + c + ': ' + f.name); } }
  });
  if (bad.length && ok) toast(ok + ' uploaded · skipped: ' + bad.join('; ')); else if (bad.length) toast(bad.join('; ')); else if (ok) toast(ok + (cat === 'Photos' ? ' photo' : ' document') + (ok > 1 ? 's' : '') + ' uploaded'); else render();
}

// Document categories that carry an expiry date.
const EXPIRY_CATS = ['Society NOC / share certificate', 'Passport', 'OCI / visa', 'Rent agreement', 'Police verification', 'Occupancy certificate', 'Loan sanction letter'];
// Group documents of a scope by category for display.
function docGroups(scope) {
  const t = scopeType(scope); const id = scopeId(scope);
  if (t === 'prop') return [{ t: 'Ownership & legal', c: ['Sale deed / Title deed', 'Ownership proof', 'Encumbrance certificate', 'Khata / Mutation', 'Owner ID proof'] }, { t: 'Tax, bills & approvals', c: ['Property tax receipt', 'Electricity / water bill', 'Society NOC / share certificate', 'RERA certificate', 'Occupancy certificate'] }, { t: 'Marketing material', c: ['Floor plan / layout', 'Brochure', 'Photos'] }, { t: 'Other', c: ['Agreement', 'Other'] }];
  if (t === 'proj') return [{ t: 'Legal & approvals', c: ['RERA certificate', 'Approved plan', 'Commencement certificate', 'Occupancy certificate'] }, { t: 'Sales material', c: ['Price list', 'Payment plan'] }, { t: 'Other', c: ['Other'] }];
  if (t === 'pros') { const c = id === '__draft' ? null : prosById(id); if (c && c.type === 'Owner') return [{ t: 'Ownership', c: ['Owner ID proof', 'Ownership proof'] }, { t: 'Other', c: ['Other'] }]; const g = [{ t: 'Identity & address', c: ['PAN card', 'Address proof', 'Passport-size photo'] }]; if (c && c.nri) g.push({ t: 'NRI documents', c: ['Passport', 'OCI / visa', 'Power of attorney'] }); g.push({ t: 'Finance (optional)', c: ['Income proof', 'Bank statement', 'Loan pre-approval'] }, { t: 'Other', c: ['Other'] }); return g; }
  if (t === 'deal') { const d = S.deals.find((x) => x.id === id); if (!d) return []; const names = d.docs.map((x) => x.name); const side = (k) => names.filter((n) => dealSide(n) === k); const sale = d.kind === 'sale'; return [{ t: (sale ? 'Buyer' : 'Tenant') + ' documents', c: side('buyer') }, { t: (sale ? 'Seller / owner' : 'Landlord') + ' documents', c: side('seller') }, { t: 'Deal papers', c: side('common').concat(['Payment proof', 'Legal / title opinion', 'Other'].filter((x) => !names.includes(x))) }].filter((g) => g.c.length); }
  if (t === 'brok') return [{ t: 'Invoices', c: ['Invoice'] }, { t: 'Payments', c: ['Payment proof / receipt'] }, { t: 'Agreements & other', c: ['Referral agreement', 'Other'] }];
  if (t === 'visit') return [{ t: 'Photos & notes', c: ['Site photos', 'Visit notes', 'Feedback form', 'Other'] }];
  if (t === 'req') return [{ t: 'Attachments', c: ['Attachment', 'Reference listing', 'Other'] }];
  if (t === 'lead') return [{ t: 'ID & attachments', c: ['ID proof', 'Enquiry attachment', 'Other'] }];
  return [{ t: 'Documents', c: ['Other'] }];
}
// One checklist row (category slot) in the deal document vault.
function slotRow(scope, cat, known) {
  const t = scopeType(scope); const fs = filesOf(scope);
  const idx = fs.map((f, i) => i).filter((i) => (cat === 'Other' ? (fs[i].cat === 'Other' || !known.includes(fs[i].cat)) : fs[i].cat === cat));
  const files = idx.map((i) => fs[i]);
  const d = t === 'deal' ? S.deals.find((x) => x.id === scopeId(scope)) : null; const row = d ? d.docs.find((x) => x.name === cat) : null;
  const req = requiredDocs(scope).includes(cat); const na = row && row.st === 'Not applicable';
  const allVer = files.length ? files.every((f) => f.st === 'Verified') : !!(row && row.st === 'Verified');
  let status;
  if (na) status = badge('Not applicable');
  else if (files.some((f) => f.st === 'Needs replacement')) status = badge('Needs replacement', 'err');
  else if (files.length || (row && ['Received', 'Verified'].includes(row.st))) status = allVer ? badge('Verified', 'ok') : badge('To verify', 'warn');
  else if (row && row.st === 'Requested') status = badge('Requested', 'blue');
  else status = req || row ? badge('Missing', 'err') : badge('Optional');
  const chips = files.map((f, k) => `<span class="fchip">${t === 'deal' ? selBox(f) : ''}<button type="button" class="fname" data-act="docPreview" data-scope="${scope}" data-i="${idx[k]}" title="Preview">${f.thumb ? `<img src="${f.thumb}" alt="" onerror="this.style.display='none'" style="width:20px;height:20px;border-radius:4px;object-fit:cover">` : fileIcon(f).replace('width="22" height="22"', 'width="16" height="16"')}<span>${esc(f.name)}</span><span class="sub" style="font-size:11px">${fmtSize(f.size)}</span></button><button type="button" class="fx" aria-label="Remove ${esc(f.name)}" data-act="docDel" data-scope="${scope}" data-i="${idx[k]}">×</button></span>`).join('');
  const expiry = EXPIRY_CATS.includes(cat) && files.length ? `<label class="sub" style="font-size:12px;display:flex;align-items:center;gap:6px">Valid till<span class="inp" style="height:32px;width:150px"><input type="date" data-f="files.${scope}.${idx[0]}.valid" data-render="1" value="${esc(files[0].valid)}" style="padding:0 8px;font-size:13px"></span></label>${expiryBadge(files[0].valid)}` : '';
  const shareT = canShare(t) && files.length ? chk(files.every((f) => f.share), shareLabel(t), `data-act="slotShare" data-scope="${scope}" data-cat="${esc(cat)}"`) : '';
  const btns = na ? btn('Undo', { k: 'sec sm', a: `data-act="rowNA" data-scope="${scope}" data-cat="${esc(cat)}"` }) : `<label class="btn ${files.length ? 'sec' : 'ghost'} sm" style="cursor:pointer">${ico('upload', 16)}${files.length ? 'Add more' : 'Upload'}<input type="file" multiple hidden data-upload="${scope}" data-cat="${esc(cat)}" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.csv,.txt"></label>${(files.length || (row && row.st === 'Received')) ? btn(allVer ? 'Unverify' : 'Verify', { k: 'sec sm', a: `data-act="slotVerify" data-scope="${scope}" data-cat="${esc(cat)}"` }) : ''}${row && !files.length && !['Received', 'Verified'].includes(row.st) ? btn('N/A', { k: 'sec sm', a: `data-act="rowNA" data-scope="${scope}" data-cat="${esc(cat)}"` }) : ''}`;
  return `<div class="slot" data-drop="${scope}" data-cat="${esc(cat)}"><div class="slot-h"><div class="grow" style="min-width:180px"><b>${esc(cat)}</b>${req ? ' <span class="req" title="Required">•</span>' : ''}</div>${status}${btns}</div>${chips || expiry || shareT ? `<div class="slot-b">${chips}${expiry}${shareT}</div>` : ''}</div>`;
}
// Currently selected upload category for a scope.
const catFor = (scope) => get(S, 'd.docCat.' + scope) || (DOC_CATS[scopeType(scope)] || ['Other'])[0];
// Selection checkbox of a document row.
const selBox = (f) => `<button type="button" class="fx" style="border-left:none;border-right:1px solid var(--line);padding:0 8px" data-act="dsel" data-fid="${f.id}" aria-label="Select ${esc(f.name)}"><span class="cb${S.d.dsel[f.id] ? ' on' : ''}" style="width:18px;height:18px">${S.d.dsel[f.id] ? ico('check', 12) : ''}</span></button>`;
// Documents panel for a scope: simple list for most records, vault for deals.
function docPanel(scope, _opts?) { return scopeType(scope) === 'deal' ? docVault(scope) : docSimple(scope); }
// Simple documents panel (upload + list).
function docSimple(scope) {
  const t = scopeType(scope); const cats = DOC_CATS[t] || ['Other']; const key = 'd.docCat.' + scope; let cur = get(S, key); if (!cats.includes(cur)) { cur = cats[0]; setp(S, key, cur); }
  const fs = filesOf(scope); const req = requiredDocs(scope); const miss = req.filter((c) => !haveDoc(scope, c));
  const rows = fs.map((f, i) => ({ f, i })).reverse();
  const list = rows.map(({ f, i }) => `<div class="li" style="padding:10px 4px;min-height:56px"><button type="button" class="docthumb" data-act="docPreview" data-scope="${scope}" data-i="${i}" aria-label="Preview ${esc(f.name)}">${f.thumb ? `<img src="${f.thumb}" alt="" onerror="this.style.display='none'" style="width:100%;height:100%;object-fit:cover">` : fileIcon(f)}</button><div class="grow" style="min-width:150px"><b style="font-size:14px;word-break:break-word">${esc(f.name)}</b><div class="sub" style="font-size:12px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">${badge(f.cat)}<span>${fmtSize(f.size)} · ${esc(dayLbl(parseISO(f.at)))}</span>${EXPIRY_CATS.includes(f.cat) ? `<label style="display:inline-flex;align-items:center;gap:6px">Valid till<span class="inp" style="height:30px;width:140px"><input type="date" data-f="files.${scope}.${i}.valid" data-render="1" value="${esc(f.valid)}" style="padding:0 6px;font-size:12px"></span></label>${expiryBadge(f.valid)}` : ''}</div></div>${docStatusBadge(f.st)}${canShare(t) ? chk(f.share, shareLabel(t), `data-act="docShareTog" data-scope="${scope}" data-i="${i}"`) : ''}${f.st !== 'Verified' ? btn('Verify', { k: 'sec sm', a: `data-act="docVerify" data-scope="${scope}" data-i="${i}"` }) : ''}<button type="button" class="btn sec sm" data-act="docDel" data-scope="${scope}" data-i="${i}" aria-label="Remove ${esc(f.name)}">Remove</button></div>`).join('');
  return `<div style="display:flex;flex-direction:column;gap:12px" data-drop="${scope}"><div class="head"><h2>Documents</h2>${badge(fs.length + ' file' + (fs.length === 1 ? '' : 's'))}<div class="grow"></div></div><div class="sub" style="font-size:12px;margin-top:-6px">${DOC_NOTE[t]}</div>
  <div class="row" style="align-items:flex-end;gap:10px">${fld('Document type', key, { opts: cats, rer: 1, style: 'flex:2;min-width:220px' })}<div style="flex:1;min-width:160px;display:flex;gap:8px"><label class="btn ${fs.length ? 'sec' : ''}" style="cursor:pointer;flex:1">${ico('upload', 16)}${fs.length ? 'Add more' : 'Choose files'}<input type="file" multiple hidden data-upload="${scope}" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.csv,.txt"></label></div></div>
  <div class="sub" style="font-size:12px;margin-top:-4px">Pick the type, then choose one or more files — or drop files here. Change the type and add more whenever you need.</div>
  ${miss.length ? `<div class="chips" style="gap:6px;align-items:center"><span class="sub" style="font-size:12px">Still needed:</span>${miss.map((c) => `<button type="button" class="badge warn" style="cursor:pointer" data-act="setf" data-p="${key}" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : req.length ? `<div class="note ok">${ico('check', 18)}<div>All the usual papers for this record are on file.</div></div>` : ''}
  ${fs.length ? `<div class="list" style="border:1px solid var(--line);border-radius:10px;padding:0 10px">${list}</div>` : '<div class="sub" style="padding:8px 0">No documents yet. Everything here is optional — add what you have.</div>'}</div>`;
}
// Deal document vault: required-documents checklist, party requests and uploads.
function docVault(scope) {
  const id = scopeId(scope); const d = S.deals.find((x) => x.id === id); if (!d) return '';
  const i = S.deals.indexOf(d); const groups = docGroups(scope); const known = groups.flatMap((g) => g.c);
  // Document search text, and which documents belong to the scope.
  const q = (S.d.docq || '').trim().toLowerCase(); const fsAll = filesOf(scope);
  // A category matches when the search is empty, matches its name, or matches one of its files.
  const matchCat = (c) => !q || c.toLowerCase().includes(q) || fsAll.some((f) => (f.cat === c || (c === 'Other' && !known.includes(f.cat))) && f.name.toLowerCase().includes(q));
  const dp = docsProgress(d);
  const sections = groups.map((g) => { const cs = g.c.filter(matchCat); if (!cs.length) return ''; const up = cs.filter((c) => { const has = fsAll.some((f) => (c === 'Other' ? (f.cat === 'Other' || !known.includes(f.cat)) : f.cat === c)); const row = d.docs.find((x) => x.name === c); return has || (row && ['Received', 'Verified'].includes(row.st)); }).length; return `<div class="dgroup"><div class="head" style="padding:10px 14px;background:var(--bg);border-bottom:1px solid var(--line)"><b style="font-size:14px">${esc(g.t)}</b><div class="grow"></div><span class="sub" style="font-size:12px">${up} of ${cs.length} uploaded</span></div>${cs.map((c) => slotRow(scope, c, known)).join('')}</div>`; }).join('');
  const sel = Object.keys(S.d.dsel).filter((fid) => S.d.dsel[fid] && fsAll.some((f) => f.id === fid));
  // Requirements newest first (copy the array so the original order is untouched).
  const reqs = (d.reqs || []).slice().reverse();
  return `<div style="display:flex;flex-direction:column;gap:14px"><div class="head"><h2>Document vault</h2>${badge(fsAll.length + ' file' + (fsAll.length === 1 ? '' : 's'))}<div class="grow"></div>${btn('Request documents', { k: 'ghost', i: 'upload', a: `data-act="docRequest" data-i="${i}"` })}${btn('Share selected' + (sel.length ? ' (' + sel.length + ')' : ''), { i: 'chat', a: `data-act="dealShare" data-i="${i}"`, c: sel.length ? '' : '' })}</div>
  <div class="sub" style="font-size:12px;margin-top:-8px">Every paper for this deal, in one searchable place. All documents are optional — mark a row N/A if it does not apply. Tick files to share them with the parties by WhatsApp or email.</div>
  <div class="head"><label class="search" style="max-width:360px;flex:1">${ico('search', 18)}<input id="docq" data-f="d.docq" data-render="1" value="${esc(S.d.docq)}" placeholder="Search documents or file names" aria-label="Search documents" autocomplete="off"></label>${btn(sel.length ? 'Clear selection' : 'Select all files', { k: 'sec sm', a: 'data-act="dselAll" data-scope="' + scope + '"' })}<div class="grow"></div><div style="display:flex;align-items:center;gap:10px;min-width:200px">${bar(dp.pct, dp.pct === 100 ? 'var(--ok)' : 'var(--p)')}<span class="sub" style="font-size:12px;white-space:nowrap">${dp.done} of ${dp.total} on file</span></div></div>
  ${sections || `<div class="sub" style="padding:16px 0">No document matches “${esc(S.d.docq)}”.</div>`}
  <div class="head"><div class="inp grow" style="max-width:300px"><input id="f_d_doc" data-f="d.doc" value="${esc(S.d.doc)}" placeholder="Add another document, e.g. Power of attorney"></div>${btn('Add', { k: 'ghost', a: `data-act="docAdd" data-i="${i}"` })}</div>
  ${reqs.length ? `<div class="card" style="background:var(--bg);gap:8px"><b>Document requests sent</b>${reqs.map((r) => `<div class="head" style="min-height:34px"><span class="grow" style="font-size:13px">${esc(r.party)} · ${esc(r.docs.join(', '))}</span>${badge(r.status, r.status === 'Received' ? 'ok' : 'blue')}<button type="button" class="btn ghost sm" data-act="copyReqLink" data-t="${esc(r.token)}" data-i="${i}">Copy link</button><a class="btn sec sm" href="#/upload/${d.id}/${esc(r.token)}">Open as party</a></div>`).join('')}</div>` : ''}
  ${(d.shares || []).length ? `<div class="sub" style="font-size:12px">Last shared: ${esc(d.shares[d.shares.length - 1].files)} → ${esc(d.shares[d.shares.length - 1].to)} via ${esc(d.shares[d.shares.length - 1].via)}</div>` : ''}</div>`;
}
/* ------------------------------------------------------------ drafts */
/* Blank 'new record' drafts for the forms. */
// Blank project draft for the add-project form.
const newProject = () => ({ name: '', dev: '', type: 'Residential Complex', rera: '', status: 'uc', cm: '', cy: '', complete: '', size: '', sizeUnit: '', towers: '', units: '', configs: [], sale: true, rent: true, saleFrom: '', saleTo: '', rentFrom: '', rentTo: '', place: null, addr: { tower: '', street: '', landmark: '', pin: '', city: 'Kolkata', state: 'West Bengal' }, amenities: [], customAmen: [], brochure: '', photoList: [], layouts: [], charges: [], chargeArea: '1450', ai: null });
// Blank property draft for the add-property form.
const newProperty = () => ({ purpose: 'sale', cat: 'Residential', sub: 'Flat / Apartment', projectId: null, src: { owner: true, broker: false, portal: false }, owner: { name: '', mobile: '', waSame: true, wa: '', email: '' }, broker: { name: '', company: '', phone: '', waSame: true, wa: '', email: '', groups: [], gNew: '' }, portal: { name: '99acres', pid: '', url: '', by: '' }, ref: '', addr: { tower: '', street: '', landmark: '', pin: '', city: 'Kolkata', state: 'West Bengal', flat: '' }, place: null, bhk: 3, baths: '2', carpet: '', sbu: '', extras: { balcony: false, utility: false, terrace: false, helper: false }, extraArea: '', buRatio: '', sbuRatio: '', facing: 'East', openSides: [], overlook: [], features: [], fNew: '', furn: 'Semi-furnished', cYear: '', cMonth: '', floor: '', totalFloors: '', price: '', quoted: '', maint: '', parkCost: '', brokerage: '', rent: '', deposit: '', charges: [], pstatus: 'Ready for Possession', cm: '', cy: '', pcount: 1, ptype: 'Covered', photoList: [], olNew: '', washrooms: '', seats: '', frontage: '', ceilHt: '', docks: '', powerKva: '', plotL: '', plotW: '', road: '', wall: 'Yes', corner: false, landUse: 'Residential', plotArea: '', balconies: '', lift: 'Yes', availFrom: '', tenants: [], lockin: '', negotiable: false, tenure: 'Freehold', gstOn: false });
// Blank prospect draft.
const newProspect = () => ({ name: '', phone: '', waSame: true, wa: '', alt: '', email: '', type: 'Buyer', city: 'Kolkata', source: '99acres', lang: 'English', nri: false, contact: 'Call', assigned: 'Anil Sharma', notes: '', link: '', country: '', tz: 'GMT+4 · Gulf', bestTime: '', refBy: '', enqId: '' });
// Blank lead draft.
const newLead = () => ({ name: '', phone: '', waSame: true, wa: '', source: 'Direct Reference', portal: '99acres', intent: 'buy', ptype: 'Apartment / Flat', bhk: 3, csub: 'Office', refBy: '', want: '', locality: '', bmin: '', bmax: '', assigned: 'Anil Sharma', notes: '', link: '' });
// Blank requirement draft.
const newReq = () => ({ cid: 'c1', purpose: 'sale', type: 'Apartment / Flat', csub: 'Office', locs: ['Salt Lake'], min: '', max: '', bhk: 3, areaType: 'Super built-up', amin: '', amax: '', parking: 'Not needed', lift: 'Yes', floor: 'Any', timeline: 'Immediate', fin: 'Cash', possession: 'Any', furn: 'Any', tenant: 'Any', lease: 'Any', pface: 'Any', road: '', wall: 'Any', use: '', pri: 'Normal', src: 'Direct', by: '', notes: '', locNew: '' });
// Blank deal draft.
const newDeal = () => ({ cid: 'c1', prop: 'RS001', kind: 'sale', ask: '', bid: '', close: '', opened: iso(today), expected: iso(addDays(today, 30)), leaseStart: iso(addDays(today, 7)), tenure: 11, leaseEnd: leaseEndOf(iso(addDays(today, 7)), 11), depMonths: 2, bType: '%', bBuyer: '1', bOwner: '1', openedBy: (S.team.find((t) => t.name === S.me) || S.team[0]).name, closedBy: (S.team.find((t) => t.name === S.me) || S.team[0]).name, notes: '' });
// Blank follow-up draft.
const newFu = () => ({ who: 'Priya Nair', kind: 'Call', when: 'today', p: 'sale', pri: 'Normal', note: '' });
// Blank visit draft.
const newVisit = () => ({ cid: 'c1', props: ['RS001'], date: iso(addDays(today, 1)), time: '10:30', remind: 'WhatsApp', pin: true });
Object.assign(S.d, { project: newProject(), property: newProperty(), prospect: newProspect(), lead: newLead(), req: newReq(), deal: newDeal(), fu: newFu(), visit: newVisit(), note: '', pay: { amt: '', mode: 'UPI', from: 'buyer' }, lost: { reason: 'Price gap', note: '', ret: true, react: true }, sold: { price: '', date: '' }, outcome: { v: 'Interested', why: ['Loved location'], note: '' }, resched: { date: iso(addDays(today, 2)), time: '15:00' }, invite: { phone: '', role: 'Agent' }, task: { t: '', due: '' }, offer: { by: 'buyer', amt: '', terms: '' }, doc: '', ded: { name: '', amt: '' }, split: { name: '', pct: '' }, waive: { reason: '' }, party: { role: 'Lawyer', name: '', phone: '' } });

/* ------------------------------------------------------------ auth */
/* ------------------------------------------------------------ dashboard */
/* Dashboard screen. */

// Build the 'Needs your attention' list (overdue follow-ups, stale deals, expiring leases, pending approvals...).
function attentionItems() {
  const it = [];
  const od = S.fus.filter((f) => !f.done && f.due === 'overdue').length; if (od) it.push([od + ' overdue follow-up' + (od > 1 ? 's' : ''), 'err', '#/followups']);
  const st = S.deals.filter(isStale).length; if (st) it.push([st + ' stale deal' + (st > 1 ? 's' : '') + ' — no update in 7+ days', 'warn', '#/deals']);
  const bo = S.brok.filter((b) => brokState(b).st === 'Overdue').length; if (bo) it.push([bo + ' brokerage payment' + (bo > 1 ? 's' : '') + ' overdue', 'err', '#/brokerage']);
  const ex = Object.keys(S.files).flatMap((k) => S.files[k].filter((f) => f.valid && daysBetween(iso(today), f.valid) <= 30).map((f) => [k, f])); if (ex.length) { const k = ex[0][0]; const t = scopeType(k); it.push([ex.length + ' document' + (ex.length > 1 ? 's' : '') + ' expiring within 30 days', 'warn', (recInfo(k) || {}).href || '#/dashboard']); }
  const mp = S.props.filter((p) => ['Available', 'On hold'].includes(p.status)).filter((p) => requiredDocs('prop:' + p.id).some((c) => !haveDoc('prop:' + p.id, c))); if (mp.length) it.push([mp.length + ' listing' + (mp.length > 1 ? 's' : '') + ' missing required documents', 'warn', '#/properties/' + mp[0].id]);
  const md = S.deals.filter((d) => isOpen(d) && d.docs.some((x) => x.st === 'Pending')).length; if (md) it.push([md + ' open deal' + (md > 1 ? 's' : '') + ' with documents pending', 'blue', '#/deals']);
  const dr = S.props.filter((p) => p.status === 'Draft'); if (dr.length) { S.tab.propStatus = S.tab.propStatus || 'all'; it.push([dr.length + ' draft listing' + (dr.length > 1 ? 's' : '') + ' waiting to be finished', 'warn', '#/properties']); }
  const al = S.alerts.filter((a) => !a.seen).length; if (al) it.push([al + ' new matching alert' + (al > 1 ? 's' : '') + ' for new properties', 'blue', '#/dashboard']);
  return it;
}
// Dashboard screen: KPI tiles, attention list, today's visits and follow-ups, pipeline.
function dashboardView() {
  const due = S.fus.filter((f) => !f.done && (f.due === 'overdue' || f.due === 'today'));
  const vt = S.visits.filter((v) => v.date === iso(today) && v.status !== 'Cancelled').sort((a, b) => a.time.localeCompare(b.time));
  const nl = S.leads.filter((l) => l.stage === 'Lead').length;
  const nm = S.reqs.filter((r) => r.status === 'Active').reduce((a, r) => a + matchesFor(r).length, 0);
  const stages = ['Lead', 'Qualified', 'Not qualified', 'Converted'];
  const mx = Math.max(...stages.map((s) => S.leads.filter((l) => l.stage === s).length), 1);
  const top = matchesFor(S.reqs[0]).slice(0, 3);
  return page('Good morning, ' + ME().name.split(' ')[0], dayLbl(today) + ' · ' + (due.length + vt.length) + ' things need you today', btn('Add follow-up', { a: 'data-act="openModal" data-m="fu"', k: 'ghost', i: 'plus' }),
    `<div class="row">${[['Follow-ups due', due.length, S.fus.filter((f) => !f.done && f.due === 'overdue').length + ' overdue', '#/followups'], ['Visits today', vt.length, (vt.length ? 'Next at ' + fmt12(vt[0].time) : 'None today'), '#/visits'], ['New leads', nl, 'Not yet contacted', '#/leads'], ['New matches', nm, 'Across active requirements', '#/matches']].map((x) => `<a class="stat" href="${x[3]}"><span class="sub">${x[0]}</span><b>${x[1]}</b><span class="sub" style="font-size:12px">${x[2]}</span></a>`).join('')}</div>
    <div class="grid2"><div class="stack">${card(`<div class="head"><h2>Today’s schedule</h2><div class="grow"></div><a href="#/followups" style="color:var(--p);font-weight:600;font-size:14px">See all</a></div><div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${due.map((f) => `<div class="li"><div class="av">${initials(f.who)}</div><div class="grow"><b>${esc(f.who)}</b><div class="sub">${esc(f.note)}</div></div>${badge(f.kind)}<span class="sub">${esc(f.when)}</span>${btn('Done', { k: 'ghost sm', a: `data-act="fuDone" data-id="${f.id}"` })}</div>`).join('') || `<div class="li sub">All clear for today.</div>`}</div>`)}
    ${card(`<div class="head"><h2>Smart matches</h2><div class="grow"></div><a href="#/matches" style="color:var(--p);font-weight:600;font-size:14px">All matches</a></div><div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${top.map((m) => `<a class="li" href="#/properties/${m.p.id}"><div class="grow"><b>${propLabel(m.p)}</b><div class="sub">${esc(m.p.loc)} · ${fmtPrice(m.p)}</div></div>${badge(m.score + '%', 'ok')}</a>`).join('')}</div>`)}</div>
    <div class="stack">${card(`<h2>Lead pipeline</h2>${stages.map((s) => { const n = S.leads.filter((l) => l.stage === s).length; return `<a href="#/leads" data-act="filt" data-k="leads" data-v="${s}" style="display:flex;align-items:center;gap:10px"><span style="width:110px;font-size:13px">${lstLabel(s)}</span><span style="flex:1;height:10px;background:var(--line2);border-radius:5px;overflow:hidden"><span style="display:block;height:100%;width:${(n / mx) * 100}%;background:var(--p)"></span></span><b style="width:20px;text-align:right">${n}</b></a>`; }).join('')}`)}
    ${(() => { const al = S.alerts.filter((a) => !a.seen); return al.length && S.org.notif.match ? card(`<div class="head"><h2>Match alerts</h2><div class="grow"></div><button type="button" class="btn ghost sm" data-act="alertsClear">Mark all seen</button></div><div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${al.slice(0, 5).map((a) => { const p = propById(a.prop); return `<div class="li" style="align-items:flex-start"><div class="grow"><a href="#/properties/${a.prop}" style="font-weight:600">${p ? esc(propLabel(p)) : esc(a.prop)}</a> fits <b>${esc(a.who)}</b> <span class="sub">(${a.kind.toLowerCase()})</span><div class="chips" style="margin-top:4px">${a.why.map((w) => `<span class="badge ${w[2] ? 'ok' : 'err'}">${w[2] ? '✓' : '✗'} ${w[0]}</span>`).join('')}</div></div>${badge(a.score + '%', 'ok')}</div>`; }).join('')}</div>`) : ''; })()}
    ${(() => { const at = attentionItems(); return at.length ? card(`<h2>Needs attention</h2><div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${at.map((x) => `<a class="li" href="${x[2]}"><div class="grow">${esc(x[0])}</div>${badge(x[1] === 'err' ? 'Act now' : x[1] === 'warn' ? 'Soon' : 'FYI', x[1])}</a>`).join('')}</div>`) : ''; })()}
    ${card(`<h2>Quick links</h2><div class="chips">${[['Add project', 'newProject'], ['Add property', 'newProperty'], ['Add requirement', 'newReq'], ['AI capture', 'newCapture'], ['Create deal', 'newDeal']].filter((x) => canW({ newProject: 'projects', newProperty: 'properties', newReq: 'requirements', newCapture: 'leads', newDeal: 'deals' }[x[1]])).map((x) => chip(x[0], false, `data-act="${x[1]}"`)).join('')}</div>`)}</div></div>`);
}

/* ------------------------------------------------------------ projects */
/* Projects: list, detail, add/edit form, amenities. */
// Count of units per status for a project.
function unitCounts(pid) { const u = S.props.filter((p) => p.projectId === pid); return { sale: u.filter((p) => p.purpose === 'sale').length, rent: u.filter((p) => p.purpose === 'rent').length }; }

// Location card (map placeholder + address) for projects/properties.
function locCard(ctx) {
  const d = S.d[ctx];
  return `<div class="ph" style="height:150px;position:relative">${d.place ? `<span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-70%)">${pinFill(34)}</span>` : ''}${d.place ? 'Map preview' : ico('pin', 20) + 'No location set'}</div>
  ${d.place ? `<div style="display:flex;gap:10px;align-items:flex-start">${pinFill(22)}<div><b>${esc(d.place.name)}</b><div class="sub">${esc(d.place.sub)}</div></div></div>` : `<div class="sub">Set the exact spot the way delivery apps do — search, then fine-tune the pin.</div>`}
  <div class="row" style="gap:8px">${btn(d.place ? 'Change location' : 'Set location', { k: 'ghost', a: `data-act="goPick" data-w="location" data-ctx="${ctx}"`, c: 'full' })}${ctx === 'project' ? btn('Address details', { k: 'ghost', a: `data-act="goPick" data-w="address" data-ctx="${ctx}"`, c: 'full' }) : ''}</div>`;
}
/* ---- v4 projects */
// Three-letter month names for completion pickers.
const MONTHS3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Configuration choices for residential projects.
const RES_CFG = ['1 BHK', '2 BHK', '3 BHK', '4 BHK', '5 BHK', 'More than 5 BHK', 'Villas', 'Plots'];
// Configuration choices for commercial projects.
const COM_CFG = ['Office', 'Retail', 'Showroom', 'Co-working', 'Shop'];
// Configuration choices for industrial projects.
const IND_CFG = ['Warehouse', 'Industrial shed', 'Industrial plot'];
// Which configuration list applies to a project type.
function cfgFor(t) { t = String(t || ''); if (/Mixed/.test(t)) return RES_CFG.slice(0, 6).concat(COM_CFG); if (/Commercial/.test(t)) return COM_CFG; if (/Industrial|Warehouse/.test(t)) return IND_CFG; if (/Residential|Township|Single Tower|Independent/.test(t)) return RES_CFG; return RES_CFG.concat(COM_CFG); }
// Standard extra-charge names (ADC, EDC, club, parking ...).
const CHARGE_NAMES = ['ADC (Additional Development Charges)', 'EDC (Extra Development Charges)', 'Club charges', 'Maintenance deposit', 'Parking charges', 'Legal charges', 'Other'];
// Charges are hidden for secondary-market-only companies.
const personaShowsCharges = () => (S.org.persona || 'mixed') !== 'secondary';
// Completion text ('Dec 2027') for a project.
const projCompl = (p) => (p.status === 'ready' ? '' : [p.cm, p.cy].filter(Boolean).join(' ') || p.complete || '');
// PIN code -> [city, state] lookup used by the address picker.
const PIN_TABLE = { 700091: ['Kolkata', 'West Bengal'], 700156: ['Kolkata', 'West Bengal'], 700160: ['Kolkata', 'West Bengal'], 700135: ['Kolkata', 'West Bengal'], 700019: ['Kolkata', 'West Bengal'], 700027: ['Kolkata', 'West Bengal'], 700084: ['Kolkata', 'West Bengal'], 400001: ['Mumbai', 'Maharashtra'], 400050: ['Mumbai', 'Maharashtra'], 110001: ['New Delhi', 'Delhi'], 560001: ['Bengaluru', 'Karnataka'], 560034: ['Bengaluru', 'Karnataka'], 500001: ['Hyderabad', 'Telangana'], 600001: ['Chennai', 'Tamil Nadu'], 411001: ['Pune', 'Maharashtra'], 380001: ['Ahmedabad', 'Gujarat'], 122001: ['Gurugram', 'Haryana'], 201301: ['Noida', 'Uttar Pradesh'] };
// Amount of a charge = rate x area (or flat).
const chargeAmt = (c, area) => Math.round((Number(String(c.rate).replace(/[^0-9.]/g, '')) || 0) * (Number(String(area).replace(/[^0-9.]/g, '')) || 0));
// Is a dated charge already in effect?
const chargeLive = (c) => !c.from || c.from <= iso(today);
// Stand-in for AI brochure extraction: returns plausible project fields.
function mockExtract(d) {
  // Display name for a project: typed name, else derived from the brochure file name.
  const nm = (d.name || '').trim() || String(d.brochure || '').replace(/\.\w+$/, '').replace(/[_-]+/g, ' ').replace(/brochure/i, '').trim() || 'Sample Heights';
  return { name: nm, dev: 'Sample Developers Pvt Ltd', type: 'Residential Complex', rera: 'WBRERA/P/KOL/2026/000999', status: 'uc', cm: 'Dec', cy: '2028', size: '12', sizeUnit: 'acres', towers: '5', units: '420', configs: ['2 BHK', '3 BHK', '4 BHK'], saleFrom: '72 L', saleTo: '1.6 Cr', amenities: ['clubhouse', 'swimming_pool', 'gym', 'security'], layouts: [{ cfg: '2 BHK', name: 'Type A', area: '1,010', baths: '2', units: '140' }, { cfg: '3 BHK', name: 'Type B', area: '1,420', baths: '3', units: '200' }, { cfg: '4 BHK', name: 'Type C', area: '2,050', baths: '4', units: '80' }] };
}
// Field labels for the AI-extraction review card.
const AI_LABEL = { name: 'Project name', dev: 'Developer', type: 'Project type', rera: 'RERA ID', status: 'Status', cm: 'Expected month', cy: 'Expected year', size: 'Project size', sizeUnit: 'Size unit', towers: 'Towers', units: 'Total units', configs: 'Configurations', saleFrom: 'Sale price from', saleTo: 'Sale price to', amenities: 'Amenities', layouts: 'Layouts' };
// Card showing AI-extracted project details for review/apply.
function aiCard(d) {
  const a = d.ai; if (!d.brochure) return '';
  if (!a) return `<div class="note">${ico('info', 18)}<div><b>Fill the form from the brochure</b><div class="sub" style="font-size:12px">AI reads the brochure and suggests values. You review every field before anything is saved.</div></div></div>${btn('Extract details from brochure', { i: 'match', a: 'data-act="aiExtract"' })}`;
  const ks = Object.keys(a.data);
  // Format one extracted field for display (amenities are shown by their labels).
  const show = (k, v) => (k === 'amenities' ? v.map((id) => (S.amen.find((x) => x.id === id) || {}).label).filter(Boolean).join(', ') : k === 'layouts' ? v.length + ' layouts (' + v.map((l) => l.cfg + ' ' + l.area).join(', ') + ')' : Array.isArray(v) ? v.join(', ') : k === 'status' ? (v === 'ready' ? 'Ready for operation' : 'Under construction') : v);
  return `<div class="card" style="background:var(--bg);gap:8px"><div class="head"><b>Preview — suggested from the brochure</b><div class="grow"></div>${badge('Review before applying', 'warn')}</div><div class="sub" style="font-size:12px">Untick anything that looks wrong. Nothing changes in the form until you apply. (Prototype: sample values — the live product reads your PDF.)</div>
  ${ks.map((k) => chk(a.pick[k] !== false, `<b>${AI_LABEL[k] || k}</b> · ${esc(show(k, a.data[k]))}`, `data-act="aiPick" data-k="${k}"`)).join('')}<div class="chips">${btn('Apply selected', { a: 'data-act="aiApply"' })}${btn('Discard', { k: 'sec', a: 'data-act="aiDiscard"' })}</div></div>`;
}
// Floor-plan/layout list editor of a project.
function layoutsCard(d) {
  const cfgs = d.configs.length ? d.configs : cfgFor(d.type);
  return card(`<div class="head"><h2>Layouts &amp; configurations</h2><div class="grow"></div>${btn('Add layout', { k: 'ghost sm', i: 'plus', a: 'data-act="layoutAdd"' })}</div><div class="sub" style="margin-top:-6px">One project can have many layouts — e.g. several 3 BHK plans with different areas.</div>
  ${d.layouts.map((l, i) => `<div class="card" style="background:var(--bg);gap:8px"><div class="row">${fld('Configuration', `d.project.layouts.${i}.cfg`, { opts: cfgs })}${fld('Layout name', `d.project.layouts.${i}.name`, { ph: 'e.g. Type B' })}</div><div class="row">${fld('Area', `d.project.layouts.${i}.area`, { suf: 'sq ft' })}${fld('Bathrooms', `d.project.layouts.${i}.baths`)}${fld('Units', `d.project.layouts.${i}.units`)}<div style="align-self:flex-end">${btn('Remove', { k: 'sec sm', a: `data-act="layoutRm" data-i="${i}"` })}</div></div></div>`).join('') || '<div class="sub">No layouts added yet.</div>'}`);
}
// Extra-charges editor/table of a project.
function chargesCard(d, edit) {
  if (!personaShowsCharges()) return '';
  return card(`<div class="head"><h2>Charges per sq ft</h2><div class="grow"></div>${btn('Add charge', { k: 'ghost sm', i: 'plus', a: 'data-act="chargeAdd"' })}</div><div class="sub" style="margin-top:-6px">Set the rate once for the project — each unit’s amount is worked out from its area. A new rate applies from its “effective from” date; older dates keep their history.</div>
  ${d.charges.map((c, i) => `<div class="row" style="align-items:flex-end;gap:8px"><div class="fld" style="flex:2"><span class="l">Charge</span><div class="inp sel"><select data-f="d.project.charges.${i}.name">${CHARGE_NAMES.map((n) => `<option ${c.name === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>${fld('Rate', `d.project.charges.${i}.rate`, { pre: '₹', suf: '/sq ft', style: 'flex:1' })}${fld('Effective from', `d.project.charges.${i}.from`, { type: 'date', style: 'flex:1' })}${btn('Remove', { k: 'sec sm', a: `data-act="chargeRm" data-i="${i}"` })}</div>`).join('') || '<div class="sub">None added.</div>'}
  ${d.charges.length ? `<div class="card" style="background:var(--bg);gap:6px"><div class="row" style="align-items:flex-end">${fld('Check the amounts for a unit of', 'd.project.chargeArea', { suf: 'sq ft', rer: 1, style: 'max-width:220px' })}</div>${kv(d.charges.map((c) => [esc(c.name) + (chargeLive(c) ? '' : ' <span class="sub">(from ' + esc(dateTxt(c.from)) + ')</span>'), inr(chargeAmt(c, d.chargeArea))]))}</div>` : ''}`);
}
// Add/edit project form (all sections).
function projectForm(edit) {
  const d = S.d.project; const P = 'd.project.'; d.layouts = d.layouts || []; d.charges = d.charges || []; d.photoList = d.photoList || []; d.customAmen = d.customAmen || [];
  const years = Array.from({ length: 10 }, (_, i) => String(today.getFullYear() + i));
  const am = d.amenities.map((id) => S.amen.find((a) => a.id === id)).filter(Boolean);
  const left = [
    card(`<h2>Basic details</h2><div class="row">${fld('Project name', P + 'name', { req: 1, ph: 'e.g. Rosedale Garden', hint: 'Shown in the autocomplete on every Property form' })}${fld('Developer / builder', P + 'dev', { ph: 'e.g. Merlin Group' })}</div><div class="row">${fld('Project type', P + 'type', { opts: S.masters.projectTypes, rer: 1, hint: 'Managed in Masters' })}${fld('RERA ID', P + 'rera', { ph: 'e.g. WBRERA/P/…' })}</div>${canA('masters') ? '' : `<div><button type="button" class="btn ghost sm" data-act="openModal" data-m="mreq" data-list="projectTypes">Need another type? Request it</button></div>`}`),
    card(`<h2>Project details</h2><div class="fld"><span class="l">Status</span>${chipSet(P + 'status', [['ready', 'Ready for operation'], ['uc', 'Under construction']], d.status)}</div>${d.status === 'uc' ? `<div class="row" style="max-width:460px">${fld('Expected completion — month', P + 'cm', { opts: [['', 'Select month'], ...MONTHS3] })}${fld('Year', P + 'cy', { opts: [['', 'Select year'], ...years] })}</div>` : ''}
    <div class="row"><div class="fld" style="flex:2"><span class="l">Project size</span><div style="display:flex;gap:8px;flex-wrap:wrap"><div class="inp grow" style="min-width:110px"><input id="f_d_project_size" data-f="d.project.size" value="${esc(d.size)}" inputmode="decimal" aria-label="Project size"></div><div class="inp sel" style="width:140px;max-width:100%"><select data-f="d.project.sizeUnit" aria-label="Size unit"><option value="">Select unit</option>${S.masters.sizeUnits.map((u) => `<option ${d.sizeUnit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div></div>${fld('Towers / blocks', P + 'towers')}${fld('Total units', P + 'units')}</div>
    <div class="fld"><span class="l">Configurations</span>${chipMulti(P + 'configs', cfgFor(d.type), d.configs)}<small>The options follow the project type.</small></div>`),
    card(`<h2>Price range <span class="sub" style="font-weight:400">(optional)</span></h2>${d.sale ? `<div class="row">${fld('Sale price from', P + 'saleFrom', { pre: '₹', ph: '68 L' })}${fld('Sale price to', P + 'saleTo', { pre: '₹', ph: '1.5 Cr' })}</div>` : ''}${d.rent ? `<div class="row">${fld('Rent/Lease from', P + 'rentFrom', { pre: '₹', suf: '/mo' })}${fld('Rent/Lease to', P + 'rentTo', { pre: '₹', suf: '/mo' })}</div>` : ''}${!d.sale && !d.rent ? '<div class="sub">Choose Sale and/or Rent/Lease under “Available for”.</div>' : ''}`),
    card(`<h2>Brochure</h2><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><label class="btn ghost" style="cursor:pointer">${ico('upload', 16)}${d.brochure ? 'Replace brochure' : 'Upload brochure (PDF)'}<input type="file" hidden data-brochure="project" accept=".pdf,.jpg,.jpeg,.png"></label>${d.brochure ? `<span>${ico('file', 18)} ${esc(d.brochure)}</span>` : ''}</div>${aiCard(d)}`),
    card(`<h2>Photos</h2><div class="sub" style="margin-top:-6px">Photos are kept apart from brochures and documents.</div><div class="chips">${d.photoList.map((x, i) => `<div class="ph" style="width:110px;height:84px;position:relative;flex-direction:column;font-size:11px;padding:4px;text-align:center;word-break:break-all">${ico('img', 18)}${esc(x.name.slice(0, 18))}<button type="button" class="fx" data-act="photoRm" data-w="project" data-i="${i}" aria-label="Remove photo" style="position:absolute;top:2px;right:2px">×</button></div>`).join('')}<label class="btn ghost" style="cursor:pointer">${ico('plus', 16)}Add photos<input type="file" multiple hidden data-photos="project" accept="image/*"></label></div>`),
    layoutsCard(d), chargesCard(d, edit),
    card(docPanel('proj:__draft', { title: 'Project documents' }))
  ].join('');
  // Sale / Rent / Both toggle chips.
  function bool() { return `<div class="chips">${chip('Sale', d.sale, 'data-act="togb" data-p="d.project.sale"')}${chip('Rent/Lease', d.rent, 'data-act="togb" data-p="d.project.rent"')}</div>`; }
  const right = [
    card(`<h2>Available for</h2>${bool()}<div class="sub" style="font-size:12px">Sale and Rent/Lease properties can both be listed under one project.</div>`),
    card(`<h2>Location</h2>${locCard('project')}`),
    card(`<h2>Amenities</h2><div class="chips">${am.map((a) => `<button type="button" class="chip on" data-act="amRmForm" data-id="${a.id}" aria-label="Remove ${esc(a.label)}">${esc(a.label)} ${ico('close', 14)}</button>`).join('') || '<span class="sub">None yet</span>'}</div>${btn('Add / edit amenities', { k: 'ghost', i: 'plus', a: 'data-act="goPick" data-w="amenities" data-ctx="project"', c: 'full' })}<div class="sub" style="font-size:12px">Type to search the list. If one is missing, add it and it joins the master list.</div>`),
    note('Only the Project name is required to save — a Property listing must never be blocked waiting for the rest of these details.')
  ].join('');
  return page(edit ? 'Edit project' : 'Add project', 'Everything except the name is optional', btn('Cancel', { k: 'sec', href: edit ? '#/projects/' + S.d.projectEditId : '#/projects' }) + btn(edit ? 'Save changes' : 'Save project', { a: 'data-act="saveProject"' }), `<div class="grid2"><div class="stack">${left}</div><div class="stack">${right}</div></div>`);
}
// Project detail page: summary, units, documents, charges.
function projectDetail(id) {
  const p = projById(id); if (!p) return page('Project not found', '', '', card(btn('Back to projects', { href: '#/projects' })));
  const tab = S.tab.projUnits || 'all'; const area = S.tab.pchArea || '1450';
  const units = S.props.filter((u) => u.projectId === p.id && (tab === 'all' || u.purpose === tab));
  // Resolve amenity ids to amenity records and count the units.
  const am = (p.amenities || []).map((a) => S.amen.find((x) => x.id === a)).filter(Boolean); const c = unitCounts(p.id);
  const overview = kv([['Developer', esc(p.dev || '—')], ['Project type', esc(p.type)], ['RERA ID', esc(p.rera || '—')], ['Size', p.size ? esc(p.size + (p.sizeUnit ? ' ' + p.sizeUnit : '')) : '—'], ['Towers · Units', esc((p.towers || '—') + ' towers · ' + (p.units || '—') + ' units')], ['Configurations', esc((p.configs || []).join(', ') || '—')], ['Sale price range', p.sale && (p.saleFrom || p.saleTo) ? '₹' + esc(p.saleFrom) + ' – ₹' + esc(p.saleTo) : '—'], ['Rent/Lease range', p.rent && (p.rentFrom || p.rentTo) ? '₹' + esc(p.rentFrom) + ' – ₹' + esc(p.rentTo) + ' /mo' : '—'], ['Available for', (p.sale ? 'Sale' : '') + (p.sale && p.rent ? ' · ' : '') + (p.rent ? 'Rent/Lease' : '')]]);
  const ut = units.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Unit</th><th>Purpose</th><th>Specs</th><th>Price / rent</th><th>Status</th></tr></thead><tbody>${units.map((u) => `<tr class="lnk" data-href="#/properties/${u.id}"><td><span class="mono sub" style="font-size:11px">${u.id}</span><div><b>${esc(u.title)}</b></div><div class="sub" style="font-size:12px">${esc(u.unit)}</div></td><td>${badge(PURPOSE[u.purpose], u.purpose === 'rent' ? 'blue' : '')}</td><td class="sub">${u.area} sq ft · ${esc(u.furn)}</td><td><b>${fmtPrice(u)}</b></td><td>${statusBadge(u.status)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="sub" style="padding:24px 16px">No ${tab === 'all' ? '' : PURPOSE[tab] + ' '}units listed yet.</div>`;
  // Layout (configuration) table, shown only when the project has layouts.
  const lay = (p.layouts || []).length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Configuration</th><th>Layout</th><th>Area</th><th>Baths</th><th>Units</th></tr></thead><tbody>${p.layouts.map((l) => `<tr><td><b>${esc(l.cfg)}</b></td><td>${esc(l.name)}</td><td>${esc(l.area)} sq ft</td><td>${esc(l.baths || '—')}</td><td>${esc(l.units || '—')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="sub">No layouts added yet.</div>';
  const chg = personaShowsCharges() && (p.charges || []).length ? card(`<h2>Charges per sq ft</h2><div class="row" style="align-items:flex-end">${fld('For a unit of', 'tab.pchArea', { suf: 'sq ft', rer: 1, style: 'max-width:200px' })}</div>${kv(p.charges.map((x) => [esc(x.name) + ' <span class="sub">· ₹' + esc(x.rate) + '/sq ft' + (x.from ? ' from ' + esc(dateTxt(x.from)) : '') + '</span>', inr(chargeAmt(x, area)) + (chargeLive(x) ? '' : ' <span class="badge">Upcoming</span>')]))}`) : '';
  return page(esc(p.name), esc(p.place ? p.place.sub : 'No location set'), btn('Edit project', { k: 'sec', i: 'edit', a: `data-act="editProject" data-id="${p.id}"` }) + btn('Add property', { i: 'plus', a: `data-act="newProperty" data-pid="${p.id}"` }),
    `<div class="grid2"><div class="stack">${card(`<div style="display:flex;gap:16px;flex-wrap:wrap">${coverBox('proj:' + p.id, 170, 260, 'No photos yet')}<div style="display:flex;flex-direction:column;gap:8px;justify-content:center"><div class="chips">${projStatus(p.status)}${p.size ? badge(p.size + (p.sizeUnit ? ' ' + p.sizeUnit : '')) : ''}${badge('Sale ' + c.sale)}${badge('Rent/Lease ' + c.rent, 'blue')}${projCompl(p) ? badge('Expected ' + projCompl(p)) : ''}</div></div></div>`)}
    ${card(`<h2>Overview</h2>${overview}`)}${card(`<h2>Layouts &amp; configurations</h2>${lay}`)}${chg}
    ${card(docPanel('proj:' + p.id, { title: 'Project documents' }))}
    ${card(`<div class="head"><h2>Properties in this project</h2></div>${tabsBar('projUnits', [['all', 'All ' + S.props.filter((u) => u.projectId === p.id).length], ['sale', 'Sale ' + c.sale], ['rent', 'Rent/Lease ' + c.rent]], tab)}<div style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${ut}</div>`)}</div>
    <div class="stack">${card(`<h2>Location</h2>${ph(170, 'Map preview')}<div class="sub">${p.place ? esc(p.place.sub) : ''}</div><div class="row" style="gap:8px">${btn('Open in Maps', { k: 'sec', c: 'full', a: 'data-act="toast" data-t="Opens Google Maps in the live product"' })}</div>`)}
    ${card(`<div class="head"><h2>Amenities</h2><div class="grow"></div><button type="button" class="btn sm ghost" data-act="editProject" data-id="${p.id}" data-go="amenities">Edit</button></div><div class="chips">${am.map((a) => chip(esc(a.label), false, 'disabled')).join('')}${(p.customAmen || []).map((a) => chip(esc(a), false, 'disabled')).join('')}${!am.length && !(p.customAmen || []).length ? '<span class="sub">None yet</span>' : ''}</div>`)}
    ${card(`<h2>Brochure</h2>${p.brochure ? `<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">${ico('file', 22)}<div class="grow"><b>${esc(p.brochure)}</b></div>${btn('Download', { k: 'sec sm', a: 'data-act="toast" data-t="Download starts in the live product"' })}</div>` : '<div class="sub">No brochure uploaded.</div>'}`)}</div></div>`);
}
// Projects list screen with search and filters.
function projectsView() {
  // Filters currently applied to the project list.
  const q = (S.q.projects || '').toLowerCase(); const pf = S.f.projects; const st = S.tab.projStatus || 'all';
  const rows = S.projects.filter((p) => { const c = unitCounts(p.id); const purposeOk = pf === 'all' || (pf === 'sale' ? (p.sale || c.sale) : (p.rent || c.rent)); return purposeOk && (st === 'all' || p.status === st) && (!q || kw(hay(p, (p.place ? p.place.sub : '') + ' ' + S.props.filter((u) => u.projectId === p.id).map((u) => u.title + ' ' + u.loc).join(' ')), q)); });
  const tbl = rows.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Project</th><th>Available for</th><th>Size</th><th>Units listed</th><th>Status</th><th>Expected completion</th>${rowActsTh()}</tr></thead><tbody>${rows.map((p) => { const c = unitCounts(p.id); return `<tr class="lnk" data-href="#/projects/${p.id}"><td><div style="display:flex;gap:10px;align-items:center"><div class="ph" style="width:56px;height:44px;flex:none">${ico('img', 16)}</div><div><a href="#/projects/${p.id}" style="font-weight:600">${esc(p.name)}</a><div class="sub" style="font-size:12px">${esc(p.place ? p.place.sub.split(',').slice(0, 2).join(', ') : '—')}</div></div></div></td><td>${p.sale ? badge('Sale') : ''} ${p.rent ? badge('Rent/Lease', 'blue') : ''}</td><td>${p.size ? esc(p.size + (p.sizeUnit ? ' ' + p.sizeUnit : '')) : esc(p.type)}</td><td><b style="color:var(--p)">${c.sale} sale · ${c.rent} rent/lease</b></td><td>${projStatus(p.status)}</td><td class="sub">${esc(projCompl(p) || '—')}</td>${rowActsTd('project', p.id)}</tr>`; }).join('')}</tbody></table></div>` : empty('No projects match', 'A Project is any building or development — even a single standalone house counts as one, containing just one Property.', btn('Add project', { a: 'data-act="newProject"', i: 'plus' }));
  return page('Projects', S.projects.length + ' developments · ' + S.props.filter((p) => p.projectId).length + ' units listed', btn('Add project', { a: 'data-act="newProject"', i: 'plus' }),
    `<div class="head">${searchBox('q.projects', 'Project name, locality')}${purposeSeg('projects')}<div class="chips">${[['all', 'All'], ['ready', 'Ready for operation'], ['uc', 'Under construction']].map((x) => chip(x[1], st === x[0], `data-act="tab" data-k="projStatus" data-v="${x[0]}"`)).join('')}</div></div>${card(tbl, 'flush')}`);
}
/* amenity picker: spell-check, duplicates, custom tags */
// Amenity checklist grouped by category.
function amenList() {
  const q = S.am.q.trim(); const ql = q.toLowerCase(); const sel = S.d.project.amenities;
  const rows = S.amen.filter((a) => (S.am.cat === 'All' || a.cat === S.am.cat || a.cat.startsWith('New')) && (!ql || a.label.toLowerCase().includes(ql)));
  const exact = S.amen.some((a) => a.label.toLowerCase() === ql) || (S.d.project.customAmen || []).some((a) => a.toLowerCase() === ql);
  const dym = q && !rows.length ? didYouMean(q, S.amen.map((a) => a.label)) : null;
  return `${dym ? `<div class="note" style="margin:8px">${ico('info', 18)}<div>Did you mean <button type="button" class="btn ghost sm" data-act="amUse" data-v="${esc(dym)}">${esc(dym)}</button>?</div></div>` : ''}${q && !exact ? `<button type="button" class="addrow" data-act="amAdd" style="display:flex;align-items:center;gap:10px;width:100%;min-height:56px;padding:8px 14px;border:none;border-bottom:1px solid var(--p-line);text-align:left">${ico('plus', 20)}<div><div>Add “${esc(q)}” as your own tag</div><div style="font-size:12px;font-weight:400">${canA('masters') ? 'Saved to the master list, then added to this project' : 'Added to this project; your Admin can approve it for the master list'}</div></div></button>` : ''}
  ${rows.map((a) => `<button type="button" data-act="amPick" data-id="${a.id}" style="background:${sel.includes(a.id) ? 'var(--p-soft)' : 'transparent'}"><div class="grow"><div style="font-weight:500">${esc(a.label)}</div><div class="sub" style="font-size:12px">${esc(a.cat)}</div></div><span class="cb${sel.includes(a.id) ? ' on' : ''}">${sel.includes(a.id) ? ico('check', 14) : ''}</span></button>`).join('')}
  ${!rows.length && !(q && !exact) ? '<div class="opt sub">No matching amenity.</div>' : ''}`;
}
// Amenity picker modal.
function pickAmenities() {
  // Amenity picker: where to go back to, and the working copy of the project being edited.
  const back = (S.ctx && S.ctx.ret) || '#/projects/new'; const P = S.d.project; const sel = P.amenities; const cu = P.customAmen || [];
  return page('Amenities', 'Search the list, or add your own tag. Spelling is checked and duplicates are blocked', btn('Cancel', { k: 'sec', href: back }) + btn('Save amenities', { a: 'data-act="saveAmen"' }),
    `<div class="grid2"><div class="card"><div><h2>Add amenities</h2><div class="sub">Pick from the list. If it isn’t there, type it and add it.</div></div>
    <div class="inp" style="border-color:var(--p)"><span class="pre">${ico('search', 18)}</span><input id="am_q" data-f="am.q" data-render="1" value="${esc(S.am.q)}" placeholder="Search or add an amenity" aria-label="Search or add an amenity" autocomplete="off"><button type="button" class="btn sec sm" data-act="amOpen" aria-label="Show or hide amenity list" style="border:none;width:44px;padding:0;background:transparent">${ico('down', 20)}</button></div>
    <div class="chips">${['All', ...CATS].map((c) => chip(c, S.am.cat === c, `data-act="amCat" data-v="${c}"`)).join('')}</div>
    ${S.am.open ? `<div class="card flush" style="max-height:420px;overflow:auto"><div class="pop" style="position:static;border:none;box-shadow:none;max-height:none">${amenList()}</div></div>` : ''}</div>
    <div class="stack">${card(`${S.am.notice ? `<div class="note ${S.am.warn ? '' : 'ok'}">${ico(S.am.warn ? 'info' : 'check', 18)}<div>${esc(S.am.notice)}</div></div>` : ''}${S.am.dym ? `<div class="note">${ico('info', 18)}<div>Did you mean <b>${esc(S.am.dym.match)}</b>?<div class="chips" style="margin-top:6px">${btn('Use “' + esc(S.am.dym.match) + '”', { k: 'ghost sm', a: `data-act="amUse" data-v="${esc(S.am.dym.match)}"` })}${btn('Add “' + esc(S.am.dym.q) + '” anyway', { k: 'sec sm', a: 'data-act="amForce"' })}</div></div></div>` : ''}<h2>Selected for this project · ${sel.length + cu.length}</h2><div class="chips">${sel.map((id) => S.amen.find((a) => a.id === id)).filter(Boolean).map((a) => `<button type="button" class="chip on" data-act="amPick" data-id="${a.id}" aria-label="Remove ${esc(a.label)}">${esc(a.label)} ${ico('close', 14)}</button>`).join('')}${cu.map((a, i) => `<button type="button" class="chip on" data-act="amRmCustom" data-i="${i}" aria-label="Remove ${esc(a)}">${esc(a)} · own tag ${ico('close', 14)}</button>`).join('') || ''}${!sel.length && !cu.length ? '<span class="sub">Nothing selected yet.</span>' : ''}</div>`)}</div></div>`);
}
// Add a new amenity name, guarding against near-duplicates ('did you mean').
function amenAddName(label, force) {
  label = label.trim().replace(/\s+/g, ' '); if (!label) return;
  const P = S.d.project; P.customAmen = P.customAmen || [];
  const ex = S.amen.find((a) => a.label.toLowerCase() === label.toLowerCase());
  if (ex) { if (!P.amenities.includes(ex.id)) P.amenities.push(ex.id); S.am.notice = '“' + ex.label + '” is already in the list — selected it instead of adding a duplicate.'; S.am.warn = true; S.am.dym = null; S.am.q = ''; return; }
  if (P.customAmen.some((a) => a.toLowerCase() === label.toLowerCase())) { S.am.notice = '“' + label + '” is already added to this project.'; S.am.warn = true; S.am.q = ''; return; }
  const near = force ? null : didYouMean(label, S.amen.map((a) => a.label).concat(P.customAmen));
  if (near) { S.am.dym = { q: label, match: near }; S.am.notice = ''; return; }
  S.am.dym = null;
  if (canA('masters')) { const id = 'custom_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_'); S.amen.push({ id, label, cat: 'New · saved to your list' }); P.amenities.push(id); S.am.notice = 'Saved “' + label + '” to the master list first, then added it to this project.'; }
  else { P.customAmen.push(label); S.mreq.push({ id: 'mr' + Date.now(), list: 'amenities', value: label, by: ME().name, at: iso(today), status: 'Pending' }); S.am.notice = 'Added “' + label + '” as your own tag. Your Admin has been asked to approve it for the master list.'; }
  S.am.warn = false; S.am.q = '';
}


/* ------------------------------------------------------------ pickers: location, address, amenities */
// The draft object the open picker (location/address) is editing.
function ctxObj() { return S.d[(S.ctx && S.ctx.ctx) || 'project']; }
// Location picker modal (search, current location, confirm).
function pickLocation() {
  const q = S.loc.q.trim().toLowerCase(); const showList = S.loc.focus || q.length > 0;
  const res = PLACES.map((pl, i): [any, number] => [pl, i]).filter((x) => !q || (x[0].name + ' ' + x[0].sub).toLowerCase().includes(q));
  const o = ctxObj(); const cur = o.place || PLACES[0];
  // Where the 'back' button returns to.
  const back = (S.ctx && S.ctx.ret) || '#/projects/new';
  return `<div class="locgrid"><div class="card" style="align-self:stretch"><div class="head"><a class="btn sec sm" href="${back}" aria-label="Back" style="width:40px;padding:0">${ico('back', 18)}</a><h2>Set ${S.ctx && S.ctx.ctx === 'property' ? 'property' : 'project'} location</h2></div>
    <div class="sub">Search for the project, society or area — the pin snaps to it. Place it at the main gate.</div>
    <label class="search" style="max-width:none">${ico('search', 18)}<input id="loc_q" data-f="loc.q" data-render="1" data-focus="loc" value="${esc(S.loc.q)}" placeholder="Search project, society or area" autocomplete="off" aria-label="Search location"></label>
    ${showList ? `<div class="card flush" style="box-shadow:var(--shadow)">${res.map((x) => `<button type="button" class="li" style="background:transparent;border:none;border-bottom:1px solid var(--line);text-align:left;width:100%" data-act="pickPlace" data-i="${x[1]}">${ico('pin', 20)}<div><b>${esc(x[0].name)}</b><div class="sub" style="font-size:12px">${esc(x[0].sub)}</div></div></button>`).join('') || '<div class="li sub">No matching place — drag the pin instead.</div>'}</div>` : ''}
    ${btn('Use current location', { k: 'ghost', i: 'locate', a: 'data-act="useCurrent"', c: 'full' })}
    <div class="grow"></div><div style="border-top:1px solid var(--line);padding-top:14px;display:flex;flex-direction:column;gap:12px"><div class="sub" style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;font-weight:500">Selected location</div><div style="display:flex;gap:10px;align-items:flex-start">${pinFill(24)}<div><div style="font-size:18px;font-weight:600">${esc(cur.name)}</div><div class="sub">${esc(cur.sub)}</div>${S.loc.note ? `<div style="color:var(--ok);font-size:12px">${esc(S.loc.note)}</div>` : ''}</div></div>${btn('Confirm location', { c: 'lg full', a: 'data-act="confirmLoc"' })}</div></div>
    <div class="mapwrap"><div class="pinbox"><div class="tip"><div style="font-weight:600;font-size:14px">Move the pin to set location</div><div style="font-size:12px;opacity:.8">Place it at the main gate</div></div><div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:8px solid var(--ink)"></div>${pinFill(44)}<div style="width:16px;height:6px;border-radius:50%;background:rgba(0,0,0,.28);margin-top:-2px"></div></div></div></div>`;
}
// Address picker modal (PIN-code auto-fill).
function pickAddress() {
  const o = ctxObj(); const k = (S.ctx && S.ctx.ctx) || 'project'; const A = `d.${k}.addr.`;
  // Where the 'back' button returns to.
  const back = (S.ctx && S.ctx.ret) || '#/projects/new';
  return page('Address details', 'Building, block and landmark — not just project and locality', btn('Cancel', { k: 'sec', href: back }) + btn('Save address', { a: 'data-act="saveAddr"' }),
    `<div class="grid2"><div class="card"><div style="display:flex;gap:10px;align-items:flex-start;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:12px">${pinFill(22)}<div><b>${esc(o.place ? o.place.name : 'No pin set')}</b><div class="sub">${esc(o.place ? o.place.sub : 'Set a location first')}</div></div><div class="grow"></div><a href="#/pick/location" style="color:var(--p);font-weight:600">Change</a></div>
    ${k === 'property' ? fld('Flat / unit no.', A + 'flat', { ph: 'e.g. 12A' }) : ''}${fld('Tower / building / plot no.', A + 'tower', { ph: 'e.g. Tower 3' })}${fld('Street / area', A + 'street', { req: 1 })}${fld('Landmark (optional)', A + 'landmark', { ph: 'e.g. Near Technopolis' })}
    <div class="row">${fld('Pincode', A + 'pin', { req: 1 })}${fld('City', A + 'city', { req: 1 })}</div>${fld('State', A + 'state', { req: 1 })}</div>
    ${card(`<h2>Pinned on map</h2><div class="ph" style="height:340px;position:relative"><span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-70%)">${pinFill(44)}</span>Map preview</div>${btn('Change location', { k: 'ghost', href: '#/pick/location', c: 'full' })}`)}</div>`);
}


/* ------------------------------------------------------------ properties */
/* Properties: list, detail, add/edit form with dynamic fields. */
// Property sub-types per category.
const SUBTYPES = { Residential: ['Flat / Apartment', 'Villa', 'Bungalow', 'Penthouse', 'Duplex'], Commercial: ['Office', 'Retail', 'Showroom', 'Warehouse'], Land: ['Plot', 'Farmhouse plot', 'Industrial plot'] };


/* ---- v4 properties */
// Compass directions for facing/overlooking.
const DIRS = ['North', 'South', 'East', 'West', 'North-East', 'North-West', 'South-East', 'South-West'];
// Optional extras of a unit (balcony, utility, terrace ...).
const EXTRAS = [['balcony', 'Balcony'], ['utility', 'Utility'], ['terrace', 'Terrace'], ['helper', 'Helper’s room']];
// Parking types.
const PARK_TYPES = ['Open', 'Covered', 'Basement', 'Mechanical', 'Combination'];
// Masked version of a phone number for display.
const maskNum = (s) => { s = String(s || ''); if (!s || s === '—') return '—'; if (s.includes('•')) return s; const dg = s.replace(/\D/g, '').slice(-10); return dg.length < 8 ? s : '+91 ' + dg.slice(0, 2) + '••• ••' + dg.slice(-3); };
// Full number when the user may see it, masked otherwise.
const fullNum = (s) => { s = String(s || ''); return s.includes('•') ? maskedFull(s) : s; };
// Phone cell with a 'request to reveal' button when the number is masked.
function numCell(key, num, what, label) {
  if (!num || num === '—') return '—';
  const shown = S.tab.rev[key] && canA('seeNumbers');
  const digits = fullNum(num).replace(/\D/g, '');
  if (shown) return `<span class="mono">${esc(fullNum(num))}</span> <a class="btn ghost sm" href="https://wa.me/${digits.length === 10 ? '91' + digits : digits}" target="_blank" rel="noopener">${ico('chat', 14)}WhatsApp</a> <span class="mobile-only"><a class="btn ghost sm" href="tel:+${digits}">${ico('phone', 14)}Call</a></span>`;
  if (!canA('seeNumbers')) return `<span class="mono">${esc(maskNum(num))}</span> <span class="sub" style="font-size:12px">Hidden</span>`;
  return `<span class="mono">${esc(maskNum(num))}</span> <button type="button" class="btn ghost sm" data-act="askReveal" data-key="${esc(key)}" data-what="${esc(what)}" data-label="${esc(label)}">Reveal</button>`;
}
// Property age text from year/month of completion.
const ageTxt = (y, m) => { y = Number(y); if (!y) return ''; let mo = (today.getFullYear() - y) * 12 + (today.getMonth() - (m ? Number(m) - 1 : 0)); if (mo < 0) return 'Not yet completed'; const yr = Math.floor(mo / 12); mo %= 12; return (yr ? yr + ' yr ' : '') + (m || !yr ? mo + ' mo' : '').trim() || 'New'; };
// Months until a property is complete (0 = ready, null = unknown).
function propComplMonths(p) { // months from today until completion; 0 = ready; null = unknown
  const f = p.form; let st = f ? f.pstatus : null, y = f ? f.cy : null, m = f ? f.cm : null;
  if (p.projectId) { const pr = projById(p.projectId); if (pr) { st = pr.status === 'ready' ? 'Ready for Possession' : 'Under Construction'; y = pr.cy; m = pr.cm; if (!y && pr.complete) { const a = pr.complete.split(' '); m = a[0]; y = a[1]; } } }
  if (!st || st === 'Ready for Possession') return 0; if (!y) return null; const mi = m ? MONTHS3.indexOf(String(m).slice(0, 3)) : 11; return Math.max(0, monthsFromToday(Number(y), mi < 0 ? 11 : mi));
}
// Copy an existing property into the edit draft.
function loadPropertyDraft(id) {
  const p = propById(id); if (!p) return;
  let d = p.form ? clone(p.form) : newProperty();
  // First open of the form: no form data yet.
  if (!p.form) {
    Object.assign(d, { purpose: p.purpose, cat: p.cat, sub: (SUBTYPES[p.cat] || []).includes(p.sub) ? p.sub : SUBTYPES[p.cat][0], projectId: p.projectId, bhk: p.bhk || 3, carpet: String(p.carpet || Math.round(p.area * 0.8)), sbu: String(p.sbu || p.area), furn: p.furn === '—' ? 'Unfurnished' : p.furn, price: p.priceL ? fmtL(p.priceL).replace('₹', '') : '', quoted: p.quotedL ? fmtL(p.quotedL).replace('₹', '') : '', rent: p.rentK ? String(p.rentK * 1000) : '' });
    const st = ['Owner', 'Broker', 'Portal'].includes(p.source) ? p.source.toLowerCase() : 'owner'; d.src = { owner: st === 'owner', broker: st === 'broker', portal: st === 'portal' }; d.owner.name = p.owner && p.owner !== '—' ? p.owner : ''; d.owner.mobile = p.ownerPhone || '';
    d.addr.street = p.unit;
  }
  d.photoList = d.photoList || []; S.d.property = d; S.d.propEditId = id; S.files['prop:__draft'] = clone(S.files['prop:' + id] || []);
}
// Validation of the 'source' tab (owner / broker / portal contact).
function srcErrors(d) {
  const e = {}; const S0 = d.src;
  if (!S0.owner && !S0.broker && !S0.portal) e['d.property.src'] = 'Choose at least one source.';
  if (S0.owner) { if (!d.owner.name.trim()) e['d.property.owner.name'] = 'Owner name is required when the source includes the owner.'; if (!String(d.owner.mobile).trim()) e['d.property.owner.mobile'] = 'Owner mobile is required.'; }
  if (S0.broker) { [['name', 'Broker name'], ['company', 'Company'], ['phone', 'Broker phone'], ['email', 'Broker email']].forEach((x) => { if (!String(d.broker[x[0]]).trim()) e['d.property.broker.' + x[0]] = x[1] + ' is required for a broker source.'; }); }
  if (S0.portal) { if (!d.portal.pid.trim()) e['d.property.portal.pid'] = 'Enter the portal property ID.'; if (!d.portal.url.trim()) e['d.property.portal.url'] = 'Paste the listing URL.'; if (!d.portal.by) e['d.property.portal.by'] = 'Tag whether an owner or a broker listed it.'; }
  return e;
}
// Source tab of the property form (who supplied the listing).
function sourceTab(d) {
  const P = 'd.property.'; const er = S.err && S.err[P + 'src'];
  const own = d.src.owner ? card(`<h2>Owner</h2><div class="row">${fld('Owner name', P + 'owner.name', { req: 1 })}${fld('Mobile', P + 'owner.mobile', { req: 1, pre: '+91' })}</div>${waFld('d.property.owner', d.owner)}${fld('Email', P + 'owner.email')}`, '') : '';
  const bro = d.src.broker ? card(`<h2>Broker</h2><div class="row">${fld('Broker name', P + 'broker.name', { req: 1 })}${fld('Company', P + 'broker.company', { req: 1 })}</div><div class="row">${fld('Phone', P + 'broker.phone', { req: 1, pre: '+91' })}${fld('Email', P + 'broker.email', { req: 1 })}</div>${waFld('d.property.broker', d.broker)}
    <div class="fld"><span class="l">Broker groups</span>${chipMulti(P + 'broker.groups', S.masters.brokerGroups.concat(d.broker.groups.filter((g) => !S.masters.brokerGroups.includes(g))), d.broker.groups)}<div style="display:flex;gap:8px;max-width:380px"><div class="inp" style="flex:1"><input id="f_d_property_broker_gNew" data-f="d.property.broker.gNew" placeholder="Add a group, e.g. BNI Kolkata"></div>${btn('+ Add', { k: 'ghost', a: 'data-act="bgAdd"' })}</div><small>Tag every group this broker belongs to. New groups are saved for next time.</small></div>
    <div class="sub" style="font-size:12px">Owner details are optional when a broker is the source.</div>`, '') : '';
  const por = d.src.portal ? card(`<h2>Portal</h2><div class="row">${fld('Which portal', P + 'portal.name', { opts: ['99acres', 'Magicbricks', 'Housing.com', 'NoBroker', 'Other'] })}${fld('Portal property ID', P + 'portal.pid', { req: 1 })}</div>${fld('Listing URL', P + 'portal.url', { req: 1, ph: 'https://…' })}<div class="fld${S.err && S.err[P + 'portal.by'] ? ' err' : ''}"><span class="l">Listed on the portal by <span class="req">*</span></span>${chipSet(P + 'portal.by', ['Owner', 'Broker'], d.portal.by)}${S.err && S.err[P + 'portal.by'] ? `<span class="emsg">${esc(S.err[P + 'portal.by'])}</span>` : '<small>Tag who is really behind the listing — it drives source reports.</small>'}</div>`, '') : '';
  return `<div class="fld${er ? ' err' : ''}"><span class="l">Source — pick one, two or all three</span><div class="chips">${[['owner', 'Owner'], ['broker', 'Broker'], ['portal', 'Portal']].map((x) => chip(x[1], d.src[x[0]], `data-act="srcTog" data-k="${x[0]}"`)).join('')}</div>${er ? `<span class="emsg">${esc(er)}</span>` : '<small>Owner → owner details are mandatory. Broker → name, company, phone and email are mandatory. Portal → portal ID, URL and who listed it.</small>'}</div>${own}${bro}${por}${fld('Reference (who referred this listing)', P + 'ref')}`;
}
// Add/edit property form: dynamic fields follow category and type.
function propertyForm(edit) {
  const d = S.d.property; const P = 'd.property.'; const t = S.tab.pf || 0;
  const tabs = ['Source', 'Category & location', 'Specifications', 'Price', 'Status & documents', 'Photos'];
  const pr = d.projectId ? projById(d.projectId) : null; const q = (S.pq.q || '').toLowerCase(); const pm = S.projects.filter((p) => !q || p.name.toLowerCase().includes(q));
  const years = Array.from({ length: 46 }, (_, i) => String(today.getFullYear() + 5 - i));
  const land = d.cat === 'Land'; const res = d.cat === 'Residential';
  const anyExtra = EXTRAS.some((x) => d.extras[x[0]]);
  const olOpts = ['Garden', 'Swimming Pool', 'Road', 'Clubhouse', ...d.overlook.filter((x) => !['Garden', 'Swimming Pool', 'Road', 'Clubhouse'].includes(x))];
  const feats = S.masters.features.concat(d.features.filter((f) => !S.masters.features.includes(f)));
  const s1 = `<div class="fld"><span class="l">Purpose</span>${purposeSet(P + 'purpose', d.purpose)}</div>
    <div class="fld"><span class="l">Category</span>${chipSet(P + 'cat', ['Residential', 'Commercial', 'Land'], d.cat)}</div>
    ${fld('Sub-type', P + 'sub', { req: 1, opts: SUBTYPES[d.cat] })}
    <div class="fld" data-popwrap="1" style="position:relative"><span class="l">Project / building</span>
      ${pr ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${badge(pr.name, 'blue')}<button type="button" class="btn sec sm" data-act="pjClear">Change</button></div>` : `<div class="inp"><input id="pq_q" data-f="pq.q" data-render="1" data-focus="pq" value="${esc(S.pq.q)}" placeholder="Search your Projects — or leave empty for a standalone property" autocomplete="off"></div>
      ${S.pq.open ? `<div class="pop">${pm.map((p) => `<button type="button" data-act="pjPick" data-id="${p.id}"><div><b>${esc(p.name)}</b><div class="sub" style="font-size:12px">${esc(p.place ? p.place.sub : '')}</div></div></button>`).join('')}${S.pq.q.trim() ? `<button type="button" class="addrow" data-act="openModal" data-m="quickProject">${ico('plus', 18)} Add new project “${esc(S.pq.q.trim())}”</button>` : ''}</div>` : ''}`}
      <small>Standalone, or linked to a project. Not in the list? Add it inline — a listing is never blocked.</small></div>
    <div class="row">${fld({ flat: 'Flat / unit no.', house: 'House no.', office: 'Unit / office no.', retail: 'Shop / unit no.', warehouse: 'Unit / godown no.', plot: 'Plot / survey no.' }[ptKind(d.cat, d.sub)], P + 'addr.flat')}${fld(ptKind(d.cat, d.sub) === 'flat' ? 'Tower / block' : 'Block / sector', P + 'addr.tower')}</div>${fld('Address line', P + 'addr.street', { hint: 'Full address — many standalone buildings have no project name' })}${fld('Landmark', P + 'addr.landmark')}
    <div class="row">${fld('Pincode', P + 'addr.pin', { hint: 'Fills city and state for you' })}${fld('City', P + 'addr.city')}${fld('State', P + 'addr.state')}</div>
    <div class="card" style="background:var(--bg)"><h2>Google Maps location</h2>${locCard('property')}<small class="sub">Search by name; the pin and address fill in and stay editable.</small></div>`;
  const K = ptKind(d.cat, d.sub); const R = PT[K]; const furnO = FURN[K] || FURN.flat; const sale = d.purpose === 'sale';
  const plotCalc = Number(d.plotL) > 0 && Number(d.plotW) > 0 ? `<div class="sub">${esc(d.plotL)} × ${esc(d.plotW)} ft = <b>${Math.round(d.plotL * d.plotW).toLocaleString('en-IN')}</b> sq ft ${Number(d.sbu) !== Math.round(d.plotL * d.plotW) ? btn('Use as plot area', { k: 'ghost sm', a: 'data-act="plotUse"' }) : ''}</div>` : '';
  const s2 = `${R.bhk ? `<div class="fld"><span class="l">BHK</span>${chipSet(P + 'bhk', [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5+']], Number(d.bhk))}</div>` : ''}
    <div class="card" style="background:var(--bg)"><h2>Area</h2>${R.plot ? `<div class="row">${fld('Plot area', P + 'sbu', { req: 1, suf: 'sq ft' })}${fld('Road width', P + 'road', { suf: 'ft', hint: 'Width of the road the plot faces' })}</div><div class="row">${fld('Length', P + 'plotL', { suf: 'ft' })}${fld('Width', P + 'plotW', { suf: 'ft' })}</div>${plotCalc}` : `<div class="row">${fld('Carpet area', P + 'carpet', { req: 1, suf: 'sq ft' })}${fld('Chargeable area', P + 'sbu', { req: 1, suf: 'sq ft', hint: 'Super built-up / chargeable' })}${R.plotA ? fld('Plot area (optional)', P + 'plotArea', { suf: 'sq ft' }) : ''}${anyExtra ? fld('Extra area (combined)', P + 'extraArea', { suf: 'sq ft' }) : ''}</div>`}
    ${R.ext ? `<div class="fld"><span class="l">Other areas included (optional)</span><div class="chips">${EXTRAS.map((x) => chk(!!d.extras[x[0]], x[1], `data-act="togb" data-p="d.property.extras.${x[0]}"`)).join('')}</div></div><div class="row">${fld('Built-up ÷ carpet', P + 'buRatio', { hint: 'Optional ratio, e.g. 1.10' })}${fld('Super built-up ÷ carpet', P + 'sbuRatio', { hint: 'Optional ratio, e.g. 1.25' })}</div>` : ''}</div>
    ${rowOf(R.baths && fld('Bathrooms', P + 'baths'), R.wash && fld('Washrooms', P + 'washrooms'), R.floor && fld('Floor', P + 'floor'), (R.floor || R.floors) && fld(R.floors ? 'Number of floors' : 'Total floors', P + 'totalFloors'), R.balc && fld('Balconies', P + 'balconies'), R.seats && fld('Workstations / cabins', P + 'seats'), R.front && fld('Frontage', P + 'frontage', { suf: 'ft' }), R.ht && fld('Ceiling height', P + 'ceilHt', { suf: 'ft' }), R.docks && fld('Loading docks', P + 'docks'), R.power && fld('Power load', P + 'powerKva', { suf: 'kVA' }), R.lift && fld('Lift in building', P + 'lift', { opts: ['Yes', 'No'] }))}
    ${R.use ? `<div class="row">${fld('Land use', P + 'landUse', { opts: LAND_USE })}<div class="fld"><span class="l">Boundary wall</span>${chipSet(P + 'wall', ['Yes', 'Partial', 'No'], d.wall)}</div></div>${chk(d.corner, 'Corner plot', 'data-act="togb" data-p="d.property.corner"')}` : ''}
    ${R.face ? `<div class="row">${fld(R.plot ? 'Plot facing' : 'Facing / entry', P + 'facing', { opts: DIRS })}</div>` : ''}
    ${R.side ? `<div class="fld"><span class="l">Open sides</span>${chipMulti(P + 'openSides', DIRS, d.openSides)}</div>` : ''}
    ${R.olook ? `<div class="fld"><span class="l">Overlooking</span>${chipMulti(P + 'overlook', olOpts, d.overlook)}<div style="display:flex;gap:8px;max-width:360px"><div class="inp" style="flex:1"><input id="f_d_property_olNew" data-f="d.property.olNew" placeholder="Add custom, e.g. Lake"></div>${btn('+ Add', { k: 'ghost', a: 'data-act="addOverlook"' })}</div></div>` : ''}
    ${R.feat ? `<div class="fld"><span class="l">Features</span>${chipMulti(P + 'features', feats, d.features)}<div style="display:flex;gap:8px;max-width:360px"><div class="inp" style="flex:1"><input id="f_d_property_fNew" data-f="d.property.fNew" placeholder="Add a feature of your own"></div>${btn('+ Add', { k: 'ghost', a: 'data-act="featAdd"' })}</div></div>` : ''}
    ${rowOf(R.furn && fld('Furnishing', P + 'furn', { opts: furnO }), R.age && fld('Year of completion', P + 'cYear', { opts: [['', 'Select year'], ...years] }), R.age && fld('Month (optional)', P + 'cMonth', { opts: [['', '—'], ...MONTHS3.map((m, i) => [String(i + 1), m])] }))}${R.age && d.cYear ? `<div class="sub">Age of the property: <b>${esc(ageTxt(d.cYear, d.cMonth))}</b></div>` : ''}
    ${R.park ? `<div class="card" style="background:var(--bg)"><h2>${K === 'warehouse' ? 'Truck &amp; vehicle parking' : 'Car parking'}</h2><div class="row"><div class="fld" style="max-width:200px"><span class="l">Number of slots</span><div style="display:flex;gap:8px"><button type="button" class="btn sec sm" data-act="stepf" data-p="d.property.pcount" data-s="-1" aria-label="Fewer">−</button><div class="inp" style="width:64px"><input data-f="d.property.pcount" data-render="1" value="${esc(d.pcount)}" inputmode="numeric" style="text-align:center"></div><button type="button" class="btn sec sm" data-act="stepf" data-p="d.property.pcount" data-s="1" aria-label="More">+</button></div></div>${Number(d.pcount) > 0 ? fld('Parking type', P + 'ptype', { opts: PARK_TYPES, style: 'max-width:240px' }) : ''}</div><small>The cost of parking goes under Price.</small></div>` : ''}`;
  // Hint of price per sq ft, worked out from price and built-up area.
  const sqftHint = (() => { const v = parseL(d.price); const a = Number(d.sbu); return v && a ? '≈ ₹' + Math.round(v * 1e5 / a).toLocaleString('en-IN') + ' per sq ft' : ''; })();
  const com = d.cat === 'Commercial';
  const s3 = sale ? `<div class="row">${fld('Expected price (owner’s)', P + 'price', { pre: '₹', hint: sqftHint || 'As quoted by the owner' })}${fld('Quoted price', P + 'quoted', { pre: '₹', hint: 'Shown to prospects — defaults to the owner’s price' })}</div>${rowOf(!R.plot && fld('Maintenance', P + 'maint', { pre: '₹', suf: '/mo' }), R.park && fld('Parking cost', P + 'parkCost', { pre: '₹' }), fld('Brokerage', P + 'brokerage', { suf: '%' }))}<div class="row">${fld('Ownership', P + 'tenure', { opts: OWNERSHIP })}</div>${chk(d.negotiable, 'Price is negotiable', 'data-act="togb" data-p="d.property.negotiable"')}${com ? chk(d.gstOn, 'GST applicable on the sale price', 'data-act="togb" data-p="d.property.gstOn"') : ''}` : `<div class="row">${fld('Monthly rent', P + 'rent', { pre: '₹', suf: '/mo' })}${fld('Security deposit', P + 'deposit', { pre: '₹' })}</div>${rowOf(fld('Maintenance', P + 'maint', { pre: '₹', suf: '/mo' }), R.park && fld('Parking cost', P + 'parkCost', { pre: '₹', suf: '/mo' }), fld('Brokerage', P + 'brokerage', { suf: 'months' }))}<div class="row">${fld('Available from', P + 'availFrom', { type: 'date' })}${fld('Lock-in', P + 'lockin', { suf: 'months' })}</div>${d.cat === 'Residential' ? `<div class="fld"><span class="l">Preferred tenants</span>${chipMulti(P + 'tenants', TENANTS, d.tenants)}</div>` : ''}${com ? chk(d.gstOn, 'GST applicable on the rent', 'data-act="togb" data-p="d.property.gstOn"') : ''}`;
  const s3b = d.purpose === 'sale' && personaShowsCharges() ? `<div class="card" style="background:var(--bg)"><h2>Additional charges <span class="sub" style="font-weight:400">(builder inventory)</span></h2>${pr && (pr.charges || []).length ? `<div class="note">${ico('info', 18)}<div>${esc(pr.name)} has charges set per sq ft (${pr.charges.map((c) => esc(c.name.split(' ')[0]) + ' ₹' + esc(c.rate)).join(', ')}). They are calculated from the area — add anything extra below.</div></div>` : ''}${d.charges.map((c, i) => `<div class="row" style="align-items:flex-end;gap:8px"><div class="fld" style="flex:2"><span class="l">Charge</span><div class="inp sel"><select data-f="d.property.charges.${i}.name">${['EDC (Extra Development Charges)', 'ADC (Additional Development Charges)', 'Floor Rise Escalation', 'Preferred Location Charges (PLC)', 'GST', 'Club Charges', 'Gen-set Charges', 'Legal Charges'].map((n) => `<option ${c.name === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>${fld('Amount', P + 'charges.' + i + '.amt', { pre: '₹', style: 'flex:1' })}${btn('Remove', { k: 'sec sm', a: `data-act="rmRow" data-p="d.property.charges" data-i="${i}"` })}</div>`).join('') || '<div class="sub">None added.</div>'}<button type="button" class="btn ghost sm" style="align-self:flex-start" data-act="addCharge">+ Add charge</button></div>` : '';
  const s4 = `<div class="fld"><span class="l">${R.plot ? 'Development status' : 'Property status'}</span>${chipSet(P + 'pstatus', R.plot ? [['Ready for Possession', 'Ready to build'], ['Under Construction', 'Under development']] : ['Ready for Possession', 'Under Construction'], d.pstatus)}</div>
    ${d.pstatus !== 'Ready for Possession' ? `<div class="row" style="max-width:420px">${fld('Expected completion — month', P + 'cm', { opts: [['', 'Select month'], ...MONTHS3] })}${fld('Year', P + 'cy', { opts: [['', 'Select year'], ...Array.from({ length: 8 }, (_, i) => String(today.getFullYear() + i))] })}</div>` : ''}
    <div class="card" style="background:var(--bg)">${docPanel('prop:__draft', {})}</div>`;
  const s5 = `<div class="chips">${d.photoList.map((x, i) => `<div class="ph" style="width:120px;height:96px;position:relative;flex-direction:column;font-size:11px;padding:4px;text-align:center;word-break:break-all">${ico('img', 18)}${i === 0 ? '<b>Cover</b>' : ''}${esc(x.name.slice(0, 18))}<button type="button" class="fx" data-act="photoRm" data-w="property" data-i="${i}" aria-label="Remove photo" style="position:absolute;top:2px;right:2px">×</button></div>`).join('')}</div><label class="btn ghost" style="cursor:pointer;align-self:flex-start">${ico('upload', 16)}Add photos<input type="file" multiple hidden data-photos="property" accept="image/*"></label><div class="sub">Photos are kept apart from documents. The first photo is the cover.</div>`;
  const secs = [sourceTab(d), s1, s2, s3 + s3b, s4, s5]; const last = t === tabs.length - 1;
  return page(edit ? 'Edit property' : 'Add property', 'The same form is used to create and to edit', btn('Cancel', { k: 'sec', href: edit ? '#/properties/' + S.d.propEditId : '#/properties' }) + btn('Save draft', { k: 'ghost', a: 'data-act="saveProperty" data-draft="1"' }) + btn(edit ? 'Save changes' : 'Save property', { a: 'data-act="saveProperty"' }),
    `<div class="card"><div class="tabs" role="tablist">${tabs.map((x, i) => `<button type="button" role="tab" class="${t === i ? 'on' : ''}" data-act="pfTab" data-i="${i}">${i + 1}. ${x}</button>`).join('')}</div><h2>${tabs[t]}</h2>${secs[t]}<div class="head" style="border-top:1px solid var(--line);padding-top:14px"><div class="sub">Property ID is generated on save. Save as draft any time — drafts show under the “Draft” filter and on your dashboard.</div><div class="grow"></div>${t > 0 ? btn('Back', { k: 'sec', a: `data-act="pfTab" data-i="${t - 1}"` }) : ''}${!last ? btn('Next', { a: `data-act="pfTab" data-i="${t + 1}"` }) : ''}</div></div>`);
}
// Property detail page: facts, contacts, photos, documents, matches.
function propertyDetail(id) {
  const p = propById(id); if (!p) return page('Property not found', '', '', card(btn('Back', { href: '#/properties' })));
  const pr = p.projectId ? projById(p.projectId) : null; const f = p.form; const tab = S.tab.propTab || 'overview';
  const ms = S.reqs.filter((r) => r.status === 'Active' && matchesFor(r).some((m) => m.p.id === p.id));
  const carpet = p.carpet || (f && f.carpet) || Math.round(p.area * 0.8); const sbu = p.sbu || p.area;
  const area = `Carpet ${Number(carpet).toLocaleString('en-IN')} · Chargeable ${Number(sbu).toLocaleString('en-IN')} sq ft` + (f && f.buRatio ? ' · built-up ÷ carpet ' + esc(f.buRatio) : '') + (f && f.sbuRatio ? ' · super built-up ÷ carpet ' + esc(f.sbuRatio) : '');
  const rows = [['Property ID', `<span class="mono">${esc(p.id)}</span>`], ['Purpose', badge(PURPOSE[p.purpose], p.purpose === 'rent' ? 'blue' : '')], ['Category', esc(p.cat + (p.sub ? ' · ' + p.sub : ''))], ['Project', pr ? `<a href="#/projects/${pr.id}" style="color:var(--p)">${esc(pr.name)}</a>` : 'Standalone'], ['Unit / address', esc(p.unit)], ['Locality', esc(p.loc)], ['Area', p.cat === 'Land' ? 'Plot area ' + Number(sbu).toLocaleString('en-IN') + ' sq ft' : area], ...(PT[ptKind(p.cat, p.sub, p.title)].furn ? [['Furnishing', esc(p.furn)]] : [])];
  if (f) { ptRows(f).forEach((x) => rows.push(x)); if (f.facing) rows.push(['Facing', esc(f.facing)]); if (f.openSides.length) rows.push(['Open sides', esc(f.openSides.join(', '))]); if (f.features.length) rows.push(['Features', f.features.map((x) => badge(x)).join(' ')]); if (f.cYear) rows.push(['Completed', esc(f.cYear) + ' · ' + esc(ageTxt(f.cYear, f.cMonth))]); if (Number(f.pcount) > 0) rows.push(['Parking', esc(f.pcount + ' · ' + f.ptype)]); if (f.parkCost) rows.push(['Parking cost', '₹' + esc(f.parkCost)]); if (f.maint) rows.push(['Maintenance', '₹' + esc(f.maint)]); }
  rows.push([p.purpose === 'sale' ? 'Owner’s price' : 'Monthly rent', fmtPrice(p)]); rows.push(p.purpose === 'sale' ? ['Quoted price', fmtL(p.quotedL || p.priceL) + ' <span class="sub">— shown to prospects</span>'] : ['Deposit', f && f.deposit ? '₹' + esc(f.deposit) : '₹' + Math.round((p.rentK || 0) * 2000).toLocaleString('en-IN') + ' <span class="sub">(2 months)</span>']); rows.push(['Status', statusBadge(p.status)]);
  const srcs = f ? Object.keys(f.src).filter((k) => f.src[k]) : [String(p.source || 'Owner').toLowerCase()];
  rows.push(['Source', esc(srcs.map((x) => x[0].toUpperCase() + x.slice(1)).join(' + '))]);
  if (srcs.includes('owner')) rows.push(['Owner', esc((f ? f.owner.name : p.owner) || '—') + ' · ' + numCell('own:' + p.id, f ? f.owner.mobile : (p.ownerPhone || '+91 98••• ••015'), 'Owner number', p.id)]);
  if (f && srcs.includes('broker')) rows.push(['Broker', esc(f.broker.name) + ' · ' + esc(f.broker.company) + '<br>' + numCell('brk:' + p.id, f.broker.phone, 'Broker number', p.id) + (f.broker.groups.length ? '<div class="chips" style="margin-top:4px">' + f.broker.groups.map((g) => badge(g)).join('') + '</div>' : '')]);
  if (f && srcs.includes('portal')) rows.push(['Portal', esc(f.portal.name) + ' · ID ' + esc(f.portal.pid) + ' · ' + (f.portal.url ? `<a href="${esc(f.portal.url)}" target="_blank" rel="noopener" style="color:var(--p)">Open listing</a>` : '') + ' · listed by ' + esc(f.portal.by || '—')]);
  const body = tab === 'overview' ? kv(rows) :
    tab === 'matches' ? (ms.length ? `<div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${ms.map((r) => `<a class="li" href="#/matches" data-act="setMatchReq" data-id="${r.id}"><div class="av">${initials(prosById(r.cid).name)}</div><div class="grow"><b>${esc(prosById(r.cid).name)}</b><div class="sub">${r.id} · ${PURPOSE[r.purpose]}${reqSpec(r) ? ' · ' + reqSpec(r) : ''}</div></div>${badge(matchesFor(r).find((m) => m.p.id === p.id).score + '%', 'ok')}</a>`).join('')}</div>` : '<div class="sub">No active requirement matches this property.</div>') :
    `<div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)"><div class="li"><div class="grow"><b>Listed</b><div class="sub">Added by ${esc(ME().name)}</div></div><span class="sub">${esc(dateTxt(p.created))}</span></div>${S.visits.filter((v) => v.prop === p.id).map((v) => `<a class="li" href="#/visits/${v.id}"><div class="grow"><b>Visit ${v.id}</b><div class="sub">${esc(prosById(v.cid).name)} · ${esc(v.when)}</div></div>${statusBadge(v.status)}</a>`).join('')}</div>`;
  const phs = f && f.photoList.length ? f.photoList.length + ' photo' + (f.photoList.length === 1 ? '' : 's') : 'Cover photo';
  return page(esc(p.title) + ` <span class="mono sub" style="font-size:14px">${p.id}</span>`, esc(p.loc) + ' · ' + fmtPrice(p), (canW('properties') ? btn('Share', { k: 'ghost', a: `data-act="openModal" data-m="share" data-ids="${p.id}"` }) + btn('Schedule visit', { k: 'ghost', a: `data-act="openModal" data-m="visit" data-ids="${p.id}"` }) + btn('Edit', { i: 'edit', a: `data-act="editProperty" data-id="${p.id}"` }) : ''),
    `<div class="grid2"><div class="card">${tabsBar('propTab', [['overview', 'Overview'], ['matches', 'Matches ' + ms.length], ['activity', 'Activity']], tab)}${body}</div><div class="stack">${card(`<h2>Photos</h2>${coverBox('prop:' + p.id, 200, 0, 'Cover photo')}`)}${card(`<h2>Location</h2>${ph(150, 'Map preview')}${btn('Open in Maps', { k: 'sec', a: 'data-act="toast" data-t="Opens Google Maps in the live product"' })}`)}</div></div>${card(docPanel('prop:' + p.id))}`);
}
// Properties list screen with filters, import/export buttons.
function propertiesView() {
  // Filters currently applied to the property list.
  const q = (S.q.props || '').toLowerCase(); const pf = S.f.props; const st = S.tab.propStatus || 'all'; const cat = S.tab.propCat || 'all'; const so = S.tab.propSort || 'newest'; const within = Number(S.tab.within) || 0;
  let rows = S.props.filter((p) => (pf === 'all' || p.purpose === pf) && (cat === 'all' || p.cat === cat) && (st === 'all' || (st === 'done' ? ['Sold', 'Rented/Leased'].includes(p.status) : p.status === st)) && (!q || kw(hay(p, ((S.projects.find((x) => x.id === p.projectId) || {}).name || '')), q)) && (!within || (() => { const m = propComplMonths(p); return m !== null && m <= within; })()));
  // Price used for sorting: sale price, otherwise monthly rent.
  const pv = (p) => (p.purpose === 'sale' ? p.priceL : p.rentK) || 0;
  rows = rows.slice(); if (so === 'newest') rows.reverse(); else if (so === 'price_asc') rows.sort((a, b) => pv(a) - pv(b)); else if (so === 'price_desc') rows.sort((a, b) => pv(b) - pv(a)); else if (so === 'area') rows.sort((a, b) => b.area - a.area);
  const nd = S.props.filter((p) => p.status === 'Draft').length;
  const tbl = rows.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Property</th><th>Locality</th><th>Specs</th><th>Price / rent</th><th>Status</th><th class="hide-lg">Source</th>${rowActsTh()}</tr></thead><tbody>${rows.map((p) => { const cm = propComplMonths(p); return `<tr class="lnk" data-href="#/properties/${p.id}"><td><span class="mono sub" style="font-size:11px">${p.id}</span><div><b>${esc(p.title)}</b> ${badge(PURPOSE[p.purpose], p.purpose === 'rent' ? 'blue' : '')}</div><div class="sub" style="font-size:12px">${p.projectId ? esc(projById(p.projectId).name) : esc(p.unit)}${cm ? ' · completes in ~' + cm + ' mo' : ''}</div></td><td>${esc(p.loc)}</td><td class="sub">${p.bhk ? p.bhk + ' BHK · ' : ''}${p.area} sq ft · ${esc(p.furn)}</td><td><b>${fmtPrice(p)}</b></td><td>${statusBadge(p.status)}</td><td class="hide-lg">${esc(p.source)}</td>${rowActsTd('property', p.id)}</tr>`; }).join('')}</tbody></table></div>` : empty('No properties match', 'Try clearing a filter, or add a new property.', btn('Add property', { a: 'data-act="newProperty"', i: 'plus' }));
  return page('Properties', S.props.length + ' total · ' + S.props.filter((p) => p.status === 'Available').length + ' available' + (nd ? ' · ' + nd + ' draft' + (nd === 1 ? '' : 's') : ''), (canA('import') ? btn('Import', { k: 'sec', a: 'data-act="importFor" data-k="properties"' }) : '') + (canW('properties') ? btn('Add property', { i: 'plus', a: 'data-act="newProperty"' }) : ''),
    `<div class="head">${searchBox('q.props', 'Search properties — ID, locality, owner, BHK, project…')}${purposeSeg('props')}${fld('', 'tab.propCat', { opts: [['all', 'All categories'], ['Residential', 'Residential'], ['Commercial', 'Commercial'], ['Land', 'Land']], rer: 1, aria: 'Category', style: 'min-width:0;flex:none' })}${fld('', 'tab.propStatus', { opts: [['all', 'Any status'], ['Available', 'Available'], ['On hold', 'On hold'], ['Draft', 'Draft' + (nd ? ' (' + nd + ')' : '')], ['done', 'Sold / Rented / Leased']], rer: 1, aria: 'Status', style: 'min-width:0;flex:none' })}<div class="inp" style="width:200px;flex:none" title="Ready now, or expected to complete within this many months"><span class="pre">Ready within</span><input id="within" data-f="tab.within" data-render="1" value="${esc(S.tab.within || '')}" inputmode="numeric" placeholder="—" aria-label="Completion within months"><span class="suf">months</span></div><div class="grow"></div>${fld('', 'tab.propSort', { opts: [['newest', 'Newest first'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['area', 'Area: large to small']], rer: 1, aria: 'Sort by', style: 'min-width:0;flex:none;margin-left:auto' })}</div>${card(tbl, 'flush')}`);
}

// Filtered and sorted property rows for the list.
function ptRows(f) {
  const K = ptKind(f.cat, f.sub); const R = PT[K]; const o = []; const add = (k, v, suf?) => { if (v !== '' && v != null && v !== false) o.push([k, esc(v) + (suf || '')]); };
  if (R.baths) add('Bathrooms', f.baths); if (R.wash) add('Washrooms', f.washrooms); if (R.floor) { add('Floor', f.floor); add('Total floors', f.totalFloors); } if (R.floors) add('Floors', f.totalFloors); if (R.balc) add('Balconies', f.balconies); if (R.lift) add('Lift', f.lift);
  if (R.seats) add('Workstations / cabins', f.seats); if (R.front) add('Frontage', f.frontage, ' ft'); if (R.ht) add('Ceiling height', f.ceilHt, ' ft'); if (R.docks) add('Loading docks', f.docks); if (R.power) add('Power load', f.powerKva, ' kVA'); if (R.plotA) add('Plot area', f.plotArea, ' sq ft');
  if (R.plot) { if (f.plotL && f.plotW) add('Plot size', f.plotL + ' × ' + f.plotW, ' ft'); add('Road width', f.road, ' ft'); add('Land use', f.landUse); add('Boundary wall', f.wall); if (f.corner) o.push(['Corner plot', 'Yes']); }
  if (f.purpose === 'rent') { if (f.availFrom) o.push(['Available from', esc(dateTxt(f.availFrom))]); add('Lock-in', f.lockin, ' months'); if ((f.tenants || []).length) o.push(['Preferred tenants', f.tenants.map((x) => badge(x)).join(' ')]); } else { add('Ownership', f.tenure); if (f.negotiable) o.push(['Negotiable', 'Yes']); }
  if (f.gstOn) o.push(['GST', 'Applicable']);
  return o;
}

/* ------------------------------------------------------------ leads & prospects */
/* Leads, prospects, requirements and smart matching screens. */
// Prospect pipeline stages.
const STAGES = ['Lead', 'Contacted', 'Qualified', 'Prospect'];
// Sub-stages used inside the pipeline.
const SUBS = ['Requirement gathering', 'Properties offered', 'Site visit due', 'Site visit done', 'Interested', 'Not interested', 'Needs further info'];
/* ---- v4 leads, prospects, requirements, matching */
// Kinds of reference links a lead can carry.
const LINK_TYPES = ['Website / listing', 'Portal listing', 'Social media post', 'Ad / campaign', 'Video', 'Form / sheet', 'WhatsApp / chat', 'Document', 'Other'];
// Add https:// and trim a typed URL.
const normUrl = (u) => { u = String(u || '').trim(); if (!u) return ''; if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u; try { const x = new URL(u); if (!/^https?:$/.test(x.protocol) || !x.hostname.includes('.')) return ''; return x.href; } catch (e) { return ''; } };
// Host name of a URL for display.
const linkHost = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
// Guess the link type (portal, social ...) from its host.
const autoLinkType = (u) => { const h = linkHost(u).toLowerCase(); if (/facebook|instagram|linkedin|twitter|x\.com|t\.co|threads/.test(h)) return 'Social media post'; if (/youtube|youtu\.be|vimeo/.test(h)) return 'Video'; if (/99acres|magicbricks|housing|nobroker|commonfloor|squareyards|proptiger/.test(h)) return 'Portal listing'; if (/docs\.google|forms\.gle|typeform|airtable/.test(h)) return 'Form / sheet'; if (/wa\.me|whatsapp/.test(h)) return 'WhatsApp / chat'; if (/drive\.google|dropbox/.test(h)) return 'Document'; return 'Website / listing'; };
// Reference links card on a lead.
function linksCard(l) {
  S.d.lk = S.d.lk || { type: 'auto', url: '', note: '' }; const ls = l.links || [];
  return card(`<div class="head"><h2>Source links</h2><div class="grow"></div>${badge(ls.length + ' link' + (ls.length === 1 ? '' : 's'))}</div><div class="sub" style="margin-top:-6px">Keep every link this lead came from or is linked to — a portal listing, social post, ad, form, video or document.</div>
    <div class="list" style="margin:0 calc(var(--pad)*-1)">${ls.map((x, k) => `<div class="li"><span style="width:128px;flex:none">${badge(x.type, 'blue')}</span><div class="grow" style="min-width:0"><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--p);font-weight:600;overflow-wrap:anywhere">${esc(x.label || linkHost(x.url))}</a><div class="sub" style="font-size:12px;overflow-wrap:anywhere">${esc(x.url)}${x.note ? ' · ' + esc(x.note) : ''}</div></div>${btn('Open', { k: 'ghost sm', href: esc(x.url) }).replace('<a ', '<a target="_blank" rel="noopener noreferrer" ')}${btn('Copy', { k: 'sec sm', a: `data-act="linkCopy" data-id="${l.id}" data-k="${k}"` })}${btn('Remove', { k: 'sec sm', a: `data-act="linkRm" data-id="${l.id}" data-k="${k}"` })}</div>`).join('') || '<div class="li sub">No links added yet.</div>'}</div>
    <div class="row" style="align-items:flex-end">${fld('Link', 'd.lk.url', { ph: 'https://…', style: 'flex:3;min-width:220px' })}${fld('Type', 'd.lk.type', { opts: [['auto', 'Auto-detect'], ...LINK_TYPES], style: 'flex:1.2' })}${fld('Note (optional)', 'd.lk.note', { ph: 'e.g. Ad shown on 12 Oct', style: 'flex:2' })}<div style="flex:none;min-width:0">${btn('Add link', { i: 'plus', a: `data-act="linkAdd" data-id="${l.id}"` })}</div></div>`);
}
// Lead stages.
const LSTAGES = ['Lead', 'Qualified', 'Not qualified', 'Converted'];
// Display label for a lead stage ('Lead' shows as 'Open').
const lstLabel = (s) => (s === 'Lead' ? 'Open' : s);
// Coloured badge for a lead stage.
const lstBadge = (s) => badge(lstLabel(s), s === 'Qualified' ? 'ok' : s === 'Not qualified' ? 'err' : s === 'Converted' ? 'blue' : '');
/* pending requirements = prospects' active requirements + unconverted leads' basic requirement (qualified or not) */
// Turn a lead's basic budget into a requirement-like object for matching (mirrors the API's matching.ts).
function leadReq(l) { const b = l.basic || {}; if (!b.max && !b.min) return null; return { id: 'LEAD-' + l.id, lead: l.id, cid: null, purpose: l.intent === 'buy' ? 'sale' : 'rent', type: b.type || '', csub: b.csub || '', locs: b.locText ? [b.locText] : [], min: b.min || 0, max: b.max || 0, bhk: b.bhk || 0, area: 'Any', status: 'Active', who: l.name }; }
// Active requirements + leads with a budget — the 'pending requirements' list.
const pendingReqs = () => S.reqs.filter((r) => r.status === 'Active').concat(S.leads.filter((l) => l.stage !== 'Converted').map(leadReq).filter(Boolean));
// Name of the person behind a requirement.
const reqWho = (r) => (r.lead ? r.who : (prosById(r.cid) || { name: '—' }).name);
// 'Lead' or 'Prospect' tag of a requirement.
const reqTag = (r) => (r.lead ? 'Lead' : 'Prospect');
// Find saved requirements that a (new/changed) property now matches.
function findAlerts(p) {
  if (p.status !== 'Available') return;
  pendingReqs().forEach((r) => { const m = matchesFor(r).find((x) => x.p.id === p.id); if (m && m.score >= 60) S.alerts.unshift({ id: 'al' + Date.now() + r.id, prop: p.id, req: r.id, who: reqWho(r), kind: reqTag(r), score: m.score, why: m.why, at: iso(today), seen: false }); });
}
// Smart-matches screen.
function matchesView() {
  const pf = S.f.matches; const all = pendingReqs(); const mq = (S.q.matches || '').trim(); const list = all.filter((r) => (pf === 'all' || r.purpose === pf) && (!mq || kw(reqHay(r), mq)));
  if (!list.find((r) => r.id === S.tab.matchReq)) S.tab.matchReq = list[0] ? list[0].id : null;
  const r = list.find((x) => x.id === S.tab.matchReq); const sel = S.tab.matchSel || []; const ms = r ? matchesFor(r) : [];
  // Budget range text for a requirement (sale shows lakhs/crores, rent shows monthly).
  const rangeTxt = (x) => (x.purpose === 'sale' ? fmtL(x.min) + '–' + fmtL(x.max) : fmtRent(x.min) + '–' + fmtRent(x.max));
  return page('Matches', r ? ms.length + ' properties · best ' + (ms[0] ? ms[0].score : 0) + '%' : 'No requirement', btn('Send to client', { k: 'ghost', i: 'chat', a: 'data-act="shareSel"' }) + btn('Schedule visit', { a: 'data-act="visitSel"' }),
    `<div class="note">${ico('info', 18)}<div>Matching runs on <b>properties</b> against every pending requirement — prospects and leads, qualified or not.</div></div><div class="head">${purposeSeg('matches')}<div class="inp sel" style="min-width:300px"><select id="mreq" data-f="tab.matchReq" data-render="1" aria-label="Requirement">${list.map((x) => `<option value="${x.id}" ${x.id === S.tab.matchReq ? 'selected' : ''}>${esc(reqWho(x))} (${reqTag(x).toLowerCase()}) · ${PURPOSE[x.purpose]}${x.bhk ? ' · ' + x.bhk + ' BHK' : ''}</option>`).join('')}</select></div></div>
    ${r ? card(`<div class="sub">${esc(reqWho(r))} · ${esc(r.locs.join(', ') || 'Any area')} · ${rangeTxt(r)} · ${esc(r.area)}</div>` + (ms.length ? `<div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${ms.map((m) => `<div style="border-bottom:1px solid var(--line)"><div class="li" style="border:none">${chk(sel.includes(m.p.id), '', `data-act="matchSel" data-id="${m.p.id}" aria-label="Select ${m.p.id}"`)}<a class="grow" href="#/properties/${m.p.id}"><b>${propLabel(m.p)}</b><div class="sub">${esc(m.p.loc)} · ${m.p.area} sq ft · ${fmtPrice(m.p)}</div></a>${badge(m.score + '%', m.score >= 80 ? 'ok' : m.score >= 60 ? 'blue' : 'warn')}<button type="button" class="btn ghost sm" data-act="why" data-id="${m.p.id}">Why this?</button></div>${S.tab.why === m.p.id ? `<div style="padding:0 16px 14px 56px;display:flex;gap:8px;flex-wrap:wrap">${m.why.map((w) => `<span class="badge ${w[2] ? 'ok' : 'err'}">${w[2] ? '✓' : '✗'} ${w[0]} ${w[2] ? '+' + w[1] : ''}</span>`).join('')}</div>` : ''}</div>`).join('')}</div>` : '<div class="sub" style="padding:16px 0">No properties match this requirement yet.</div>')) : card('<div class="sub">Add a requirement or a lead with a basic requirement to see matches.</div>')}`);
}
// Leads list screen.
function leadsView() {
  const st = S.f.leads === 'All' || LSTAGES.includes(S.f.leads) ? S.f.leads : 'All'; const q = (S.q.leads || '').toLowerCase(); const pf = S.tab.leadPurpose || 'all';
  const base = S.leads.filter((l) => (pf === 'all' || (pf === 'sale' ? l.intent === 'buy' : l.intent === 'rent')) && (!q || kw(hay(l), q)));
  const rows = base.filter((l) => st === 'All' || l.stage === st);
  return page('Leads', S.leads.length + ' leads · ' + S.leads.filter((l) => l.stage === 'Lead').length + ' open', (canA('import') ? btn('Import', { k: 'sec', a: 'data-act="importFor" data-k="leads"' }) : '') + btn('Add lead', { i: 'plus', a: 'data-act="openModal" data-m="lead"' }),
    `<div class="head"><label class="search" style="max-width:360px;flex:1">${ico('search', 18)}<input id="lq" data-f="q.leads" data-render="1" value="${esc(S.q.leads || '')}" placeholder="Search by name or requirement" aria-label="Search leads" autocomplete="off"></label><div class="seg">${[['all', 'All'], ['sale', 'Sale'], ['rent', 'Rent/Lease']].map((x) => `<button type="button" class="${pf === x[0] ? 'on' : ''}" data-act="tab" data-k="leadPurpose" data-v="${x[0]}">${x[1]}</button>`).join('')}</div></div>
    <div class="tabs">${['All', ...LSTAGES].map((s) => `<button type="button" class="${st === s ? 'on' : ''}" data-act="filt" data-k="leads" data-v="${s}">${s === 'All' ? 'All' : lstLabel(s)} ${s === 'All' ? base.length : base.filter((l) => l.stage === s).length}</button>`).join('')}</div>
    ${card(rows.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Lead</th><th>Interest</th><th>Budget</th><th>Source</th><th>Status</th>${rowActsTh()}</tr></thead><tbody>${rows.map((l) => `<tr class="lnk" data-href="#/leads/${l.id}"><td><div style="display:flex;gap:10px;align-items:center"><div class="av">${initials(l.name)}</div><div><b>${esc(l.name)}</b> ${l.tags.map((t) => badge(t)).join(' ')}<span class="sub ph">${esc(maskNum(l.phone))}</span></div></div></td><td>${badge(l.intent === 'buy' ? 'Buy' : 'Rent/Lease', l.intent === 'rent' ? 'blue' : '')}<div class="sub" style="font-size:12px">${esc(l.want)}</div></td><td>${esc(l.budget)}</td><td>${esc(l.source)}</td><td>${l.stage === 'Lead' ? '<span class="sub">—</span>' : lstBadge(l.stage)}</td>${rowActsTd('lead', l.id)}</tr>`).join('')}</tbody></table></div>` : empty('No leads here', 'Nothing in this status yet.'), 'flush')}`);
}
// Lead detail: stages, activity log, notes, links, convert action.
function leadDetail(id) {
  const l = S.leads.find((x) => x.id === id); if (!l) return page('Lead not found', '', '', btn('Back', { href: '#/leads' }));
  const conv = l.stage === 'Converted'; const pr = l.prospectId ? prosById(l.prospectId) : S.prospects.find((c) => c.name === l.name);
  const b = l.basic || {};
  return page(esc(l.name), esc(maskNum(l.phone)) + ' · ' + esc(l.source), (!conv ? btn('Convert and add requirement', { a: `data-act="doConvert" data-id="${l.id}" data-req="1"` }) + btn('Convert only', { k: 'ghost', a: `data-act="doConvert" data-id="${l.id}"` }) : pr ? btn('Open prospect', { href: '#/prospects/' + pr.id }) : ''),
    `<div class="card"><div class="head"><b>Status</b>${l.stage === 'Lead' ? '<span class="sub">No status yet</span>' : lstBadge(l.stage)}<div class="grow"></div></div>${conv ? `<div class="note ok">${ico('check', 18)}<div>Converted to a prospect${pr ? ' — <a href="#/prospects/' + pr.id + '" style="color:var(--p);font-weight:600">' + esc(pr.name) + '</a>' : ''}. Reopen it if it was a mistake.</div></div>` : ''}
      <div class="chips">${!conv ? chip('Qualified', l.stage === 'Qualified', `data-act="leadStage" data-id="${l.id}" data-v="Qualified"`) + chip('Not qualified', l.stage === 'Not qualified', `data-act="leadStage" data-id="${l.id}" data-v="Not qualified"`) : ''}${l.stage !== 'Lead' ? chip('Reopen', false, `data-act="leadStage" data-id="${l.id}" data-v="Lead"`) : ''}</div><div class="sub" style="font-size:12px">Qualified or not, this lead’s basic requirement is still matched against new properties.</div></div>
    ${linksCard(l)}
    <div class="grid2"><div class="card"><h2>Activity</h2><div class="head"><div class="inp grow"><input id="f_d_note" data-f="d.note" placeholder="Add a note…"></div>${btn('Add note', { a: `data-act="leadNote" data-id="${l.id}"` })}${btn('WhatsApp', { k: 'ghost', i: 'chat', a: `data-act="leadLog" data-id="${l.id}" data-v="WhatsApp"` })}<span class="mobile-only">${btn('Call', { k: 'ghost', i: 'phone', a: `data-act="leadLog" data-id="${l.id}" data-v="Call"` })}</span></div>
    <div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${l.act.map((a) => `<div class="li"><span style="width:76px">${badge(a[0])}</span><div class="grow">${esc(a[1])}</div><span class="sub">${esc(a[2])}</span></div>`).join('') || '<div class="li sub">No activity yet.</div>'}</div></div>
    ${card(`<h2>Details</h2>${kv([['Phone', numCell('lead:' + l.id, l.phone, 'Lead number', l.name)], ['WhatsApp', l.waSame === false ? esc(l.wa || '—') : 'Same as phone'], ['Interest', l.intent === 'buy' ? 'Buy' : 'Rent/Lease'], ['Basic requirement', esc(l.want)], ['Budget', esc(l.budget)], ['Area / BHK', esc((b.locText || 'Any') + (b.bhk ? ' · ' + b.bhk + ' BHK' : ''))], ['Source', esc(l.source)], ['Tags', l.tags.map((t) => badge(t)).join(' ') || '—']])}${fld('Update basic requirement note', `leads.${S.leads.indexOf(l)}.want`, { rows: 2 })}`)}</div>${card(docPanel('lead:' + l.id, { title: 'Documents' }))}`);
}
// Prospects list screen.
function prospectsView() {
  const st = S.f.prospects; const q = (S.q.prospects || '').toLowerCase();
  const rows = S.prospects.filter((c) => (st === 'all' || (st === 'nri' ? c.nri : c.type === st)) && (!q || kw(hay(c), q)));
  // Count of prospects of one type.
  const cnt = (t) => S.prospects.filter((c) => c.type === t).length;
  return page('Prospects', S.prospects.length + ' prospects · ' + cnt('Buyer') + ' buyers · ' + cnt('Tenant') + ' tenants · ' + cnt('Owner') + ' owners', (canA('import') ? btn('Import', { k: 'sec', a: 'data-act="importFor" data-k="prospects"' }) : '') + btn('Add prospect', { i: 'plus', a: 'data-act="openModal" data-m="prospect"' }),
    `<div class="head">${searchBox('q.prospects', 'Name, phone, email')}<div class="chips">${[['all', 'All'], ['Buyer', 'Buyers'], ['Tenant', 'Tenants'], ['Owner', 'Owners'], ['nri', 'NRI']].map((x) => chip(x[1], st === x[0], `data-act="filt" data-k="prospects" data-v="${x[0]}"`)).join('')}</div></div>
    ${card(rows.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Prospect</th><th>Type</th><th>City</th><th>Source</th><th>Requirements</th>${rowActsTh()}</tr></thead><tbody>${rows.map((c) => `<tr class="lnk" data-href="#/prospects/${c.id}"><td><div style="display:flex;gap:10px;align-items:center"><div class="av">${initials(c.name)}</div><div><b>${esc(c.name)}</b> ${c.nri ? badge('NRI') : ''}<span class="sub ph">${esc(maskNum(c.phone))}</span></div></div></td><td>${badge(c.type, c.type === 'Tenant' ? 'blue' : '')}</td><td>${esc(c.city)}</td><td>${esc(c.source)}</td><td>${S.reqs.filter((r) => r.cid === c.id).length}</td>${rowActsTd('prospect', c.id)}</tr>`).join('')}</tbody></table></div>` : empty('No prospects here', 'Convert a lead or add a prospect directly.'), 'flush')}`);
}
// Modal for sharing selected properties with a prospect (WhatsApp/email).
function shareModal(m, wrap, cancel, D) {
  // Property ids chosen for a match share, and their documents.
  const ids = (m.ids || '').split(',').filter(Boolean); const docs = ids.flatMap((pid) => filesOf('prop:' + pid).filter((f) => f.share).map((f) => ({ pid, f })));
  const to = D.shareTo || ''; const c = prosById(to); const noWa = c && c.waOk === false;
  return wrap('Share properties', `<div class="sub">${ids.length} selected: ${esc(ids.join(', ') || 'none')}</div>${fld('Send to', 'd.shareTo', { opts: [['', 'Choose a prospect…'], ...S.prospects.map((x) => [x.id, x.name])], rer: 1 })}${noWa ? `<div class="note" style="background:var(--warn-soft);border-color:var(--warn-line);color:var(--warn)">${ico('info', 18)}<div>${esc(c.name)}’s number is flagged as <b>not on WhatsApp</b>. Send by email instead, or update the number.</div></div>` : ''}
    ${docs.length ? `<div class="card" style="background:var(--bg);gap:2px"><b>Include documents</b><div class="sub" style="font-size:12px;margin-bottom:4px">Only files marked Shareable can be sent. Owner ID and title papers never appear here.</div>${docs.map((x) => chk(S.d.shareSel[x.f.id] !== false, esc(x.f.name) + ' <span class="sub">· ' + x.pid + ' · ' + esc(x.f.cat) + '</span>', `data-act="shareDocTog" data-id="${x.f.id}"`)).join('')}</div>` : '<div class="sub" style="font-size:12px">No shareable documents on these properties yet.</div>'}
    <div class="card" style="background:var(--bg)"><b>WhatsApp</b><div class="sub">A short message with links to the PDF and the documents (links work 7 days).</div>${btn('Share via WhatsApp', { i: 'chat', a: 'data-act="shareVia" data-v="WhatsApp"' + (noWa || S.mailBusy ? ' disabled' : '') })}</div><div class="card" style="background:var(--bg)"><b>Email</b><div class="sub">One email with a PDF of the selected properties and the chosen documents attached.</div>${btn('Share via Email', { i: 'mail', k: 'ghost', a: 'data-act="shareVia" data-v="Email"' + (S.mailBusy ? ' disabled' : '') })}</div>`, cancel);
}



// Prospect profile: contact, requirements, visits, deals, documents.
function prospectProfile(id) {
  const c = prosById(id); if (!c) return page('Prospect not found', '', '', btn('Back', { href: '#/prospects' }));
  const tab = S.tab.prospect || 'overview'; const rq = S.reqs.filter((r) => r.cid === c.id); const vs = S.visits.filter((v) => v.cid === c.id); const ds = S.deals.filter((d) => d.cid === c.id); const fs = S.fus.filter((f) => f.who.startsWith(c.name));
  const ms = rq.flatMap((r) => matchesFor(r).map((m) => ({ ...m, r })));
  const body = { overview: kv([['Type', esc(c.type)], ['Phone', numCell('pros:' + c.id, c.phone, 'Prospect number', c.name) + (c.waOk === false ? ' <span class="badge err">Not on WhatsApp</span>' : '')], ['Email', esc(c.email || '—')], ['City', esc(c.city) + (c.nri ? ' · NRI' : '')], ['Language', esc(c.lang)], ['Source', esc(c.source)], ['Notes', esc(c.notes || '—')]]),
    reqs: rq.length ? `<div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${rq.map((r) => `<a class="li" href="#/requirements/${r.id}"><div class="grow"><b>${r.id}</b><div class="sub">${PURPOSE[r.purpose]}${reqSpec(r) ? ' · ' + reqSpec(r) : ''} · ${esc(r.locs.join(', '))}</div></div>${badge(r.status, r.status === 'Active' ? 'ok' : '')}</a>`).join('')}</div>` : '<div class="sub">No requirements yet.</div>',
    matches: ms.length ? `<div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${ms.map((m) => `<a class="li" href="#/properties/${m.p.id}"><div class="grow"><b>${propLabel(m.p)}</b><div class="sub">${fmtPrice(m.p)} · ${esc(m.p.loc)}</div></div>${badge(m.score + '%', 'ok')}</a>`).join('')}</div>` : '<div class="sub">No matches.</div>',
    visits: vs.length ? `<div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${vs.map((v) => `<a class="li" href="#/visits/${v.id}"><div class="grow"><b>${propLabel(propById(v.prop))}</b><div class="sub">${esc(v.when)}</div></div>${statusBadge(v.status)}</a>`).join('')}</div>` : '<div class="sub">No visits.</div>',
    fus: fs.length ? `<div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${fs.map((f) => `<div class="li"><div class="grow"><b>${esc(f.kind)}</b><div class="sub">${esc(f.note)}</div></div><span class="sub">${esc(f.when)}</span></div>`).join('')}</div>` : '<div class="sub">No follow-ups.</div>',
    deals: ds.length ? `<div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${ds.map((d) => `<a class="li" href="#/deals/${d.id}"><div class="grow"><b>${d.id}</b><div class="sub">${propLabel(propById(d.prop))} · ${PURPOSE[d.kind === 'lease' ? 'rent' : d.kind]}</div></div>${badge(STAGE_LABEL[d.stage])}</a>`).join('')}</div>` : '<div class="sub">No deals.</div>' }[tab];
  return page(esc(c.name) + (c.nri ? ' ' + badge('NRI') : ''), c.type + ' · ' + esc(maskNum(c.phone)), '<span class="mobile-only">' + btn('Call', { k: 'ghost', i: 'phone', a: 'data-act="toast" data-t="Calling…"' }) + '</span>' + btn('WhatsApp', { k: 'ghost', i: 'chat', a: 'data-act="toast" data-t="' + (c.waOk === false ? 'This number is not on WhatsApp — use email' : 'Opening WhatsApp…') + '"' }) + btn('Add requirement', { i: 'plus', a: `data-act="newReq" data-cid="${c.id}"` }),
    `<div class="card">${tabsBar('prospect', [['overview', 'Overview'], ['reqs', 'Requirements ' + rq.length], ['matches', 'Matches ' + ms.length], ['visits', 'Visits ' + vs.length], ['fus', 'Follow-ups ' + fs.length], ['deals', 'Deals ' + ds.length]], tab)}${body}</div>${card(docPanel('pros:' + c.id))}`);
}

/* ------------------------------------------------------------ requirements & matches */
// Extra requirement fields kept on the record (stored in the API's flexible JSON column, so no migration is needed).
const REQ_EXTRA = ['areaType', 'lift', 'floor', 'furn', 'tenant', 'lease', 'possession', 'pface', 'road', 'wall', 'use', 'pri', 'src', 'by'];
// Text a requirement is searched on: its own fields plus the client's name, phone and email.
const reqHay = (r) => { const c = prosById(r.cid) || {}; return hay(r, [c.name, c.phone, c.email, r.who].join(' ')); };
// Budget text of a requirement.
const reqBudget = (r) => (r.purpose === 'sale' ? fmtL(r.min) + ' – ' + fmtL(r.max) : fmtRent(r.min) + ' – ' + fmtRent(r.max));
const dash = (v) => (v === undefined || v === null || v === '' || v === '—' ? '—' : esc(String(v)));
// Requirements list screen: one row per client, with how many requirements they have.
function reqsView() {
  const q = (S.q.reqs || '').trim(); const ids = []; S.reqs.forEach((r) => { if (!ids.includes(r.cid)) ids.push(r.cid); });
  const clients = ids.map((id) => prosById(id)).filter(Boolean);
  const mine = (c) => S.reqs.filter((r) => r.cid === c.id);
  const rows = clients.filter((c) => !q || mine(c).some((r) => kw(reqHay(r), q)));
  const cnt = (s) => S.reqs.filter((r) => r.status === s).length;
  const tile = (n, l, bg, fg) => `<div style="background:${bg};border-radius:14px;padding:14px 16px"><div style="font-size:26px;font-weight:700;color:${fg}">${n}</div><div class="sub" style="font-weight:500">${l}</div></div>`;
  const w = canW('requirements');
  return page('Requirements', 'One row per client, with how many requirements they have.', w ? btn('Add requirement', { i: 'plus', a: 'data-act="newReq"' }) : '',
    `<div class="head">${searchBox('q.reqs', 'Search clients, locality, requirement ID…')}</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">${tile(clients.length, 'Clients', 'var(--line2)', 'var(--text)')}${tile(cnt('Active'), 'Active requirements', 'var(--p-soft)', 'var(--p)')}${tile(cnt('On hold'), 'On hold', 'var(--warn-soft, #fff3d6)', '#7a4e00')}${tile(cnt('Fulfilled'), 'Fulfilled', 'var(--ok-soft)', 'var(--ok)')}</div>
    ${card(rows.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Client</th><th>Requirements</th><th></th></tr></thead><tbody>${rows.map((c) => { const n = mine(c).length; return `<tr class="lnk" data-href="#/requirements/${mine(c)[0].id}"><td data-l="Client"><div style="display:flex;gap:12px;align-items:center"><div class="av">${initials(c.name)}</div><div><b>${esc(c.name)}</b><span class="sub ph">${esc(maskNum(c.phone))} · ${esc(c.type)}</span></div></div></td><td data-l="Requirements">${badge(n + (n === 1 ? ' requirement' : ' requirements'), 'blue')}</td><td style="text-align:right" data-l="Actions"><div class="nwrow">${btn('View', { k: 'ghost sm', href: '#/requirements/' + mine(c)[0].id })}${w ? btn('Add requirement for ' + esc(c.name.split(' ')[0]), { k: 'sm', a: `data-act="newReq" data-cid="${c.id}"` }) : ''}</div></td></tr>`; }).join('')}</tbody></table></div>` : empty(q ? 'No client matches “' + esc(q) + '”' : 'No requirements yet', q ? 'Try a name, phone, locality or requirement ID.' : 'Add a requirement to get started.'), 'flush')}`);
}
// Requirement detail: the client's requirements as tabs, then every detail of the chosen one.
function reqDetail(id) {
  const r = S.reqs.find((x) => x.id === id); if (!r) return page('Requirement not found', '', '', btn('Back', { href: '#/requirements' }));
  const c = prosById(r.cid) || { id: '', name: '—', type: '', phone: '', email: '' }; const sib = S.reqs.filter((x) => x.cid === r.cid); const w = canW('requirements');
  const k = reqKind(r); const sale = r.purpose === 'sale'; const res = k === 'flat' || k === 'house';
  const tabs = sib.map((x) => `<a class="chip${x.id === r.id ? ' on' : ''}" href="#/requirements/${x.id}">${PURPOSE[x.purpose]} · ${esc(reqSpec(x) ? reqSpec(x) + ' ' : '')}${esc(x.type)}</a>`).join('');
  const sec = (t, rows) => { rows = rows.filter((x) => x[1] !== '—' && x[1] !== undefined && x[1] !== ''); return rows.length ? card(`<h2>${t}</h2>${kv(rows)}`) : ''; };
  const locs = (r.locs || []).length ? (r.locs || []).map((l) => badge(l)).join(' ') : 'Any area';
  const stCls = r.status === 'Active' ? 'ok' : r.status === 'On hold' ? 'warn' : '';
  const sum = `${PURPOSE[r.purpose]} · ${reqSpec(r) ? reqSpec(r) + ' ' : ''}${r.type} · ${(r.locs || []).join(', ') || 'any area'} · ${reqBudget(r)}`;
  return page(esc(c.name) + ' ' + badge(r.id), esc(c.type) + ' · ' + esc(maskNum(c.phone)), (c.id ? btn('Open prospect', { k: 'sec', href: '#/prospects/' + c.id }) : '') + btn('WhatsApp', { k: 'ghost', i: 'chat', a: 'data-act="toast" data-t="Opening WhatsApp…"' }) + (w ? btn('Add requirement', { i: 'plus', a: `data-act="newReq" data-cid="${r.cid}"` }) : ''),
    `<div class="chips">${tabs}</div>
    <div class="grid2"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:var(--gap);align-items:start;min-width:0">
    ${sec('Property', [['Purpose', PURPOSE[r.purpose]], ['Type', esc(r.type)], [k === 'comm' ? 'Commercial type' : res ? 'Bedrooms' : 'Type', k === 'comm' ? dash(r.csub) : res ? (Number(r.bhk) ? r.bhk + ' BHK' : 'Any') : '—'], ['Facing', dash(r.pface)]])}
    ${sec('Budget and payment', [['Budget', reqBudget(r)], sale ? ['Financing', dash(r.fin)] : ['Lease length', dash(r.lease)], sale ? ['Possession', dash(r.possession)] : ['Tenant type', dash(r.tenant)], r.use ? ['Business use', dash(r.use)] : ['Furnishing', dash(r.furn)]])}
    ${card(`<h2>Location</h2><div class="chips">${locs}</div>`)}
    ${sec('Size and preferences', [['Area', dash(r.area)], ['Area measured as', dash(r.areaType)], ['Parking', dash(r.parking)], ['Lift required', dash(r.lift)], ['Floor', dash(r.floor)], ['Furnishing', dash(r.furn)], k === 'plot' ? ['Road width', r.road ? esc(r.road) + ' ft' : '—'] : ['', ''], k === 'plot' ? ['Boundary wall', dash(r.wall)] : ['', '']].filter((x) => x[0]))}
    ${sec('Timeline', [['Needed', dash(r.timeline)], ['Added on', dash(r.created)]])}
    </div><div class="stack">
    ${card(`<h2>Status</h2><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${badge(r.status, stCls)}${badge(r.pri || 'Normal', r.pri === 'Urgent' ? 'err' : r.pri === 'High' ? 'warn' : '')}</div>${kv([['Source', dash(r.src)], ['Handled by', dash(r.by)]])}${w ? `<div style="display:flex;gap:8px;flex-wrap:wrap">${btn('Edit', { k: 'ghost sm', a: `data-act="rowEdit" data-k="req" data-id="${r.id}"` })}${r.status === 'On hold' ? btn('Make active', { k: 'ghost sm', a: `data-act="setReqStatus" data-id="${r.id}" data-v="Active"` }) : btn('On hold', { k: 'ghost sm', a: `data-act="setReqStatus" data-id="${r.id}" data-v="On hold"` })}${r.status === 'Fulfilled' ? btn('Reopen', { k: 'ghost sm', a: `data-act="setReqStatus" data-id="${r.id}" data-v="Active"` }) : btn('Fulfilled', { k: 'ghost sm', a: `data-act="setReqStatus" data-id="${r.id}" data-v="Fulfilled"` })}${btn('Delete', { k: 'ghost sm', a: `data-act="rowDel" data-k="req" data-id="${r.id}"` })}</div>` : ''}`)}
    ${card(`<h2>Summary</h2><div class="sub">${esc(sum)}</div>`)}
    ${card(`<h2>Notes</h2><div class="sub">${esc(r.notes || 'No notes yet.')}</div>`)}
    ${card(docPanel('req:' + r.id, { title: 'Attachments' }))}</div></div>`);
}


/* ------------------------------------------------------------ visits, follow-ups */
/* Visits calendar and follow-up tasks. */
// Colour set per visit status.
const VSTYLE = { Scheduled: ['var(--p-soft)', 'var(--p)', 'var(--p-line)'], Confirmed: ['var(--ok-soft)', 'var(--ok)', 'var(--ok-line)'], Completed: ['var(--line2)', 'var(--muted)', 'var(--line)'], Cancelled: ['var(--err-soft)', 'var(--err)', 'var(--err)'] };
// Calendar grid start/end hours and row height.
const CAL_H0 = 8, CAL_H1 = 21, RH = 60;
// Visits after applying the status tab and search filters.
function visitsFiltered() { const st = S.tab.visitStatus || 'all', pf = S.f.visits, q = (S.q.visits || '').trim(); return S.visits.filter((v) => (pf === 'all' || propById(v.prop).purpose === pf) && (st === 'all' || v.status === st) && (!q || kw(hay(v, ((prosById(v.cid) || {}).name || '') + ' ' + ((prosById(v.cid) || {}).phone || '') + ' ' + (propById(v.prop) ? propById(v.prop).title + ' ' + propById(v.prop).loc : '')), q))).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)); }
// Arrange overlapping events into side-by-side lanes on the calendar.
function laneLayout(evs) {
  const out = []; let cl = [], end = 0;
  // Close the current group of overlapping calendar events: every event in it shares the same number of lanes.
  const flush = () => { const n = Math.max(1, ...cl.map((c) => c.lane + 1)); cl.forEach((c) => { c.lanes = n; }); out.push(...cl); cl = []; end = 0; };
  evs.forEach((v) => { const s = mins(v.time), e = s + (v.dur || 45); if (cl.length && s >= end) flush(); let lane = 0; while (cl.some((c) => c.lane === lane && c.e > s)) lane++; cl.push({ v, s, e, lane }); end = Math.max(end, e); });
  flush(); return out;
}
// Short label of a visit for calendar blocks.
const vLabel = (v) => { const c = prosById(v.cid); const p = propById(v.prop); return { name: c ? c.name : '—', prop: p ? p.id : '', pur: p ? (p.purpose === 'rent' ? 'R' : 'S') : '' }; };
// Day/week time-grid of the calendar.
function calGrid(days, all) {
  const hours = Array.from({ length: CAL_H1 - CAL_H0 }, (_, i) => CAL_H0 + i);
  const cols = `56px repeat(${days.length},minmax(${days.length > 1 ? 96 : 240}px,1fr))`;
  const head = `<div style="display:grid;grid-template-columns:${cols};border-bottom:1px solid var(--line)"><div></div>${days.map((d) => `<button type="button" class="calhead${iso(d) === iso(today) ? ' today' : ''}" data-act="calDay" data-d="${iso(d)}" aria-label="Open ${dayLbl(d)}"><span class="sub">${DOW[d.getDay()]}</span><b>${d.getDate()}</b></button>`).join('')}</div>`;
  const gutter = `<div>${hours.map((h) => `<div style="height:${RH}px;font-size:11px;color:var(--muted);text-align:right;padding:2px 8px 0 0">${fmt12(h + ':00').replace(':00', '')}</div>`).join('')}</div>`;
  const dayCols = days.map((d) => {
    const key = iso(d); const evs = laneLayout(all.filter((v) => v.date === key));
    return `<div style="position:relative;border-left:1px solid var(--line2);${key === iso(today) ? 'background:color-mix(in srgb,var(--p-soft) 35%,transparent)' : ''}">${hours.map((h) => `<button type="button" class="hcell" data-act="calSlot" data-d="${key}" data-h="${h}" aria-label="Schedule visit ${dayLbl(d)} ${fmt12(h + ':00')}"></button>`).join('')}${evs.map((c) => { const st = VSTYLE[c.v.status]; const top = Math.max(0, (c.s - CAL_H0 * 60) / 60 * RH); const h = Math.max(38, (c.e - c.s) / 60 * RH - 2); const w = 100 / c.lanes; const L = vLabel(c.v); return `<a class="calev" href="#/visits/${c.v.id}" data-act="noop" title="${esc(L.name)} · ${esc(L.prop)} · ${c.v.status}" style="top:${top}px;height:${h}px;left:calc(${c.lane * w}% + 2px);width:calc(${w}% - 4px);background:${st[0]};color:${st[1]};border-color:${st[2]};${c.v.status === 'Cancelled' ? 'text-decoration:line-through;' : ''}"><b>${fmt12(c.v.time).replace(' ', '')}</b> ${esc(L.name.split(' ')[0])}<br><span style="opacity:.85">${esc(L.prop)} · ${L.pur}</span></a>`; }).join('')}</div>`;
  }).join('');
  return `<div class="scroll-x"><div style="min-width:${days.length > 1 ? 760 : 0}px">${head}<div style="display:grid;grid-template-columns:${cols}">${gutter}${dayCols}</div></div></div>`;
}
// Month grid of the calendar.
function calMonth(all) {
  const a = parseISO(S.cal.anchor); const first = new Date(a.getFullYear(), a.getMonth(), 1); const start = weekStart(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return `<div class="scroll-x"><div style="min-width:720px"><div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-bottom:1px solid var(--line)">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div style="padding:8px 10px;font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">${d}</div>`).join('')}</div>
  <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr))">${cells.map((d) => { const key = iso(d); const ev = all.filter((v) => v.date === key); const out = d.getMonth() !== a.getMonth(); return `<div class="mcell${out ? ' out' : ''}" data-act="calSlot" data-d="${key}" data-h="10"><div style="display:flex;justify-content:space-between;align-items:center"><button type="button" class="calnum${key === iso(today) ? ' today' : ''}" data-act="calDay" data-d="${key}" aria-label="Open ${dayLbl(d)}">${d.getDate()}</button>${ev.length ? `<span class="sub" style="font-size:11px">${ev.length}</span>` : ''}</div>${ev.slice(0, 3).map((v) => { const st = VSTYLE[v.status]; const L = vLabel(v); return `<a class="mchip" href="#/visits/${v.id}" data-act="noop" style="background:${st[0]};color:${st[1]};border-color:${st[2]}"><b>${fmt12(v.time).replace(' ', '')}</b> ${esc(L.name.split(' ')[0])} · ${L.pur}</a>`; }).join('')}${ev.length > 3 ? `<button type="button" class="calmore" data-act="calDay" data-d="${key}">+${ev.length - 3} more</button>` : ''}</div>`; }).join('')}</div></div></div>`;
}
// Calendar widget (day / week / month) wrapper.
function calendarHtml(all) {
  const m = S.cal.mode; const a = parseISO(S.cal.anchor); let label, body;
  if (m === 'month') { label = MONTHS[a.getMonth()] + ' ' + a.getFullYear(); body = calMonth(all); }
  else if (m === 'day') { label = DOW[a.getDay()] + ', ' + a.getDate() + ' ' + MONTHS[a.getMonth()] + ' ' + a.getFullYear(); body = calGrid([a], all); }
  else { const w = weekStart(a); const e = addDays(w, 6); label = w.getDate() + ' ' + MONTHS[w.getMonth()].slice(0, 3) + ' – ' + e.getDate() + ' ' + MONTHS[e.getMonth()].slice(0, 3) + ' ' + e.getFullYear(); body = calGrid(Array.from({ length: 7 }, (_, i) => addDays(w, i)), all); }
  const legend = ['Scheduled', 'Confirmed', 'Completed', 'Cancelled'].map((s) => `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)"><span style="width:12px;height:12px;border-radius:3px;background:${VSTYLE[s][0]};border:1px solid ${VSTYLE[s][2]}"></span>${s}</span>`).join('');
  return `<div class="card flush"><div class="head" style="padding:14px 16px;border-bottom:1px solid var(--line)"><button type="button" class="btn sec sm" data-act="calNav" data-s="-1" aria-label="Previous" style="width:36px;padding:0">${ico('back', 18)}</button><button type="button" class="btn sec sm" data-act="calToday">Today</button><button type="button" class="btn sec sm" data-act="calNav" data-s="1" aria-label="Next" style="width:36px;padding:0;transform:none"><span style="display:flex;transform:scaleX(-1)">${ico('back', 18)}</span></button><h2 style="margin-left:6px">${label}</h2><div class="grow"></div><div class="seg">${[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map((x) => `<button type="button" class="${m === x[0] ? 'on' : ''}" data-act="calMode" data-v="${x[0]}">${x[1]}</button>`).join('')}</div></div>${body}<div class="head" style="padding:10px 16px;border-top:1px solid var(--line);gap:16px">${legend}<div class="grow"></div><span class="sub" style="font-size:12px">S = Sale · R = Rent/Lease · click an empty slot to schedule</span></div></div>`;
}
// Visits screen (calendar + list).
function visitsView() {
  const st = S.tab.visitStatus || 'all'; const vw = S.tab.visitView || 'cal'; const rows = visitsFiltered();
  const days = [...new Set(rows.map((v) => v.date))];
  const list = days.map((d) => card(`<h2>${esc(dayLbl(parseISO(d)))}${d === iso(today) ? ' · Today' : ''}</h2><div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${rows.filter((v) => v.date === d).map((v) => `<a class="li" href="#/visits/${v.id}"><span class="mono" style="width:70px;font-size:13px">${fmt12(v.time)}</span><div class="grow"><b>${esc(prosById(v.cid).name)}</b><div class="sub">${propLabel(propById(v.prop))} ${badge(PURPOSE[propById(v.prop).purpose], propById(v.prop).purpose === 'rent' ? 'blue' : '')}</div></div>${statusBadge(v.status)}${rowActs('visit', v.id)}</a>`).join('')}</div>`)).join('') || card(empty('No visits here', 'Schedule one from a property, a match or the calendar.'));
  return page('Visits', S.visits.filter((v) => ['Scheduled', 'Confirmed'].includes(v.status)).length + ' upcoming · ' + S.visits.filter((v) => v.date === iso(today) && v.status !== 'Cancelled').length + ' today', btn('Schedule visit', { i: 'plus', a: 'data-act="openModal" data-m="visit"' }),
    `<div class="head">${searchBox('q.visits', 'Search visits — client, property, status…')}<div class="seg">${[['cal', 'Calendar'], ['list', 'List']].map((x) => `<button type="button" class="${vw === x[0] ? 'on' : ''}" data-act="tab" data-k="visitView" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>${purposeSeg('visits')}<div class="chips">${['all', 'Scheduled', 'Confirmed', 'Completed', 'Cancelled'].map((x) => chip(x === 'all' ? 'All' : x, st === x, `data-act="tab" data-k="visitStatus" data-v="${x}"`)).join('')}</div></div>${vw === 'cal' ? calendarHtml(rows) : list}`);
}
// Visit detail with reschedule / outcome actions.
function visitDetail(id) {
  const v = S.visits.find((x) => x.id === id); if (!v) return page('Visit not found', '', '', btn('Back', { href: '#/visits' }));
  const p = propById(v.prop); const c = prosById(v.cid); const open = ['Scheduled', 'Confirmed'].includes(v.status);
  return page(v.id, esc(v.when), (open ? btn('Cancel visit', { k: 'danger', a: `data-act="visitStatus" data-id="${v.id}" data-v="Cancelled"` }) + btn('Reschedule', { k: 'ghost', a: `data-act="openModal" data-m="resched" data-id="${v.id}"` }) + (v.status === 'Scheduled' ? btn('Confirm', { k: 'ghost', a: `data-act="visitStatus" data-id="${v.id}" data-v="Confirmed"` }) : '') + btn('Mark completed', { a: `data-act="openModal" data-m="outcome" data-id="${v.id}"` }) : ''),
    `<div class="grid2"><div class="stack">${card(`${kv([['When', esc(v.when)], ['Status', statusBadge(v.status)], ['Prospect', `<a href="#/prospects/${c.id}" style="color:var(--p)">${esc(c.name)}</a>`], ['Property', `<a href="#/properties/${p.id}" style="color:var(--p)">${propLabel(p)}</a> ${badge(PURPOSE[p.purpose], p.purpose === 'rent' ? 'blue' : '')}`], ['Notes', esc(v.notes || '—')], ['Reminder', '1 hour before · WhatsApp']])}`)}${card(`<h2>Activity log</h2><div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${v.log.map((l, i) => `<div class="li"><div class="grow">${esc(l)}</div><span class="sub">${i === 0 ? 'Latest' : 'Earlier'}</span></div>`).join('')}</div>`)}</div>
    <div class="stack">${card(`<h2>Map</h2>${ph(180, 'Map preview')}${btn('Directions', { k: 'sec', a: 'data-act="toast" data-t="Opens Google Maps directions in the live product"' })}`)}${card(docPanel('visit:' + v.id, { title: 'Attachments' }))}</div></div>`);
}
// Follow-ups screen.
function followupsView() {
  const tab = S.tab.fu || 'today'; const pf = S.f.fus || 'all';
  // Follow-ups for a tab: done ones, or the open ones matching the person filter.
  const fq = (S.q.fus || '').trim(); const items = (k) => S.fus.filter((f) => (pf === 'all' || f.p === pf) && (!fq || kw(hay(f), fq)) && (k === 'done' ? f.done : !f.done && f.due === k));
  const list = items(tab);
  return page('Follow-ups', 'Your personal task list for leads and prospects', btn('Add follow-up', { i: 'plus', a: 'data-act="openModal" data-m="fu"' }),
    `<div class="head">${searchBox('q.fus', 'Search follow-ups — name, note, type…')}${seg([['all', 'All'], ['sale', 'Sale'], ['rent', 'Rent/Lease']], pf, 'fus')}</div>${tabsBar('fu', [['overdue', 'Overdue ' + items('overdue').length], ['today', 'Today ' + items('today').length], ['upcoming', 'Upcoming ' + items('upcoming').length], ['done', 'Done ' + items('done').length]], tab)}
    ${card(list.length ? `<div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${list.map((f) => `<div class="li fu"><div class="av">${initials(f.who)}</div><div class="grow"><b>${esc(f.who)}</b> ${PURPOSE[f.p] ? badge(PURPOSE[f.p], f.p === 'rent' ? 'blue' : '') : ''}<div class="sub">${esc(f.note)}</div></div>${badge(f.kind)}<span class="sub hide-m">${esc(f.when)}</span>${f.done ? badge('Done', 'ok') : btn('Snooze', { k: 'sec sm', a: `data-act="fuSnooze" data-id="${f.id}"` }) + btn('Mark done', { k: 'ghost sm', a: `data-act="fuDone" data-id="${f.id}"` })}${rowActs('fu', f.id)}</div>`).join('')}</div>` : empty('Nothing here', 'You’re all caught up.'))}`);
}

/* ------------------------------------------------------------ deals & brokerage */
/* Deals pipeline and brokerage/commission handling. */
// Display names of deal stages.
const STAGE_LABEL = { negotiation: 'Negotiation', agreed: 'Terms Agreed', token_paid: 'Token Received', agreement: 'Agreement Signed', registration: 'Registration', closed_won: 'Closed Won', lost: 'Closed Lost' };
// Deal pipeline order.
const STAGE_ORDER = ['negotiation', 'agreed', 'token_paid', 'agreement', 'registration', 'closed_won'];
// Win probability (%) per stage, used for the weighted pipeline value.
const PROB = { negotiation: 30, agreed: 45, token_paid: 55, agreement: 75, registration: 90, closed_won: 100, lost: 0 };
// 'sale' or 'rent' for a deal.
const dealPurpose = (d) => (d.kind === 'sale' ? 'sale' : 'rent');
// Format a deal amount according to its kind.
const dealPriceTxt = (d, v) => (d.kind === 'sale' ? fmtL(Number(v)) : fmtRent(Number(v)));
// Whole days between two yyyy-mm-dd dates.
const daysBetween = (a, b) => Math.round((+parseISO(b) - +parseISO(a)) / 86400000);
// Is the deal still open (not won/lost)?
const isOpen = (d) => !['closed_won', 'lost'].includes(d.stage);
// Open deal with no update for more than 7 days.
const isStale = (d) => isOpen(d) && d.upd && daysBetween(d.upd, iso(today)) > 7;
// Days the deal has spent in its current stage.
const stageDays = (d) => (d.stageSince ? Math.max(0, daysBetween(d.stageSince, iso(today))) : 0);
// Format rupees as ₹ Cr / ₹ L / ₹ amount.
const rupeesM = (n) => (n >= 1e7 ? '₹' + (n / 1e7).toFixed(2).replace(/\.?0+$/, '') + ' Cr' : n >= 1e5 ? '₹' + (n / 1e5).toFixed(2).replace(/\.?0+$/, '') + ' L' : inr(n));
// Brokerage amounts {buyer, owner} for a deal (percent or fixed).
function brokAmt(d) { const base = d.kind === 'sale' ? cp(d) * 1e5 : cp(d) * 1e3; const f = (x) => (d.bType === '%' ? Math.round(base * Number(x) / 100) : Number(x)); return { buyer: f(d.bBuyer), owner: f(d.bOwner) }; }
// Total brokerage of a deal.
const brokTotal = (d) => { const a = brokAmt(d); return a.buyer + a.owner; };
// Deal value in rupees.
const dealValue = (d) => (d.kind === 'sale' ? cp(d) * 1e5 : cp(d) * 1e3);
// Default document checklist for sale deals [name, responsible party].
const DOCS_SALE = [['Token receipt', 'broker'], ['Agreement to sell', 'lawyer'], ['Sale deed', 'lawyer'], ['Registration receipt', 'lawyer'], ['Loan sanction letter', 'bank'], ['NOC (society / builder)', 'owner'], ['KYC — buyer', 'client'], ['KYC — owner', 'owner'], ['Property tax receipt', 'owner']];
// Default document checklist for rental deals.
const DOCS_RENT = [['Rent agreement', 'lawyer'], ['Security deposit receipt', 'owner'], ['KYC — tenant', 'client'], ['KYC — landlord', 'owner'], ['Police verification', 'client'], ['Society NOC', 'owner']];
// Stage label (rentals call registration 'Registration / lease').
const stageLbl = (d, s) => (s === 'registration' && d.kind !== 'sale' ? 'Registration / notarization' : STAGE_LABEL[s]);
// Current price of a deal: closing, else bid, else asking.
const cp = (d) => Number(d.close) || Number(d.bid) || Number(d.ask) || 0;
// Is a lease ending within n days?
const leaseExpiring = (d, n) => d.kind !== 'sale' && d.stage === 'closed_won' && d.leaseEnd && daysBetween(iso(today), d.leaseEnd) >= 0 && daysBetween(iso(today), d.leaseEnd) <= n;
// Total contract value (rent x tenure for rentals).
const totalAmt = (d) => (d.kind === 'sale' ? cp(d) * 1e5 : cp(d) * 1e3 * (Number(d.tenure) || 0));
// Append an entry to a deal's timeline.
const mlog = (d, t, at?, by?) => { d.timeline.push({ t, by: by || ME().name, at: at || iso(today), seq: d.timeline.length + 100 }); d.upd = iso(today); };
// Build the starting timeline from a deal's data.
function genTimeline(d, c) {
  const tl = []; let n = 0; const sale = d.kind === 'sale'; const add = (t, at?, by?, k?) => { if (at) tl.push({ t, by: by || d.openedBy, at, seq: n++, k }); };
  const ld = S.leads.find((l) => c && l.name === c.name);
  if (ld) add('Lead created · ' + ld.source, iso(addDays(parseISO(d.created), -7)), ld.assigned);
  add('Deal created — ask ' + dealPriceTxt(d, d.ask), d.created);
  if (d.agreedOn) add('Negotiation successful — terms agreed' + (cp(d) ? ' at ' + dealPriceTxt(d, cp(d)) : ''), d.agreedOn, null, 'agreed');
  if (d.token && d.token.on) add('Token paid' + (d.token.amt ? ' ₹' + d.token.amt : ''), d.token.date || d.agreedOn, null, 'token');
  if (d.agr && d.agr.on) add(sale ? 'Agreement signed' : 'Rent agreement signed', d.agr.date, null, 'agr');
  if (d.reg && d.reg.on) add(sale ? 'Registration done' : 'Notarization done', d.reg.date, null, 'reg');
  if (d.stage === 'closed_won') { add(sale ? 'Closed — sold' : 'Closed — leased out', d.closedOn, d.closedBy, 'closed'); if (!sale && d.leaseStart) add('Lease commenced · ends ' + dateTxt(d.leaseEnd), d.leaseStart); }
  if (d.stage === 'lost') add('Deal lost — ' + d.lostReason, d.stageSince);
  return tl;
}
// Keep the payment schedule in sync with price/stage.
function syncSched(d) {
  if (d.kind === 'sale' || !d.sched) return;
  const r = cp(d) * 1e3; const sd = d.sched.find((x) => x.k === 'deposit'); const r1 = d.sched.find((x) => x.k === 'rent1');
  if (sd) { if (!d.depManual) sd.amt = Math.round(r * Number(d.depMonths || 0)); d.depAmt = sd.amt; sd.label = d.depManual ? 'Security deposit (custom amount)' : 'Security deposit (' + (Number(d.depMonths) || 0) + ' month' + (Number(d.depMonths) === 1 ? '' : 's') + ')'; }
  if (r1) r1.amt = Math.round(r);
}
// Get or create the brokerage record of a deal.
function ensureBrok(d) { let b = S.brok.find((x) => x.deal === d.id); if (!b) { b = { deal: d.id, due: iso(addDays(parseISO(d.agreedOn || iso(today)), 30)), pay: [] }; initBrok(b); S.brok.push(b); } return b; }
// Fill every optional block of a deal with defaults so the UI never hits undefined.
function initDeal(d) {
  const p = propById(d.prop) || {}; const c = prosById(d.cid) || {}; const sale = d.kind === 'sale';
  d.openedBy = d.openedBy || d.handled || 'Anil Sharma'; d.closedBy = d.closedBy || d.openedBy; delete d.handled;
  d.created = d.created || iso(addDays(parseISO(d.stageSince || iso(today)), -14));
  d.expected = d.expected || iso(addDays(today, 30)); d.stageSince = d.stageSince || iso(today); d.upd = d.upd || iso(today);
  ['token', 'agr', 'reg'].forEach((k) => { d[k] = d[k] || { on: false, amt: '', date: '', note: '' }; d[k].date = normDate(d[k].date) || d[k].date || ''; });
  d.offers = d.offers || []; d.tasks = d.tasks || []; d.notes = d.notes || '';
  if (d.bid == null) d.bid = (d.offers.filter((o) => o.by === 'buyer').slice(-1)[0] || {}).amt || d.close || '';
  if (d.stage !== 'negotiation' && d.stage !== 'lost' && !d.agreedOn) d.agreedOn = normDate(d.token.date) || d.stageSince;
  if (!sale) { d.tenure = d.tenure == null ? 11 : d.tenure; d.depMonths = d.depMonths == null ? 2 : d.depMonths; d.renewals = d.renewals || []; d.rem = d.rem || { days: [60, 30], to: { tenant: true, owner: true, team: true } }; if (d.leaseStart && !d.leaseEnd) d.leaseEnd = leaseEndOf(d.leaseStart, d.tenure); }
  // Deal has no document checklist yet.
  if (!d.docs) {
    d.docs = (sale ? DOCS_SALE : DOCS_RENT).map((x) => ({ name: x[0], who: x[1], st: 'Pending', req: '', rec: '' }));
    const mark = (n, st) => { const x = d.docs.find((y) => y.name === n); if (x) x.st = st; };
    if (d.token && d.token.on) mark('Token receipt', 'Verified'); if (d.agr && d.agr.on) mark(sale ? 'Agreement to sell' : 'Rent agreement', 'Received');
    if (d.reg && d.reg.on) { mark('Registration receipt', 'Verified'); mark('Sale deed', 'Verified'); }
    if (d.stage !== 'negotiation') { mark('KYC — buyer', 'Verified'); mark('KYC — tenant', 'Verified'); }
    if (d.stage === 'closed_won' && !sale) { mark('Security deposit receipt', 'Verified'); mark('KYC — landlord', 'Verified'); mark('Police verification', 'Received'); }
  }
  // Deal has no payment schedule yet.
  if (!d.sched) {
    if (sale) { const base = cp(d) * 1e5; const tk = Number(String(d.token.amt || '').replace(/[^0-9]/g, '')) || Math.round(base * 0.01); const ag = Math.round(base * 0.1); d.sched = [{ k: 'token', label: 'Token amount', amt: tk, due: 'On token', paid: !!d.token.on }, { k: 'agr', label: 'On agreement (10% of price)', amt: ag - tk > 0 ? ag - tk : ag, due: 'On agreement', paid: !!d.agr.on }, { k: 'reg', label: 'Balance on registration', amt: base - ag, due: 'On registration', paid: !!d.reg.on }]; }
    else { d.sched = [{ k: 'deposit', label: 'Security deposit', amt: 0, due: 'Before move-in', paid: d.stage === 'closed_won' }, { k: 'rent1', label: 'First month rent', amt: 0, due: 'Before move-in', paid: d.stage === 'closed_won' }]; }
  }
  syncSched(d);
  if (!d.loan) d.loan = { required: false, bank: '', amt: '', stage: 'Not started', applied: '', sanctioned: '', disbursed: '', contact: '' };
  ['applied', 'sanctioned', 'disbursed'].forEach((k) => { d.loan[k] = normDate(d.loan[k]) || d.loan[k] || ''; });
  if (!d.parties) d.parties = [{ role: sale ? 'Buyer' : 'Tenant', name: c.name || '—', phone: c.phone || '—' }, { role: sale ? 'Owner' : 'Landlord', name: p.owner || '—', phone: '+91 98••• ••015' }];
  if (!d.timeline) d.timeline = genTimeline(d, c);
  else d.timeline = d.timeline.map((t, i) => (Array.isArray(t) ? { t: t[0], by: t[1], at: normDate(t[2]) || iso(today), seq: i } : t));
  d.shares = d.shares || []; d.reqs = d.reqs || []; d.reqs.forEach((r) => { r.status = reqStatusOf(d, r); }); syncTL(d);
  d.prob = PROB[d.stage];
}
// Mark a deal as updated today.
const dlog = (d, _text?) => { d.upd = iso(today); };
// Document completion percentage for a deal.
function docsProgress(d) { const rel = d.docs.filter((x) => x.st !== 'Not applicable'); const done = rel.filter((x) => ['Received', 'Verified'].includes(x.st)).length; return { done, total: rel.length, pct: rel.length ? Math.round(done / rel.length * 100) : 0 }; }
// Thin progress bar.
const bar = (pct, k?) => `<span style="display:block;height:6px;background:var(--line2);border-radius:3px;overflow:hidden"><span style="display:block;height:100%;width:${pct}%;background:${k || 'var(--p)'}"></span></span>`;

// Deals screen: board/list with stage filters and totals.
function dealsView() {
  const pf = S.f.deals; const q = (S.q.deals || '').toLowerCase(); const vw = S.tab.dealView || 'board'; const who = S.tab.dealWho || 'all';
  const ds = S.deals.filter((d) => (pf === 'all' || dealPurpose(d) === pf) && (who === 'all' || d.openedBy === who || d.closedBy === who) && (!q || (d.id + prosById(d.cid).name + propLabel(propById(d.prop))).toLowerCase().includes(q)));
  const open = ds.filter(isOpen); const lost = ds.filter((d) => d.stage === 'lost'); const won = ds.filter((d) => d.stage === 'closed_won');
  // True when the deal closed in the current month.
  const thisMonth = (d) => d.closedOn && d.closedOn.slice(0, 7) === iso(today).slice(0, 7);
  const sv = open.filter((d) => d.kind === 'sale').reduce((a, d) => a + dealValue(d), 0); const rv = open.filter((d) => d.kind !== 'sale').reduce((a, d) => a + dealValue(d), 0);
  const pot = open.reduce((a, d) => a + brokTotal(d), 0); const wpot = open.reduce((a, d) => a + brokTotal(d) * PROB[d.stage] / 100, 0);
  const soon = open.filter((d) => d.kind === 'sale' && daysBetween(iso(today), d.expected) <= 30).length;
  const exp = ds.filter((d) => leaseExpiring(d, 60)).length;
  const wonM = won.filter(thisMonth); const wonBrok = wonM.reduce((a, d) => a + brokTotal(d), 0);
  const rate = won.length + lost.length ? Math.round(won.length / (won.length + lost.length) * 100) : 0;
  const tiles = [['Open deals', open.length, open.filter((d) => d.kind === 'sale').length + ' sale · ' + open.filter((d) => d.kind !== 'sale').length + ' rent/lease'], ['Pipeline value', (sv ? rupeesM(sv) : '—'), rv ? '+ ' + inr(rv) + '/mo rentals' : 'Sale deals only'], ['Potential brokerage', rupeesM(pot), 'Weighted ' + rupeesM(Math.round(wpot))], ['Won this month', wonM.length, rupeesM(wonBrok) + ' brokerage']];
  const watch = [[soon, 'sales closing in 30 days'], [exp, 'leases ending in 60 days'], [open.filter(isStale).length, 'stale (7+ days)'], [rate + '%', 'win rate · ' + won.length + ' won, ' + lost.length + ' lost']];
  const cols = STAGE_ORDER.concat('lost');
  // Date caption shown on a deal card.
  const dateLine = (d) => (d.stage === 'closed_won' ? (d.kind === 'sale' ? 'Closed ' + dayLbl(parseISO(d.closedOn || d.expected)) : 'Lease ' + (d.leaseStart ? dstr(parseISO(d.leaseStart)) : '—') + ' → ' + (d.leaseEnd ? dstr(parseISO(d.leaseEnd)) : '—')) : d.kind === 'sale' ? 'Day ' + stageDays(d) + ' in stage · closes ' + dayLbl(parseISO(d.expected)) : 'Day ' + stageDays(d) + ' in stage · ' + (d.leaseStart ? 'lease from ' + dstr(parseISO(d.leaseStart)) : 'lease dates not set'));
  // One deal card in the pipeline board.
  const cardOf = (d) => { const dp = docsProgress(d); return `<div class="kcard" data-href="#/deals/${d.id}" style="cursor:pointer"><div class="head" style="gap:6px"><span class="mono sub" style="font-size:11px">${d.id}</span><div class="grow"></div>${isStale(d) ? badge('Stale', 'warn') : ''}${d.stage !== 'closed_won' ? badge(PROB[d.stage] + '%') : ''}${rowActs('deal', d.id)}</div><b>${esc(prosById(d.cid).name)}</b><div class="sub" style="font-size:12px">${propLabel(propById(d.prop))}</div><div class="head" style="gap:6px">${badge(d.kind === 'sale' ? 'Sale' : 'Rent/Lease', d.kind === 'sale' ? '' : 'blue')}<b>${dealPriceTxt(d, cp(d))}</b></div><div class="sub" style="font-size:12px">Brokerage ${inr(brokTotal(d))} · ${esc(d.openedBy.split(' ')[0])}${d.closedBy !== d.openedBy ? ' → ' + esc(d.closedBy.split(' ')[0]) : ''}</div><div style="display:flex;align-items:center;gap:8px"><span style="flex:1">${bar(dp.pct, dp.pct === 100 ? 'var(--ok)' : 'var(--p)')}</span><span class="sub" style="font-size:11px">Docs ${dp.done}/${dp.total}</span></div><div class="sub" style="font-size:11px">${dateLine(d)}</div>${d.stage === 'lost' ? `<div class="sub" style="font-size:12px;color:var(--err)">${esc(d.lostReason)}${d.lostFrom && d.lostFrom !== 'negotiation' ? ' · lost at ' + esc(STAGE_LABEL[d.lostFrom]) : ''}</div><button type="button" class="btn sec sm" data-act="reopenDeal" data-id="${d.id}">Reopen</button>` : ''}</div>`; };
  const board = `<div class="kan">${cols.map((c) => { const cs = ds.filter((d) => d.stage === c); const val = cs.reduce((a, d) => a + (d.kind === 'sale' ? dealValue(d) : 0), 0); const br = cs.reduce((a, d) => a + brokTotal(d), 0); return `<div class="kcol${c === 'lost' ? ' kbad' : ''}"><div class="head" style="padding:2px 4px"><b style="${c === 'lost' ? 'color:var(--err)' : ''}">${c === 'lost' ? 'Closed Lost' : STAGE_LABEL[c]}</b><div class="grow"></div><span class="sub">${cs.length}</span></div>${c === 'agreed' ? '<div class="sub" style="font-size:11px;padding:0 4px">Terms agreed — awaiting token</div>' : ''}${c === 'lost' ? '' : `<div class="sub" style="font-size:11px;padding:0 4px">${val ? rupeesM(val) + ' · ' : ''}Brokerage ${rupeesM(br)}</div>`}${cs.map(cardOf).join('') || '<div class="sub" style="padding:8px">—</div>'}</div>`; }).join('')}</div>`;
  const listRows = ds.filter((d) => d.stage !== 'lost').sort((a, b) => a.expected.localeCompare(b.expected));
  const listV = card(`<div class="scroll-x"><table class="tbl"><thead><tr><th>Deal</th><th>Type</th><th>Value</th><th>Brokerage</th><th>Stage</th><th>Docs</th><th>Dates</th><th>Opened / closed by</th>${rowActsTh()}</tr></thead><tbody>${listRows.map((d) => { const dp = docsProgress(d); return `<tr class="lnk" data-href="#/deals/${d.id}"><td><b>${d.id}</b> ${isStale(d) ? badge('Stale', 'warn') : ''}<div class="sub" style="font-size:12px">${esc(prosById(d.cid).name)} · ${d.prop}</div></td><td>${badge(d.kind === 'sale' ? 'Sale' : 'Rent/Lease', d.kind === 'sale' ? '' : 'blue')}</td><td><b>${dealPriceTxt(d, cp(d))}</b></td><td>${inr(brokTotal(d))}</td><td>${badge(STAGE_LABEL[d.stage], d.stage === 'closed_won' ? 'ok' : 'blue')}<div class="sub" style="font-size:11px">${d.stage === 'closed_won' ? '' : 'Day ' + stageDays(d) + ' · ' + PROB[d.stage] + '% likely'}</div></td><td style="min-width:110px">${bar(dp.pct)}<div class="sub" style="font-size:11px">${dp.done}/${dp.total}</div></td><td class="sub">${d.kind === 'sale' ? 'Expected ' + esc(dayLbl(parseISO(d.expected))) : esc(d.leaseStart ? dstr(parseISO(d.leaseStart)) + ' → ' + (d.leaseEnd ? dstr(parseISO(d.leaseEnd)) : '—') : 'Lease dates not set')}</td><td>${esc(d.openedBy)}${d.closedBy !== d.openedBy ? '<div class="sub" style="font-size:11px">closed by ' + esc(d.closedBy) + '</div>' : ''}</td>${rowActsTd('deal', d.id)}</tr>`; }).join('')}</tbody></table></div>`, 'flush');
  const reasons = {}; lost.forEach((d) => { reasons[d.lostReason] = (reasons[d.lostReason] || 0) + 1; });
  const insight = card(`<h2>Win / loss</h2><div class="row"><div>${kv([['Won', won.length], ['Lost / failed', lost.length], ['Win rate', rate + '%'], ['Avg. brokerage / won deal', won.length ? inr(Math.round(won.reduce((a, d) => a + brokTotal(d), 0) / won.length)) : '—']])}</div><div><div class="sub" style="margin-bottom:6px">Why negotiations failed or deals were lost</div>${Object.keys(reasons).map((r) => `<div style="display:flex;gap:8px;align-items:center;min-height:32px"><span style="width:150px;font-size:13px">${esc(r)}</span><span style="flex:1">${bar(reasons[r] / lost.length * 100, 'var(--err)')}</span><b>${reasons[r]}</b></div>`).join('') || '<div class="sub">None yet.</div>'}</div></div>`);
  return page('Deals', open.length + ' open · ' + rupeesM(pot) + ' potential brokerage', btn('Create deal', { i: 'plus', a: 'data-act="newDeal"' }),
    `<div class="figs kf">${tiles.map((t) => `<div class="fig"><small>${t[0]}</small><b style="font-size:22px">${t[1]}</b><span class="sub" style="font-size:11px">${t[2]}</span></div>`).join('')}</div><div class="watch">${watch.map((w) => `<span><b>${w[0]}</b> ${w[1]}</span>`).join('')}</div>
    <div class="head">${searchBox('q.deals', 'Deal ID, prospect, property')}${purposeSeg('deals')}<div class="grow"></div><div class="seg">${[['board', 'Board'], ['list', 'List']].map((x) => `<button type="button" class="${vw === x[0] ? 'on' : ''}" data-act="tab" data-k="dealView" data-v="${x[0]}">${x[1]}</button>`).join('')}</div></div>
    ${vw === 'board' ? board : listV}
    ${insight}`);
}
// Lease-specific form fields (tenure, lock-in, deposit...).
function leaseFields(P, d, hasId?) {
  const dm = Number(d.depMonths) || 0; const rent = (Number(d.close) || Number(d.bid) || Number(d.ask) || 0) * 1000;
  return `<div class="card" style="background:var(--bg)"><h2>Lease term</h2><div class="row">${fld('Lease start', P + 'leaseStart', { type: 'date', rer: 1 })}${fld('Tenure', P + 'tenure', { suf: 'months', rer: 1, hint: 'e.g. 11 months' })}${fld('Lease end', P + 'leaseEnd', { type: 'date', rer: 1, hint: 'Calculated from start + tenure — you can edit it' })}</div>
  <div class="row">${fld('Security deposit', P + 'depMonths', { suf: 'months of rent', rer: 1, hint: 'Suggested 2 months — change it for each deal' })}<div class="fld"><span class="l">Deposit amount</span><div class="inp" style="background:var(--line2)"><span class="pre">₹</span><input value="${rent ? Math.round(rent * dm).toLocaleString('en-IN') : '—'}" readonly aria-label="Deposit amount"></div><small>Editable on the deal after it is created</small></div></div></div>`;
}
// New deal form.
function dealForm() {
  const d = S.d.deal; const P = 'd.deal.'; const p = propById(d.prop); const sale = d.kind !== 'rent' && d.kind !== 'lease'; const unit = sale ? 'lakh' : '/mo ×1000';
  return page('Create deal', 'New deals start in Negotiation — add the closing price once terms are agreed', btn('Cancel', { k: 'sec', href: '#/deals' }) + btn('Create deal', { a: 'data-act="saveDeal"' }),
    `<div class="card"><div class="row">${fld('Buyer / tenant', P + 'cid', { opts: S.prospects.map((c) => [c.id, c.name]) })}${fld('Property', P + 'prop', { opts: [['', '— choose —']].concat(S.props.filter((x) => (x.status === 'Available' || x.status === 'On hold') && x.purpose === (sale ? 'sale' : 'rent')).map((x) => [x.id, propLabel(x)])), rer: 1, hint: sale ? 'Showing properties for sale' : 'Showing properties for rent / lease' })}</div>
    <div class="fld"><span class="l">Deal type</span>${purposeSet(P + 'kind', sale ? 'sale' : 'rent')}</div>
    <div class="row">${fld('Ask price (owner’s)', P + 'ask', { pre: '₹', suf: unit, hint: p ? 'Property is listed at ' + fmtPrice(p) + ' — leave blank to use it' : '' })}${fld('Bid (buyer’s offer)', P + 'bid', { pre: '₹', suf: unit, hint: 'Latest offer from the ' + (sale ? 'buyer' : 'tenant') })}${fld('Closing price', P + 'close', { pre: '₹', suf: unit, hint: 'Optional now — set it when terms are agreed' })}</div>
    <div class="row">${fld('Deal opened on', P + 'opened', { type: 'date' })}${sale ? fld('Expected closing', P + 'expected', { type: 'date', hint: 'Used for forecasting and “closing soon”' }) : ''}</div>
    ${sale ? '' : leaseFields(P, d)}
    <div class="card" style="background:var(--bg)"><h2>Brokerage</h2><div class="seg" style="align-self:flex-start">${[['%', '% of price'], ['fixed', 'Fixed value']].map((x) => `<button type="button" class="${d.bType === x[0] ? 'on' : ''}" data-act="setf" data-p="d.deal.bType" data-v="${x[0]}">${x[1]}</button>`).join('')}</div><div class="row">${fld(sale ? 'From buyer' : 'From tenant', P + 'bBuyer', { suf: d.bType === '%' ? '%' : '₹' })}${fld(sale ? 'From owner' : 'From landlord', P + 'bOwner', { suf: d.bType === '%' ? '%' : '₹' })}</div><div class="sub">Entered per deal. Via an associate broker, usually one side only. GST is optional and set later, per party.</div></div>
    <div class="row"><div class="card" style="background:var(--bg)"><b>${sale ? 'Buyer’s' : 'Tenant’s'} lead source</b><div class="sub">${esc(prosById(d.cid).source)} · read-only</div></div><div class="card" style="background:var(--bg)"><b>${sale ? 'Seller’s' : 'Owner’s'} lead source</b><div class="sub">${esc(p ? p.source : '—')} · read-only</div></div></div>
    ${fld('Notes', P + 'notes', { rows: 3 })}<div class="sub" style="font-size:12px">A unique Deal ID is generated on submit. The documents vault and payment schedule are created automatically.</div></div>`);
}

// Click handler (delegated): closes pop-ups, runs ACTS[data-act], follows in-app links with pushState, opens table rows.
_doc.addEventListener('click', (e) => { const k = e.target.closest && e.target.closest('.kcard[data-href]'); if (k && !e.target.closest('button,a')) go(k.dataset.href); });

// Reminder schedule text for payments.
function remSchedule(d) {
  const end = d.leaseEnd; if (!end) return [];
  // Reminder settings: days before due, and who is notified.
  const days = (d.rem.days || []).slice().sort((a, b) => b - a); const to = d.rem.to || {};
  const who = [['tenant', 'tenant'], ['owner', 'owner / landlord'], ['team', 'internal team']].filter((x) => to[x[0]]);
  return days.map((n) => { const at = iso(addDays(parseISO(end), -n)); const diff = daysBetween(iso(today), at); return { n, at, diff, who: who.map((x) => x[1]) }; });
}
// Deal detail page with tabs: overview, offers, parties, documents, brokerage, timeline.
function dealDetail(id) {
  const i = S.deals.findIndex((x) => x.id === id); if (i < 0) return page('Deal not found', '', '', btn('Back', { href: '#/deals' }));
  const d = S.deals[i]; initDeal(d); const p = propById(d.prop); const c = prosById(d.cid); const b = brokAmt(d); const closed = ['closed_won', 'lost'].includes(d.stage); const sale = d.kind === 'sale';
  let tab = S.tab.dealTab || 'overview'; if (tab === 'lease' && sale) tab = 'overview';
  const dp = docsProgress(d); const bk = S.brok.find((x) => x.deal === d.id);
  const sidx = STAGE_ORDER.indexOf(d.stage);
  const lostAt = d.stage === 'lost' ? STAGE_ORDER.indexOf(d.lostFrom || 'negotiation') : -1;
  const negFail = d.stage === 'lost' && lostAt <= 0;
  const tracker = `<div class="stp">${STAGE_ORDER.map((s, k) => { let st = ''; if (d.stage === 'lost') st = k < lostAt ? 'done' : k === lostAt ? 'bad' : 'lock'; else if (k < sidx || d.stage === 'closed_won') st = 'done'; else if (k === sidx) st = 'cur'; else st = 'lock'; return `<div class="${st}"><i>${st === 'done' ? '✓' : st === 'bad' ? '✗' : k + 1}</i><span>${k === 0 && negFail ? 'Closed Lost' : (s === 'registration' ? (sale ? 'Registration' : 'Notarization') : stageLbl(d, s))}</span></div>`; }).join('')}</div>`;
  const decision = d.stage === 'negotiation' ? `<div class="decide"><div><b>Negotiation in progress</b><div class="sub">Log offers on the Offers tab. When the talks end, record the outcome — the next steps open only if it is successful.</div></div><div class="dbtns"><button type="button" class="btn lg" data-act="openModal" data-m="agree" data-id="${d.id}">${ico('check', 18)} Negotiation successful</button><button type="button" class="btn danger lg" data-act="openModal" data-m="lost" data-id="${d.id}">${ico('close', 18)} Mark as Closed Lost</button></div></div>` : d.stage === 'lost' ? `<div class="decide bad"><div><b>${negFail ? 'Closed Lost' : 'Deal lost'}</b><div class="sub">${esc(d.lostReason || '')}${d.lostOn ? ' · ' + esc(dateTxt(d.lostOn)) : ''}</div></div><div class="dbtns"><button type="button" class="btn sec" data-act="reopenDeal" data-id="${d.id}">Reopen deal</button></div></div>` : '';
  // One milestone row (token / agreement / registration) with its checkbox and optional amount.
  const msRow = (k, label, amt?) => `<div class="mrow">${chk(d[k].on, `<b>${label}</b>`, `data-act="dealTog" data-i="${i}" data-k="${k}" ${closed ? 'disabled' : ''}`)}${amt ? `<div style="width:150px">${fld('', `deals.${i}.${k}.amt`, { pre: '₹', aria: 'Token amount' })}</div>` : ''}<div style="width:160px">${fld('', `deals.${i}.${k}.date`, { type: 'date', aria: label + ' date' })}</div><div style="flex:1;min-width:160px">${fld('', `deals.${i}.${k}.note`, { ph: 'Note (optional)', aria: label + ' note' })}</div></div>`;
  const dealTasks = `<h2>Next actions</h2>${d.tasks.map((t, k) => `<div style="display:flex;gap:8px;align-items:center">${chk(t.done, `<span style="${t.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(t.t)}</span>`, `data-act="taskTog" data-i="${i}" data-k="${k}"`)}<div class="grow"></div>${!t.done && t.due < iso(today) ? badge('Overdue', 'err') : ''}<span class="sub" style="font-size:12px">${esc(dayLbl(parseISO(t.due)))}</span></div>`).join('') || '<div class="sub">No tasks yet.</div>'}<div class="head"><div class="inp grow"><input id="f_d_task_t" data-f="d.task.t" value="${esc(S.d.task.t)}" placeholder="Add a task…"></div><div class="inp" style="width:150px"><input type="date" data-f="d.task.due" value="${esc(S.d.task.due)}" aria-label="Task due date"></div>${btn('Add', { k: 'ghost', a: `data-act="taskAdd" data-i="${i}"` })}</div>`;
  const tn = sale ? 'Buyer' : 'Tenant', on = sale ? 'Owner' : 'Landlord';
  const leaseLine = !sale ? ['Lease term', d.leaseStart ? `${esc(dateTxt(d.leaseStart))} → ${esc(dateTxt(d.leaseEnd))} <span class="sub">· ${Number(d.tenure) || 0} months</span>` : '<span class="sub">Not set yet — add it under Lease &amp; renewal</span>'] : null;

  // Two-column key/value block.
  const kv2 = (rows) => `<div class="kv2">${rows.map(([k, v]) => `<div><small>${k}</small><span>${v}</span></div>`).join('')}</div>`;
  const overview = `<div class="grid2"><div class="stack">
    ${card(`<h2>Deal details</h2>${kv2([[tn, `<a href="#/prospects/${c.id}" style="color:var(--p)">${esc(c.name)}</a>`], [on, esc(p.owner || '—')], ['Property', `<a href="#/properties/${p.id}" style="color:var(--p)">${propLabel(p)}</a>`], [sale ? 'Address' : 'Premises', esc(p.unit) + ' · ' + esc(p.loc)], ['Ask', dealPriceTxt(d, d.ask)], ['Bid', dealPriceTxt(d, d.bid)], ['Closing price', d.close ? '<b>' + dealPriceTxt(d, d.close) + '</b>' : '<span class="sub">Set when terms are agreed</span>'], [sale ? 'Total amount' : 'Total rent for term', totalAmt(d) ? '<b>' + inr(totalAmt(d)) + '</b>' : '—'], ...(leaseLine ? [leaseLine] : []), ['Lead source', esc(c.source) + ' → ' + esc(p.source)], ['Brokerage', 'Total <b>' + inr(b.buyer + b.owner) + '</b> · ' + tn.toLowerCase() + ' ' + inr(b.buyer) + ' · ' + on.toLowerCase() + ' ' + inr(b.owner)]])}
      <div class="sep"></div><div class="row tight">${fld('Opened on', `deals.${i}.created`, { type: 'date' })}${fld('Finalizing date', `deals.${i}.agreedOn`, { type: 'date' })}${sale ? fld('Expected closing', `deals.${i}.expected`, { type: 'date' }) : ''}${sale && d.stage === 'closed_won' ? fld('Completion date', `deals.${i}.closedOn`, { type: 'date' }) : ''}</div>`)}
    ${card(`<h2>Milestones</h2><div class="sub" style="margin-top:-6px">Tick in order once the negotiation succeeds.</div>${d.stage === 'negotiation' ? `<div class="note">${ico('info', 18)}<div>Locked until the negotiation is marked successful.</div></div>` : ''}<div class="mlist${d.stage === 'negotiation' || d.stage === 'lost' ? ' locked' : ''}">${msRow('token', sale ? 'Token amount paid' : 'Token / advance paid', true)}${msRow('agr', sale ? 'Agreement signed' : 'Rent agreement signed')}${msRow('reg', sale ? 'Registration' : 'Notarization / registration')}</div>`)}
    </div>
    <div class="stack">${card(dealTasks, '')}${card(`<h2>Remarks</h2><div class="list" style="margin:0 calc(var(--pad)*-1)">${d.log.map((l) => `<div class="li" style="min-height:48px"><div class="grow"><b>${esc(l[0])}</b><div class="sub" style="font-size:12px">${esc(l[1])}</div></div></div>`).join('') || '<div class="li sub">No remarks yet.</div>'}</div><div class="head"><div class="inp grow"><input id="f_d_note" data-f="d.note" placeholder="Add a remark…"></div>${btn('Add', { k: 'ghost', a: `data-act="dealLog" data-i="${i}"` })}</div><div class="sep"></div>${fld('Deal notes', `deals.${i}.notes`, { rows: 2, ph: 'Anything the team should know' })}`)}
    ${!closed && d.stage !== 'negotiation' ? `<div class="head" style="justify-content:space-between;padding:4px 2px"><span class="sub">Not going ahead?</span><button type="button" class="btn danger sm" data-act="openModal" data-m="lost" data-id="${d.id}">Mark as Lost</button></div>` : ''}</div></div>`;
  const lb = d.offers.filter((o) => o.by === 'buyer').slice(-1)[0]; const ls = d.offers.filter((o) => o.by === 'seller').slice(-1)[0];
  const gap = lb && ls ? Math.abs(ls.amt - lb.amt) : null;
  const offersT = `<div class="stack">${card(`<div class="head"><h2>Offers &amp; counter-offers</h2><div class="grow"></div>${gap != null && isOpen(d) ? badge('Gap ' + dealPriceTxt(d, gap) + ' (' + Math.round(gap / ls.amt * 100) + '%)', gap === 0 ? 'ok' : 'warn') : ''}</div>${d.offers.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>When</th><th>From</th><th>Amount</th><th>Terms</th><th>Status</th><th></th></tr></thead><tbody>${d.offers.map((o, k) => `<tr><td>${esc(o.at)}</td><td>${badge(o.by === 'buyer' ? (sale ? 'Buyer' : 'Tenant') : (sale ? 'Seller' : 'Owner'), o.by === 'buyer' ? 'blue' : '')}</td><td><b>${dealPriceTxt(d, o.amt)}</b></td><td class="sub">${esc(o.terms || '—')}</td><td>${badge(o.status, o.status === 'Accepted' ? 'ok' : o.status === 'Rejected' ? 'err' : o.status === 'Open' ? 'warn' : '')}</td><td style="text-align:right;white-space:nowrap">${o.status === 'Open' && isOpen(d) ? btn('Accept', { k: 'ghost sm', a: `data-act="offerSet" data-i="${i}" data-k="${k}" data-v="Accepted"` }) + ' ' + btn('Reject', { k: 'sec sm', a: `data-act="offerSet" data-i="${i}" data-k="${k}" data-v="Rejected"` }) : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="sub">No offers logged yet.</div>'}`)}
    ${isOpen(d) ? card(`<h2>Log an offer</h2><div class="row"><div class="fld"><span class="l">From</span>${chipSet('d.offer.by', [['buyer', sale ? 'Buyer' : 'Tenant'], ['seller', sale ? 'Seller' : 'Owner']], S.d.offer.by)}</div>${fld('Amount', 'd.offer.amt', { pre: '₹', suf: sale ? 'lakh' : '/mo ×1000' })}</div>${fld('Terms', 'd.offer.terms', { ph: 'e.g. Home loan · possession in 90 days' })}<div>${btn('Add offer', { a: `data-act="offerAdd" data-i="${i}"` })}</div><div class="sub" style="font-size:12px">A new offer marks the other side’s open offer as Countered and updates the Bid. Accepting an offer sets the closing price.</div>`) : ''}</div>`;
  const propN = filesOf('prop:' + p.id).length; const prosN = filesOf('pros:' + c.id).length;
  const docsT = `<div class="stack">${card(docPanel('deal:' + d.id))}<div class="sub">Also on record: <button type="button" class="btn ghost sm" data-act="openDocs" data-scope="prop:${p.id}">Property documents (${propN})</button> <button type="button" class="btn ghost sm" data-act="openDocs" data-scope="pros:${c.id}">Prospect documents (${prosN})</button></div></div>`;
  const paid = d.sched.filter((x) => x.paid).reduce((a, x) => a + x.amt, 0); const totalS = d.sched.reduce((a, x) => a + x.amt, 0); const L = d.loan;
  const loanSteps = ['Not started', 'Documents', 'Applied', 'Sanctioned', 'Disbursed', 'Rejected'];
  const payT = `<div class="grid2">${card(`<div class="head"><h2>${sale ? 'Payment schedule' : 'Move-in payments'}</h2><div class="grow"></div>${badge(inr(paid) + ' of ' + inr(totalS), paid >= totalS ? 'ok' : 'blue')}</div>${bar(totalS ? Math.round(paid / totalS * 100) : 0)}<div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${d.sched.map((x, k) => `<div class="li"><div class="grow"><b>${esc(x.label)}</b><div class="sub" style="font-size:12px">${esc(x.due)}</div></div><b>${inr(x.amt)}</b>${x.paid ? badge('Paid', 'ok') : badge('Due', 'warn')}${btn(x.paid ? 'Undo' : 'Mark paid', { k: 'ghost sm', a: `data-act="schedTog" data-i="${i}" data-k="${k}"` })}</div>`).join('')}</div>${sale ? '' : '<div class="sub" style="font-size:12px;margin-top:14px">The deposit months and amount are set on the Lease &amp; renewal tab.</div>'}`)}
    ${sale ? card(`<div class="head"><h2>Home loan</h2><div class="grow"></div>${chk(L.required, 'Loan required', `data-act="togb" data-p="deals.${i}.loan.required"`)}</div>${L.required ? `<div class="step">${loanSteps.map((s, k) => { const li = loanSteps.indexOf(L.stage); return `<button type="button" data-act="setf" data-p="deals.${i}.loan.stage" data-v="${s}" style="text-align:left;border:1px solid ${s === L.stage ? (s === 'Rejected' ? 'var(--err)' : 'var(--p-line)') : 'var(--line)'};background:${s === L.stage ? (s === 'Rejected' ? 'var(--err-soft)' : 'var(--p-soft)') : k < li && L.stage !== 'Rejected' ? 'var(--ok-soft)' : 'var(--surface)'};border-radius:8px;padding:10px 12px;font-size:13px;font-weight:${s === L.stage ? 600 : 500};min-width:100px">${s}</button>`; }).join('')}</div><div class="row">${fld('Bank', `deals.${i}.loan.bank`, { opts: ['', 'HDFC Bank', 'SBI', 'ICICI Bank', 'Axis Bank', 'LIC Housing', 'Other'] })}${fld('Loan amount', `deals.${i}.loan.amt`, { pre: '₹' })}</div><div class="row">${fld('Applied on', `deals.${i}.loan.applied`, { type: 'date' })}${fld('Sanctioned on', `deals.${i}.loan.sanctioned`, { type: 'date' })}${fld('Disbursed on', `deals.${i}.loan.disbursed`, { type: 'date' })}</div>${fld('Bank contact', `deals.${i}.loan.contact`, { ph: 'Name · phone' })}<div class="sub" style="font-size:12px">Tracks loan status only — no financial advice is given here.</div>` : '<div class="sub">Turn this on if the buyer is taking a home loan to track sanction and disbursement.</div>'}`) : card('<h2>Home loan</h2><div class="sub">Not applicable for a Rent/Lease deal.</div>')}</div>`;
  const partT = card(`<div class="head"><h2>Parties &amp; contacts</h2><div class="grow"></div>${btn('Add party', { k: 'ghost sm', i: 'plus', a: `data-act="openModal" data-m="party" data-id="${d.id}"` })}</div><div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${d.parties.map((x, k) => `<div class="li"><div class="av">${initials(x.name)}</div><div class="grow"><b>${esc(x.name)}</b><div class="sub">${esc(x.role)} · ${esc(x.phone)}</div></div>${btn('Call', { k: 'ghost sm callbtn', i: 'phone', a: `data-act="toast" data-t="Calling ${esc(x.name)}…"` })}${btn('WhatsApp', { k: 'ghost sm', i: 'chat', a: `data-act="toast" data-t="Opening WhatsApp…"` })}${k > 1 ? btn('Remove', { k: 'sec sm', a: `data-act="partyRm" data-i="${i}" data-k="${k}"` }) : ''}</div>`).join('')}</div><div class="sub" style="font-size:12px;margin-top:14px">Calling is available in the mobile app. On a computer, use WhatsApp.</div>`);
  const tb: Rec = bk || (() => { const t = { deal: d.id, due: iso(addDays(parseISO(d.agreedOn || iso(today)), 30)), pay: [] }; initBrok(t); return t; })(); const ts = brokState(tb);
  const bi = S.brok.indexOf(bk);
  const brT = `<div class="grid2">${card(`<h2>Brokerage terms</h2><div class="seg" style="align-self:flex-start">${[['%', '% of price'], ['fixed', 'Fixed value']].map((x) => `<button type="button" class="${d.bType === x[0] ? 'on' : ''}" data-act="setf" data-p="deals.${i}.bType" data-v="${x[0]}">${x[1]}</button>`).join('')}</div><div class="row">${fld(sale ? 'From buyer' : 'From tenant', `deals.${i}.bBuyer`, { suf: d.bType === '%' ? '%' : '₹', rer: 1 })}${fld(sale ? 'From owner' : 'From landlord', `deals.${i}.bOwner`, { suf: d.bType === '%' ? '%' : '₹', rer: 1 })}</div>${kv([['Base amount', dealPriceTxt(d, cp(d))], ['From ' + tn.toLowerCase(), inr(b.buyer)], ['From ' + on.toLowerCase(), inr(b.owner)], ['Total (before GST)', '<b>' + inr(b.buyer + b.owner) + '</b>'], ['GST', ts.gst ? inr(ts.gst) + ' <span class="sub">(on for ' + ts.sides.filter((x) => x.gst).map((x) => (x.k === 'buyer' ? tn : on).toLowerCase()).join(' &amp; ') + ')</span>' : '<span class="sub">Not applied</span>']])}<div class="sub" style="font-size:12px">GST is optional. Switch it on per party below — it is not applied by default.</div>${ts.sides.map((x) => `<div class="head">${chk(x.gst > 0 || (tb.gst && tb.gst[x.k]), 'GST on ' + (x.k === 'buyer' ? tn : on).toLowerCase() + '’s brokerage @' + (tb.gstPct || 18) + '%', `data-act="gstTog" data-deal="${d.id}" data-side="${x.k}"`)}</div>`).join('')}`)}
    ${card(`<div class="head"><h2>Brokerage payments</h2><div class="grow"></div>${btn('Record payment', { i: 'plus', a: `data-act="dealPay" data-id="${d.id}"` })}</div><div class="figs">${[['Total due', inr(ts.tot)], ['Collected', inr(ts.rec)], ['Pending', inr(ts.pend)]].map((f) => `<div class="fig"><small>${f[0]}</small><b>${f[1]}</b></div>`).join('')}</div><div class="list" style="margin:0 calc(var(--pad)*-1)">${tb.pay.map((x) => `<div class="li"><div class="grow"><b>${inr(x.amt)}</b> · from ${x.from === 'buyer' ? tn.toLowerCase() : on.toLowerCase()}<div class="sub" style="font-size:12px">${esc(dateTxt(x.date))} · ${esc(x.mode)} · Ref ${esc(x.ref || '—')}${x.note ? ' · ' + esc(x.note) : ''}</div></div></div>`).join('') || '<div class="li sub">No payments recorded yet.</div>'}</div><div class="sub" style="font-size:12px">Payments recorded here feed the collected, pending and overdue totals on the Brokerage page.</div>${bk ? btn('Open full brokerage (invoice, contribution split)', { k: 'sec', href: '#/brokerage/' + d.id, c: 'full' }) : ''}`)}</div>`;
  const rd = d.rem || { days: [], to: {} }; const sch = remSchedule(d);
  const renewDef = S.d.renew && S.d.renew.deal === d.id ? S.d.renew : (S.d.renew = { deal: d.id, date: d.leaseEnd ? iso(addDays(parseISO(d.leaseEnd), 1)) : '', rent: String(Math.round(cp(d) * 1000)), term: '11' });
  const dayLeft = d.leaseEnd ? daysBetween(iso(today), d.leaseEnd) : null;
  const leaseT = sale ? '' : `<div class="grid2"><div class="stack">${card(`<div class="head"><h2>Lease term</h2><div class="grow"></div>${dayLeft == null ? '' : d.stage !== 'closed_won' ? badge('Not started', '') : dayLeft < 0 ? badge('Expired ' + (-dayLeft) + ' days ago', 'err') : badge('Ends in ' + dayLeft + ' days', dayLeft <= 60 ? 'warn' : 'ok')}</div><div class="row">${fld('Lease start', `deals.${i}.leaseStart`, { type: 'date', rer: 1 })}${fld('Tenure', `deals.${i}.tenure`, { suf: 'months', rer: 1, hint: 'e.g. 11 months' })}${fld('Lease end', `deals.${i}.leaseEnd`, { type: 'date', rer: 1, hint: 'Calculated from start + tenure — edit it if the agreement says otherwise' })}</div>
      <div class="row">${fld('Security deposit', `deals.${i}.depMonths`, { suf: 'months of rent', rer: 1, hint: 'Default 2 months — change per deal' })}${fld('Deposit amount', `deals.${i}.depAmt`, { pre: '₹', rer: 1, hint: 'Or type any amount directly' })}</div>${d.stage === 'closed_won' ? `<div class="note ok">${ico('check', 18)}<div>Lease commenced on ${esc(dateTxt(d.leaseStart))}. The commencement date is captured when the deal is closed.</div></div>` : `<div class="note">${ico('info', 18)}<div>The commencement date is confirmed when you close the deal.</div></div>`}`)}
    ${card(`<h2>Renewal</h2><div class="sub">Record the renewal once the tenant and owner agree. The lease start, tenure, end date and rent update, and the milestone is added to Activity.</div><div class="row">${fld('Renewal date', 'd.renew.date', { type: 'date' })}${fld('New rent', 'd.renew.rent', { pre: '₹', suf: '/mo', hint: 'Currently ' + fmtRent(cp(d)) })}${fld('New term', 'd.renew.term', { suf: 'months' })}</div><div>${btn('Record renewal', { a: `data-act="renewDeal" data-i="${i}"` })}</div>${d.renewals.length ? `<div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${d.renewals.slice().reverse().map((r) => `<div class="li"><div class="grow"><b>Renewed from ${esc(dateTxt(r.date))}</b><div class="sub" style="font-size:12px">${r.term} months · ${fmtRent(r.rent / 1000)}${r.prev ? ' (was ' + fmtRent(r.prev / 1000) + ')' : ''}</div></div></div>`).join('')}</div>` : ''}`)}</div>
    <div class="stack">${card(`<h2>Renewal reminders</h2><div class="sub">Sent before the lease expires. These are separate from brokerage-payment reminders.</div><div class="fld"><span class="l">Remind this many days before expiry</span><div class="chips">${[90, 60, 45, 30, 15].map((n) => chip(n + ' days', (rd.days || []).includes(n), `data-act="togf" data-p="deals.${i}.rem.days" data-v="${n}" data-num="1"`)).join('')}</div></div><div class="fld"><span class="l">Send to</span>${[['tenant', 'Tenant'], ['owner', 'Owner / landlord'], ['team', 'Me']].map((x) => chk(!!(rd.to || {})[x[0]], x[1], `data-act="togb" data-p="deals.${i}.rem.to.${x[0]}"`)).join('')}</div>
      <div class="list" style="margin:0 calc(var(--pad)*-1)">${sch.length ? sch.map((s) => `<div class="li"><div class="grow"><b>${s.n} days before</b> · ${esc(dateTxt(s.at))}<div class="sub" style="font-size:12px">To ${esc(s.who.join(', ') || 'nobody — pick a recipient')}</div></div>${s.diff < 0 ? badge('Passed') : s.diff <= 7 ? badge('Due in ' + s.diff + ' days', 'warn') : badge('Scheduled', 'blue')}</div>`).join('') : '<div class="li sub">Set a lease end date and at least one reminder to see the schedule.</div>'}</div>
      <div class="card" style="background:var(--bg);gap:6px"><b style="font-size:13px">Message preview</b><div class="sub" style="font-size:12px">“Hi ${esc(c.name.split(' ')[0])}, your lease at ${esc(p.unit)} ends on ${esc(dateTxt(d.leaseEnd))}. Would you like to renew? Reply to confirm the new rent and term.” — Tenant</div><div class="sub" style="font-size:12px">“Lease for ${esc(p.id)} ends ${esc(dateTxt(d.leaseEnd))}. Please confirm whether you want to renew and at what rent.” — Owner / landlord</div><div class="sub" style="font-size:12px">“${esc(d.id)}: renewal due ${esc(dateTxt(d.leaseEnd))}.” — Team</div></div>${btn('Send a test reminder', { k: 'sec', a: 'data-act="toast" data-t="Test reminder sent to you — real reminders go out on the scheduled dates"' })}`)}</div></div>`;
  const evs = d.timeline.slice(); (bk ? bk.pay : []).forEach((x, k) => evs.push({ t: 'Brokerage received ' + inr(x.amt) + ' from ' + (x.from === 'buyer' ? tn.toLowerCase() : on.toLowerCase()), by: '—', at: x.date, seq: 1000 + k }));
  evs.sort((a, b) => (b.at === a.at ? b.seq - a.seq : b.at.localeCompare(a.at)));
  const actT = card(`<h2>Activity</h2><div class="sub" style="margin-top:-6px">Major milestones only — lead and deal creation, stage changes, lease commencement and payments. Calls, messages and visits live in the lead’s own activity.</div><div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${evs.map((t) => `<div class="li"><div class="grow">${esc(t.t)}<div class="sub" style="font-size:12px">${t.by && t.by !== '—' ? 'by ' + esc(t.by) : ''}</div></div><span class="sub">${esc(dateTxt(t.at))}</span></div>`).join('')}</div>`);
  const body = { overview, offers: offersT, docs: docsT, pay: payT, parties: partT, brok: brT, lease: leaseT, act: actT }[tab];
  const tabs = [['overview', 'Overview'], ['offers', 'Offers ' + d.offers.length], ['docs', 'Documents ' + dp.done + '/' + dp.total], ['pay', 'Payments & loan'], ...(sale ? [] : [['lease', 'Lease & renewal']]), ['parties', 'Parties ' + d.parties.length], ['brok', 'Brokerage'], ['act', 'Activity']];
  // Action buttons shown for the deal's current stage.
  const acts = (d.stage === 'negotiation' ? '' : isOpen(d) ? btn(sale ? 'Close deal · mark Sold' : 'Close deal · mark Leased Out', { a: `data-act="openModal" data-m="sold" data-id="${d.id}"` }) : '') + (d.stage === 'closed_won' ? btn('Brokerage', { k: 'ghost', href: '#/brokerage/' + d.id }) : '');
  // Hint text telling the user what the next step is.
  const needs = (d.stage === 'negotiation' ? 'Next: agree terms' : d.stage === 'agreed' ? 'Next: collect token' : d.stage === 'token' ? 'Next: sign agreement' : d.stage === 'agreement' ? 'Next: ' + (sale ? 'registration' : 'notarization') : '');
  // One headline figure (label, value, sub-text).
  const fig = (k, v, s) => `<div class="fig"><small>${k}</small><b>${v}</b>${s ? `<span class="sub" style="font-size:11px">${s}</span>` : ''}</div>`;
  const keyfigs = `<div class="figs kf">${fig(sale ? 'Deal value' : 'Monthly rent', d.close ? dealPriceTxt(d, d.close) : dealPriceTxt(d, d.bid || d.ask), d.close ? 'Closing price' : 'Not agreed yet')}${fig('Brokerage', inr(b.buyer + b.owner), 'Collected ' + inr(ts.rec))}${fig(sale ? 'Expected closing' : 'Lease term', sale ? (d.expected ? esc(dateTxt(d.expected)) : '—') : (d.leaseStart ? esc(dateTxt(d.leaseStart)) + ' → ' + esc(dateTxt(d.leaseEnd)) : 'Not set'), isOpen(d) ? 'Likelihood ' + PROB[d.stage] + '%' : '')}${fig('Documents', dp.done + ' / ' + dp.total, dp.pct + '% complete')}</div>`;
  const head = `<div class="card"><div class="head">${badge(d.stage === 'lost' ? (negFail ? 'Closed Lost' : 'Lost') : stageLbl(d, d.stage), d.stage === 'closed_won' ? 'ok' : d.stage === 'lost' ? 'err' : 'blue')}${badge(sale ? 'Sale' : 'Rent/Lease', sale ? '' : 'blue')}${isStale(d) ? badge('Stale · ' + daysBetween(d.upd, iso(today)) + ' days', 'warn') : ''}<div class="grow"></div>${isOpen(d) ? `<span class="sub" style="font-size:13px">Day ${stageDays(d)} in stage${needs ? ' · ' + needs : ''}</span>` : ''}</div>${tracker}${decision}${keyfigs}</div>
    <div class="card flush">${tabsBar('dealTab', tabs, tab)}</div>${body}`;
  return page(esc(c.name), d.id + ' · ' + propLabel(p), acts, head);
}

/* ---- brokerage */
/* Brokerage: commission tracking per deal. */
// Fill a brokerage record with defaults.
function initBrok(b) {
  if (typeof b.gst !== 'object' || b.gst === null) b.gst = { buyer: !!b.gst, owner: !!b.gst };
  b.gstPct = b.gstPct || 18; b.discounts = b.discounts || []; b.deductions = b.deductions || [];
  b.splits = b.splits || [{ name: 'Anil Sharma', pct: 100, inc: '', note: '' }];
  b.splits.forEach((s) => { delete s.paid; if (s.inc == null) s.inc = ''; if (s.note == null) s.note = ''; });
  b.inv = b.inv || null; b.reminders = b.reminders || []; b.notes = b.notes || ''; b.pay.forEach((p) => { if (p.note == null) p.note = ''; });
}
// Status of a brokerage record: Pending / Partial / Received / Waived.
function brokState(bk) {
  const d = S.deals.find((x) => x.id === bk.deal); const a = brokAmt(d); const gr = (Number(bk.gstPct) || 18) / 100;
  const sides = ['buyer', 'owner'].map((k) => { const base = a[k]; const disc = bk.discounts.filter((x) => x.side === k).reduce((s, x) => s + Number(x.amt || 0), 0); const nb = Math.max(base - disc, 0); const gst = bk.gst[k] ? Math.round(nb * gr) : 0; const tot = nb + gst; const rec = bk.pay.filter((p) => p.from === k).reduce((s, p) => s + p.amt, 0); return { k, base, disc, nb, gst, tot, rec, pend: Math.max(tot - rec, 0), st: tot > 0 && rec >= tot ? 'Received' : rec > 0 ? 'Partial' : 'Expected' }; });
  const tot = sides[0].tot + sides[1].tot; const rec = sides[0].rec + sides[1].rec; const pend = Math.max(tot - rec, 0);
  const ded = bk.deductions.reduce((s, x) => s + Number(x.amt || 0), 0); const net = sides[0].nb + sides[1].nb - ded; const disc = sides[0].disc + sides[1].disc;
  const late = bk.due && pend > 0 ? daysBetween(bk.due, iso(today)) : 0;
  const st = tot === 0 ? 'Nil due' : rec >= tot ? 'Received' : late > 0 ? 'Overdue' : rec > 0 ? 'Partial' : 'Expected';
  return { d, a, sides, tot, rec, pend, ded, net, disc, late: Math.max(late, 0), st, gst: sides[0].gst + sides[1].gst };
}
// Badge for a brokerage status.
const brokBadge = (st) => badge(st, st === 'Received' ? 'ok' : st === 'Partial' ? 'warn' : st === 'Overdue' ? 'err' : '');
// 'Buyer' / 'Tenant' / 'Owner' / 'Landlord' wording per side.
const sideName = (d, k) => (k === 'buyer' ? (d.kind === 'sale' ? 'Buyer' : 'Tenant') : (d.kind === 'sale' ? 'Owner' : 'Landlord'));
// Name of the person who pays a brokerage side.
const sidePayer = (d, k) => (k === 'buyer' ? prosById(d.cid).name : (propById(d.prop).owner || '—'));
// Brokerage screen: totals, due list and filters.
function brokerageView() {
  const pf = S.f.brok; const q = (S.q.brok || '').toLowerCase(); const st = S.tab.brokSt || 'all'; const tile = S.tab.brokTile || '';
  const all = S.brok.map((b) => ({ b, s: brokState(b) })).filter((x) => (pf === 'all' || dealPurpose(x.s.d) === pf) && (!q || (x.s.d.id + prosById(x.s.d.cid).name + x.s.d.prop).toLowerCase().includes(q)));
  // Does a brokerage row match the chosen status filter?
  const match = (x, s) => s === 'all' || (s === 'pending' ? x.s.pend > 0 : x.s.st === s);
  const rows = all.filter((x) => match(x, st));
  const T = all.reduce((a, x) => a + x.s.tot, 0), R = all.reduce((a, x) => a + x.s.rec, 0); const OD = all.filter((x) => x.s.st === 'Overdue').reduce((a, x) => a + x.s.pend, 0);
  const mk = iso(today).slice(0, 7); const monthPays = all.flatMap((x) => x.b.pay.map((p) => ({ x, p }))).filter((y) => y.p.date.slice(0, 7) === mk); const mrec = monthPays.reduce((a, y) => a + y.p.amt, 0);
  // Total overdue amount whose lateness falls between lo and hi days.
  const bucket = (lo, hi) => all.filter((x) => x.s.st === 'Overdue' && x.s.late >= lo && x.s.late <= hi).reduce((a, x) => a + x.s.pend, 0);
  const months = Array.from({ length: 6 }, (_, k) => { const d = new Date(today.getFullYear(), today.getMonth() - 5 + k, 1); const key = iso(d).slice(0, 7); return { l: MONTHS[d.getMonth()].slice(0, 3), v: S.brok.flatMap((b) => b.pay).filter((p) => p.date.slice(0, 7) === key).reduce((a, p) => a + p.amt, 0) }; });
  const mx = Math.max(...months.map((m) => m.v), 1);
  // Number of rows matching a status.
  const cnt = (s) => all.filter((x) => match(x, s)).length;
  const tiles = [['total', 'Total expected', T, ''], ['received', 'Received', R, ''], ['pending', 'Pending', T - R, ''], ['overdue', 'Overdue', OD, 'err'], ['month', 'Collected this month', mrec, '']];
  const tileHtml = tiles.map((x) => `<button type="button" class="stat" data-act="brokTile" data-v="${x[0]}" style="text-align:left;cursor:pointer;font:inherit;color:inherit;${tile === x[0] ? 'border:2px solid var(--p);background:var(--p-soft)' : ''}"><span class="sub">${x[1]}</span><b style="${x[3] ? 'color:var(--err)' : ''}">${inr(x[2])}</b><span class="sub" style="font-size:11px">${tile === x[0] ? 'Showing the deals behind this' : 'Tap to see the deals'}</span></button>`).join('');
  // Link to a deal's brokerage page.
  const link = (d) => `<a href="#/brokerage/${d.id}" style="color:var(--p);font-weight:600">${d.id}</a>`;
  // Flatten the per-side (buyer / seller) rows that pass the filter, newest first.
  const sideRows = (f) => all.flatMap((x) => x.s.sides.filter((sd) => f(sd, x)).map((sd) => ({ x, sd }))).sort((a, b) => (b.sd.pend || b.sd.rec) - (a.sd.pend || a.sd.rec));
  let drill = '';
  if (tile === 'pending' || tile === 'overdue') { const rs = sideRows((sd, x) => sd.pend > 0 && (tile === 'pending' || x.s.st === 'Overdue')); drill = card(`<div class="head"><h2>${tile === 'overdue' ? 'Overdue — who owes what' : 'Pending — who owes what'}</h2><div class="grow"></div>${badge(inr(rs.reduce((a, r) => a + r.sd.pend, 0)) + ' · ' + rs.length + ' payer' + (rs.length === 1 ? '' : 's'))}</div><div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${rs.map((r) => `<div class="li"><div class="av">${initials(sidePayer(r.x.s.d, r.sd.k))}</div><div class="grow"><b>${esc(sidePayer(r.x.s.d, r.sd.k))}</b> <span class="sub">(${sideName(r.x.s.d, r.sd.k)})</span><div class="sub" style="font-size:12px">${link(r.x.s.d)} · ${esc(prosById(r.x.s.d.cid).name)} · due ${esc(dateTxt(r.x.b.due))}${r.x.s.late ? ' · ' + r.x.s.late + ' days late' : ''}</div></div><b>${inr(r.sd.pend)}</b><a class="btn ghost sm" href="#/deals/${r.x.s.d.id}">Open deal</a></div>`).join('') || '<div class="li sub">Nothing pending.</div>'}</div>`); }
  else if (tile === 'received') { const rs = sideRows((sd) => sd.rec > 0); drill = card(`<h2>Received — by payer</h2><div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${rs.map((r) => `<div class="li"><div class="grow"><b>${esc(sidePayer(r.x.s.d, r.sd.k))}</b> <span class="sub">(${sideName(r.x.s.d, r.sd.k)})</span><div class="sub" style="font-size:12px">${link(r.x.s.d)} · of ${inr(r.sd.tot)}</div></div><b>${inr(r.sd.rec)}</b>${brokBadge(r.sd.st)}</div>`).join('')}</div>`); }
  else if (tile === 'total') { drill = card(`<h2>Total expected — by deal</h2><div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${all.map((x) => `<div class="li"><div class="grow"><b>${link(x.s.d)}</b> · ${esc(prosById(x.s.d.cid).name)}<div class="sub" style="font-size:12px">${x.s.sides.map((sd) => sideName(x.s.d, sd.k) + ' ' + inr(sd.tot)).join(' · ')}</div></div><b>${inr(x.s.tot)}</b>${brokBadge(x.s.st)}</div>`).join('')}</div>`); }
  else if (tile === 'month') { drill = card(`<h2>Collected this month</h2><div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${monthPays.map((y) => `<div class="li"><div class="grow"><b>${esc(sidePayer(y.x.s.d, y.p.from))}</b> <span class="sub">(${sideName(y.x.s.d, y.p.from)})</span><div class="sub" style="font-size:12px">${link(y.x.s.d)} · ${esc(dateTxt(y.p.date))} · ${esc(y.p.mode)}</div></div><b>${inr(y.p.amt)}</b></div>`).join('') || '<div class="li sub">No payments recorded this month.</div>'}</div>`); }
  const chart = card(`<h2>Collections — last 6 months</h2><div style="display:flex;align-items:flex-end;gap:12px;height:130px">${months.map((m) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end"><span class="sub" style="font-size:11px">${m.v ? rupeesM(m.v) : ''}</span><div style="width:100%;max-width:44px;height:${Math.max(m.v / mx * 90, m.v ? 4 : 2)}px;background:${m.v ? 'var(--p)' : 'var(--line)'};border-radius:4px 4px 0 0"></div><span class="sub" style="font-size:12px">${m.l}</span></div>`).join('')}</div>`);
  const aging = card(`<h2>Overdue ageing</h2>${[['1–30 days', bucket(1, 30)], ['31–60 days', bucket(31, 60)], ['60+ days', bucket(61, 9999)]].map((x) => `<div style="display:flex;align-items:center;gap:10px;min-height:34px"><span style="width:90px;font-size:13px">${x[0]}</span><span style="flex:1">${bar(OD ? (x[1] as number) / OD * 100 : 0, 'var(--err)')}</span><b>${inr(x[1])}</b></div>`).join('')}<div class="sub" style="font-size:12px">Only deals past their due date with money still pending.</div>`);
  const mem = {}; all.forEach((x) => { x.b.splits.forEach((sp) => { const m = mem[sp.name] || (mem[sp.name] = { w: 0, inc: 0, n: 0 }); m.w += Math.round(x.s.net * Number(sp.pct || 0) / 100); m.inc += Number(String(sp.inc || '').replace(/\D/g, '')) || 0; m.n++; }); });
  const contrib = card(`<div class="head"><h2>Contribution split</h2><div class="grow"></div>${badge('Reference for month-end')}</div><div class="sub" style="margin-top:-6px">Weighted share of net brokerage plus any lump-sum incentive, across the deals listed above. Nothing here is marked paid — payouts are worked out at month-end.</div><div class="scroll-x"><table class="tbl"><thead><tr><th>Member</th><th>Deals</th><th>Weighted share</th><th>Lump-sum incentive</th><th>Total</th></tr></thead><tbody>${Object.keys(mem).map((n) => `<tr><td><b>${esc(n)}</b></td><td>${mem[n].n}</td><td>${inr(mem[n].w)}</td><td>${inr(mem[n].inc)}</td><td><b>${inr(mem[n].w + mem[n].inc)}</b></td></tr>`).join('') || '<tr><td colspan="5" class="sub">No deals yet.</td></tr>'}</tbody></table></div>`);
  return page('Brokerage', 'Expected, received and pending — deal-wise', btn('Export', { k: 'sec', a: 'data-act="openModal" data-m="export"' }),
    `<div class="row" style="gap:12px">${tileHtml}</div>${drill}
    <div class="head">${searchBox('q.brok', 'Deal, prospect, property')}${purposeSeg('brok')}<div class="chips">${['all', 'Expected', 'Partial', 'pending', 'Overdue', 'Received'].map((x) => chip((x === 'all' ? 'All' : x === 'pending' ? 'Pending' : x) + ' ' + cnt(x), st === x, `data-act="tab" data-k="brokSt" data-v="${x}"`)).join('')}</div></div>
    ${card(rows.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Deal</th><th>Type</th><th>Total</th><th>Received</th><th>Pending</th><th>Status</th><th>Due</th><th>Invoice</th>${rowActsTh()}</tr></thead><tbody>${rows.map((x) => `<tr class="lnk" data-href="#/brokerage/${x.s.d.id}"><td><b>${x.s.d.id}</b><div class="sub" style="font-size:12px">${esc(prosById(x.s.d.cid).name)} · ${x.s.d.prop}</div></td><td>${badge(x.s.d.kind === 'sale' ? 'Sale' : 'Rent/Lease', x.s.d.kind === 'sale' ? '' : 'blue')}</td><td>${inr(x.s.tot)}${x.s.gst ? '<div class="sub" style="font-size:11px">incl. GST</div>' : ''}${x.s.disc ? '<div class="sub" style="font-size:11px">after discount</div>' : ''}</td><td>${inr(x.s.rec)}</td><td>${inr(x.s.pend)}</td><td>${brokBadge(x.s.st)}${x.s.late ? `<div class="sub" style="font-size:11px;color:var(--err)">${x.s.late} days late</div>` : ''}</td><td>${esc(dayLbl(parseISO(x.b.due)))}</td><td class="sub">${x.b.inv ? 'Issued' : '—'}</td>${rowActsTd('brok', x.b.deal)}</tr>`).join('')}</tbody></table></div>` : empty('No brokerage here', 'Brokerage appears once a deal reaches agreement.'), 'flush')}
    <div class="row">${chart}${aging}</div>${contrib}`);
}
// HTML of a brokerage invoice (GST etc.).
function invoiceHtml(bid, k) {
  const b = S.brok.find((x) => x.deal === bid); const s = brokState(b); const d = s.d; const p = propById(d.prop); const sale = d.kind === 'sale'; const x = s.sides.find((y) => y.k === k);
  const num = b.inv ? b.inv[k] : 'INV-DRAFT'; const payer = sidePayer(d, k); const role = sideName(d, k);
  const rows = [['Brokerage — ' + propLabel(p) + ' (' + (sale ? 'sale at ' : 'lease at ') + dealPriceTxt(d, cp(d)) + ')', inr(x.base)]];
  if (x.disc) rows.push(['Discount', '− ' + inr(x.disc)]);
  if (b.gst[k]) rows.push(['GST @ ' + b.gstPct + '% on ' + inr(x.nb), inr(x.gst)]);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(num)}</title><style>body{font-family:Arial,Helvetica,sans-serif;color:#1c1e21;margin:0;padding:32px;max-width:760px;margin:auto}h1{font-size:22px;margin:0}table{width:100%;border-collapse:collapse;margin:20px 0}td,th{padding:10px;border-bottom:1px solid #d3d7dc;text-align:left;font-size:14px}td:last-child,th:last-child{text-align:right}.muted{color:#5a5f66;font-size:13px}.tot td{font-weight:700;border-top:2px solid #1c1e21}@media print{body{padding:0}}</style></head><body><div style="display:flex;justify-content:space-between;gap:20px"><div><h1>${esc(S.org.name)}</h1><div class="muted">RERA ${esc(S.org.rera)} · ${esc(S.org.gstin || '')}<br>${esc(S.org.city)}, ${esc(S.org.state)}, ${esc(S.org.country)}</div></div><div style="text-align:right"><h1>INVOICE</h1><div class="muted">${esc(num)}<br>Date: ${esc(dateTxt(b.inv ? iso(today) : iso(today)))}<br>Due: ${esc(dateTxt(b.due))}</div></div></div><p><b>Bill to</b><br>${esc(payer)} <span class="muted">(${esc(role)})</span><br><span class="muted">Deal ${esc(d.id)} · ${esc(p.unit)}, ${esc(p.loc)}</span></p><table><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}<tr class="tot"><td>Total</td><td>${inr(x.tot)}</td></tr><tr><td>Received</td><td>${inr(x.rec)}</td></tr><tr class="tot"><td>Balance due</td><td>${inr(x.pend)}</td></tr></tbody></table><p class="muted"><b>Payment details</b><br>${esc(S.org.bank || 'Add your bank / UPI details in Settings')}</p><p class="muted">Thank you for choosing ${esc(S.org.name)}. This is a computer-generated invoice${b.gst[k] ? '' : '; GST has not been applied'}.</p></body></html>`;
}
// Brokerage detail: payments, splits, deductions, invoices, reminders.
function brokDetail(id) {
  const bi = S.brok.findIndex((x) => x.deal === id); if (bi < 0) return page('Not found', '', '', btn('Back', { href: '#/brokerage' }));
  const b = S.brok[bi]; initBrok(b); const s = brokState(b); const d = s.d; const sale = d.kind === 'sale'; const p = propById(d.prop);
  const names = { buyer: sideName(d, 'buyer'), owner: sideName(d, 'owner') }; const payer = { buyer: sidePayer(d, 'buyer'), owner: sidePayer(d, 'owner') };
  const pct = b.splits.reduce((a, x) => a + Number(x.pct || 0), 0);
  const sidesT = card(`<div class="head"><h2>Terms by side</h2><div class="grow"></div><div style="display:flex;align-items:center;gap:8px"><span class="sub" style="font-size:12px">GST rate</span><div class="inp" style="width:90px;height:36px"><input data-f="brok.${bi}.gstPct" data-render="1" value="${esc(b.gstPct)}" inputmode="numeric" aria-label="GST rate"><span class="suf">%</span></div></div></div><div class="sub" style="font-size:12px;margin-top:-6px">GST is optional and set separately for each party.</div>${s.sides.map((x) => `<div class="card" style="background:var(--bg);gap:10px;padding:14px"><div class="head"><b>${names[x.k]}</b><span class="sub">${esc(payer[x.k])}</span><div class="grow"></div>${brokBadge(x.st)}</div>${chk(!!b.gst[x.k], 'Add GST for ' + names[x.k].toLowerCase(), `data-act="gstTog" data-i="${bi}" data-side="${x.k}"`)}<div class="figs">${[['Brokerage', inr(x.base)], ...(x.disc ? [['Discount', '− ' + inr(x.disc)]] : []), ['GST' + (b.gst[x.k] ? ' @' + b.gstPct + '%' : ''), b.gst[x.k] ? inr(x.gst) : '—'], ['Total', '<b>' + inr(x.tot) + '</b>'], ['Received', inr(x.rec)], ['Pending', inr(x.pend)]].map((f) => `<div class="fig"><small>${f[0]}</small><span>${f[1]}</span></div>`).join('')}</div><div class="sub" style="font-size:12px">${d.bType === '%' ? (x.k === 'buyer' ? d.bBuyer : d.bOwner) + '% of ' + dealPriceTxt(d, cp(d)) : 'Fixed amount'}${b.gst[x.k] ? ` · GST ${b.gstPct}% on ${inr(x.nb)} = ${inr(x.gst)}` : ''}</div></div>`).join('')}<div class="row" style="align-items:flex-end"><div><div class="sub" style="font-size:12px">Due date</div><b>${esc(dayLbl(parseISO(b.due)))}</b>${s.late ? ` ${badge(s.late + ' days overdue', 'err')}` : ''}</div>${fld('Change due date', `brok.${bi}.due`, { type: 'date', rer: 1, style: 'max-width:220px' })}</div>`);
  const payT = card(`<div class="head"><h2>Payments received</h2><div class="grow"></div><a class="btn ghost sm" href="#/deals/${d.id}" data-act="tabBrok">Recorded in the deal</a></div><div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${b.pay.map((x, k) => `<div class="li"><div class="grow"><b>${inr(x.amt)}</b> · from ${names[x.from].toLowerCase()} (${esc(payer[x.from])})<div class="sub" style="font-size:12px">${esc(dayLbl(parseISO(x.date)))} · ${esc(x.mode)} · Ref ${esc(x.ref || '—')}${x.note ? ' · ' + esc(x.note) : ''}</div></div>${btn('Receipt', { k: 'ghost sm', a: 'data-act="toast" data-t="Receipt PDF is generated in the live product"' })}${btn('Delete', { k: 'sec sm', a: `data-act="brokPayRm" data-i="${bi}" data-k="${k}"` })}</div>`).join('') || '<div class="li sub">No payments yet.</div>'}</div>`);
  const discT = card(`<h2>Discount</h2><div class="sub">A price reduction agreed with one party. It reduces what that party owes (and GST, if applied) and is kept on record.</div>${b.discounts.map((x, k) => `<div class="head"><div class="grow"><b>${names[x.side]}</b> · ${esc(x.reason || 'No reason noted')}</div><b>− ${inr(x.amt)}</b>${btn('Remove', { k: 'sec sm', a: `data-act="discRm" data-i="${bi}" data-k="${k}"` })}</div>`).join('') || '<div class="sub">No discount given.</div>'}<div class="head"><div class="inp sel" style="width:150px"><select data-f="d.disc.side" aria-label="Discount for"><option value="buyer" ${S.d.disc.side === 'buyer' ? 'selected' : ''}>${names.buyer}</option><option value="owner" ${S.d.disc.side === 'owner' ? 'selected' : ''}>${names.owner}</option></select></div><div class="inp" style="width:140px"><span class="pre">₹</span><input data-f="d.disc.amt" value="${esc(S.d.disc.amt)}" inputmode="numeric" aria-label="Discount amount"></div><div class="inp grow"><input data-f="d.disc.reason" value="${esc(S.d.disc.reason)}" placeholder="Reason, e.g. repeat client" aria-label="Discount reason"></div>${btn('Add discount', { k: 'ghost', a: `data-act="discAdd" data-i="${bi}"` })}</div>`);
  const dedT = card(`<h2>Deductions &amp; referral fees</h2><div class="sub">Taken off the brokerage before the contribution split — e.g. associate-broker referral, marketing, legal.</div>${b.deductions.map((x, k) => `<div class="head"><div class="grow"><b>${esc(x.name)}</b></div><b>− ${inr(x.amt)}</b>${btn('Remove', { k: 'sec sm', a: `data-act="dedRm" data-i="${bi}" data-k="${k}"` })}</div>`).join('') || '<div class="sub">None.</div>'}<div class="head"><div class="inp grow"><input id="f_d_ded_name" data-f="d.ded.name" value="${esc(S.d.ded.name)}" placeholder="e.g. Referral fee — associate broker"></div><div class="inp" style="width:140px"><span class="pre">₹</span><input data-f="d.ded.amt" value="${esc(S.d.ded.amt)}" inputmode="numeric" aria-label="Deduction amount"></div>${btn('Add', { k: 'ghost', a: `data-act="dedAdd" data-i="${bi}"` })}</div>${kv([['Brokerage after discount (before GST)', inr(s.sides[0].nb + s.sides[1].nb)], ['Deductions', '− ' + inr(s.ded)], ['Net for contribution split', '<b>' + inr(s.net) + '</b>']])}`);
  const splitT = card(`<div class="head"><h2>Contribution split</h2><div class="grow"></div>${badge(pct + '% allocated', pct === 100 ? 'ok' : pct > 100 ? 'err' : 'warn')}</div><div class="sub" style="margin-top:-6px">Each person’s weightage on this deal, plus an optional lump-sum incentive. This is for reference at month-end — nothing is marked paid here.</div>${pct > 100 ? '<div class="note" style="background:var(--err-soft);border-color:var(--err);color:var(--err)">Weightages add up to more than 100%.</div>' : pct < 100 ? `<div class="sub" style="font-size:12px">${100 - pct}% is unallocated (kept by the firm).</div>` : ''}<div class="list" style="margin:0 calc(var(--pad)*-1)">${b.splits.map((x, k) => `<div class="li" style="align-items:flex-start"><div class="av">${initials(x.name || '?')}</div><div class="grow" style="min-width:150px;display:flex;flex-direction:column;gap:6px"><div class="inp"><input id="f_brok_${bi}_splits_${k}_name" data-f="brok.${bi}.splits.${k}.name" value="${esc(x.name)}" list="teamlist" aria-label="Name" placeholder="You or a co-broker"></div><div class="inp"><input data-f="brok.${bi}.splits.${k}.note" value="${esc(x.note)}" placeholder="Short note, e.g. closed the negotiation" aria-label="Note for ${esc(x.name)}"></div></div><div style="display:flex;flex-direction:column;gap:6px;width:130px"><div class="inp"><input id="f_brok_${bi}_splits_${k}_pct" data-f="brok.${bi}.splits.${k}.pct" data-render="1" value="${esc(x.pct)}" inputmode="numeric" aria-label="Weightage for ${esc(x.name)}"><span class="suf">%</span></div><div class="inp"><span class="pre">₹</span><input id="f_brok_${bi}_splits_${k}_inc" data-f="brok.${bi}.splits.${k}.inc" data-render="1" value="${esc(x.inc)}" inputmode="numeric" placeholder="Incentive" aria-label="Lump-sum incentive for ${esc(x.name)}"></div><div class="sub" style="font-size:12px">${inr(Math.round(s.net * Number(x.pct || 0) / 100))} share</div></div>${btn('Remove', { k: 'sec sm', a: `data-act="splitRm" data-i="${bi}" data-k="${k}"` })}</div>`).join('') || '<div class="li sub">No contribution defined.</div>'}</div><datalist id="teamlist">${S.team.map((t) => `<option value="${esc(t.name)}">`).join('')}</datalist><div class="head">${btn('Add person', { k: 'ghost', i: 'plus', a: `data-act="splitAdd" data-i="${bi}"` })}<div class="grow"></div><span class="sub" style="font-size:12px">Type your name or an outside co-broker</span></div>`);
  const invT = card(`<h2>Invoice &amp; reminders</h2>${b.inv ? `<div class="kv">${s.sides.filter((x) => x.base > 0).map((x) => `<div><b>${names[x.k]}</b><span style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${esc(b.inv[x.k])} ${btn('Send / download', { k: 'ghost sm', a: `data-act="openModal" data-m="invoice" data-id="${id}" data-side="${x.k}"` })}</span></div>`).join('')}</div>` : `<div class="sub">No invoice issued yet. The invoice uses your template: business details, bill-to, brokerage, optional GST, discount and balance.</div>${btn('Generate invoices', { a: `data-act="genInvoice" data-i="${bi}"` })}`}<div class="sub" style="margin-top:4px">Payment reminders sent</div>${b.reminders.map((r) => `<div class="head" style="min-height:30px"><span class="grow" style="font-size:13px">${esc(r.to)} · ${esc(r.via)}</span><span class="sub" style="font-size:12px">${esc(r.at)}</span></div>`).join('') || '<div class="sub" style="font-size:13px">None yet.</div>'}<div class="chips">${s.sides.filter((x) => x.pend > 0).map((x) => btn('Send reminder to ' + names[x.k].toLowerCase(), { k: 'sec sm', i: 'chat', a: `data-act="remind" data-i="${bi}" data-side="${x.k}"` })).join('')}</div><div class="sub" style="font-size:12px">These are brokerage-payment reminders. Lease-renewal reminders are set on the deal’s Lease &amp; renewal tab.</div>`);
  const stateT = card(`<h2>Status</h2><div>${brokBadge(s.st)}</div>${fld('Notes', `brok.${bi}.notes`, { rows: 3 })}`);
  return page(id, propLabel(p) + ' · ' + esc(prosById(d.cid).name), btn('Record payment', { i: 'plus', a: `data-act="openModal" data-m="pay" data-id="${id}"` }),
    `<div class="row">${[['Total' + (s.gst ? ' (incl. GST)' : ''), s.tot], ['Received', s.rec], ['Pending', s.pend], ['Net after deductions', s.net]].map((x) => `<div class="stat"><span class="sub">${x[0]}</span><b>${inr(x[1])}</b></div>`).join('')}</div>
    <div class="grid2"><div class="stack">${sidesT}${payT}${discT}${dedT}${card(docPanel('brok:' + id))}</div><div class="stack">${splitT}${invT}${stateT}</div></div>`);
}



/* ------------------------------------------------------------ team, settings, import */
/* ---- v4 pages: export, masters, AI capture, team, settings, party upload */
// Permission gate: returns a 'no access' screen if the user's role cannot open the route.
function gateRoute(R) {
  const mod = ROUTE_MOD[R.a];
  if (mod && !canR(mod)) return noAccess(NAV.find((n) => n[0] === R.a) ? NAV.find((n) => n[0] === R.a)[1] : R.a);
  if (mod && (R.b === 'new' || R.c === 'edit') && !canW(mod)) return noAccess('Adding or editing here');
  if (R.a === 'import' && !canA('import')) return noAccess('Import');
  if (R.a === 'export' && !canExportAny()) return noAccess('Export');
  if (R.a === 'masters' && !canA('masters')) return noAccess('Masters');
  if (R.a === 'team' && !canR('team')) return noAccess('Team');
  return '';
}
/* ---------------- export */
/* Data export with permission and approval flow. */
// Exportable datasets and the action permission each needs.
const EXP_KINDS = { properties: ['Properties', 'exportProperties'], leads: ['Leads', 'exportLeads'], prospects: ['Prospects', 'exportProspects'] };
// Rows for an export (applies filters and masks numbers).
function expRows(kind, f) {
  // Is the date inside the chosen From–To range?
  const inD = (c) => (!f.from || (c || '') >= f.from) && (!f.to || (c || '') <= f.to);
  const mn = f.min === '' ? null : Number(f.min), mx = f.max === '' ? null : Number(f.max); const inV = (v) => (mn == null || v >= mn) && (mx == null || v <= mx);
  // Does the lead source match the chosen source filter?
  const srcOk = (s) => f.source === 'all' || String(s).toLowerCase().includes(f.source.toLowerCase());
  if (kind === 'properties') { const rows = S.props.filter((p) => p.status !== 'Draft' && inD(p.created) && inV((p.purpose === 'sale' ? p.priceL : p.rentK) || 0) && srcOk(p.source) && (!f.cat || f.cat === 'all' || p.cat === f.cat) && (!f.pur || f.pur === 'all' || p.purpose === f.pur) && (!f.pst || f.pst === 'all' || p.status === f.pst)); return { head: ['Property ID', 'Title', 'Purpose', 'Category', 'Project', 'Locality', 'Carpet sq ft', 'Chargeable sq ft', 'Price (lakh) / rent (thousand)', 'Status', 'Source', 'Created'], rows: rows.map((p) => [p.id, p.title, PURPOSE[p.purpose], p.cat, p.projectId ? projById(p.projectId).name : '', p.loc, p.carpet || '', p.sbu || p.area, (p.purpose === 'sale' ? p.priceL : p.rentK) || '', p.status, p.source, p.created]) }; }
  if (kind === 'leads') { const rows = S.leads.filter((l) => inD(l.created) && inV((l.basic || {}).max || 0) && srcOk(l.source) && (!f.intent || f.intent === 'all' || l.intent === f.intent) && (!f.lst || f.lst === 'all' || l.stage === f.lst)); return { head: ['Lead ID', 'Name', 'Interest', 'Status', 'Source', 'Basic requirement', 'Budget', 'Assigned', 'Created'], rows: rows.map((l) => [l.id, l.name, l.intent === 'buy' ? 'Buy' : 'Rent/Lease', lstLabel(l.stage), l.source, l.want, l.budget, l.assigned, l.created]) }; }
  const rows = S.prospects.filter((c) => inD(c.created) && srcOk(c.source) && (!f.ptype || f.ptype === 'all' || c.type === f.ptype)); return { head: ['Prospect ID', 'Name', 'Type', 'City', 'Source', 'Assigned', 'Created'], rows: rows.map((c) => [c.id, c.name, c.type, c.city, c.source, c.assigned, c.created]) };
}
// Run an export: build CSV, download, write the export log.
function runExport(kind, f, who) { const t = expRows(kind, f); const ok = dlFile(kind + '-export-' + iso(today) + '.csv', toCsv([t.head].concat(t.rows)), 'text/csv'); S.exportLog.unshift({ who, what: EXP_KINDS[kind][0], n: t.rows.length, at: nowStamp() }); return ok ? t.rows.length : -1; }
// Export screen with request/approval flow.
function exportView() {
  const E = S.exp; const kinds = Object.keys(EXP_KINDS).filter((k) => canA(EXP_KINDS[k][1])); if (!kinds.includes(E.kind)) E.kind = kinds[0] || 'properties';
  const t = expRows(E.kind, E); const needsAppr = !!S.org.exportApproval && !canA('approveExports'); const mine = S.exportReq.filter((r) => r.by === ME().name); const queue = S.exportReq.filter((r) => r.status === 'Pending');
  const srcOpts = [['all', 'Any source'], ...['Owner', 'Broker', 'Portal', '99acres', 'Magicbricks', 'Housing.com', 'Direct Reference', 'Friend & Family', 'Associate Broker'].map((x) => [x, x])];
  return page('Export data', 'Choose what to export and filter it first. Import and export are separate.', '',
    `<div class="grid2"><div class="stack">${card(`<h2>What to export</h2><div class="chips">${kinds.map((k) => chip(EXP_KINDS[k][0], E.kind === k, `data-act="setf" data-p="exp.kind" data-v="${k}"`)).join('')}</div>
      <div class="row">${fld('Created from', 'exp.from', { type: 'date', rer: 1 })}${fld('Created to', 'exp.to', { type: 'date', rer: 1 })}</div>
      <div class="row">${fld(E.kind === 'properties' ? 'Value from (₹ lakh / rent ₹ thousand)' : 'Budget from (₹ lakh)', 'exp.min', { rer: 1 })}${fld('Value to', 'exp.max', { rer: 1 })}</div>${E.kind === 'properties' ? `<div class="row">${fld('Category', 'exp.cat', { opts: [['all', 'Any category'], 'Residential', 'Commercial', 'Land'], rer: 1 })}${fld('Purpose', 'exp.pur', { opts: [['all', 'Sale + rent'], ['sale', 'For sale'], ['rent', 'For rent / lease']], rer: 1 })}${fld('Status', 'exp.pst', { opts: [['all', 'Any status'], 'Available', 'On hold', 'Sold', 'Rented'], rer: 1 })}</div>` : E.kind === 'leads' ? `<div class="row">${fld('Interest', 'exp.intent', { opts: [['all', 'Buy + rent'], ['buy', 'Buy'], ['rent', 'Rent / lease']], rer: 1 })}${fld('Stage', 'exp.lst', { opts: [['all', 'Any stage']].concat(LSTAGES.map((k) => [k, lstLabel(k)])), rer: 1 })}</div>` : `<div class="row">${fld('Prospect type', 'exp.ptype', { opts: [['all', 'Any type'], 'Buyer', 'Tenant', 'Owner', 'Landlord', 'Investor'], rer: 1 })}</div>`}${fld('Source', 'exp.source', { opts: srcOpts, rer: 1 })}
      <div class="note">${ico('info', 18)}<div><b>${t.rows.length}</b> record${t.rows.length === 1 ? '' : 's'} match. Phone numbers and emails are never included in exports.</div></div>
      ${needsAppr ? `<div class="sub" style="font-size:12px">Exports from your role need approval from an Admin or Manager first.</div>` : ''}
      <div>${btn(needsAppr ? 'Request export' : 'Export as CSV', { i: needsAppr ? 'clock' : 'download', a: 'data-act="doExport"' })}</div>`)}
    ${card(`<h2>Preview</h2><div class="scroll-x"><table class="tbl"><thead><tr>${t.head.slice(0, 6).map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.slice(0, 6).map((r) => `<tr>${r.slice(0, 6).map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="sub" style="font-size:12px">First ${Math.min(6, t.rows.length)} of ${t.rows.length} rows, first 6 columns.</div>`)}</div>
    <div class="stack">${canA('approveExports') && queue.length ? card(`<h2>Export requests waiting for you</h2>${queue.map((r) => `<div class="head" style="min-height:44px"><div class="grow"><b>${esc(EXP_KINDS[r.kind][0])}</b> · ${r.n} rows<div class="sub" style="font-size:12px">${esc(r.by)} · ${esc(dateTxt(r.at))}</div></div>${btn('Reject', { k: 'ghost sm', a: `data-act="expAppr" data-id="${r.id}" data-v="Rejected"` })}${btn('Approve', { k: 'sm', a: `data-act="expAppr" data-id="${r.id}" data-v="Approved"` })}</div>`).join('')}`) : ''}${mine.length ? card(`<h2>My export requests</h2>${mine.map((r) => `<div class="head" style="min-height:44px"><div class="grow"><b>${esc(EXP_KINDS[r.kind][0])}</b> · ${r.n} rows<div class="sub" style="font-size:12px">${esc(dateTxt(r.at))}${r.decidedBy ? ' · ' + (r.status === 'Rejected' ? 'rejected' : 'approved') + ' by ' + esc(r.decidedBy) : ''}</div></div>${badge(r.status, r.status === 'Approved' ? 'ok' : r.status === 'Rejected' ? 'err' : 'warn')}${r.status === 'Approved' ? btn('Download', { k: 'ghost sm', a: `data-act="expDl" data-id="${r.id}"` }) : ''}</div>`).join('')}`) : ''}
    ${card(`<h2>Recent exports</h2><div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${S.exportLog.slice(0, 8).map((x) => `<div class="li"><div class="grow"><b>${esc(x.who)}</b> exported ${esc(x.what)}<div class="sub" style="font-size:12px">${x.n} rows</div></div><span class="sub">${esc(fmtStamp(x.at))}</span></div>`).join('') || '<div class="li sub">No exports yet.</div>'}</div>`)}</div></div>`);
}
/* ---------------- masters (admin console) */
/* Admin lists: project types, amenities, features, broker groups, size units. */
// Master lists editable by admins.
const MLISTS = [['projectTypes', 'Project types'], ['amenities', 'Amenities'], ['features', 'Property features'], ['brokerGroups', 'Broker groups'], ['sizeUnits', 'Size units']];
// Masters console (dropdown lists, amenities, change requests).
function mastersView() {
  const tab = S.tab.masters || 'projectTypes'; const pend = S.mreq.filter((r) => r.status === 'Pending');
  const tabs = MLISTS.map((x) => [x[0], x[1] + (x[0] === 'requests' && pend.length ? ' ' + pend.length : '')]);
  let body;
  if (tab === 'requests') body = `<div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${S.mreq.slice().reverse().map((r) => `<div class="li"><div class="grow"><b>${esc(r.value)}</b> <span class="sub">→ ${esc((MLISTS.find((x) => x[0] === r.list) || [0, r.list])[1])}</span><div class="sub" style="font-size:12px">Requested by ${esc(r.by)} · ${esc(dateTxt(r.at))}${r.note ? ' · ' + esc(r.note) : ''}</div></div>${r.status === 'Pending' ? btn('Approve', { k: 'ghost sm', a: `data-act="mreqDo" data-id="${r.id}" data-v="Approved"` }) + btn('Reject', { k: 'sec sm', a: `data-act="mreqDo" data-id="${r.id}" data-v="Rejected"` }) : badge(r.status, r.status === 'Approved' ? 'ok' : 'err')}</div>`).join('') || '<div class="li sub">No requests.</div>'}</div>`;
  else {
    const isAm = tab === 'amenities'; const items = isAm ? S.amen.map((a) => a.label) : S.masters[tab]; const cnt = {}; items.forEach((x) => { const k = x.trim().toLowerCase(); cnt[k] = (cnt[k] || 0) + 1; });
    const dym = S.tab.mAdd ? didYouMean(S.tab.mAdd, items) : null;
    body = `<div class="head"><div class="inp grow" style="max-width:360px"><input id="f_tab_mAdd" data-f="tab.mAdd" data-render="1" value="${esc(S.tab.mAdd || '')}" placeholder="Add an item" aria-label="Add an item" autocomplete="off"></div>${btn('Add', { a: `data-act="mAdd" data-l="${tab}"` })}</div>${dym ? `<div class="note">${ico('info', 18)}<div>Did you mean <b>${esc(dym)}</b>? It is already in the list. ${btn('Add mine anyway', { k: 'sec sm', a: `data-act="mAdd" data-l="${tab}" data-force="1"` })}</div></div>` : ''}
    <div class="sub" style="font-size:12px">Rename by editing the text. Duplicates are flagged so you can clean them up.</div><div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${items.map((x, i) => `<div class="li"><div class="inp grow" style="max-width:420px"><input data-f="${isAm ? 'amen.' + i + '.label' : 'masters.' + tab + '.' + i}" value="${esc(x)}" aria-label="Item ${i + 1}"></div>${cnt[x.trim().toLowerCase()] > 1 ? badge('Duplicate', 'warn') : ''}${isAm ? `<span class="sub">${esc(S.amen[i].cat)}</span>` : ''}<div class="grow"></div>${btn('Remove', { k: 'sec sm', a: `data-act="mDel" data-l="${tab}" data-i="${i}"` })}</div>`).join('')}</div>`;
  }
  return page('Masters', 'Your lists for project types, amenities, features, broker groups and size units.', '', `<div class="card flush">${tabsBar('masters', tabs, tab)}<div style="padding:16px 20px 20px">${body}</div></div>`);
}
/* ---------------- AI capture */
/* Quick lead capture from free text / voice. */
// Parse free text/voice notes into lead fields (name, phone, intent, budget, locality).
function parseCapture(t) {
  const s = String(t || '').replace(/\s+/g, ' ').trim(); const lo = s.toLowerCase(); const out = { name: '', phone: '', intent: lo.match(/\b(rent|lease|tenant)\b|per month|monthly|\/mo\b/) ? 'rent' : 'buy', kind: /\b(office|shop|showroom|warehouse|commercial|retail)\b/.test(lo) ? 'Commercial' : /\b(plot|land|farmhouse)\b/.test(lo) ? 'Land' : 'Residential', bhk: '', area: '', loc: '', min: '', max: '', note: s, isProperty: /\b(available|for sale|for rent|has a|selling|owner)\b/.test(lo) && !/\b(looking|wants?|needs?|require)/.test(lo) };
  out.name = (s.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2})(?=\s+(?:is|are|was|called|wants?|needs?|looking|asked|from|has|will))/) || s.match(/(?:from|name is|met|call from)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/) || [])[1] || '';
  out.phone = (s.match(/(?:\+91[\s-]?)?([6-9]\d{4}[\s-]?\d{5})/) || [])[1] || '';
  out.bhk = (lo.match(/(\d)\s*bhk/) || [])[1] || ''; out.area = ((lo.match(/([\d,]{3,6})\s*(?:sq\.?\s*ft|sqft|square feet|sft)/) || [])[1] || '').replace(/,/g, '');
  out.loc = ((s.match(/\b(?:in|at|near|around)\s+([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]*)?)/) || [])[1] || '');
  const money = [...lo.matchAll(/(?:₹|rs\.?|inr)?\s*([\d.]+)\s*(cr|crore|crores|lakh|lakhs|lac|l|k|thousand)\b/g)].map((m) => { const n = parseFloat(m[1]); const u = m[2]; return u.startsWith('c') ? n * 100 : u === 'k' || u === 'thousand' ? n : n; });
  if (money.length) { out.max = String(Math.max(...money)); if (money.length > 1) out.min = String(Math.min(...money)); }
  return out;
}
// Validate/de-duplicate a parsed capture.
function checkCapture(p) {
  const c = []; const ok = (t) => c.push([true, t]); const bad = (t) => c.push([false, t]); const owner = !!p.isProperty; const unit = p.intent === 'buy' ? ' lakh' : ' thousand/month';
  p.name ? ok('Name found: ' + p.name) : bad('No name mentioned — add it before approving');
  p.phone ? ok('Phone number found') : bad(owner ? 'No phone number on the screenshot — add it if you have it' : 'No phone number mentioned — a lead needs one to be useful');
  p.loc ? ok('Area: ' + p.loc) : bad('Area not mentioned');
  if (owner) p.max ? ok((p.intent === 'buy' ? 'Asking price: ' : 'Asking rent: ') + p.max + unit) : bad(p.intent === 'buy' ? 'No asking price mentioned' : 'No asking rent mentioned');
  else p.max ? ok('Budget understood: up to ' + p.max + unit) : bad('No budget mentioned');
  if (p.kind === 'Residential' && !p.bhk) bad('BHK not mentioned'); if (p.kind !== 'Residential' && !p.area) bad('Size not mentioned');
  (S.cap.dups || []).forEach((d) => bad('Already in the CRM (' + (d.by === 'phone' ? 'same phone number' : 'same name') + '): ' + d.name + ' · ' + (d.kind === 'lead' ? 'lead ' : 'prospect ') + d.id + ' — check before saving a duplicate'));
  (S.cap.warn || []).forEach((w) => bad(w));
  return c;
}
// The four things a sender can want, shown as plain words: [key, label, intent, hasProperty].
const CAP_INTENTS = [['buy', 'Wants to buy', 'buy', false], ['rent', 'Wants to rent', 'rent', false], ['sell', 'Wants to sell', 'buy', true], ['rentout', 'Wants to rent out', 'rent', true]];
const capKey = (p) => (p.isProperty ? (p.intent === 'rent' ? 'rentout' : 'sell') : p.intent === 'rent' ? 'rent' : 'buy');
// Pick the CRM property sub-type that fits what the AI read (e.g. "Office space" -> "Office").
function capSub(kind, sub) {
  const list = SUBTYPES[kind] || SUBTYPES.Residential; const t = String(sub || '').toLowerCase();
  return list.find((x) => t && (t.includes(x.toLowerCase().split(' ')[0]) || x.toLowerCase().includes(t.split(' ')[0]))) || list[0];
}
/* ---- AI capture: read a WhatsApp screenshot with the vision model (API: POST /api/capture/screenshot) ---- */
// Show one found item in the preview. Edits stay on the item (parsed is the same object), so switching items keeps them.
function capShow(i) { const C = S.cap; C.idx = i; C.parsed = C.items[i] || null; if (C.parsed) C.target = C.parsed.isProperty ? 'property' : 'lead'; }
// Upload the screenshot, then fill the preview with every need or offer the AI found in it.
async function readScreenshot(f: File) {
  const C = S.cap; if (f.size > 8 * 1048576) { toast(f.name + ' is over 8 MB'); return; }
  C.busy = true; C.imgName = f.name; C.items = []; C.parsed = null; C.warn = []; C.dups = []; render();
  try {
    const form = new FormData(); form.append('file', f);
    const r = await ADAPTER.api!('/capture/screenshot', { form });
    C.items = r.items || []; C.warn = r.warnings || []; C.dups = r.duplicates || []; C.text = r.transcript || ''; C.model = r.model || ''; C.srcLabel = 'WhatsApp';
    if (C.items.length) { capShow(0); toast(C.items.length + (C.items.length === 1 ? ' lead' : ' leads') + ' found — check and approve'); }
    else toast(C.warn[0] || 'No leads found in that screenshot.');
  } catch (e: any) { toast(e?.message || 'Could not read the screenshot'); }
  C.busy = false; render();
}
// Sample texts for the capture screen.
const CAP_SAMPLES = ['Santosh Saraf is looking for 200 sq ft office in Sector V, budget 40 thousand per month, number 98300 12345', 'Meera Kapoor wants a 3 BHK to buy in Salt Lake, around 1.2 crore, 1450 sq ft', 'Owner Bimal Roy has a 2 BHK for rent in Ballygunge, 35 thousand, 1050 sq ft, call 9831012345'];
// AI capture screen.
function captureView() {
  const C = S.cap; const sr = [['text', 'Type or paste'], ['voice', 'Voice note / call'], ['shot', 'WhatsApp screenshot']];
  const P = C.parsed;
  const input = C.src === 'voice' ? `<div class="card" style="background:var(--bg)"><div class="sub">Record a voice note, or upload a call recording. It is turned into text first, then understood. Browsers that support speech recognition transcribe live; otherwise use the sample.</div><div class="chips">${btn(C.listening ? 'Stop recording' : 'Record voice note', { i: 'phone', k: C.listening ? 'danger' : '', a: 'data-act="capVoice"' })}<label class="btn ghost" style="cursor:pointer">${ico('upload', 16)}Upload recording<input type="file" hidden data-capaudio="1" accept="audio/*"></label>${btn('Use a sample note', { k: 'sec', a: 'data-act="capSample" data-i="0"' })}</div>${C.listening ? '<div class="badge err">Listening… speak now</div>' : ''}</div>` :
    C.src === 'shot' ? `<div class="card" style="background:var(--bg)"><div class="sub">Upload a screenshot of a WhatsApp chat. The AI reads it and lists every property or requirement in it (one screenshot can hold several). You check each one before it is saved.</div><label class="btn ghost" style="cursor:pointer;align-self:flex-start">${ico('upload', 16)}${C.busy ? 'Reading…' : 'Upload screenshot'}<input type="file" hidden data-capshot="1" accept="image/png,image/jpeg,image/webp"></label>${C.imgName ? `<div class="sub">${ico('img', 16)} ${esc(C.imgName)}${C.busy ? ' — reading the chat…' : ''}</div>` : ''}${C.model ? `<div class="sub" style="font-size:12px">Read by ${esc(C.model)}. Check every field, especially numbers and amounts.</div>` : ''}</div>` : '';
  const owner = !!(P && P.isProperty); const target = owner ? [['property', 'Property (draft)'], ['owner', 'Owner contact only']] : [['lead', 'Lead'], ['prospect', 'Prospect + requirement']];
  if (P && !target.some((x) => x[0] === C.target)) C.target = target[0][0];
  return page('AI capture', 'Say it or paste it — the CRM fills the form. You approve before anything is saved.', '',
    `<div class="note">${ico('info', 18)}<div>AI capture is a paid add-on. Two AI steps run in order: one fills the fields, a second checks them. Everything lands in a preview for you to edit and approve.</div></div>
    <div class="grid2"><div class="stack">${card(`<div class="chips">${sr.map((x) => chip(x[1], C.src === x[0], `data-act="capSrc" data-v="${x[0]}"`)).join('')}</div>${input}
      <div class="fld"><span class="l">Text</span><textarea id="f_cap_text" data-f="cap.text" rows="5" placeholder="e.g. Santosh Saraf looking for 200 sq ft office in Sector V, budget 40 thousand per month">${esc(C.text)}</textarea></div>
      <div class="chips"><span class="sub" style="font-size:12px">Try:</span>${CAP_SAMPLES.map((x, i) => `<button type="button" class="chip" data-act="capSample" data-i="${i}">${esc(x.slice(0, 34))}…</button>`).join('')}</div><div>${btn('Understand', { i: 'match', a: 'data-act="capRun"' })}</div>`)}</div>
    <div class="stack">${P ? card(`<div class="head"><h2>Preview — check and edit</h2><div class="grow"></div>${badge('Step 1 · filled', 'blue')}${badge('Step 2 · checked', 'ok')}</div>
      ${C.items && C.items.length > 1 ? `<div class="fld"><span class="l">Found in the screenshot — ${C.items.length} left</span><div class="chips">${C.items.map((it, i) => chip((i + 1) + '. ' + (CAP_INTENTS.find((x) => x[0] === capKey(it)) || [])[1] + ' · ' + (it.project || it.sub || it.kind), C.idx === i, `data-act="capItem" data-i="${i}"`)).join('')}</div></div>` : ''}
      <div class="fld"><span class="l">Save as</span>${chipSet('cap.target', target, C.target)}</div>
      <div class="row">${fld('Name', 'cap.parsed.name')}${fld('Phone', 'cap.parsed.phone', { pre: '+91' })}</div>
      <div class="fld"><span class="l">What does ${esc(P.name || 'the sender')} want?</span><div class="chips">${CAP_INTENTS.map((x) => chip(x[1], capKey(P) === x[0], `data-act="capIntent" data-v="${x[0]}"`)).join('')}</div>${P.evidence ? `<small>From the chat: “${esc(P.evidence)}”</small>` : ''}</div>
      <div class="row">${fld('Category', 'cap.parsed.kind', { opts: ['Residential', 'Commercial', 'Land'], rer: 1 })}${fld('Property type', 'cap.parsed.sub', { hint: 'e.g. Office space, Flat' })}</div>
      <div class="row">${P.kind === 'Residential' || !P.kind ? fld('BHK', 'cap.parsed.bhk') : ''}${fld('Area', 'cap.parsed.area', { suf: 'sq ft' })}${fld('Location', 'cap.parsed.loc')}</div>
      ${P.project !== undefined ? `<div class="row">${fld('Project / building', 'cap.parsed.project')}${fld('Unit details', 'cap.parsed.unit', { hint: 'Tower, floor, flat number' })}</div>` : ''}
      <div class="row">${owner ? '' : fld('Budget min', 'cap.parsed.min', { hint: P.intent === 'buy' ? 'lakh' : 'thousand / month' })}${fld(owner ? (P.intent === 'buy' ? 'Asking price' : 'Asking rent') : 'Budget max', 'cap.parsed.max', { hint: P.intent === 'buy' ? 'lakh' : 'thousand / month' })}</div>
      ${P.note ? fld('Notes from the chat', 'cap.parsed.note', { rows: 2 }) : ''}
      <div class="card" style="background:var(--bg);gap:4px"><b style="font-size:13px">Checker notes</b>${checkCapture(P).map((c) => `<div style="display:flex;gap:8px;align-items:flex-start;font-size:13px"><span style="color:var(${c[0] ? '--ok' : '--warn'})">${c[0] ? '✓' : '!'}</span><span>${esc(c[1])}</span></div>`).join('')}</div>
      <div class="chips">${btn('Approve & save', { a: 'data-act="capApprove"' })}${btn('Discard', { k: 'sec', a: 'data-act="capDiscard"' })}</div>`) : card(`<h2>Preview</h2><div class="sub">The understood fields appear here. You can change anything before approving.</div>`)}</div></div>`);
}
/* ---------------- team */
/* ---------------- settings */
/* Company settings, team, roles & permissions. */
// Settings: company profile, team, roles & permissions, notifications.
function settingsView() {
  const th = S.tab.theme || 'auto'; const O = S.org; const adm = canW('team');
  return page('Settings', 'Organisation, region, integrations and preferences', '',
    `<div class="grid2"><div class="stack">${card(`<h2>Organisation</h2><div class="row">${fld('Business name', 'org.name')}${fld('RERA number', 'org.rera')}</div><div class="row">${fld('GSTIN (for invoices)', 'org.gstin', { ph: 'Optional' })}${fld('Business type', 'org.persona', { opts: [['mixed', 'Primary and secondary sales'], ['primary', 'Mainly primary (builder inventory)'], ['secondary', 'Mainly secondary (resale / rental)']], hint: 'Secondary teams don’t see builder charges' })}</div>${fld('Bank details for invoices', 'org.bank', { rows: 2, ph: 'Account name, bank, account no., IFSC' })}`)}
    ${card(`<h2>Region</h2><div class="row">${fld('Country', 'org.country', { opts: ['India'] })}${fld('State', 'org.state', { opts: INDIAN_STATES })}</div><div class="row">${fld('City', 'org.city')}${fld('Currency', 'org.cur', { opts: [['INR', '₹ Indian rupee (INR)']] })}</div><div class="sub" style="font-size:12px">Amounts show in rupees, lakh and crore. Pincodes fill the city and state in address forms.</div>`)}
    ${card(`<h2>Data protection</h2><div class="sub" style="font-size:12px">Phone numbers stay masked until you reveal them, one record at a time, and are never included in exports. Every reveal is logged here.</div><div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${S.viewLog.slice(0, 30).map((v) => `<div class="li"><div class="grow">Viewed ${esc(v.what.toLowerCase())}<div class="sub" style="font-size:12px">${esc(v.rec)}</div></div><span class="sub">${esc(fmtStamp(v.at))}</span></div>`).join('') || '<div class="li sub">Nothing yet.</div>'}</div>`)}
    ${card(`<h2>Portal integrations</h2><div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${[['magicbricks', 'Magicbricks'], ['99acres', '99acres'], ['housing', 'Housing.com'], ['nobroker', 'NoBroker']].map((x) => `<div class="li"><div class="grow"><b>${x[1]}</b><div class="sub">${O.portals[x[0]] ? 'Connected — leads flow into the inbox' : 'Not connected'}</div></div>${btn(O.portals[x[0]] ? 'Manage' : 'Connect', { k: O.portals[x[0]] ? 'sec sm' : 'ghost sm', a: `data-act="portalTog" data-id="${x[0]}"` })}</div>`).join('')}</div>`)}</div>
    <div class="stack">${card(`<h2>Planned integrations</h2><div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${[['WhatsApp Business API', 'Send and receive on the official API — one-time setup of about ₹35,000, billed by your provider.'], ['Call-recording platform', 'Pull call recordings in so AI capture can turn calls into leads.'], ['AI capture add-on', 'Voice, call and screenshot capture using low-cost models. Paid add-on.']].map((x) => `<div class="li"><div class="grow"><b>${x[0]}</b><div class="sub" style="font-size:12px">${x[1]}</div></div>${badge('Planned')}</div>`).join('')}</div>`)}
    ${card(`<h2>Appearance</h2><div class="seg" style="align-self:flex-start">${[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map((x) => `<button type="button" class="${th === x[0] ? 'on' : ''}" data-act="theme" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>`)}
    ${card(`<h2>Notifications</h2>${[['New leads', 'leads'], ['Visit reminders', 'visits'], ['Follow-up reminders', 'fus'], ['Deal updates', 'deals'], ['Matching alerts on new properties', 'match']].map((x) => chk(O.notif[x[1]], x[0], `data-act="notifTog" data-k="${x[1]}"`)).join('')}`)}
    ${card(`<h2>Access &amp; approvals</h2>${chk(!!O.exportApproval, 'Staff need approval before exporting data', adm ? 'data-act="exportApprovalTog"' : 'disabled')}<div class="sub" style="font-size:12px">When on, people without the “approve exports” permission send a request that an Admin or Manager approves on the Export page.${adm ? '' : ' Only people with team access can change this.'}</div><div class="head" style="gap:8px;flex-wrap:wrap">${canR('team') ? btn('Team &amp; permissions', { k: 'sec sm', href: '#/team' }) : ''}${btn('My account', { k: 'sec sm', href: '#/account' })}</div>`)}
    ${card(`<h2>Your data</h2><div class="sub">Everything you enter is saved to your CRM database and is available on every device you sign in from.</div>`)}</div></div>`);
}
/* ---------------- party upload (opened from a document-request link) */
// Public document-upload page opened from a request link.
function uploadView(R) {
  const d = S.deals.find((x) => x.id === R.b); const rq = d && (d.reqs || []).find((r) => r.token === R.c);
  if (!d || !rq) return `<div style="max-width:560px;margin:60px auto;padding:20px"><div class="card"><h2>This link is not valid</h2><div class="sub">Ask ${esc(S.org.name)} to send a fresh upload link.</div></div></div>`;
  rq.status = reqStatusOf(d, rq); const scope = 'deal:' + d.id; const p = propById(d.prop);
  return `<div style="max-width:620px;margin:32px auto;padding:0 16px;display:flex;flex-direction:column;gap:14px"><div class="head"><div class="logo">SF</div><div><b>${esc(S.org.name)}</b><div class="sub" style="font-size:12px">Secure document upload</div></div></div>
  <div class="card"><h2>Hello ${esc(rq.party)} — documents needed</h2><div class="sub">For ${esc(p.title)} · ${esc(p.unit)}. Upload each paper below; photos or PDFs are fine. Nothing else in the CRM is visible from this page.</div>
  ${rq.docs.map((n) => { const row = d.docs.find((x) => x.name === n); const done = row && ['Received', 'Verified'].includes(row.st); return `<div class="slot"><div class="slot-h"><div class="grow"><b>${esc(n)}</b></div>${done ? badge('Uploaded', 'ok') : badge('Needed', 'warn')}<label class="btn ${done ? 'sec' : ''} sm" style="cursor:pointer">${ico('upload', 16)}${done ? 'Add more' : 'Upload'}<input type="file" multiple hidden data-upload="${scope}" data-cat="${esc(n)}" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx"></label></div></div>`; }).join('')}
  ${rq.status === 'Received' ? `<div class="note ok">${ico('check', 18)}<div>All documents received — thank you.</div></div>` : ''}</div><a href="#/deals/${d.id}" class="sub" style="text-align:center">← Back to the CRM (demo only)</a></div>${S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : ''}`;
}
/* ---------------- actions */


S.org = { name: 'Sharma Property Consultants', country: 'India', state: 'West Bengal', city: 'Kolkata', rera: 'WBRERA/A/2022/0456', gstin: '19AAAAA0000A1Z5', bank: '', cur: 'INR', persona: 'mixed', exportApproval: false, portals: { magicbricks: true, '99acres': true, housing: false, nobroker: false }, notif: { leads: true, visits: true, fus: true, deals: false, match: true } };
// Remembers which modal is open to avoid needless re-rendering (plus the debounce timer for saving).
let _lastModalKey = '', _saveT = null;
// State keys that are persisted (kept for compatibility; saving is done by the adapter).
const PERSIST = ['me', 'perms', 'masters', 'mreq', 'alerts', 'viewLog', 'exportReq', 'exportLog', 'amen', 'projects', 'props', 'leads', 'prospects', 'reqs', 'visits', 'fus', 'deals', 'brok', 'team', 'roles', 'org', 'imports'];
// Hand the state to ADAPTER.save(), which diffs it and POSTs changes to /api/sync.
function saveState() { try { ADAPTER.save(S); } catch (e) { console.error(e); } }
// No-op in the connected build: data is loaded from /api/bootstrap instead of the browser.
function loadState() {
  PERSIST.forEach((k) => { if (BOOT[k] !== undefined) S[k] = BOOT[k]; });
  S.files = BOOT.files || {}; S.me = BOOT.me; S.profile = BOOT.profile; S.audit = BOOT.audit || [];
  S.visits.forEach(syncWhen);
  ADAPTER.loaded && ADAPTER.loaded(S);
}
loadState();
S.deals.forEach(initDeal); S.brok.forEach(initBrok);
/* ------------------------------------------------------------ modals */
/* Modal dialogs. */
/* ---- v4 modals */
// WhatsApp number field with 'same as phone' tick.
const waFld = (P, o) => `${chk(o.waSame !== false, 'WhatsApp number is the same as the phone number', `data-act="togb" data-p="${P}.waSame"`)}${o.waSame === false ? fld('WhatsApp number', P + '.wa', { pre: '+91' }) : ''}`;
// Content of the modals that need custom bodies (reveal, convert, sold, lost, invite ...).
function modalExtra0(m, wrap, cancel, D) {
  // The deal the open modal is about.
  const dealOf = () => S.deals.find((x) => x.id === m.id);
  // Pick the modal body by its type.
  switch (m.t) {
    case 'agree': {
      const d = dealOf(); const sale = d.kind === 'sale';
      return wrap('Negotiation successful', `<div class="sub">${d.id} · ${esc(prosById(d.cid).name)} · ${esc(d.prop)}</div><div class="note">${ico('info', 18)}<div>This means the price and terms are agreed and you are waiting for the token. Token, agreement and ${sale ? 'registration' : 'notarization'} are tracked separately after this.</div></div>
      <div class="row">${fld('Date terms were agreed', 'd.agree.date', { type: 'date', req: 1 })}${fld('Agreed ' + (sale ? 'price' : 'rent'), 'd.agree.price', { pre: '₹', suf: sale ? 'lakh' : '/mo ×1000' })}</div>${fld('Note', 'd.agree.note', { rows: 2, ph: 'e.g. Possession in 60 days, loan-backed' })}`, cancel + btn('Confirm', { a: `data-act="doAgree" data-id="${d.id}"` }));
    }
    case 'sold': {
      const d = dealOf(); const sale = d.kind === 'sale'; const b = brokAmt(d);
      return wrap(sale ? 'Close deal — mark Sold' : 'Close deal — mark Leased Out', `<div class="sub">${d.id} · ${esc(prosById(d.cid).name)} · ${esc(d.prop)}</div>${kv([['Closing ' + (sale ? 'price' : 'rent'), dealPriceTxt(d, cp(d))], ['Brokerage from ' + sideName(d, 'buyer').toLowerCase(), inr(b.buyer)], ['Brokerage from ' + sideName(d, 'owner').toLowerCase(), inr(b.owner)], ['Total brokerage', '<b>' + inr(b.buyer + b.owner) + '</b>']])}
      <div class="row">${fld('Closed on', 'd.won.date', { type: 'date' })}${fld('Closed by', 'd.won.by', { opts: S.team.map((t) => t.name) })}</div>
      ${sale ? '' : `<div class="row">${fld('Lease commencement', 'd.won.start', { type: 'date', req: 1, hint: 'Lease ends ' + dateTxt(leaseEndOf(D.won.start, d.tenure)) + ' (' + (Number(d.tenure) || 0) + ' months)' })}</div>`}
      ${chk(true, 'Mark ' + esc(d.prop) + ' as ' + (sale ? 'Sold' : 'Leased Out'), 'disabled')}${chk(true, 'Set the requirement to Fulfilled', 'disabled')}${chk(true, 'Create the brokerage entry', 'disabled')}`, cancel + btn(sale ? 'Mark Sold' : 'Mark Leased Out', { a: `data-act="doSold" data-id="${d.id}"` }));
    }
    case 'lost': {
      const d = dealOf(); const neg = d.stage === 'negotiation';
      return wrap(neg ? 'Mark as Closed Lost' : 'Mark as Lost', `<div class="note" style="background:var(--err-soft);border-color:var(--err);color:var(--err)">${ico('info', 18)}<div>${neg ? 'The negotiation did not succeed. The deal moves to Closed Lost and the reason is kept.' : 'You are about to mark this deal as Lost — are you sure?'}</div></div>${fld('Reason', 'd.lost.reason', { opts: ['Price gap', 'Bought elsewhere (buyer withdrew)', 'Owner withdrew', 'Title not clear', 'Loan rejected', 'Terms not agreed', 'Others'] })}${fld('Notes', 'd.lost.note', { rows: 2 })}${chk(D.lost.ret, 'Return property to Available', 'data-act="togb" data-p="d.lost.ret"')}${chk(D.lost.react, 'Reactivate requirement', 'data-act="togb" data-p="d.lost.react"')}`, cancel + btn(neg ? 'Mark Closed Lost' : 'Mark Lost', { k: 'danger', a: `data-act="doLost" data-id="${d.id}"` }));
    }
    case 'invoice': {
      const b = S.brok.find((x) => x.deal === m.id); const s = brokState(b); const d = s.d; const k = D.invSide || 'buyer'; const sd = s.sides.find((x) => x.k === k) || s.sides[0];
      return wrap('Invoice · ' + (b.inv ? b.inv[sd.k] : ''), `<div class="seg" style="align-self:flex-start">${s.sides.filter((x) => x.base > 0).map((x) => `<button type="button" class="${x.k === sd.k ? 'on' : ''}" data-act="setf" data-p="d.invSide" data-v="${x.k}">${sideName(d, x.k)}</button>`).join('')}</div>
      <div class="card" style="background:var(--bg);gap:6px"><div class="sub" style="font-size:12px">From ${esc(S.org.name)} · RERA ${esc(S.org.rera)}${S.org.gstin ? ' · GSTIN ' + esc(S.org.gstin) : ''}</div><div>Bill to <b>${esc(sidePayer(d, sd.k))}</b> <span class="sub">(${sideName(d, sd.k)})</span></div>${kv([['Brokerage', inr(sd.base)], sd.disc ? ['Discount', '− ' + inr(sd.disc)] : null, b.gst[sd.k] ? ['GST @ ' + b.gstPct + '% on ' + inr(sd.nb), inr(sd.gst)] : null, ['Total', '<b>' + inr(sd.tot) + '</b>'], ['Received', inr(sd.rec)], ['Balance', '<b>' + inr(sd.pend) + '</b>']].filter(Boolean))}</div>
      <div class="chips">${btn('Download invoice', { i: 'download', a: `data-act="invDownload" data-id="${m.id}" data-side="${sd.k}"` })}${btn('Print / Save as PDF', { k: 'ghost', i: 'file', a: `data-act="invPrint" data-id="${m.id}" data-side="${sd.k}"` })}</div>
      <div class="fld"><span class="l">Send by email</span><div style="display:flex;gap:8px"><div class="inp grow"><input data-f="d.invTo" value="${esc(D.invTo || '')}" placeholder="Email address (optional)" type="email" aria-label="Email address"></div>${btn('Email', { k: 'ghost', i: 'chat', a: `data-act="invMail" data-id="${m.id}" data-side="${sd.k}"` })}${btn('WhatsApp', { k: 'ghost', i: 'chat', a: `data-act="invWa" data-id="${m.id}" data-side="${sd.k}"` })}</div><small>Email and WhatsApp open your own app with the message filled in. Attach the downloaded invoice.</small></div>`, btn('Close', { k: 'sec', a: 'data-act="closeModal"' }), 560);
    }
    case 'dshare': {
      const d = dealOf(); const ids = m.ids.split(','); const fs = filesOf('deal:' + d.id).filter((f) => ids.includes(f.id));
      return wrap('Share documents', `<div class="card" style="background:var(--bg);gap:4px"><b>${fs.length} file${fs.length === 1 ? '' : 's'}</b>${fs.map((f) => `<div class="sub" style="font-size:12px">${esc(f.name)} · ${esc(f.cat)}</div>`).join('')}</div><div class="fld"><span class="l">Send to</span>${d.parties.map((p, i) => chk(!!D.dshare.to[i], `${esc(p.name)} <span class="sub">· ${esc(p.role)}</span>`, `data-act="togb" data-p="d.dshare.to.${i}"`)).join('')}</div><div class="fld"><span class="l">Send by</span>${chipSet('d.dshare.via', ['WhatsApp', 'Email'], D.dshare.via)}</div><div class="sub" style="font-size:12px">Only the files you ticked are sent. Each person gets their own message.</div>`, cancel + btn('Send', { a: `data-act="doDealShare" data-id="${d.id}"` }));
    }
    case 'lead': {
      const l = D.lead; const buy = l.intent === 'buy'; const rk = reqKind({ type: l.ptype }); const res = rk === 'flat' || rk === 'house';
      return wrap('Add lead', `<div class="row">${fld('Name', 'd.lead.name', { req: 1 })}${fld('Mobile', 'd.lead.phone', { req: 1, pre: '+91' })}</div>${waFld('d.lead', l)}<div class="note">${ico('check', 18)}<div>No duplicate found for this number.</div></div>
      <div class="fld"><span class="l">Lead source</span>${chipSet('d.lead.source', ['Direct Reference', 'Friend & Family', 'Portal', 'Associate Broker', 'Owner'], l.source)}</div>${l.source === 'Portal' ? fld('Which portal', 'd.lead.portal', { opts: ['99acres', 'Magicbricks', 'Housing.com', 'NoBroker'] }) : ''}${l.source === 'Associate Broker' ? fld('Broker / agency name', 'd.lead.refBy', { ph: 'Who sent this lead?' }) : ''}${l.source === 'Friend & Family' || l.source === 'Direct Reference' ? fld('Referred by', 'd.lead.refBy', { ph: 'Name of the person (optional)' }) : ''}
      <div class="fld"><span class="l">Interested in</span>${chipSet('d.lead.intent', [['buy', 'Buy'], ['rent', 'Rent/Lease']], l.intent)}</div>
      <div class="fld"><span class="l">Property type</span>${chipSet('d.lead.ptype', [['Apartment / Flat', 'Flat'], ['Independent house', 'House / Villa'], ['Plot', 'Plot'], ['Commercial', 'Commercial']], l.ptype)}</div>
      ${res ? `<div class="fld"><span class="l">BHK</span>${chipSet('d.lead.bhk', [[0, 'Any'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5+']], Number(l.bhk))}</div>` : ''}${rk === 'comm' ? `<div class="fld"><span class="l">Commercial type</span>${chipSet('d.lead.csub', COMM_SUBS, l.csub)}</div>` : ''}
      ${fld('Preferred locality', 'd.lead.locality', { ph: 'e.g. Salt Lake' })}<div class="row">${fld('Budget min', 'd.lead.bmin', { suf: buy ? 'lakh' : '₹ thousand / month' })}${fld('Budget max', 'd.lead.bmax', { suf: buy ? 'lakh' : '₹ thousand / month' })}</div>${fld('Note (optional)', 'd.lead.want', { ph: rk === 'plot' ? 'e.g. East-facing, 2,400 sq ft, near metro' : 'Anything else they said', hint: 'Detailed requirements are added after you convert the lead' })}${fld('Source link (optional)', 'd.lead.link', { ph: 'https://…', hint: 'Post, ad, listing or form this lead came from — you can add more on the lead' })}`, cancel + btn('Save lead', { a: 'data-act="saveLead"' }));
    }
    case 'prospect': {
      const c = D.prospect; const owner = c.type === 'Owner'; const src = c.source; const portal = ['99acres', 'Magicbricks', 'Housing.com', 'NoBroker'].includes(src);
      return wrap('Add prospect', `<div class="note">${ico('info', 18)}<div>${owner ? 'Owners are linked to their properties — save, then add the property.' : 'Already know what they want? Add them directly as a prospect and record the requirement next.'}</div></div><div class="row">${fld('Full name', 'd.prospect.name', { req: 1 })}${fld('Mobile', 'd.prospect.phone', { req: 1, pre: '+91' })}</div>${waFld('d.prospect', c)}<div class="row">${fld('Alternate mobile', 'd.prospect.alt', { pre: '+91' })}${fld('Email', 'd.prospect.email')}</div>
      <div class="fld"><span class="l">Prospect type</span>${chipSet('d.prospect.type', ['Buyer', 'Tenant', 'Owner'], c.type)}</div><div class="row">${fld('City', 'd.prospect.city')}${fld('Source', 'd.prospect.source', { opts: ['99acres', 'Magicbricks', 'Housing.com', 'NoBroker', 'Friend & Family', 'Direct Reference', 'Associate Broker'], rer: 1 })}</div>
      ${portal ? fld('Portal enquiry ID (optional)', 'd.prospect.enqId') : fld(src === 'Associate Broker' ? 'Broker / agency name' : 'Referred by', 'd.prospect.refBy', { ph: 'Name (optional)' })}
      ${chk(c.nri, 'NRI prospect — adds country &amp; time zone', 'data-act="togb" data-p="d.prospect.nri"')}${c.nri ? `<div class="row">${fld('Country', 'd.prospect.country', { req: 1, ph: 'e.g. UAE' })}${fld('Time zone', 'd.prospect.tz', { opts: ['GMT+4 · Gulf', 'GMT+0 · UK', 'GMT-5 · US East', 'GMT-8 · US West', 'GMT+8 · Singapore', 'Other'] })}</div>${fld('Best time to call', 'd.prospect.bestTime', { ph: 'e.g. 9–11 pm IST' })}` : ''}
      <div class="fld"><span class="l">Preferred contact</span>${chipSet('d.prospect.contact', ['Call', 'WhatsApp', 'Email'], c.contact)}</div>`, cancel + (owner ? btn('Save & add property', { k: 'ghost', a: 'data-act="saveProspect" data-prop="1"' }) : btn('Save & add requirement', { k: 'ghost', a: 'data-act="saveProspect" data-req="1"' })) + btn('Save prospect', { a: 'data-act="saveProspect"' }));
    }
    case 'invite': return wrap('Add team member', `<div class="row">${fld('Full name', 'd.invite.name', { req: 1 })}${fld('Email', 'd.invite.email', { hint: 'Used to sign in' })}</div><div class="row">${fld('Mobile', 'd.invite.phone', { pre: '+91' })}${fld('Corporate number', 'd.invite.corp', { pre: '+91' })}</div>${fld('Alternative number', 'd.invite.alt', { pre: '+91' })}${fld('Role', 'd.invite.role', { opts: ROLES })}<div class="sub" style="font-size:12px">What this role can see or change is set under Team → Roles &amp; permissions.</div>`, cancel + btn('Add member', { a: 'data-act="doInvite"' }));
    case 'share': return shareModal(m, wrap, cancel, D);
    case 'reveal': {
      const r = m.rec; return wrap('Reveal number', `<div class="note" style="background:var(--warn-soft);border-color:var(--warn-line);color:var(--warn)">${ico('info', 18)}<div>Every reveal is logged with your name and the time. Numbers cannot be downloaded in bulk.</div></div><div class="sub">${esc(m.what)} · ${esc(m.label)}</div>`, cancel + btn('Show number', { a: `data-act="doReveal"` }));
    }
    case 'mreq': return wrap('Request a new ' + m.list.replace(/s$/, ''), `<div class="sub">Lists are managed by your Admin so they stay clean. Your request goes to the Admin for approval.</div>${m.dym ? `<div class="note">${ico('info', 18)}<div>Did you mean <b>${esc(m.dym)}</b>? That is already in the list.</div></div>` : ''}${fld('Name', 'd.mreq.value', { req: 1 })}${fld('Note for Admin', 'd.mreq.note', { rows: 2 })}`, cancel + btn('Send request', { a: 'data-act="doMreq"' }));
  }
  return null;
}
// Build the HTML of whichever modal is open.
function modalHtml() {
  const m = S.modal; if (!m) return '';
  // Shared modal frame: title, body, footer buttons and optional width.
  const wrap = (title, body, foot?, w?) => `<div class="overlay" data-act="ovClose" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal" ${w ? `style="max-width:${w}px"` : ''}><div class="mh">${title}</div><div class="mb">${body}</div><div class="mf">${foot}</div></div></div>`;
  const cancel = btn('Cancel', { k: 'sec', a: 'data-act="closeModal"' });
  const D = S.d;
  { const _x = modalExtra(m, wrap, cancel, D); if (_x != null) return _x; }
  // Pick the modal body by its type.
  switch (m.t) {
    case 'lead': return wrap('Add lead', `<div class="row">${fld('Name', 'd.lead.name', { req: 1 })}${fld('Mobile', 'd.lead.phone', { req: 1, pre: '+91' })}</div><div class="note">${ico('check', 18)}<div>No duplicate found for this number.</div></div>
      <div class="fld"><span class="l">Lead source</span>${chipSet('d.lead.source', ['Direct Reference', 'Friend & Family', 'Portal', 'Associate Broker', 'Owner'], D.lead.source)}</div>${D.lead.source === 'Portal' ? fld('Which portal', 'd.lead.portal', { opts: ['99acres', 'Magicbricks', 'Housing.com', 'NoBroker'] }) : ''}
      <div class="fld"><span class="l">Interested in</span>${chipSet('d.lead.intent', [['buy', 'Buy'], ['rent', 'Rent/Lease']], D.lead.intent)}</div>${fld('Requirement', 'd.lead.want', { ph: 'e.g. 3 BHK · Salt Lake' })}<div class="row">${fld('Budget min', 'd.lead.bmin')}${fld('Budget max', 'd.lead.bmax')}</div>`, cancel + btn('Save lead', { a: 'data-act="saveLead"' }));
    case 'prospect': return wrap('Add prospect', `<div class="row">${fld('Full name', 'd.prospect.name', { req: 1 })}${fld('Mobile', 'd.prospect.phone', { req: 1, pre: '+91' })}</div><div class="row">${fld('Alternate mobile', 'd.prospect.alt', { pre: '+91' })}${fld('Email', 'd.prospect.email')}</div>
      <div class="fld"><span class="l">Prospect type</span>${chipSet('d.prospect.type', ['Buyer', 'Tenant', 'Owner'], D.prospect.type)}</div><div class="row">${fld('City', 'd.prospect.city')}${fld('Source', 'd.prospect.source', { opts: ['99acres', 'Magicbricks', 'Friend & Family', 'Direct Reference', 'Associate Broker'] })}</div>
      ${chk(D.prospect.nri, 'NRI prospect — adds country &amp; time zone', 'data-act="togb" data-p="d.prospect.nri"')}`, cancel + btn('Save & add requirement', { k: 'ghost', a: 'data-act="saveProspect" data-req="1"' }) + btn('Save prospect', { a: 'data-act="saveProspect"' }));
    case 'fu': return wrap('Add follow-up', `${fld('Lead / Prospect', 'd.fu.who', { opts: [...S.prospects.map((c) => c.name), ...S.leads.map((l) => l.name)].filter((v, i, a) => a.indexOf(v) === i) })}<div class="fld"><span class="l">Type</span>${chipSet('d.fu.kind', ['Call', 'WhatsApp', 'Visit', 'Email', 'Meeting'], D.fu.kind)}</div><div class="fld"><span class="l">For</span>${purposeSet('d.fu.p', D.fu.p)}</div><div class="fld"><span class="l">When</span>${chipSet('d.fu.when', [['today', 'Today'], ['tomorrow', 'Tomorrow'], ['3days', 'In 3 days']], D.fu.when)}</div><div class="fld"><span class="l">Priority</span>${chipSet('d.fu.pri', ['Low', 'Normal', 'High'], D.fu.pri)}</div>${fld('Note', 'd.fu.note', { rows: 3, ph: 'e.g. Confirm visit and share parking info' })}`, cancel + btn('Save follow-up', { a: 'data-act="saveFu"' }));
    case 'visit': {
      const av = S.props.filter((p) => ['Available', 'On hold'].includes(p.status));
      return wrap('Schedule visit', `${fld('Prospect', 'd.visit.cid', { opts: S.prospects.map((c) => [c.id, c.name]) })}<div class="fld"><span class="l">Properties</span><div class="sub" style="font-size:12px">Pre-filled from matches. Properties in different places get separate visit records.</div>${av.map((p) => chk(D.visit.props.includes(p.id), `${propLabel(p)} <span class="sub">· ${PURPOSE[p.purpose]}</span>`, `data-act="togf" data-p="d.visit.props" data-v="${p.id}"`)).join('')}</div><div class="row">${fld('Date', 'd.visit.date', { type: 'date' })}${fld('Time', 'd.visit.time', { type: 'time' })}</div>${(() => { const c = S.visits.filter((v) => v.date === D.visit.date && v.time === D.visit.time && v.status !== 'Cancelled'); return c.length ? `<div class="note" style="background:var(--warn-soft);border-color:var(--warn-line);color:var(--warn)">${ico('info', 18)}<div>${c.length} visit${c.length > 1 ? 's are' : ' is'} already booked at ${fmt12(D.visit.time)} on ${dayLbl(parseISO(D.visit.date))}.</div></div>` : ''; })()}<div class="fld"><span class="l">Reminder</span>${chipSet('d.visit.remind', ['Call', 'WhatsApp'], D.visit.remind)}</div>${chk(D.visit.pin, 'Share location pin with prospect', 'data-act="togb" data-p="d.visit.pin"')}`, cancel + btn('Confirm', { a: 'data-act="saveVisit"' }), 600);
    }
    case 'share': { const ids = (m.ids || '').split(',').filter(Boolean); const docs = ids.flatMap((pid) => filesOf('prop:' + pid).filter((f) => f.share).map((f) => ({ pid, f })));
      return wrap('Share properties', `<div class="sub">${ids.length} selected: ${esc(ids.join(', ') || 'none')}</div>${docs.length ? `<div class="card" style="background:var(--bg);gap:2px"><b>Include documents</b><div class="sub" style="font-size:12px;margin-bottom:4px">Only files marked Shareable can be sent. Owner ID and title papers never appear here.</div>${docs.map((x) => chk(S.d.shareSel[x.f.id] !== false, esc(x.f.name) + ' <span class="sub">· ' + x.pid + ' · ' + esc(x.f.cat) + '</span>', `data-act="shareDocTog" data-id="${x.f.id}"`)).join('')}</div>` : '<div class="sub" style="font-size:12px">No shareable documents on these properties yet — tick “Shareable” in the property’s Documents tab.</div>'}<div class="card" style="background:var(--bg)"><b>WhatsApp</b><div class="sub">Each property goes as its own message — WhatsApp can’t combine several into one.</div>${btn('Share via WhatsApp', { i: 'chat', a: 'data-act="shareVia" data-v="WhatsApp"' })}</div><div class="card" style="background:var(--bg)"><b>Email</b><div class="sub">One templated email, with a PDF per property and the chosen documents attached.</div>${btn('Share via Email', { i: 'mail', k: 'ghost', a: 'data-act="shareVia" data-v="Email"' })}</div>`, cancel); }
    case 'convert': { const l = S.leads.find((x) => x.id === m.id); return wrap('Convert to prospect?', `<div class="sub">Creates a prospect profile for ${esc(l.name)} with her contact details, source (${esc(l.source)}) and full activity history. The lead stays linked for reporting.</div>`, cancel + btn('Convert only', { k: 'ghost', a: `data-act="doConvert" data-id="${l.id}"` }) + btn('Convert & add requirement', { a: `data-act="doConvert" data-id="${l.id}" data-req="1"` })); }
    case 'quickProject': return wrap('Add new project', `<div class="sub">“${esc(S.pq.q.trim())}” wasn’t found in your Projects list.</div>${fld('Project name', 'pq.q', { req: 1 })}<div class="sub" style="font-size:12px">Add amenities, brochure, size and rent/lease details later from Projects → Edit.</div>`, cancel + btn('Add project', { a: 'data-act="quickProject"' }));
    case 'sold': { const d = S.deals.find((x) => x.id === m.id); const sale = d.kind === 'sale'; const b = brokAmt(d); return wrap(sale ? 'Mark as Sold' : 'Mark as Leased Out', `<div class="sub">${d.id} · ${esc(prosById(d.cid).name)} · ${d.prop}</div>${kv([['Closing price', dealPriceTxt(d, d.close)], ['From buyer', inr(b.buyer)], ['From owner', inr(b.owner)], ['Total brokerage', '<b>' + inr(b.buyer + b.owner) + '</b>']])}${chk(true, `Mark ${d.prop} as ${sale ? 'Sold' : 'Leased Out'}`, 'disabled')}${chk(true, 'Set the requirement to Fulfilled', 'disabled')}${chk(true, 'Notify team', 'disabled')}`, cancel + btn('Confirm & record brokerage', { a: `data-act="doSold" data-id="${d.id}"` })); }
    case 'lost': return wrap('Mark as Lost', `<div class="note" style="background:var(--err-soft);border-color:var(--err);color:var(--err)">${ico('info', 18)}<div>You are about to mark this deal as Lost — are you sure?</div></div>${fld('Reason', 'd.lost.reason', { opts: ['Bought elsewhere (buyer withdrew)', 'Owner withdrew', 'Price gap', 'Title not clear', 'Loan rejected', 'Others'] })}${fld('Notes', 'd.lost.note', { rows: 2 })}${chk(D.lost.ret, 'Return property to Available', 'data-act="togb" data-p="d.lost.ret"')}${chk(D.lost.react, 'Reactivate requirement', 'data-act="togb" data-p="d.lost.react"')}<div class="sub" style="font-size:12px">Marked as lost; the reason is kept on the record.</div>`, cancel + btn('Mark as Lost', { k: 'danger', a: `data-act="doLost" data-id="${m.id}"` }));
    case 'resched': return wrap('Reschedule visit', `<div class="row">${fld('New date', 'd.resched.date', { type: 'date' })}${fld('New time', 'd.resched.time', { type: 'time' })}</div><div class="sub" style="font-size:12px">Only date and time change; the change is kept in the activity log.</div>`, cancel + btn('Reschedule', { a: `data-act="doResched" data-id="${m.id}"` }));
    case 'outcome': return wrap('How did it go?', `<div class="fld"><span class="l">Outcome</span>${chipSet('d.outcome.v', ['Very interested', 'Interested', 'Wants to think / see more', 'Not interested', 'Needs another visit'], D.outcome.v)}</div><div class="fld"><span class="l">What stood out?</span>${chipMulti('d.outcome.why', ['Loved location', 'Price high', 'Layout', 'Parking', 'Needs repairs'], D.outcome.why)}</div>${fld('Notes', 'd.outcome.note', { rows: 3 })}`, cancel + btn('Save outcome', { a: `data-act="doOutcome" data-id="${m.id}"` }));
    case 'invite': return wrap('Invite member', `${fld('Mobile', 'd.invite.phone', { pre: '+91' })}${fld('Role', 'd.invite.role', { opts: ['Admin', 'Manager', 'Agent', 'Field staff'] })}`, cancel + btn('Add member', { a: 'data-act="doInvite"' }));
    case 'pay': return wrap('Record payment', `<div class="fld"><span class="l">Received from</span>${chipSet('d.pay.from', ['buyer', 'owner'], D.pay.from)}</div><div class="row">${fld('Amount', 'd.pay.amt', { pre: '₹' })}${fld('Mode', 'd.pay.mode', { opts: ['UPI', 'NEFT', 'Cheque', 'Cash', 'Card'] })}</div><div class="row">${fld('Date received', 'd.pay.date', { type: 'date' })}${fld('Reference / UTR', 'd.pay.ref')}</div>${fld('Note', 'd.pay.note', { rows: 2 })}`, cancel + btn('Save payment', { a: `data-act="doPay" data-id="${m.id}"` }));
    case 'invoice': { const b = S.brok.find((x) => x.deal === m.id); const s = brokState(b); const d = s.d; const p = propById(d.prop); const sale = d.kind === 'sale'; const payer = { buyer: prosById(d.cid).name, owner: p.owner }; const nm = { buyer: sale ? 'Buyer' : 'Tenant', owner: sale ? 'Owner' : 'Landlord' };
      return wrap('Invoices · ' + m.id, s.sides.filter((x) => x.base > 0).map((x) => `<div class="card" style="background:var(--bg);gap:8px"><div class="head"><b class="mono">${esc(b.inv ? b.inv[x.k] : '—')}</b><div class="grow"></div><span class="sub">Issued ${esc(b.inv ? b.inv.at : '')}</span></div><div class="sub" style="font-size:12px">From ${esc(S.org.name)} · RERA ${esc(S.org.rera)} · GSTIN 19AAAAA0000A1Z5 (sample)</div><div>Bill to <b>${esc(payer[x.k])}</b> <span class="sub">(${nm[x.k]})</span></div>${kv([['Brokerage — ' + propLabel(p), inr(x.base)], ['GST @18%', b.gst ? inr(x.gst) : 'Not applied'], ['Total', '<b>' + inr(x.tot) + '</b>'], ['Received', inr(x.rec)], ['Balance due', '<b>' + inr(x.pend) + '</b>'], ['Due date', esc(dayLbl(parseISO(b.due)))]])}</div>`).join(''), btn('Close', { k: 'sec', a: 'data-act="closeModal"' }) + btn('Send via WhatsApp', { k: 'ghost', i: 'chat', a: 'data-act="toast" data-t="Invoices sent on WhatsApp"' }) + btn('Download PDF', { a: 'data-act="toast" data-t="PDF download is available in the live product"' }), 640); }
    case 'export': { const rows = [['Deal', 'Prospect', 'Property', 'Type', 'Total', 'Received', 'Pending', 'Status', 'Due']].concat(S.brok.map((b) => { const s = brokState(b); return [s.d.id, prosById(s.d.cid).name, s.d.prop, PURPOSE[dealPurpose(s.d)], s.tot, s.rec, s.pend, s.st, b.due]; })); const csv = rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
      return wrap('Export brokerage', `<div class="sub">CSV preview — select and copy it into a spreadsheet. Direct file download is available in the live product.</div><textarea readonly rows="9" style="font-family:'IBM Plex Mono',monospace;font-size:12px">${esc(csv)}</textarea>`, btn('Close', { k: 'sec', a: 'data-act="closeModal"' }), 640); }
    case 'waive': return wrap(m.k2 === 'Waived' ? 'Waive brokerage' : 'Write off brokerage', `<div class="note" style="background:var(--warn-soft);border-color:var(--warn-line);color:var(--warn)">${ico('info', 18)}<div>${m.k2 === 'Waived' ? 'You will not collect the pending amount. It is kept on record.' : 'The pending amount is treated as unrecoverable. It is kept on record.'}</div></div>${fld('Reason', 'd.waive.reason', { rows: 3, ph: 'e.g. Goodwill for repeat client' })}`, cancel + btn(m.k2 === 'Waived' ? 'Waive' : 'Write off', { k: 'danger', a: `data-act="doWaive" data-id="${m.id}"` }));
    case 'party': return wrap('Add party', `${fld('Role', 'd.party.role', { opts: ['Lawyer', 'Bank contact', 'Associate broker', 'Witness', 'Other'] })}${fld('Name', 'd.party.name', { req: 1 })}${fld('Phone', 'd.party.phone', { pre: '+91' })}`, cancel + btn('Add party', { a: `data-act="doParty" data-id="${m.id}"` }));
    case 'preview': { const f = (S.files[m.scope] || [])[m.i]; if (!f) return ''; const ri = recInfo(m.scope) || { label: 'Draft record' };
      return wrap(esc(f.name), (f.thumb ? `<img src="${f.thumb}" alt="" style="max-width:100%;max-height:60vh;border-radius:8px;border:1px solid var(--line);align-self:center">` : `<div class="ph" style="height:220px;flex-direction:column">${fileIcon(f)}${f.sample ? 'Sample file — upload a real file to preview it here' : isImg(f) ? 'Image preview unavailable (file is over 3 MB)' : 'Preview for this file type is not available in the prototype'}</div>`) + kv([['Category', esc(f.cat)], ['Linked to', esc(ri.label)], ['Size', fmtSize(f.size)], ['Status', docStatusBadge(f.st)], ['Valid till', f.valid ? esc(dayLbl(parseISO(f.valid))) : '—'], ['Uploaded', esc(f.by) + ' · ' + esc(dayLbl(parseISO(f.at)))]]), btn('Close', { k: 'sec', a: 'data-act="closeModal"' }) + (f.url ? `<a class="btn ghost" href="${f.url}" target="_blank" rel="noopener">Open file</a>` : '') + (f.st !== 'Verified' ? btn('Mark verified', { a: `data-act="docVerify" data-scope="${m.scope}" data-i="${m.i}"` }) : ''), 640); }
    case 'importText': return wrap(esc(m.title), `<div class="sub">${esc(m.note)}</div><textarea id="copy_src" readonly rows="9" style="font-family:'IBM Plex Mono',monospace;font-size:12px" aria-label="${esc(m.title)}">${esc(m.text)}</textarea>`, btn('Copy', { k: 'ghost', a: 'data-act="copyText"' }) + btn('Close', { k: 'sec', a: 'data-act="closeModal"' }), 680);
    case 'notif': return wrap('Notifications', `<div class="list" style="margin:-20px">${[['New lead from 99acres', 'Sunita Agarwal · 2 BHK New Town', '#/leads/l1'], ['New match 92%', 'RS001 fits Priya Nair', '#/matches'], ['Visit tomorrow', 'VIS-3387 · 10:30 am', '#/visits/VIS-3387'], ['Payment due', 'DEAL-0142 · 30 Oct', '#/brokerage/DEAL-0142']].map((n) => `<a class="li" href="${n[2]}" data-act="closeModal"><div class="grow"><b>${n[0]}</b><div class="sub">${n[1]}</div></div></a>`).join('')}</div>`, btn('Notification settings', { k: 'ghost', href: '#/settings', a: '' }) + btn('Close', { k: 'sec', a: 'data-act="closeModal"' }), 480);
  }
  return '';
}

/* ------------------------------------------------------------ router + render */
/* Path-based router and the render loop: parse URL -> pick view -> write HTML into the host -> restore scroll/focus. */
// Parse location.pathname into {route, id, ...}.
function parse() { const p = (location.pathname.replace(/^\/+|\/+$/g, '') || 'dashboard').split('/').map(decodeURIComponent); return { a: p[0] || 'dashboard', b: p[1], c: p[2] }; }


// Pick the screen function for a route.
function view(R) {
  { const g = gateRoute(R); if (g) return g; }
  // Route action: which screen to build.
  switch (R.a) {
    case 'dashboard': return dashboardView();
    case 'projects': if (!R.b) return projectsView(); if (R.b === 'new') { if (S.d.projectEditId) { S.d.project = newProject(); S.d.projectEditId = null; S.files['proj:__draft'] = []; } return projectForm(false); } /* a stale edit draft must never leak into a new project (it would overwrite the edited one) */ if (R.c === 'edit') { if (S.d.projectEditId !== R.b) loadProjectDraft(R.b); return projectForm(true); } return projectDetail(R.b);
    case 'properties': if (!R.b) return propertiesView(); if (R.b === 'new') { if (S.d.propEditId) { S.d.property = newProperty(); S.d.propEditId = null; S.files['prop:__draft'] = []; S.tab.pf = 0; } return propertyForm(false); } if (R.c === 'edit') { if (S.d.propEditId !== R.b) loadPropertyDraft(R.b); return propertyForm(true); } return propertyDetail(R.b);
    case 'pick': return R.b === 'location' ? pickLocation() : R.b === 'address' ? pickAddress() : pickAmenities();
    case 'leads': return R.b ? leadDetail(R.b) : leadsView();
    case 'prospects': return R.b ? prospectProfile(R.b) : prospectsView();
    case 'requirements': return R.b === 'new' ? reqForm() : R.b ? reqDetail(R.b) : reqsView();
    case 'matches': return matchesView();
    case 'visits': return R.b ? visitDetail(R.b) : visitsView();
    case 'followups': return followupsView();
    case 'deals': return R.b === 'new' ? dealForm() : R.b ? dealDetail(R.b) : dealsView();
    case 'brokerage': return R.b ? brokDetail(R.b) : brokerageView();
    case 'team': return teamView(); case 'account': return accountView(); case 'settings': return settingsView(); case 'import': return importView(); case 'export': return exportView(); case 'masters': return mastersView(); case 'capture': return captureView(); case 'upload': return uploadView(R);
    default: return page('Page not found', '', '', card(btn('Go to dashboard', { href: '#/dashboard' })));
  }
}
// Re-render the whole UI from S (called after every state change).
function render0() {
  const R = parse(); const ae = document.activeElement as HTMLInputElement | null; const fid = ae && ae.id; const ss = ae && ae.selectionStart; const sy = window.scrollY;
  let html; const auth = ['upload'].includes(R.a);
  try { html = view(R); if (!auth) html = shell(R, html); else html += modalHtml(); } catch (e) { html = `<pre style="padding:24px;white-space:pre-wrap">${esc(e.stack || e)}</pre>`; }
  host.innerHTML = html;
  try { const nv = NAV.find((n) => n[0] === R.a); document.title = (nv ? nv[1] : R.a === 'account' ? 'My account' : R.a === 'login' ? 'Sign in' : 'SquareFeets') + ' · SquareFeets Realty CRM'; } catch (e) { }
  if (fid) { const el = document.getElementById(fid) as HTMLInputElement | null; if (el) { el.focus(); try { if (ss != null && el.setSelectionRange) el.setSelectionRange(ss, ss); } catch (e) { } } }
  try { document.querySelectorAll('table.tbl').forEach((t) => { const hs = [...t.querySelectorAll('thead th')].map((h) => h.textContent.trim()); t.querySelectorAll('tbody tr').forEach((r) => [...r.children].forEach((c, i) => { if (hs[i] && !c.hasAttribute('data-l')) c.setAttribute('data-l', hs[i]); })); }); } catch (e) { }
  window.scrollTo(0, sy);
  if (S.errScroll) { S.errScroll = false; const fe = document.querySelector('.fld.err') as HTMLElement | null; if (fe && fe.scrollIntoView) fe.scrollIntoView({ block: 'center' }); const inp = (fe && fe.querySelector ? fe.querySelector('input,select,textarea') : null) as HTMLElement | null; if (inp) inp.focus(); }
  const mk = S.modal ? S.modal.t + ':' + (S.modal.id || S.modal.scope || '') : '';
  if (mk && mk !== _lastModalKey) { const f = document.querySelector('.modal input:not([type=file]),.modal select,.modal textarea,.modal button') as HTMLElement | null; if (f && f.focus) f.focus(); }
  _lastModalKey = mk;
  clearTimeout(_saveT); _saveT = setTimeout(saveState, 400);
}
// document.querySelector shortcut.
const $ = (s) => document.querySelector(s);
// Show a transient message at the bottom.
function toast(t) { S.toast = t; render(); clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = ''; render(); }, 2600); }
// Navigate with history.pushState (path routing) and re-render.
const go = (h) => { const path = String(h).replace(/^#/, ''); if (location.pathname === path) render(); else { history.pushState({}, '', path); S.nav = false; S.newMenuOpen = false; S.err = {}; render(); window.scrollTo(0, 0); } };
// Parse '1.5 cr' / '85 l' / '8500000' into lakhs.
const parseL = (s) => { const t = String(s || '').toLowerCase().replace(/[₹,\s]/g, ''); const n = parseFloat(t); if (isNaN(n)) return 0; if (t.includes('cr')) return n * 100; if (t.includes('l')) return n; return n >= 100000 ? n / 100000 : n; };
// Parse '25k' / '25000' into thousands.
const parseK = (s) => { const n = parseFloat(String(s || '').replace(/[₹,\s]/g, '')); if (isNaN(n)) return 0; return n >= 1000 ? n / 1000 : n; };
// Prototype id helper (the API generates real ids).
const nextId = (arr, pre, n0) => pre + (n0 + arr.length + 1);

/* ------------------------------------------------------------ actions */
/* ACTS: all button actions, referenced from the HTML by data-act. */
// Store validation errors and re-render with them shown.
const fail = (e, tabFix?) => { S.err = e; S.errScroll = true; if (tabFix) tabFix(); render(); toast('Please fix the highlighted field' + (Object.keys(e).length > 1 ? 's' : '') + '.'); };
// All click actions. Buttons carry data-act='name'; the click handler below calls ACTS[name](element). Later blocks override/extend earlier ones.
const ACTS: Record<string, ActHandler> = {
  // Open/close the mobile side menu.
  navToggle() { S.nav = !S.nav; render(); },
  // Toggle the '+ New' dropdown.
  newMenu() { S.newMenuOpen = !S.newMenuOpen; render(); },
  // Clear the global search box.
  clearGs() { S.q.gs = ''; },
  // Set a list filter (data-k key, data-v value) and re-render.
  filt(el) { S.f[el.dataset.k] = el.dataset.v; render(); },
  // Switch a tab (data-k) to a value.
  tab(el) { S.tab[el.dataset.k] = el.dataset.num ? Number(el.dataset.v) : el.dataset.v; render(); },
  // Set any state path (data-p) to a value (data-v).
  setf(el) { setp(S, el.dataset.p, el.dataset.v); render(); },
  // Toggle a value inside an array state path (multi-select chips).
  togf(el) { const a = get(S, el.dataset.p) || []; const v = el.dataset.v; setp(S, el.dataset.p, a.includes(v) ? a.filter((x) => x !== v) : a.concat(v)); render(); },
  // Toggle a boolean state path.
  togb(el) { setp(S, el.dataset.p, !get(S, el.dataset.p)); render(); },
  // Increment a number at a state path.
  incf(el) { setp(S, el.dataset.p, (Number(get(S, el.dataset.p)) || 0) + 1); render(); },
  // Step a number up/down within limits.
  stepf(el) { setp(S, el.dataset.p, Math.max(0, (Number(get(S, el.dataset.p)) || 0) + Number(el.dataset.s))); render(); },
  // Show a toast message.
  toast(el) { toast(el.dataset.t); },
  // Open a modal by name with optional context data attributes.
  openModal(el) { S.newMenuOpen = false; const d = el.dataset; S.modal = { t: d.m, id: d.id, ids: d.ids, k2: d.k2 };
    if (d.m === 'visit') { S.d.visit = newVisit(); if (d.ids) S.d.visit.props = d.ids.split(',').filter(Boolean); }
    if (d.m === 'resched') { const rv = S.visits.find((x) => x.id === d.id); S.d.resched = { date: rv.date, time: rv.time }; }
    if (d.m === 'lead') S.d.lead = newLead(); if (d.m === 'prospect') S.d.prospect = newProspect(); if (d.m === 'fu') S.d.fu = newFu();
    if (d.m === 'lost') S.d.lost = { reason: 'Price gap', note: '', ret: true, react: true };
    if (d.m === 'pay') { const bk = S.brok.find((x) => x.deal === d.id); const bs = brokState(bk); const side = d.side || (bs.sides.find((x) => x.pend > 0) || bs.sides[0]).k; S.d.pay = { amt: String(bs.sides.find((x) => x.k === side).pend || ''), mode: 'UPI', from: side, date: iso(today), ref: '', note: '' }; }
    if (d.m === 'waive') S.d.waive = { reason: '' }; if (d.m === 'party') S.d.party = { role: 'Lawyer', name: '', phone: '' };
    render(); },
  // Close the open modal.
  closeModal() { S.modal = null; S.err = {}; render(); },
  // Close a modal when the dark overlay (not the dialog) is clicked.
  ovClose(el, e) { if (e.target === el) { S.modal = null; render(); } },
  /* projects */
  // Start the add-project flow with a blank draft.
  newProject() { S.newMenuOpen = false; S.files['proj:__draft'] = []; S.d.project = newProject(); S.d.projectEditId = null; S.ctx = null; S.am = { q: '', cat: 'All', open: true, notice: '' }; go('#/projects/new'); },
  // Open the edit-project form with the project copied into a draft.
  editProject(el) { loadProjectDraft(el.dataset.id); if (el.dataset.go === 'amenities') { S.ctx = { ctx: 'project', ret: '#/projects/' + el.dataset.id + '/edit' }; go('#/pick/amenities'); } else go('#/projects/' + el.dataset.id + '/edit'); },
  // Open the location/address picker for the current form.
  goPick(el) { S.ctx = { ctx: el.dataset.ctx, ret: '#' + location.pathname }; S.loc = { q: '', focus: false, note: '' }; S.am.notice = ''; go('#/pick/' + el.dataset.w); },
  // Choose a place from the location search results.
  pickPlace(el) { const o = ctxObj(); o.place = PLACES[Number(el.dataset.i)]; S.loc = { q: '', focus: false, note: '' }; render(); },
  // Use the browser geolocation as the place.
  useCurrent() { const o = ctxObj(); o.place = PLACES[0]; S.loc = { q: '', focus: false, note: 'Using your current location' }; render(); },
  // Confirm the chosen location into the draft.
  confirmLoc() { const o = ctxObj(); if (!o.place) o.place = PLACES[0]; if (!o.addr.street) o.addr.street = o.place.name; o.addr.pin = o.addr.pin || o.place.pin; o.addr.city = o.place.city; o.addr.state = o.place.state; go('#/pick/address'); },
  // Save the picked address into the draft.
  saveAddr() { const b = (S.ctx && S.ctx.ret) || '#/projects/new'; S.toast = 'Address saved'; go(b); clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = ''; render(); }, 2200); },
  // Tick/untick an amenity.
  amPick(el) { const a = S.d.project.amenities; const id = el.dataset.id; S.d.project.amenities = a.includes(id) ? a.filter((x) => x !== id) : a.concat(id); S.am.notice = ''; render(); },
  // Switch amenity category tab.
  amCat(el) { S.am.cat = el.dataset.v; render(); },
  // Open the 'add amenity' box.
  amOpen() { S.am.open = !S.am.open; render(); },
  // Add a typed amenity to the master and the draft.
  amAdd() { const label = S.am.q.trim().replace(/\s+/g, ' '); if (!label) return; const ex = S.amen.find((a) => a.label.toLowerCase() === label.toLowerCase()); let id;
    if (ex) { id = ex.id; S.am.notice = '“' + ex.label + '” is already in your list — selected it.'; } else { id = 'custom_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_'); S.amen.push({ id, label, cat: 'New · saved to your list' }); S.am.notice = 'Saved “' + label + '” to your amenity list first, then added it to this project.'; }
    if (!S.d.project.amenities.includes(id)) S.d.project.amenities.push(id); S.am.q = ''; render(); },
  // Save the amenity selection.
  saveAmen() { const b = (S.ctx && S.ctx.ret) || '#/projects/new'; go(b); },
  // Simulate attaching a brochure (prototype stand-in).
  fakeBrochure() { S.d.project.brochure = (S.d.project.name || 'Project').replace(/\s+/g, '_') + '_brochure.pdf'; render(); },
  // Validate and save the project draft (create or update).
  saveProject() {
    const d = clone(S.d.project); if (!d.name.trim()) { fail({ 'd.project.name': 'Enter a project name — it is the only required field.' }); return; }
    d.complete = d.status === 'ready' ? '' : d.cm + ' ' + d.cy; if (!d.place) d.place = null;
    const eid = S.d.projectEditId; if (eid) { d.id = eid; const i = S.projects.findIndex((p) => p.id === eid); S.projects[i] = d; } else { d.id = 'p' + Date.now(); S.projects.push(d); }
    S.files['proj:' + d.id] = S.files['proj:__draft'] || []; S.files['proj:__draft'] = [];
    S.d.projectEditId = null; S.toast = 'Project saved'; go('#/projects/' + d.id); clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = ''; render(); }, 2200); },
  /* properties */
  // Start the add-property flow.
  newProperty(el) { S.newMenuOpen = false; S.files['prop:__draft'] = []; S.d.property = newProperty(); S.d.propEditId = null; S.tab.pf = 0; S.pq = { q: '', open: false }; if (el && el.dataset.pid) S.d.property.projectId = el.dataset.pid; S.ctx = null; go('#/properties/new'); },
  // Edit an existing property.
  editProperty(el) { loadPropertyDraft(el.dataset.id); S.tab.pf = 0; S.pq = { q: '', open: false }; go('#/properties/' + el.dataset.id + '/edit'); },
  // Switch the property-form tab.
  pfTab(el) { S.tab.pf = Number(el.dataset.i); render(); },
  // Link the property to a project and copy its details.
  pjPick(el) { S.d.property.projectId = el.dataset.id; S.pq = { q: '', open: false }; render(); },
  // Unlink the project.
  pjClear() { S.d.property.projectId = null; render(); },
  // Create a minimal project from inside the property form.
  quickProject() { const n = S.pq.q.trim(); if (!n) return; const p = { ...newProject(), id: 'p' + Date.now(), name: n, status: 'ready', configs: [], units: '', complete: '' }; S.projects.push(p); S.d.property.projectId = p.id; S.pq = { q: '', open: false }; S.modal = null; toast('Project “' + n + '” added — you can fill in details later.'); },
  // Add an 'overlooking' value.
  addOverlook() { const v = (S.d.property.olNew || '').trim(); if (!v) return; if (!S.d.property.overlook.includes(v)) S.d.property.overlook.push(v); S.d.property.olNew = ''; render(); },
  // Add a row to a repeating list in a form.
  addRow(el) { get(S, el.dataset.p).push(''); render(); },
  // Remove a row from a repeating list.
  rmRow(el) { get(S, el.dataset.p).splice(Number(el.dataset.i), 1); render(); },
  // Add an extra-charge line.
  addCharge() { S.d.property.charges.push({ name: 'EDC (Extra Development Charges)', amt: '' }); render(); },
  // Attach a document slot to the current record.
  addDoc(el) { S.d.property.docs.push({ name: el.dataset.n, share: true }); render(); },
  // Toggle whether a document is shareable.
  docShare(el) { const d = S.d.property.docs[Number(el.dataset.i)]; d.share = !d.share; render(); },
  // Reveal a masked number (needs permission or approval).
  reveal(el) { S.tab.reveal = el.dataset.id; render(); },
  // Validate and save the property draft (create/update/publish).
  saveProperty(el) {
    const d = clone(S.d.property); const draft = !!(el && el.dataset.draft); const price = parseL(d.price); const rent = parseK(d.rent);
    if (!draft && d.purpose === 'sale' && !price) { fail({ 'd.property.price': 'Enter the expected price, or save as draft.' }, () => { S.tab.pf = 3; }); return; }
    if (!draft && d.purpose === 'rent' && !rent) { fail({ 'd.property.rent': 'Enter the monthly rent, or save as draft.' }, () => { S.tab.pf = 3; }); return; }
    const eid = S.d.propEditId; const old = eid ? propById(eid) : null; const pr = d.projectId ? projById(d.projectId) : null;
    const o = { id: eid || '', purpose: d.purpose, cat: d.cat, title: (d.cat === 'Residential' && d.bhk ? d.bhk + ' BHK ' : '') + d.sub, projectId: d.projectId, unit: [d.addr.flat, d.addr.tower, d.addr.street].filter(Boolean).join(', ') || (pr ? pr.name : '—'), loc: (d.place ? d.place.sub.split(',').slice(0, 2).join(',') : d.addr.street) || '—', bhk: Number(d.bhk) || 0, area: Number(d.sbu) || 0, furn: d.furn, priceL: price, quotedL: parseL(d.quoted) || price, rentK: rent, status: draft ? 'Draft' : (old && old.status !== 'Draft' ? old.status : 'Available'), source: d.srcType, owner: d.ownerName || '—' };
    if (!draft && (!o.id || o.id.startsWith('DR'))) { const pre = (d.cat === 'Residential' ? 'R' : d.cat === 'Commercial' ? 'C' : 'L') + (d.purpose === 'sale' ? 'S' : 'R'); const n = S.props.filter((p) => p.id.startsWith(pre)).length + 1; o.id = pre + String(n).padStart(3, '0'); }
    if (draft && !o.id) o.id = 'DR' + (S.props.filter((p) => p.id.startsWith('DR')).length + 1);
    if (eid) { const i = S.props.findIndex((p) => p.id === eid); S.props[i] = o; } else S.props.push(o);
    if (eid && eid !== o.id) delete S.files['prop:' + eid]; S.files['prop:' + o.id] = S.files['prop:__draft'] || []; S.files['prop:__draft'] = [];
    S.d.propEditId = null; S.toast = draft ? 'Draft saved' : 'Property saved · ID ' + o.id; if (el && el.dataset && el.dataset.stay) render(); else go('#/properties/' + o.id); clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = ''; render(); }, 2600); },
  /* leads & prospects */
  // Change a lead's stage.
  leadStage(el) { const l = S.leads.find((x) => x.id === el.dataset.id); l.stage = el.dataset.v; l.sub = ''; l.act.unshift(['System', 'Stage changed to ' + l.stage, 'Just now']); render(); },
  // Change a lead's sub-stage.
  leadSub(el) { const l = S.leads.find((x) => x.id === el.dataset.id); l.sub = el.dataset.v; l.act.unshift(['System', 'Prospect stage: ' + l.sub, 'Just now']); render(); },
  // Add a note to a lead's activity log.
  leadNote(el) { const l = S.leads.find((x) => x.id === el.dataset.id); if (!S.d.note.trim()) return; l.act.unshift(['Note', S.d.note.trim(), 'Just now']); S.d.note = ''; render(); },
  // Log a call/WhatsApp/visit on a lead.
  leadLog(el) { const l = S.leads.find((x) => x.id === el.dataset.id); l.act.unshift([el.dataset.v, el.dataset.v === 'Call' ? 'Call attended' : 'WhatsApp message sent', 'Just now']); if (l.stage === 'Lead') l.stage = 'Contacted'; render(); },
  // Validate and save a lead.
  saveLead() { const d = S.d.lead; if (!d.name.trim() || !String(d.phone).trim()) { const e = {}; if (!d.name.trim()) e['d.lead.name'] = 'Enter the lead’s name.'; if (!String(d.phone).trim()) e['d.lead.phone'] = 'Enter a mobile number.'; fail(e); return; } S.leads.unshift({ id: 'l' + Date.now(), name: d.name, phone: '+91 ' + (d.phone || '—'), source: d.source === 'Portal' ? d.portal : d.source, intent: d.intent, stage: 'Lead', sub: '', budget: d.bmin || d.bmax ? d.bmin + '–' + d.bmax : '—', want: d.want || '—', assigned: d.assigned, tags: [], act: [['System', 'Lead created', 'Just now']] }); S.modal = null; toast('Lead added'); go('#/leads'); },
  // Convert a lead into a prospect (and requirement).
  doConvert(el) { const l = S.leads.find((x) => x.id === el.dataset.id); l.stage = 'Prospect'; l.sub = 'Requirement gathering'; l.act.unshift(['System', 'Converted to prospect', 'Just now']); let c = S.prospects.find((x) => x.name === l.name); if (!c) { c = { id: 'c' + Date.now(), name: l.name, type: l.intent === 'buy' ? 'Buyer' : 'Tenant', nri: l.tags.includes('NRI'), city: 'Kolkata', source: l.source, assigned: l.assigned, phone: l.phone, email: '', lang: 'English', notes: '' }; S.prospects.push(c); } S.modal = null; if (el.dataset.req) { S.d.req = newReq(); S.d.req.cid = c.id; go('#/requirements/new'); } else { S.toast = 'Converted to prospect'; go('#/prospects/' + c.id); } },
  // Validate and save a prospect.
  saveProspect(el) { const d = S.d.prospect; if (!d.name.trim() || !String(d.phone).trim()) { const e = {}; if (!d.name.trim()) e['d.prospect.name'] = 'Enter the prospect’s name.'; if (!String(d.phone).trim()) e['d.prospect.phone'] = 'Enter a mobile number.'; fail(e); return; } const c = { id: 'c' + Date.now(), name: d.name, type: d.type, nri: d.nri, city: d.city, source: d.source, assigned: d.assigned, phone: '+91 ' + (d.phone || '—'), email: d.email, lang: d.lang, notes: d.notes }; S.prospects.push(c); S.modal = null; if (el.dataset.req) { S.d.req = newReq(); S.d.req.cid = c.id; go('#/requirements/new'); } else { toast('Prospect added'); go('#/prospects/' + c.id); } },
  /* requirements & matches */
  // Start a new requirement for a prospect.
  newReq(el) { S.newMenuOpen = false; S.d.req = newReq(); if (el && el.dataset.cid) S.d.req.cid = el.dataset.cid; go('#/requirements/new'); },
  // Add a wanted locality to the requirement.
  addLoc() { const v = (S.d.req.locNew || '').trim(); if (!v) return; if (!S.d.req.locs.includes(v)) S.d.req.locs.push(v); S.d.req.locNew = ''; render(); },
  // Validate and save a requirement.
  saveReq() { const d = clone(S.d.req); if (!Number(d.max)) { fail({ 'd.req.max': 'Enter a maximum budget.' }); return; } const r = { id: 'REQ-' + (2037 + S.reqs.length), cid: d.cid, purpose: d.purpose, type: d.type, locs: d.locs, min: Number(d.min) || 0, max: Number(d.max), bhk: Number(d.bhk), area: (d.amin || d.amax) ? `${d.amin || '—'}–${d.amax || '—'} sq ft (${d.areaType.toLowerCase()})` : 'Any', parking: d.parking, timeline: d.timeline, status: 'Active', notes: d.notes }; S.reqs.push(r); S.tab.matchReq = r.id; S.f.matches = 'all'; S.toast = 'Requirement saved'; go('#/matches'); clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = ''; render(); }, 2200); },
  // Choose which requirement to view matches for.
  setMatchReq(el) { S.tab.matchReq = el.dataset.id; S.f.matches = 'all'; if (el.dataset.go) go('#/matches'); },
  // Tick/untick a matched property for sharing.
  matchSel(el) { const a = S.tab.matchSel || []; const id = el.dataset.id; S.tab.matchSel = a.includes(id) ? a.filter((x) => x !== id) : a.concat(id); render(); },
  // Show the score breakdown of a match.
  why(el) { S.tab.why = S.tab.why === el.dataset.id ? null : el.dataset.id; render(); },
  // Open the share modal for ticked matches.
  shareSel() { const a = S.tab.matchSel || []; if (!a.length) { toast('Tick one or more properties first.'); return; } S.modal = { t: 'share', ids: a.join(',') }; render(); },
  // Schedule visits for ticked matches.
  visitSel() { const a = S.tab.matchSel || []; if (!a.length) { toast('Tick one or more properties first.'); return; } S.d.visit = newVisit(); S.d.visit.props = a.slice(); const r = S.reqs.find((x) => x.id === S.tab.matchReq); if (r) S.d.visit.cid = r.cid; S.modal = { t: 'visit' }; render(); },
  // Share via WhatsApp/email/copy.
  shareVia(el) { const ids = ((S.modal && S.modal.ids) || '').split(',').filter(Boolean); const n = ids.flatMap((pid) => filesOf('prop:' + pid).filter((f) => f.share && S.d.shareSel[f.id] !== false)).length; S.modal = null; toast((el.dataset.v === 'WhatsApp' ? 'Opening WhatsApp — one message per property' : 'One email with a PDF per property') + (n ? ' · ' + n + ' document' + (n > 1 ? 's' : '') + ' included' : '')); },
  /* visits & follow-ups */
  // Do nothing (placeholder target).
  noop() { },
  // Move the calendar back/forward.
  calNav(el) { const s = Number(el.dataset.s); const a = parseISO(S.cal.anchor); if (S.cal.mode === 'month') S.cal.anchor = iso(new Date(a.getFullYear(), a.getMonth() + s, 1)); else S.cal.anchor = iso(addDays(a, s * (S.cal.mode === 'week' ? 7 : 1))); render(); },
  // Jump the calendar to today.
  calToday() { S.cal.anchor = iso(today); render(); },
  // Switch calendar mode (day/week/month).
  calMode(el) { S.cal.mode = el.dataset.v; render(); },
  // Open a day from the calendar.
  calDay(el, e) { if (e && e.stopPropagation) e.stopPropagation(); S.cal.anchor = el.dataset.d; S.cal.mode = 'day'; render(); },
  // Create a visit by clicking a time slot.
  calSlot(el) { S.d.visit = newVisit(); S.d.visit.date = el.dataset.d; S.d.visit.time = String(el.dataset.h).padStart(2, '0') + ':00'; S.modal = { t: 'visit' }; render(); },
  // Validate and save a visit.
  saveVisit() { const d = S.d.visit; if (!d.props.length) { toast('Pick at least one property.'); return; } if (!d.date || !d.time) { toast('Choose a date and time.'); return; } let n = Math.max(...S.visits.map((v) => Number(v.id.slice(4)))); d.props.forEach((pid, i) => { const v = { id: 'VIS-' + (n + 1 + i), cid: d.cid, prop: pid, date: d.date, time: d.time, dur: 45, status: 'Scheduled', agent: 'Anil Sharma', notes: '', log: ['Visit scheduled'] }; syncWhen(v); S.visits.push(v); }); S.cal.anchor = d.date; S.tab.visitView = S.tab.visitView || 'cal'; S.modal = null; toast(d.props.length + ' visit' + (d.props.length > 1 ? 's' : '') + ' scheduled for ' + dayLbl(parseISO(d.date))); go('#/visits'); },
  // Change a visit's status.
  visitStatus(el) { const v = S.visits.find((x) => x.id === el.dataset.id); v.status = el.dataset.v; v.log.unshift('Status: ' + v.status); render(); },
  // Reschedule a visit.
  doResched(el) { const v = S.visits.find((x) => x.id === el.dataset.id); const r = S.d.resched; if (!r.date || !r.time) { toast('Choose a date and time.'); return; } v.log.unshift('Rescheduled ' + dayLbl(parseISO(v.date)) + ' ' + fmt12(v.time) + ' → ' + dayLbl(parseISO(r.date)) + ' ' + fmt12(r.time)); v.date = r.date; v.time = r.time; syncWhen(v); S.cal.anchor = r.date; S.modal = null; toast('Visit rescheduled'); },
  // Record the outcome/feedback of a visit.
  doOutcome(el) { const v = S.visits.find((x) => x.id === el.dataset.id); v.status = 'Completed'; v.log.unshift('Outcome: ' + S.d.outcome.v); if (S.d.outcome.note) v.notes = S.d.outcome.note; S.modal = null; toast('Outcome saved'); },
  // Save a follow-up.
  saveFu() { const d = S.d.fu; const w = { today: ['today', 'Today'], tomorrow: ['upcoming', 'Tomorrow'], '3days': ['upcoming', 'In 3 days'] }[d.when]; S.fus.unshift({ id: 'f' + Date.now(), who: d.who, kind: d.kind, note: d.note || d.kind + ' follow-up', due: w[0], when: w[1], p: d.p, done: false }); S.modal = null; toast('Follow-up added'); go('#/followups'); },
  // Mark a follow-up done.
  fuDone(el) { S.fus.find((x) => x.id === el.dataset.id).done = true; render(); },
  // Snooze a follow-up.
  fuSnooze(el) { const f = S.fus.find((x) => x.id === el.dataset.id); f.due = 'upcoming'; f.when = 'Tomorrow'; render(); },
  /* deals */
  // Start a new deal.
  newDeal() { S.newMenuOpen = false; S.d.deal = newDeal(); go('#/deals/new'); },
  // Validate and save a deal.
  // (an earlier duplicate saveDeal was removed: it was overridden by the later definitions below, so behaviour is unchanged)
  // Toggle a boolean on a deal (e.g. token received).
  dealTog(el) { const d = S.deals[Number(el.dataset.i)]; const k = el.dataset.k; d[k].on = !d[k].on; const old = d.stage; d.stage = d.reg.on ? 'registration' : d.agr.on ? 'agreement' : d.token.on ? 'token_paid' : 'negotiation'; if (d.stage !== old) d.stageSince = iso(today); d.prob = PROB[d.stage]; if (d.kind === 'sale') { const ix = { token: 0, agr: 1, reg: 2 }[k]; if (d.sched && d.sched[ix]) d.sched[ix].paid = d[k].on; } const lab = { token: 'Token paid', agr: 'Agreement signed', reg: 'Registration done' }[k]; dlog(d, d[k].on ? lab : lab + ' — undone'); render(); },
  // Add a note/event to a deal's timeline.
  dealLog(el) { const d = S.deals[Number(el.dataset.i)]; if (!S.d.note.trim()) return; d.log.push([S.d.note.trim(), 'Just now']); dlog(d, 'Remark: ' + S.d.note.trim()); S.d.note = ''; render(); },
  // Add an offer/counter-offer.
  offerAdd(el) { const d = S.deals[Number(el.dataset.i)]; const o = S.d.offer; const amt = Number(String(o.amt).replace(/[^0-9.]/g, '')); if (!amt) { toast('Enter an amount.'); return; } d.offers.forEach((x) => { if (x.status === 'Open') x.status = 'Countered'; }); d.offers.push({ by: o.by, amt, terms: o.terms, status: 'Open', at: dayLbl(today) }); dlog(d, (o.by === 'buyer' ? (d.kind === 'sale' ? 'Buyer' : 'Tenant') : (d.kind === 'sale' ? 'Seller' : 'Owner')) + ' offered ' + dealPriceTxt(d, amt)); S.d.offer = { by: o.by === 'buyer' ? 'seller' : 'buyer', amt: '', terms: '' }; render(); },
  // Accept/reject an offer.
  offerSet(el) { const d = S.deals[Number(el.dataset.i)]; const o = d.offers[Number(el.dataset.k)]; o.status = el.dataset.v; if (o.status === 'Accepted') { d.close = o.amt; d.offers.forEach((x) => { if (x !== o && x.status === 'Open') x.status = 'Countered'; }); dlog(d, 'Offer accepted at ' + dealPriceTxt(d, o.amt) + ' — closing price set'); } else dlog(d, 'Offer of ' + dealPriceTxt(d, o.amt) + ' rejected'); render(); },
  // Add a document row to a deal.
  docAdd(el) { const d = S.deals[Number(el.dataset.i)]; const n = (S.d.doc || '').trim(); if (!n) return; d.docs.push({ name: n, who: 'client', st: 'Pending', req: '', rec: '' }); S.d.doc = ''; dlog(d, 'Added document: ' + n); render(); },
  // Request documents from a party via link.
  docRequest(el) { const d = S.deals[Number(el.dataset.i)]; const p = d.docs.filter((x) => x.st === 'Pending'); p.forEach((x) => { x.st = 'Requested'; x.req = iso(today); }); dlog(d, 'Requested ' + p.length + ' pending document' + (p.length === 1 ? '' : 's')); toast(p.length ? 'Requested ' + p.length + ' document' + (p.length === 1 ? '' : 's') + ' from the responsible parties' : 'Nothing pending to request'); },
  // Mark a payment-schedule row paid/unpaid.
  schedTog(el) { const d = S.deals[Number(el.dataset.i)]; const x = d.sched[Number(el.dataset.k)]; x.paid = !x.paid; dlog(d, x.label + (x.paid ? ' marked paid' : ' marked due')); render(); },
  // Add a deal task.
  taskAdd(el) { const d = S.deals[Number(el.dataset.i)]; const t = (S.d.task.t || '').trim(); if (!t) { toast('Describe the task first.'); return; } d.tasks.push({ t, due: S.d.task.due || iso(addDays(today, 3)), done: false }); S.d.task = { t: '', due: '' }; render(); },
  // Tick a deal task.
  taskTog(el) { const d = S.deals[Number(el.dataset.i)]; const t = d.tasks[Number(el.dataset.k)]; t.done = !t.done; if (t.done) dlog(d, 'Task done: ' + t.t); render(); },
  // Remove a party from a deal.
  partyRm(el) { const d = S.deals[Number(el.dataset.i)]; d.parties.splice(Number(el.dataset.k), 1); render(); },
  // Add a party (buyer, owner, lawyer, bank ...) to a deal.
  doParty(el) { const d = S.deals.find((x) => x.id === el.dataset.id); const p = S.d.party; if (!p.name.trim()) { toast('Enter a name.'); return; } d.parties.push({ role: p.role, name: p.name.trim(), phone: '+91 ' + (p.phone || '—') }); dlog(d, 'Added ' + p.role + ': ' + p.name.trim()); S.modal = null; render(); },
  // Validate and save a deal. (later version — overrides the earlier one above)
  saveDeal() { const d = clone(S.d.deal); if (!Number(d.close)) { toast('Enter the deal closing price.'); return; } const id = 'DEAL-' + String(146 + S.deals.length - 3).padStart(4, '0'); const nd: Rec = { id, cid: d.cid, prop: d.prop, kind: d.kind === 'lease' ? 'rent' : d.kind, stage: 'negotiation', ask: Number(d.ask) || 0, close: Number(d.close), token: { on: false, amt: '', date: '', note: '' }, agr: { on: false, date: '', note: '' }, reg: { on: false, date: '', note: '' }, bType: d.bType, bBuyer: Number(d.bBuyer) || 0, bOwner: Number(d.bOwner) || 0, handled: d.handled, lostReason: '', log: [], expected: d.expected || iso(addDays(today, 30)) }; initDeal(nd); nd.offers = nd.ask ? [{ by: 'buyer', amt: nd.ask, terms: 'Opening offer', status: 'Countered', at: dayLbl(today) }, { by: 'seller', amt: nd.close, terms: 'Agreed price', status: 'Accepted', at: dayLbl(today) }] : []; S.deals.push(nd); S.toast = 'Deal created · ' + id; go('#/deals/' + id); clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = ''; render(); }, 2200); },
  // Close a deal as won (sold/rented) and update the property.
  doSold(el) { const d = S.deals.find((x) => x.id === el.dataset.id); d.stage = 'closed_won'; d.closedOn = iso(today); d.stageSince = iso(today); d.prob = 100; propById(d.prop).status = d.kind === 'sale' ? 'Sold' : 'Rented/Leased'; S.reqs.filter((r) => r.cid === d.cid && r.purpose === (d.kind === 'sale' ? 'sale' : 'rent')).forEach((r) => { r.status = 'Fulfilled'; }); if (!S.brok.find((b) => b.deal === d.id)) { const nb = { deal: d.id, due: iso(addDays(today, 30)), pay: [] }; initBrok(nb); S.brok.push(nb); } dlog(d, (d.kind === 'sale' ? 'Marked as Sold' : 'Marked as Leased Out') + ' — brokerage entry created'); S.modal = null; S.toast = (d.kind === 'sale' ? 'Marked as Sold' : 'Marked as Leased Out') + ' · requirement fulfilled'; go('#/brokerage/' + d.id); clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = ''; render(); }, 3000); },
  // Close a deal as lost with a reason.
  doLost(el) { const d = S.deals.find((x) => x.id === el.dataset.id); d.stage = 'lost'; d.stageSince = iso(today); d.prob = 0; d.lostReason = S.d.lost.reason; if (S.d.lost.ret) propById(d.prop).status = 'Available'; if (S.d.lost.react) S.reqs.filter((r) => r.cid === d.cid).forEach((r) => { r.status = 'Active'; }); dlog(d, 'Marked as Lost — ' + d.lostReason); S.modal = null; toast('Deal marked as Lost · Admin notified'); },
  // Record a brokerage payment.
  doPay(el) { const b = S.brok.find((x) => x.deal === el.dataset.id); const a = Number(String(S.d.pay.amt).replace(/[^0-9]/g, '')); if (!a) { toast('Enter an amount.'); return; } const sd = brokState(b).sides.find((x) => x.k === S.d.pay.from); if (a > sd.pend) { toast('That is more than the ' + inr(sd.pend) + ' pending from this side.'); return; } b.pay.push({ amt: a, from: S.d.pay.from, date: S.d.pay.date || iso(today), mode: S.d.pay.mode, ref: S.d.pay.ref, note: S.d.pay.note }); S.modal = null; toast('Payment recorded'); },
  // Toggle GST on a brokerage invoice.
  gstTog(el) { const b = S.brok[Number(el.dataset.i)]; b.gst = !b.gst; render(); },
  // Add a deduction to a brokerage.
  dedAdd(el) { const b = S.brok[Number(el.dataset.i)]; const a = Number(String(S.d.ded.amt).replace(/[^0-9]/g, '')); if (!S.d.ded.name.trim() || !a) { toast('Add a name and an amount.'); return; } b.deductions.push({ name: S.d.ded.name.trim(), amt: a }); S.d.ded = { name: '', amt: '' }; render(); },
  // Remove a deduction.
  dedRm(el) { S.brok[Number(el.dataset.i)].deductions.splice(Number(el.dataset.k), 1); render(); },
  // Add a commission split to a team member.
  splitAdd(el) { const b = S.brok[Number(el.dataset.i)]; const p = Number(S.d.split.pct); if (!S.d.split.name.trim() || !p) { toast('Add a name and a percentage.'); return; } b.splits.push({ name: S.d.split.name.trim(), pct: p, paid: false }); S.d.split = { name: '', pct: '' }; render(); },
  // Remove a split.
  splitRm(el) { S.brok[Number(el.dataset.i)].splits.splice(Number(el.dataset.k), 1); render(); },
  // Mark a split as paid.
  splitPaid(el) { const b = S.brok[Number(el.dataset.i)]; const x = b.splits[Number(el.dataset.k)]; const tot = b.splits.reduce((a, y) => a + Number(y.pct || 0), 0); if (tot > 100) { toast('Splits exceed 100% — fix them first.'); return; } x.paid = !x.paid; render(); },
  // Remove a recorded payment.
  brokPayRm(el) { S.brok[Number(el.dataset.i)].pay.splice(Number(el.dataset.k), 1); render(); },
  // Generate an invoice number.
  genInvoice(el) { const b = S.brok[Number(el.dataset.i)]; const n = b.deal.slice(-4); b.inv = { buyer: 'INV-2026-' + n + '-B', owner: 'INV-2026-' + n + '-O', at: dayLbl(today) }; S.modal = { t: 'invoice', id: b.deal }; render(); },
  // Send a payment reminder.
  remind(el) { const b = S.brok[Number(el.dataset.i)]; const s = brokState(b); const side = el.dataset.side; const who = side === 'owner' ? propById(s.d.prop).owner : prosById(s.d.cid).name; b.reminders.unshift({ to: who + ' (' + (side === 'owner' ? (s.d.kind === 'sale' ? 'owner' : 'landlord') : (s.d.kind === 'sale' ? 'buyer' : 'tenant')) + ')', via: 'WhatsApp', at: 'Just now' }); toast('Reminder sent to ' + who); },
  // Waive (part of) the brokerage.
  doWaive(el) { const b = S.brok.find((x) => x.deal === el.dataset.id); b.override = S.modal.k2; b.notes = S.modal.k2 + (S.d.waive.reason ? ': ' + S.d.waive.reason : ''); S.modal = null; toast('Marked as ' + b.override); },
  // Reopen a waived/closed brokerage.
  brokReopen(el) { const b = S.brok[Number(el.dataset.i)]; b.override = null; render(); },
  // Preview a document in a modal.
  docPreview(el) { S.modal = { t: 'preview', scope: el.dataset.scope, i: Number(el.dataset.i) }; render(); const f0 = (S.files[el.dataset.scope] || [])[Number(el.dataset.i)]; if (f0) ADAPTER.openUrl(f0, render); },
  // Preview a document by id.
  docPreviewId(el) { const i = filesOf(el.dataset.scope).findIndex((f) => f.id === el.dataset.fid); S.modal = { t: 'preview', scope: el.dataset.scope, i }; render(); const f0 = filesOf(el.dataset.scope)[i]; if (f0) ADAPTER.openUrl(f0, render); },
  // Mark a document verified.
  docVerify(el) { const f = filesOf(el.dataset.scope)[Number(el.dataset.i)]; f.st = 'Verified'; render(); },
  // Toggle document sharing.
  docShareTog(el) { const f = filesOf(el.dataset.scope)[Number(el.dataset.i)]; f.share = !f.share; render(); },
  // Delete a document (record + file).
  docDel(el) { const arr = filesOf(el.dataset.scope); const ix = Number(el.dataset.i); const f = arr[ix]; arr.splice(ix, 1); if (scopeType(el.dataset.scope) === 'deal') { const d = S.deals.find((x) => x.id === scopeId(el.dataset.scope)); if (d) d.docs.forEach((r) => { if (r.name === f.cat && !arr.some((y) => y.cat === r.name)) { r.fid = ''; if (['Received', 'Verified'].includes(r.st)) r.st = 'Pending'; } }); } S.modal = null; toast('Removed ' + f.name); },
  // Verify the document in a checklist slot.
  slotVerify(el) { const sc = el.dataset.scope; const cat = el.dataset.cat; const fs = filesOf(sc).filter((f) => f.cat === cat); const row = scopeType(sc) === 'deal' ? S.deals.find((x) => x.id === scopeId(sc)).docs.find((x) => x.name === cat) : null; const all = fs.length ? fs.every((f) => f.st === 'Verified') : !!(row && row.st === 'Verified'); fs.forEach((f) => { f.st = all ? 'Uploaded' : 'Verified'; }); if (row) row.st = all ? 'Received' : 'Verified'; render(); },
  // Toggle sharing for a slot's document.
  slotShare(el) { const fs = filesOf(el.dataset.scope).filter((f) => f.cat === el.dataset.cat); const on = !fs.every((f) => f.share); fs.forEach((f) => { f.share = on; }); render(); },
  // Mark a checklist row 'Not applicable'.
  rowNA(el) { const d = S.deals.find((x) => x.id === scopeId(el.dataset.scope)); const r = d.docs.find((x) => x.name === el.dataset.cat); r.st = r.st === 'Not applicable' ? 'Pending' : 'Not applicable'; render(); },
  // Remove a document from a deal.
  dealFileRm(el) { const d = S.deals[Number(el.dataset.i)]; const r = d.docs[Number(el.dataset.k)]; const arr = filesOf('deal:' + d.id); const ix = arr.findIndex((f) => f.id === r.fid); if (ix >= 0) arr.splice(ix, 1); r.fid = ''; if (r.st === 'Received') r.st = 'Pending'; render(); },
  // Open a documents panel in a modal.
  openDocs(el, e) { const sc = el.dataset.scope; const t = scopeType(sc); S.modal = null; if (t === 'prop') S.tab.propTab = 'docs'; if (t === 'pros') S.tab.prospect = 'docs'; if (t === 'deal') S.tab.dealTab = 'docs'; const ri = recInfo(sc); if (ri) { if (e && e.preventDefault) e.preventDefault(); go(ri.href); } },
  // Toggle selection of a document for sharing.
  shareDocTog(el) { const id = el.dataset.id; S.d.shareSel[id] = S.d.shareSel[id] === false; render(); },
  /* team, settings */
  // Invite a team member (creates the team row; set their password afterwards).
  doInvite() { S.team.push({ name: 'Invited · +91 ' + (S.d.invite.phone || '—'), role: S.d.invite.role, phone: '+91 ' + (S.d.invite.phone || '—'), status: 'Invited', leads: 0 }); S.modal = null; toast('Invite sent'); },
  // Toggle a role permission cell.
  roleTog(el) { const r = S.roles[Number(el.dataset.r)][1]; const c = Number(el.dataset.c); r[c] = r[c] ? 0 : 1; render(); },
  // Toggle a portal setting.
  portalTog(el) { S.org.portals[el.dataset.id] = !S.org.portals[el.dataset.id]; render(); },
  // Toggle a notification preference.
  notifTog(el) { S.org.notif[el.dataset.k] = !S.org.notif[el.dataset.k]; render(); },
  
  // Copy text to the clipboard.
  copyText() { const ta = document.getElementById('copy_src') as HTMLTextAreaElement | null; const t = (S.modal && S.modal.text) || ''; const done = () => toast('Copied'); const fb = () => { if (ta) { ta.select(); try { document.execCommand('copy') ? done() : toast('Press Ctrl/⌘ + C to copy'); } catch (e) { toast('Press Ctrl/⌘ + C to copy'); } } }; try { navigator.clipboard.writeText(t).then(done, fb); } catch (e) { fb(); } },
  // Switch light/dark theme.
  theme(el) { S.tab.theme = el.dataset.v; const r = document.documentElement; if (el.dataset.v === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', el.dataset.v); render(); }
};

/* ---- v4 actions: deals, brokerage, documents, team (merged over the originals) */
// Random short token for document-request links.
const tokenOf = () => Math.random().toString(36).slice(2, 8);
// Keep a deal's timeline consistent after edits.
function syncTL(d) {
  (d.timeline || []).forEach((t) => {
    if (t.k === 'agreed' && d.agreedOn) t.at = d.agreedOn;
    else if (['token', 'agr', 'reg'].includes(t.k) && d[t.k] && d[t.k].date) t.at = d[t.k].date;
    else if (t.k === 'closed' && d.closedOn) t.at = d.closedOn;
  });
}
// Status of a party's document request.
function reqStatusOf(d, r) { const rows = r.docs.map((n) => d.docs.find((x) => x.name === n)).filter(Boolean); return rows.length && rows.every((x) => ['Received', 'Verified', 'Not applicable'].includes(x.st)) ? 'Received' : 'Awaiting'; }
// Which party a document belongs to.
const partyOfDoc = (d, who) => (who === 'owner' ? (d.kind === 'sale' ? 'Owner' : 'Landlord') : who === 'client' ? (d.kind === 'sale' ? 'Buyer' : 'Tenant') : who === 'bank' ? 'Bank contact' : who === 'lawyer' ? 'Lawyer' : 'Broker / office');
Object.assign(ACTS, {
  openModal: (function (orig) {
    return function (el, e) {
      const d = el.dataset; const deal = d.id && S.deals.find((x) => x.id === d.id);
      if (['pay', 'invoice'].includes(d.m) && deal) ensureBrok(deal);
      if (d.m === 'agree' && deal) S.d.agree = { date: iso(today), price: String(cp(deal) || ''), note: '' };
      if (d.m === 'sold' && deal) S.d.won = { date: iso(today), start: deal.leaseStart || iso(today), by: deal.closedBy || deal.openedBy };
      if (d.m === 'invoice') S.d.invSide = d.side || 'buyer';
      if (d.m === 'lost') S.d.lost = { reason: (deal && deal.stage === 'negotiation') ? 'Price gap' : 'Price gap', note: '', ret: true, react: true };
      if (d.m === 'capsave') { /* handled elsewhere */ }
      return orig(el, e);
    };
  })(ACTS.openModal),
  // Toggle a boolean on a deal (e.g. token received). (later version — overrides the earlier one above)
  dealTog(el) {
    const d = S.deals[Number(el.dataset.i)]; const k = el.dataset.k; const sale = d.kind === 'sale'; d[k].on = !d[k].on;
    const lab = { token: sale ? 'Token paid' : 'Token / advance paid', agr: sale ? 'Agreement signed' : 'Rent agreement signed', reg: sale ? 'Registration done' : 'Notarization done' }[k];
    if (d[k].on) {
      if (!d[k].date) d[k].date = iso(today);
      if (!d.agreedOn) { d.agreedOn = d[k].date; mlog(d, 'Negotiation successful — terms agreed' + (cp(d) ? ' at ' + dealPriceTxt(d, cp(d)) : ''), d.agreedOn); d.timeline[d.timeline.length - 1].k = 'agreed'; }
      mlog(d, lab + (k === 'token' && d.token.amt ? ' · ₹' + d.token.amt : ''), d[k].date); d.timeline[d.timeline.length - 1].k = k;
    } else d.timeline = d.timeline.filter((t) => t.k !== k);
    const old = d.stage; d.stage = d.reg.on ? 'registration' : d.agr.on ? 'agreement' : d.token.on ? 'token_paid' : d.agreedOn ? 'agreed' : 'negotiation';
    if (d.stage !== old) d.stageSince = iso(today); d.prob = PROB[d.stage];
    if (sale) { const ix = { token: 0, agr: 1, reg: 2 }[k]; if (d.sched && d.sched[ix]) d.sched[ix].paid = d[k].on; }
    d.upd = iso(today); render();
  },
  // Add a note/event to a deal's timeline. (later version — overrides the earlier one above)
  dealLog(el) { const d = S.deals[Number(el.dataset.i)]; if (!S.d.note.trim()) return; d.log.push([S.d.note.trim(), dateTxt(iso(today)) + ' · ' + ME().name]); d.upd = iso(today); S.d.note = ''; render(); },
  // Record agreement/terms agreed on a deal.
  doAgree(el) {
    const d = S.deals.find((x) => x.id === el.dataset.id); const a = S.d.agree; const pr = Number(String(a.price).replace(/[^0-9.]/g, ''));
    if (!a.date) { toast('Pick the date the terms were agreed.'); return; }
    d.agreedOn = a.date; if (pr) d.close = pr; d.stage = 'agreed'; d.stageSince = iso(today); d.prob = PROB.agreed;
    d.timeline = d.timeline.filter((t) => t.k !== 'agreed'); mlog(d, 'Negotiation successful — terms agreed' + (cp(d) ? ' at ' + dealPriceTxt(d, cp(d)) : '') + (a.note ? ' · ' + a.note : ''), a.date); d.timeline[d.timeline.length - 1].k = 'agreed';
    S.modal = null; toast('Terms agreed — next: token payment');
  },
  // Add an offer/counter-offer. (later version — overrides the earlier one above)
  offerAdd(el) {
    const d = S.deals[Number(el.dataset.i)]; const o = S.d.offer; const amt = Number(String(o.amt).replace(/[^0-9.]/g, '')); if (!amt) { toast('Enter an amount.'); return; }
    d.offers.forEach((x) => { if (x.status === 'Open') x.status = 'Countered'; }); d.offers.push({ by: o.by, amt, terms: o.terms, status: 'Open', at: dayLbl(today) });
    if (o.by === 'buyer') d.bid = amt; d.log.push([(o.by === 'buyer' ? (d.kind === 'sale' ? 'Buyer' : 'Tenant') : (d.kind === 'sale' ? 'Seller' : 'Owner')) + ' offered ' + dealPriceTxt(d, amt), dateTxt(iso(today)) + ' · ' + ME().name]); d.upd = iso(today);
    S.d.offer = { by: o.by === 'buyer' ? 'seller' : 'buyer', amt: '', terms: '' }; render();
  },
  // Accept/reject an offer. (later version — overrides the earlier one above)
  offerSet(el) {
    const d = S.deals[Number(el.dataset.i)]; const o = d.offers[Number(el.dataset.k)]; o.status = el.dataset.v;
    if (o.status === 'Accepted') { d.close = o.amt; d.offers.forEach((x) => { if (x !== o && x.status === 'Open') x.status = 'Countered'; }); d.log.push(['Offer accepted at ' + dealPriceTxt(d, o.amt) + ' — closing price set', dateTxt(iso(today)) + ' · ' + ME().name]); toast('Closing price set — mark the negotiation successful when everyone confirms'); }
    else d.log.push(['Offer of ' + dealPriceTxt(d, o.amt) + ' rejected', dateTxt(iso(today)) + ' · ' + ME().name]);
    d.upd = iso(today); render();
  },
  // Add a document row to a deal. (later version — overrides the earlier one above)
  docAdd(el) { const d = S.deals[Number(el.dataset.i)]; const n = (S.d.doc || '').trim(); if (!n) return; if (d.docs.some((x) => x.name.toLowerCase() === n.toLowerCase())) { toast('That document is already in the list.'); return; } d.docs.push({ name: n, who: 'client', st: 'Pending', req: '', rec: '' }); S.d.doc = ''; render(); },
  // Request documents from a party via link. (later version — overrides the earlier one above)
  docRequest(el) {
    const d = S.deals[Number(el.dataset.i)]; const pend = d.docs.filter((x) => x.st === 'Pending');
    if (!pend.length) { toast('Nothing pending to request.'); return; }
    const by = {}; pend.forEach((x) => { x.st = 'Requested'; x.req = iso(today); const p = partyOfDoc(d, x.who); (by[p] = by[p] || []).push(x.name); });
    Object.keys(by).forEach((p) => { d.reqs.push({ party: p, docs: by[p], token: tokenOf(), status: 'Awaiting', at: iso(today) }); });
    d.upd = iso(today); toast('Requested ' + pend.length + ' document' + (pend.length === 1 ? '' : 's') + ' · ' + Object.keys(by).length + ' upload link' + (Object.keys(by).length === 1 ? '' : 's') + ' created');
  },
  // Copy a document-request link.
  copyReqLink(el) {
    const url = location.origin + '/upload/' + S.deals[Number(el.dataset.i)].id + '/' + el.dataset.t; let ok = false;
    try { if (navigator.clipboard) { navigator.clipboard.writeText(url); ok = true; } } catch (e) { }
    S.modal = ok ? null : { t: 'importText', title: 'Upload link', note: 'Copy this link and send it to the party.', text: url }; toast(ok ? 'Upload link copied' : 'Copy the link shown');
  },
  // Select a deal document.
  dsel(el) { S.d.dsel[el.dataset.fid] = !S.d.dsel[el.dataset.fid]; render(); },
  // Select all deal documents.
  dselAll(el) { const fs = filesOf(el.dataset.scope); const any = fs.some((f) => S.d.dsel[f.id]); fs.forEach((f) => { S.d.dsel[f.id] = !any; }); render(); },
  // Open the 'share documents with a party' modal.
  dealShare(el) {
    const d = S.deals[Number(el.dataset.i)]; const ids = filesOf('deal:' + d.id).filter((f) => S.d.dsel[f.id]).map((f) => f.id);
    if (!ids.length) { toast('Tick one or more files first.'); return; }
    S.d.dshare = { to: {}, via: 'WhatsApp' }; S.modal = { t: 'dshare', id: d.id, ids: ids.join(',') }; render();
  },
  // Confirm sharing deal documents.
  doDealShare(el) {
    const d = S.deals.find((x) => x.id === el.dataset.id); const m = S.modal; const names = filesOf('deal:' + d.id).filter((f) => m.ids.split(',').includes(f.id)).map((f) => f.name);
    const to = d.parties.filter((p, i) => S.d.dshare.to[i]).map((p) => p.name); if (!to.length) { toast('Choose who to send them to.'); return; }
    d.shares.push({ files: names.length === 1 ? names[0] : names.length + ' files', to: to.join(', '), via: S.d.dshare.via, at: iso(today) }); S.d.dsel = {}; S.modal = null; toast(S.d.dshare.via === 'WhatsApp' ? 'Opening WhatsApp — one message per person' : 'One email per person is ready to send');
  },
  // Mark a payment-schedule row paid/unpaid. (later version — overrides the earlier one above)
  schedTog(el) { const d = S.deals[Number(el.dataset.i)]; const x = d.sched[Number(el.dataset.k)]; x.paid = !x.paid; d.upd = iso(today); render(); },
  // Tick a deal task. (later version — overrides the earlier one above)
  taskTog(el) { const d = S.deals[Number(el.dataset.i)]; const t = d.tasks[Number(el.dataset.k)]; t.done = !t.done; d.upd = iso(today); render(); },
  // Remove a party from a deal. (later version — overrides the earlier one above)
  partyRm(el) { const d = S.deals[Number(el.dataset.i)]; d.parties.splice(Number(el.dataset.k), 1); render(); },
  // Add a party (buyer, owner, lawyer, bank ...) to a deal. (later version — overrides the earlier one above)
  doParty(el) { const d = S.deals.find((x) => x.id === el.dataset.id); const p = S.d.party; if (!p.name.trim()) { toast('Enter a name.'); return; } d.parties.push({ role: p.role, name: p.name.trim(), phone: '+91 ' + (p.phone || '—') }); S.modal = null; render(); },
  // Close a deal as won (sold/rented) and update the property. (later version — overrides the earlier one above)
  doSold(el) {
    const d = S.deals.find((x) => x.id === el.dataset.id); const w = S.d.won; const sale = d.kind === 'sale';
    if (!sale && !w.start) { toast('Enter the lease commencement date.'); return; }
    d.stage = 'closed_won'; d.closedOn = w.date || iso(today); d.stageSince = iso(today); d.prob = 100; d.closedBy = w.by || d.closedBy;
    if (!d.agreedOn) d.agreedOn = d.closedOn;
    if (!sale) { d.leaseStart = w.start; if (!d.leaseEnd || !d.leaseEndEdited) d.leaseEnd = leaseEndOf(d.leaseStart, d.tenure); }
    propById(d.prop).status = sale ? 'Sold' : 'Rented/Leased';
    S.reqs.filter((r) => r.cid === d.cid && r.purpose === (sale ? 'sale' : 'rent')).forEach((r) => { r.status = 'Fulfilled'; });
    ensureBrok(d); d.timeline = d.timeline.filter((t) => t.k !== 'closed');
    mlog(d, (sale ? 'Closed — sold' : 'Closed — leased out') + (d.closedBy ? ' · closed by ' + d.closedBy : ''), d.closedOn, d.closedBy); d.timeline[d.timeline.length - 1].k = 'closed';
    if (!sale) mlog(d, 'Lease commenced · ends ' + dateTxt(d.leaseEnd), d.leaseStart);
    S.modal = null; S.toast = (sale ? 'Marked as Sold' : 'Marked as Leased Out') + ' · brokerage entry created'; go('#/brokerage/' + d.id); clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = ''; render(); }, 3000);
  },
  // Reopen a closed/lost deal.
  reopenDeal(el) { const d = S.deals.find((x) => x.id === el.dataset.id); d.stage = d.lostFrom && d.lostFrom !== 'lost' ? d.lostFrom : 'negotiation'; d.stageSince = iso(today); d.lostReason = ''; d.lostFrom = ''; mlog(d, 'Deal reopened', iso(today)); toast('Deal reopened'); },
  // Close a deal as lost with a reason. (later version — overrides the earlier one above)
  doLost(el) {
    const d = S.deals.find((x) => x.id === el.dataset.id); const wasNeg = d.stage === 'negotiation'; d.lostFrom = d.stage; d.stage = 'lost'; d.stageSince = iso(today); d.prob = 0; d.lostReason = S.d.lost.reason + (S.d.lost.note ? ' — ' + S.d.lost.note : '');
    d.lostOn = iso(today); if (S.d.lost.ret) propById(d.prop).status = 'Available'; if (S.d.lost.react) S.reqs.filter((r) => r.cid === d.cid).forEach((r) => { r.status = 'Active'; });
    mlog(d, (wasNeg ? 'Closed Lost — ' : 'Deal lost — ') + d.lostReason, iso(today)); S.modal = null; toast(wasNeg ? 'Moved to Closed Lost · reason saved' : 'Deal marked as Lost · Admin notified');
  },
  // Create a renewal for an expiring lease.
  renewDeal(el) {
    const d = S.deals[Number(el.dataset.i)]; const r = S.d.renew; const rent = parseK(r.rent); const term = Number(r.term);
    if (!r.date || !rent || !term) { toast('Enter the renewal date, new rent and new term.'); return; }
    d.renewals.push({ date: r.date, rent, term, prevRent: cp(d), prevEnd: d.leaseEnd });
    d.leaseStart = r.date; d.tenure = term; d.leaseEnd = leaseEndOf(r.date, term); d.leaseEndEdited = false; d.close = rent; d.depManual = d.depManual;
    mlog(d, 'Lease renewed — ' + term + ' months at ₹' + Math.round(rent * 1000).toLocaleString('en-IN') + '/mo · new end ' + dateTxt(d.leaseEnd), r.date); d.timeline[d.timeline.length - 1].k = 'renew';
    S.d.renew = null; toast('Renewal recorded · reminders now follow the new end date'); render();
  },
  // Open the payment dialog.
  dealPay(el) { const d = S.deals.find((x) => x.id === el.dataset.id); ensureBrok(d); ACTS.openModal({ dataset: { m: 'pay', id: d.id } }); },
  // Open the brokerage tab of a deal.
  tabBrok() { S.tab.dealTab = 'brok'; },
  /* brokerage */
  // Filter brokerage by a summary tile.
  brokTile(el) { S.tab.brokTile = S.tab.brokTile === el.dataset.v ? '' : el.dataset.v; render(); },
  // Toggle GST on a brokerage invoice. (later version — overrides the earlier one above)
  gstTog(el) { const b = el.dataset.deal ? ensureBrok(S.deals.find((x) => x.id === el.dataset.deal)) : S.brok[Number(el.dataset.i)]; b.gst[el.dataset.side] = !b.gst[el.dataset.side]; render(); },
  // Add a discount to a brokerage.
  discAdd(el) { const b = S.brok[Number(el.dataset.i)]; const a = Number(String(S.d.disc.amt).replace(/[^0-9]/g, '')); if (!a) { toast('Enter the discount amount.'); return; } const base = brokState(b).sides.find((x) => x.k === S.d.disc.side).nb; if (a > base) { toast('The discount is more than the brokerage on that side.'); return; } b.discounts.push({ side: S.d.disc.side, amt: a, reason: S.d.disc.reason.trim(), at: iso(today) }); S.d.disc = { side: S.d.disc.side, amt: '', reason: '' }; render(); },
  // Remove a discount.
  discRm(el) { S.brok[Number(el.dataset.i)].discounts.splice(Number(el.dataset.k), 1); render(); },
  // Add a commission split to a team member. (later version — overrides the earlier one above)
  splitAdd(el) { const b = S.brok[Number(el.dataset.i)]; const p = Number(S.d.split.pct); if (!S.d.split.name.trim() || !p) { toast('Add a name and a percentage.'); return; } b.splits.push({ name: S.d.split.name.trim(), pct: p, inc: '', note: '' }); S.d.split = { name: '', pct: '' }; render(); },
  // Generate an invoice number. (later version — overrides the earlier one above)
  genInvoice(el) { const b = S.brok[Number(el.dataset.i)]; const n = b.deal.slice(-4); b.inv = { buyer: 'INV-2026-' + n + '-B', owner: 'INV-2026-' + n + '-O', at: iso(today) }; S.d.invSide = 'buyer'; S.modal = { t: 'invoice', id: b.deal }; render(); },
  // Download the invoice.
  invDownload(el) { const html = invoiceHtml(el.dataset.id, el.dataset.side); const b = S.brok.find((x) => x.deal === el.dataset.id); toast(dlFile((b.inv ? b.inv[el.dataset.side] : 'invoice') + '.html', html, 'text/html') ? 'Invoice downloaded — open it and use Print → Save as PDF' : 'Download is blocked in this browser'); },
  // Print the invoice.
  invPrint(el) { const html = invoiceHtml(el.dataset.id, el.dataset.side); try { const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300); } else toast('Allow pop-ups to print'); } catch (e) { toast('Printing is not available here'); } },
  // Email the invoice.
  invMail(el) {
    const s = brokState(S.brok.find((x) => x.deal === el.dataset.id)); const d = s.d; const k = el.dataset.side; const sd = s.sides.find((x) => x.k === k); const b = S.brok.find((x) => x.deal === el.dataset.id);
    const subj = encodeURIComponent('Invoice ' + b.inv[k] + ' · ' + S.org.name); const body = encodeURIComponent('Dear ' + sidePayer(d, k) + ',\n\nPlease find our brokerage invoice ' + b.inv[k] + ' for ' + propLabel(propById(d.prop)) + '. Amount due: ' + inr(sd.pend) + '.\n\nRegards,\n' + ME().name + '\n' + S.org.name);
    const to = S.d.invTo || ''; location.href = 'mailto:' + encodeURIComponent(to) + '?subject=' + subj + '&body=' + body; toast('Opening your email app — attach the downloaded invoice');
  },
  // Send the invoice on WhatsApp.
  invWa(el) {
    const s = brokState(S.brok.find((x) => x.deal === el.dataset.id)); const d = s.d; const k = el.dataset.side; const sd = s.sides.find((x) => x.k === k); const b = S.brok.find((x) => x.deal === el.dataset.id);
    const t = encodeURIComponent('Hi ' + sidePayer(d, k) + ', invoice ' + b.inv[k] + ' from ' + S.org.name + ' for ' + propLabel(propById(d.prop)) + ': amount due ' + inr(sd.pend) + '. Thank you.'); window.open('https://wa.me/?text=' + t, '_blank'); toast('Opening WhatsApp');
  },
  // Send a payment reminder. (later version — overrides the earlier one above)
  remind(el) { const b = S.brok[Number(el.dataset.i)]; const s = brokState(b); const side = el.dataset.side; const who = sidePayer(s.d, side); b.reminders.unshift({ to: who + ' (' + sideName(s.d, side).toLowerCase() + ')', via: 'WhatsApp', at: dateTxt(iso(today)) }); toast('Reminder sent to ' + who); },
  // Add a deduction to a brokerage. (later version — overrides the earlier one above)
  dedAdd(el) { const b = S.brok[Number(el.dataset.i)]; const a = Number(String(S.d.ded.amt).replace(/[^0-9]/g, '')); if (!S.d.ded.name.trim() || !a) { toast('Add a name and an amount.'); return; } b.deductions.push({ name: S.d.ded.name.trim(), amt: a }); S.d.ded = { name: '', amt: '' }; render(); },
  // Record a brokerage payment. (later version — overrides the earlier one above)
  doPay(el) {
    const b = S.brok.find((x) => x.deal === el.dataset.id); const a = Number(String(S.d.pay.amt).replace(/[^0-9]/g, '')); if (!a) { toast('Enter an amount.'); return; }
    const sd = brokState(b).sides.find((x) => x.k === S.d.pay.from); if (a > sd.pend) { toast('That is more than the ' + inr(sd.pend) + ' pending from this side.'); return; }
    b.pay.push({ amt: a, from: S.d.pay.from, date: S.d.pay.date || iso(today), mode: S.d.pay.mode, ref: S.d.pay.ref, note: S.d.pay.note }); S.modal = null; toast('Payment recorded');
  },
  /* team */
  // Invite a team member (creates the team row; set their password afterwards). (later version — overrides the earlier one above)
  doInvite() {
    const d = S.d.invite; if (!String(d.name || '').trim()) { toast('Enter the person’s name.'); return; }
    S.team.push({ name: d.name.trim(), role: d.role, phone: '+91 ' + (d.phone || '—'), corp: '+91 ' + (d.corp || '—'), alt: d.alt ? '+91 ' + d.alt : '', email: d.email || '', status: 'Invited', leads: 0, seeNumbers: d.role !== 'Field staff' }); S.modal = null; toast('Added ' + d.name + ' — now set their password');
  },
  // Change a role's access level for a module (owner only).
  permLv(el) { const a = S.perms.lv[el.dataset.m]; a[Number(el.dataset.c)] = el.dataset.v; render(); },
  // Toggle an action permission for a role.
  permAct(el) { const a = S.perms.act.find((x) => x[0] === el.dataset.k); a[2][Number(el.dataset.c)] = a[2][Number(el.dataset.c)] ? 0 : 1; render(); },
  // Toggle the 'see full numbers' override for a team member.
  seeNum(el) { const m = S.team.find((t) => t.name === el.dataset.n); m.seeNumbers = !m.seeNumbers; render(); },
  // Activate/disable a team member.
  memberStatus(el) { const m = S.team.find((t) => t.name === el.dataset.n); m.status = m.status === 'Disabled' || m.status === 'Inactive' ? 'Active' : 'Disabled'; render(); },
  // Demo reset is not available in the connected build (shows a note).
  resetDemo() { toast('Demo data is loaded from the server — run “npm run db:seed” to reset it.'); }
});
/* ---- v4: input side-effects + deal creation */
// Side effects after typing (auto-fill, dependent fields, live validation).
function afterInput0(p, el) {
  let m = p.match(/^(?:d\.deal|deals\.(\d+))\.(leaseStart|tenure|depMonths|leaseEnd|bid|ask|close)$/);
  // Regex matched: act on it.
  if (m) {
    const o = m[1] != null ? S.deals[Number(m[1])] : S.d.deal; const f = m[2];
    if (f === 'leaseStart' || f === 'tenure') { if (o.leaseStart && Number(o.tenure) > 0) { o.leaseEnd = leaseEndOf(o.leaseStart, o.tenure); o.leaseEndEdited = false; } }
    if (f === 'leaseEnd') o.leaseEndEdited = true;
    if (f === 'depMonths' && o.depManual != null) o.depManual = false;
    if (o.upd != null) o.upd = iso(today);
  }
  if (p === 'd.project.type') { const P = S.d.project; P.configs = P.configs.filter((c) => cfgFor(P.type).includes(c)); }
  m = p.match(/^d\.(project|property)\.addr\.pin$/); if (m && /^\d{6}$/.test(el.value) && PIN_TABLE[el.value]) { const a = S.d[m[1]].addr; a.city = PIN_TABLE[el.value][0]; a.state = PIN_TABLE[el.value][1]; render(); }
  m = p.match(/^deals\.(\d+)\.(token|agr|reg)\.date$/); if (m) { const d = S.deals[Number(m[1])]; syncTL(d); }
  m = p.match(/^deals\.(\d+)\.agreedOn$/); if (m) { const d = S.deals[Number(m[1])]; syncTL(d); }
}
Object.assign(ACTS, {
  // Validate and save a deal. (later version — overrides the earlier one above)
  saveDeal() {
    const d = clone(S.d.deal); const sale = d.kind === 'sale'; const p = propById(d.prop);
    if (!p) { fail({ 'd.deal.prop': 'Choose a property for this ' + (sale ? 'sale' : 'rental') + ' deal.' }); return; }
    const ask = Number(d.ask) || (p ? (sale ? p.priceL : p.rentK) : 0) || 0;
    if (!ask && !Number(d.bid) && !Number(d.close)) { fail({ 'd.deal.ask': 'Enter the ask price (or a bid).' }); return; }
    if (!sale && (!d.leaseStart || !Number(d.tenure))) { fail({ 'd.deal.tenure': 'Enter the lease start date and tenure.' }); return; }
    const n = Math.max(...S.deals.map((x) => Number(x.id.slice(5)) || 0), 140) + 1; const id = 'DEAL-' + String(n).padStart(4, '0');
    const nd: Rec = { id, cid: d.cid, prop: d.prop, kind: sale ? 'sale' : 'rent', stage: 'negotiation', ask, bid: Number(d.bid) || '', close: Number(d.close) || '', token: { on: false, amt: '', date: '', note: '' }, agr: { on: false, date: '', note: '' }, reg: { on: false, date: '', note: '' }, bType: d.bType, bBuyer: Number(d.bBuyer) || 0, bOwner: Number(d.bOwner) || 0, openedBy: d.openedBy, closedBy: d.closedBy || d.openedBy, created: d.opened || iso(today), notes: d.notes || '', lostReason: '', log: [], expected: sale ? (d.expected || '') : '', stageSince: d.opened || iso(today), upd: iso(today) };
    if (!sale) Object.assign(nd, { leaseStart: d.leaseStart, tenure: Number(d.tenure), leaseEnd: d.leaseEnd || leaseEndOf(d.leaseStart, d.tenure), depMonths: Number(d.depMonths) || 0 });
    nd.offers = []; if (ask) nd.offers.push({ by: 'seller', amt: ask, terms: 'Asking price', status: nd.bid ? 'Countered' : 'Open', at: dayLbl(today) }); if (nd.bid) nd.offers.push({ by: 'buyer', amt: nd.bid, terms: 'Opening bid', status: 'Open', at: dayLbl(today) });
    initDeal(nd); S.deals.push(nd); S.toast = 'Deal created in Negotiation · ' + id; go('#/deals/' + id); clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = ''; render(); }, 2400);
  }
});
/* ---- v4 actions: projects, properties, masters requests, reveal */
// Copy a project into the edit draft.
function loadProjectDraft(id) { const p = projById(id); if (!p) return; const d = Object.assign(newProject(), clone(p)); if (!d.cm && p.complete) { const m = p.complete.split(' '); d.cm = m[0]; d.cy = m[1] || ''; } d.place = p.place; d.photoList = d.photoList || []; d.layouts = d.layouts || []; d.charges = d.charges || []; d.customAmen = d.customAmen || []; d.ai = null; S.d.project = d; S.d.projectEditId = id; S.files['proj:__draft'] = clone(S.files['proj:' + id] || []); }
Object.assign(ACTS, {
  // Validate and save the project draft (create or update). (later version — overrides the earlier one above)
  saveProject() {
    const d = clone(S.d.project); if (!d.name.trim()) { fail({ 'd.project.name': 'Enter a project name — it is the only required field.' }); return; }
    d.complete = d.status === 'ready' ? '' : [d.cm, d.cy].filter(Boolean).join(' '); d.ai = null; if (!d.place) d.place = null;
    const eid = S.d.projectEditId; if (eid) { d.id = eid; const i = S.projects.findIndex((p) => p.id === eid); S.projects[i] = d; } else { d.id = 'p' + Date.now(); S.projects.push(d); }
    S.files['proj:' + d.id] = S.files['proj:__draft'] || []; S.files['proj:__draft'] = [];
    S.d.projectEditId = null; S.toast = 'Project saved'; go('#/projects/' + d.id); clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = ''; render(); }, 2200);
  },
  // Run the (mock) AI extraction on a brochure.
  aiExtract() { const d = S.d.project; d.ai = { data: mockExtract(d), pick: {} }; render(); },
  // Choose extracted fields to apply.
  aiPick(el) { const a = S.d.project.ai; a.pick[el.dataset.k] = a.pick[el.dataset.k] === false; render(); },
  // Discard the extraction.
  aiDiscard() { S.d.project.ai = null; render(); },
  // Apply selected extracted fields to the draft.
  aiApply() { const d = S.d.project; const a = d.ai; let n = 0; Object.keys(a.data).forEach((k) => { if (a.pick[k] === false) return; const v = a.data[k]; if (k === 'amenities') { v.forEach((id) => { if (!d.amenities.includes(id)) d.amenities.push(id); }); } else if (k === 'layouts') d.layouts = d.layouts.concat(v); else d[k] = Array.isArray(v) ? v.slice() : v; n++; }); d.ai = null; toast(n + ' field' + (n === 1 ? '' : 's') + ' applied — check them, then save'); },
  // Add a layout row.
  layoutAdd() { const d = S.d.project; d.layouts.push({ cfg: (d.configs[0] || cfgFor(d.type)[0]), name: '', area: '', baths: '', units: '' }); render(); },
  // Remove a layout row.
  layoutRm(el) { S.d.project.layouts.splice(Number(el.dataset.i), 1); render(); },
  // Add a charge row.
  chargeAdd() { S.d.project.charges.push({ name: CHARGE_NAMES[0], rate: '', from: iso(today) }); render(); },
  // Remove a charge row.
  chargeRm(el) { S.d.project.charges.splice(Number(el.dataset.i), 1); render(); },
  // Remove a photo.
  photoRm(el) { const w = el.dataset.w, i = Number(el.dataset.i), x = S.d[w].photoList[i]; S.d[w].photoList.splice(i, 1); if (x && x.fid) { const sc = (w === 'project' ? 'proj:' : 'prop:') + '__draft'; S.files[sc] = filesOf(sc).filter((f) => f.id !== x.fid); } render(); },
  // Remove an amenity from the form.
  amRmForm(el) { const P = S.d.project; P.amenities = P.amenities.filter((x) => x !== el.dataset.id); render(); },
  // Remove a custom amenity.
  amRmCustom(el) { S.d.project.customAmen.splice(Number(el.dataset.i), 1); render(); },
  // Tick/untick an amenity. (later version — overrides the earlier one above)
  amPick(el) { const a = S.d.project.amenities; const id = el.dataset.id; S.d.project.amenities = a.includes(id) ? a.filter((x) => x !== id) : a.concat(id); S.am.notice = ''; S.am.dym = null; render(); },
  // Add a typed amenity to the master and the draft. (later version — overrides the earlier one above)
  amAdd() { amenAddName(S.am.q, false); render(); },
  // Add an amenity even if it looks like a duplicate.
  amForce() { amenAddName(S.am.dym ? S.am.dym.q : '', true); render(); },
  // Use the suggested existing amenity instead.
  amUse(el) { const ex = S.amen.find((a) => a.label === el.dataset.v); if (ex && !S.d.project.amenities.includes(ex.id)) S.d.project.amenities.push(ex.id); S.am.notice = 'Selected “' + el.dataset.v + '”.'; S.am.warn = false; S.am.dym = null; S.am.q = ''; render(); },
  /* properties */
  // Toggle the property source type.
  srcTog(el) { const s = S.d.property.src; s[el.dataset.k] = !s[el.dataset.k]; if (S.err) delete S.err['d.property.src']; render(); },
  // Add a broker group.
  bgAdd() { const b = S.d.property.broker; const v = (b.gNew || '').trim(); if (!v) return; const ex = S.masters.brokerGroups.find((g) => g.toLowerCase() === v.toLowerCase()); const near = ex ? null : didYouMean(v, S.masters.brokerGroups); if (ex) { if (!b.groups.includes(ex)) b.groups.push(ex); b.gNew = ''; toast('“' + ex + '” already exists — tagged it'); return; } if (near && !b.gForce) { b.gForce = true; toast('Did you mean “' + near + '”? Press + Add again to add yours anyway.'); return; } b.gForce = false; S.masters.brokerGroups.push(v); b.groups.push(v); b.gNew = ''; render(); },
  // Add a feature.
  featAdd() { const d = S.d.property; const v = (d.fNew || '').trim(); if (!v) return; const all = S.masters.features.concat(d.features); if (all.some((x) => x.toLowerCase() === v.toLowerCase())) { toast('That feature is already in the list.'); d.fNew = ''; render(); return; } d.features.push(v); d.fNew = ''; render(); },
  // Switch the property-form tab. (later version — overrides the earlier one above)
  pfTab(el) { S.tab.pf = Number(el.dataset.i); render(); },
  // Edit an existing property. (later version — overrides the earlier one above)
  editProperty(el) { loadPropertyDraft(el.dataset.id); S.tab.pf = 0; S.pq = { q: '', open: false }; go('#/properties/' + el.dataset.id + '/edit'); },
  // Start the add-property flow. (later version — overrides the earlier one above)
  newProperty(el) { S.newMenuOpen = false; S.files['prop:__draft'] = []; S.d.property = newProperty(); S.d.propEditId = null; S.tab.pf = 0; S.pq = { q: '', open: false }; if (el && el.dataset.pid) S.d.property.projectId = el.dataset.pid; S.ctx = null; go('#/properties/new'); },
  // Validate and save the property draft (create/update/publish). (later version — overrides the earlier one above)
  saveProperty(el) {
    const d = clone(S.d.property); const draft = !!(el && el.dataset.draft); const price = parseL(d.price); const rent = parseK(d.rent); const land = d.cat === 'Land'; const _R = PT[ptKind(d.cat, d.sub)];
    if (!draft) {
      const e = srcErrors(d); if (Object.keys(e).length) { fail(e, () => { S.tab.pf = 0; }); return; }
      if (!Number(d.sbu) || (!land && !Number(d.carpet))) { const e2 = {}; if (!land && !Number(d.carpet)) e2['d.property.carpet'] = 'Carpet area is required.'; if (!Number(d.sbu)) e2['d.property.sbu'] = land ? 'Plot area is required.' : 'Chargeable area is required.'; fail(e2, () => { S.tab.pf = 2; }); return; }
      if (d.purpose === 'sale' && !price) { fail({ 'd.property.price': 'Enter the expected price, or save as draft.' }, () => { S.tab.pf = 3; }); return; }
      if (d.purpose === 'rent' && !rent) { fail({ 'd.property.rent': 'Enter the monthly rent, or save as draft.' }, () => { S.tab.pf = 3; }); return; }
    }
    const eid = S.d.propEditId; const old = eid ? propById(eid) : null; const pr = d.projectId ? projById(d.projectId) : null;
    const srcs = ['owner', 'broker', 'portal'].filter((k) => d.src[k]); const srcLbl = srcs.length ? srcs[0][0].toUpperCase() + srcs[0].slice(1) : 'Owner';
    const o = { id: eid || '', purpose: d.purpose, cat: d.cat, sub: d.sub, title: (PT[ptKind(d.cat, d.sub)].bhk && d.bhk ? d.bhk + ' BHK ' : '') + d.sub, projectId: d.projectId, unit: [d.addr.flat, d.addr.tower, d.addr.street].filter(Boolean).join(', ') || (pr ? pr.name : '—'), loc: (d.place ? d.place.sub.split(',').slice(0, 2).join(',') : d.addr.street) || '—', bhk: PT[ptKind(d.cat, d.sub)].bhk ? Number(d.bhk) || 0 : 0, area: Number(d.sbu) || Number(d.carpet) || 0, carpet: Number(d.carpet) || 0, sbu: Number(d.sbu) || 0, furn: d.furn, priceL: price, quotedL: parseL(d.quoted) || price, rentK: rent, status: draft ? 'Draft' : (old && old.status !== 'Draft' ? old.status : 'Available'), source: srcLbl, sources: srcs, owner: (d.owner.name || '').trim() || (d.src.broker ? d.broker.company : '') || '—', ownerPhone: d.owner.mobile ? '+91 ' + d.owner.mobile : '', created: old ? old.created : iso(today), form: d };
    if (!draft && (!o.id || o.id.startsWith('DR'))) { const pre = (d.cat === 'Residential' ? 'R' : d.cat === 'Commercial' ? 'C' : 'L') + (d.purpose === 'sale' ? 'S' : 'R'); let n = S.props.filter((p) => p.id.startsWith(pre)).length + 1; while (propById(pre + String(n).padStart(3, '0'))) n++; o.id = pre + String(n).padStart(3, '0'); }
    if (draft && !o.id) { let n = S.props.filter((p) => p.id.startsWith('DR')).length + 1; while (propById('DR' + n)) n++; o.id = 'DR' + n; }
    if (eid) { const i = S.props.findIndex((p) => p.id === eid); S.props[i] = o; } else S.props.push(o);
    if (!draft && o.status === 'Available' && (!old || old.status === 'Draft')) findAlerts(o);
    if (eid && eid !== o.id) delete S.files['prop:' + eid]; S.files['prop:' + o.id] = S.files['prop:__draft'] || []; S.files['prop:__draft'] = [];
    S.d.propEditId = null; S.toast = draft ? 'Draft saved — find it under Properties → Draft' : 'Property saved · ID ' + o.id; if (el && el.dataset && el.dataset.stay) render(); else go('#/properties/' + o.id); clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = ''; render(); }, 2600);
  },
  /* numbers */
  // Ask for permission to reveal a number.
  askReveal(el) { S.modal = { t: 'reveal', key: el.dataset.key, what: el.dataset.what, label: el.dataset.label }; render(); },
  // Perform the reveal after approval.
  doReveal() { const m = S.modal; S.tab.rev[m.key] = true; S.viewLog.unshift({ who: ME().name, what: m.what, rec: m.label, at: nowStamp() }); S.modal = null; render(); },
  /* masters requests */
  // Raise a masters/change request.
  doMreq() {
    const m = S.modal; const v = (S.d.mreq.value || '').trim(); if (!v) { fail({ 'd.mreq.value': 'Enter a name.' }); return; }
    const list = m.list; const items = list === 'amenities' ? S.amen.map((a) => a.label) : S.masters[list] || [];
    if (items.some((x) => x.toLowerCase() === v.toLowerCase())) { S.modal = null; toast('“' + v + '” is already in the list.'); return; }
    const near = didYouMean(v, items); if (near && !m.forced) { m.dym = near; m.forced = true; render(); return; }
    S.mreq.push({ id: 'mr' + Date.now(), list, value: v, note: S.d.mreq.note, by: ME().name, at: iso(today), status: 'Pending' }); S.modal = null; toast('Request sent to your Admin');
  }
});
ACTS.openModal = (function (orig) { return function (el, e) { const r = orig(el, e); if (el.dataset.m === 'mreq') { S.modal.list = el.dataset.list; S.d.mreq = { value: '', note: '' }; render(); } return r; }; })(ACTS.openModal);
/* file pickers: brochure + photos */
// Change handler: file inputs (upload documents) and select-like controls.
_doc.addEventListener('change', (e) => {
  const el = e.target; if (!el || el.type !== 'file' || !el.dataset) return;
  if (el.dataset.brochure) { const f = (el.files || [])[0]; if (f) { S.d.project.brochure = f.name; S.d.project.ai = null; render(); } el.value = ''; }
  if (el.dataset.photos) { const w = el.dataset.photos; const arr = S.d[w].photoList = S.d[w].photoList || []; const sc = (w === 'project' ? 'proj:' : 'prop:') + '__draft'; const before = new Set(filesOf(sc).map((x) => x.id)); const picked = (Array.from(el.files || []) as File[]).filter((f) => isImg({ type: f.type, name: f.name })); const skipped = (el.files ? el.files.length : 0) - picked.length; addFiles(sc, picked, 'Photos', el); filesOf(sc).filter((x) => !before.has(x.id)).forEach((x) => { if (!arr.some((y) => y.fid === x.id)) arr.push({ name: x.name, fid: x.id }); }); if (skipped) toast(skipped + ' file' + (skipped > 1 ? 's were' : ' was') + ' not a picture and was skipped'); el.value = ''; render(); }
});
Object.assign(ACTS, {
  // Change a lead's stage. (later version — overrides the earlier one above)
  leadStage(el) { const l = S.leads.find((x) => x.id === el.dataset.id); const was = l.stage; l.stage = el.dataset.v; l.act.unshift(['System', el.dataset.v === 'Lead' ? 'Reopened (was ' + lstLabel(was) + ')' : 'Marked ' + lstLabel(l.stage), dateTxt(iso(today))]); render(); },
  // Log a call/WhatsApp/visit on a lead. (later version — overrides the earlier one above)
  leadLog(el) { const l = S.leads.find((x) => x.id === el.dataset.id); l.act.unshift([el.dataset.v, el.dataset.v === 'Call' ? 'Call attended' : 'WhatsApp message sent', dateTxt(iso(today))]); render(); },
  // Add a note to a lead's activity log. (later version — overrides the earlier one above)
  leadNote(el) { const l = S.leads.find((x) => x.id === el.dataset.id); if (!S.d.note.trim()) return; l.act.unshift(['Note', S.d.note.trim(), dateTxt(iso(today))]); S.d.note = ''; render(); },
  // Add a reference link to a lead.
  linkAdd(el) {
    const l = S.leads.find((x) => x.id === el.dataset.id); const k = S.d.lk; const u = normUrl(k.url);
    if (!u) { fail({ 'd.lk.url': k.url && k.url.trim() ? 'This does not look like a valid web link — check it, e.g. https://www.instagram.com/p/…' : 'Paste or type a link.' }); return; }
    l.links = l.links || []; if (l.links.some((x) => x.url === u)) { fail({ 'd.lk.url': 'This link is already added.' }); return; }
    l.links.push({ url: u, type: k.type === 'auto' ? autoLinkType(u) : k.type, note: (k.note || '').trim(), at: iso(today) });
    l.act.unshift(['System', 'Source link added — ' + linkHost(u), dateTxt(iso(today))]); S.d.lk = { type: 'auto', url: '', note: '' }; toast('Link added');
  },
  // Remove a reference link.
  linkRm(el) { const l = S.leads.find((x) => x.id === el.dataset.id); l.links.splice(Number(el.dataset.k), 1); render(); },
  // Copy a link.
  linkCopy(el) { const l = S.leads.find((x) => x.id === el.dataset.id); const u = l.links[Number(el.dataset.k)].url; try { navigator.clipboard.writeText(u); } catch (e) {} toast('Link copied'); },
  // Validate and save a lead. (later version — overrides the earlier one above)
  saveLead() {
    const d = S.d.lead; if (!d.name.trim() || !String(d.phone).trim()) { const e = {}; if (!d.name.trim()) e['d.lead.name'] = 'Enter the lead’s name.'; if (!String(d.phone).trim()) e['d.lead.phone'] = 'Enter a mobile number.'; fail(e); return; }
    const rk = reqKind({ type: d.ptype }); const bhk = (rk === 'flat' || rk === 'house') ? Number(d.bhk) || 0 : 0; const loc = (d.locality || '').trim(); const spec = bhk ? bhk + ' BHK' : rk === 'plot' ? 'Plot' : rk === 'comm' ? d.csub : ''; const wantTxt = [spec, bhk || rk === 'comm' ? '' : '', loc].filter(Boolean).join(' · ') || '—';
    S.leads.unshift({ id: 'l' + Date.now(), name: d.name, phone: '+91 ' + d.phone, waSame: d.waSame, wa: d.wa, source: d.source === 'Portal' ? d.portal : d.source, intent: d.intent, stage: 'Lead', sub: '', budget: d.bmin || d.bmax ? d.bmin + '–' + d.bmax : '—', want: wantTxt + (d.want ? ' — ' + d.want : ''), basic: { locText: loc, min: parseL(d.bmin), max: parseL(d.bmax), bhk: bhk, type: d.ptype, csub: rk === 'comm' ? d.csub : '' }, refBy: d.refBy, assigned: d.assigned, tags: [], created: iso(today), links: (function () { const u = normUrl(d.link); return u ? [{ url: u, type: autoLinkType(u), note: '', at: iso(today) }] : []; })(), act: [['System', 'Lead created', dateTxt(iso(today))]] });
    S.modal = null; toast('Lead added'); go('#/leads');
  },
  // Convert a lead into a prospect (and requirement). (later version — overrides the earlier one above)
  doConvert(el) {
    const l = S.leads.find((x) => x.id === el.dataset.id); l.stage = 'Converted'; l.act.unshift(['System', 'Converted to prospect', dateTxt(iso(today))]);
    let c = S.prospects.find((x) => x.name === l.name); if (!c) { c = { id: 'c' + Date.now(), name: l.name, type: l.intent === 'buy' ? 'Buyer' : 'Tenant', nri: l.tags.includes('NRI'), city: 'Kolkata', source: l.source, assigned: l.assigned, phone: l.phone, waSame: l.waSame !== false, wa: l.wa || '', waOk: true, email: '', lang: 'English', notes: l.want, created: iso(today) }; S.prospects.push(c); } l.prospectId = c.id; S.modal = null;
    if (el.dataset.req) { S.d.req = newReq(); S.d.req.cid = c.id; S.d.req.purpose = l.intent === 'buy' ? 'sale' : 'rent'; if (l.basic) { if (l.basic.type) S.d.req.type = l.basic.type; if (l.basic.csub) S.d.req.csub = l.basic.csub; if (l.basic.bhk) S.d.req.bhk = l.basic.bhk; if (l.basic.locText) S.d.req.locs = [l.basic.locText]; if (l.basic.min) S.d.req.min = String(l.basic.min); if (l.basic.max) S.d.req.max = String(l.basic.max); } go('#/requirements/new'); } else { S.toast = 'Converted to prospect'; go('#/prospects/' + c.id); }
  },
  // Validate and save a prospect. (later version — overrides the earlier one above)
  saveProspect(el) {
    const d = S.d.prospect; const e = {}; if (!d.name.trim()) e['d.prospect.name'] = 'Enter the prospect’s name.'; if (!String(d.phone).trim()) e['d.prospect.phone'] = 'Enter a mobile number.'; if (d.nri && !String(d.country || '').trim()) e['d.prospect.country'] = 'Enter the country for an NRI prospect.'; if (d.contact === 'Email' && !String(d.email || '').trim()) e['d.prospect.email'] = 'Add an email — you picked Email as the preferred contact.'; if (Object.keys(e).length) { fail(e); return; }
    const c = { id: 'c' + Date.now(), name: d.name, type: d.type, nri: d.nri, city: d.city, source: d.source, assigned: d.assigned, phone: '+91 ' + d.phone, waSame: d.waSame, wa: d.wa, waOk: true, alt: d.alt, email: d.email, lang: d.lang, notes: d.notes, created: iso(today), contact: d.contact, refBy: d.refBy, enqId: d.enqId, country: d.nri ? d.country : '', tz: d.nri ? d.tz : '', bestTime: d.nri ? d.bestTime : '' }; S.prospects.push(c); S.modal = null;
    if (el.dataset.req) { S.d.req = newReq(); S.d.req.cid = c.id; S.d.req.purpose = d.type === 'Tenant' ? 'rent' : 'sale'; go('#/requirements/new'); } else if (el.dataset.prop) { ACTS.newProperty(); S.d.property.src = { owner: true, broker: false, portal: false }; S.d.property.owner.name = c.name; S.d.property.owner.mobile = String(d.phone); toast('Prospect added — now add the property'); } else { toast('Prospect added'); go('#/prospects/' + c.id); }
  },
  // Share via WhatsApp/email/copy. (later version — overrides the earlier one above)
  shareVia(el) { const ids = ((S.modal && S.modal.ids) || '').split(',').filter(Boolean); const n = ids.flatMap((pid) => filesOf('prop:' + pid).filter((f) => f.share && S.d.shareSel[f.id] !== false)).length; const c = prosById(S.d.shareTo); S.modal = null; toast((el.dataset.v === 'WhatsApp' ? 'Opening WhatsApp' + (c ? ' for ' + c.name : '') + ' — one message per property' : 'One email' + (c ? ' to ' + c.name : '') + ' with a PDF per property') + (n ? ' · ' + n + ' document' + (n > 1 ? 's' : '') + ' included' : '')); },
  // Open the share modal for ticked matches. (later version — overrides the earlier one above)
  shareSel() { const a = S.tab.matchSel || []; if (!a.length) { toast('Tick one or more properties first.'); return; } const r = pendingReqs().find((x) => x.id === S.tab.matchReq); S.d.shareTo = r && r.cid ? r.cid : ''; S.modal = { t: 'share', ids: a.join(',') }; render(); },
  // Schedule visits for ticked matches. (later version — overrides the earlier one above)
  visitSel() { const a = S.tab.matchSel || []; if (!a.length) { toast('Tick one or more properties first.'); return; } S.d.visit = newVisit(); S.d.visit.props = a.slice(); const r = pendingReqs().find((x) => x.id === S.tab.matchReq); if (r && r.cid) S.d.visit.cid = r.cid; else if (r) { toast('Convert the lead to a prospect before scheduling a visit.'); return; } S.modal = { t: 'visit' }; render(); },
  // Mark a match alert as seen.
  alertSeen(el) { const a = S.alerts.find((x) => x.id === el.dataset.id); if (a) a.seen = true; render(); },
  // Clear all match alerts.
  alertsClear() { S.alerts.forEach((a) => { a.seen = true; }); render(); }
});
Object.assign(ACTS, {
  // Open the AI capture screen.
  newCapture() { S.newMenuOpen = false; S.cap = { text: '', stage: 0, parsed: null, checks: [], src: 'text', img: '', imgName: '', target: 'lead', listening: false, items: [], idx: 0, busy: false, srcLabel: '', warn: [], dups: [], model: '' }; go('#/capture'); },
  // Run/request a data export.
  doExport() {
    const E = S.exp; const t = expRows(E.kind, E); if (!t.rows.length) { toast('Nothing matches those filters.'); return; }
    if (S.org.exportApproval && !canA('approveExports')) { S.exportReq.unshift({ id: 'ex' + Date.now(), kind: E.kind, f: clone(E), n: t.rows.length, by: ME().name, at: iso(today), status: 'Pending' }); toast('Export requested — an Admin or Manager will review it'); return; }
    const n = runExport(E.kind, E, ME().name); toast(n < 0 ? 'Download is blocked in this browser' : n + ' rows exported'); },
  // Approve an export request.
  expAppr(el) { const r = S.exportReq.find((x) => x.id === el.dataset.id); r.status = el.dataset.v; toast('Request ' + el.dataset.v.toLowerCase()); },
  // Download an approved export.
  expDl(el) { const r = S.exportReq.find((x) => x.id === el.dataset.id); const n = runExport(r.kind, r.f, r.by); r.status = 'Downloaded'; toast(n + ' rows exported'); },
  // Approve/reject a masters change request.
  mreqDo(el) { const r = S.mreq.find((x) => x.id === el.dataset.id); r.status = el.dataset.v; if (el.dataset.v === 'Approved') { if (r.list === 'amenities') { if (!S.amen.some((a) => a.label.toLowerCase() === r.value.toLowerCase())) S.amen.push({ id: 'custom_' + r.value.toLowerCase().replace(/[^a-z0-9]+/g, '_'), label: r.value, cat: 'New · saved to your list' }); } else if (!S.masters[r.list].some((x) => x.toLowerCase() === r.value.toLowerCase())) S.masters[r.list].push(r.value); } toast('Request ' + el.dataset.v.toLowerCase()); },
  // Add an item to a master list.
  mAdd(el) {
    const l = el.dataset.l; const v = (S.tab.mAdd || '').trim().replace(/\s+/g, ' '); if (!v) return; const items = l === 'amenities' ? S.amen.map((a) => a.label) : S.masters[l];
    if (items.some((x) => x.toLowerCase() === v.toLowerCase())) { toast('“' + v + '” is already in the list.'); return; }
    if (!el.dataset.force && didYouMean(v, items)) { render(); return; }
    if (l === 'amenities') S.amen.push({ id: 'custom_' + v.toLowerCase().replace(/[^a-z0-9]+/g, '_'), label: v, cat: 'New · saved to your list' }); else S.masters[l].push(v); S.tab.mAdd = ''; render();
  },
  // Delete an item from a master list.
  mDel(el) { const l = el.dataset.l; const i = Number(el.dataset.i); if (l === 'amenities') { const a = S.amen[i]; S.amen.splice(i, 1); S.projects.forEach((p) => { p.amenities = (p.amenities || []).filter((x) => x !== a.id); }); } else S.masters[l].splice(i, 1); render(); },
  // Choose the capture source (text/voice).
  capSrc(el) { S.cap.src = el.dataset.v; render(); },
  // Load a sample text into capture.
  capSample(el) { S.cap.text = CAP_SAMPLES[Number(el.dataset.i)]; S.cap.parsed = null; render(); },
  // Parse the captured text.
  capRun() { if (!S.cap.text.trim()) { toast('Add some text, a voice note or a screenshot first.'); return; } S.cap.parsed = parseCapture(S.cap.text); S.cap.target = S.cap.parsed.isProperty ? 'property' : S.cap.parsed.name && !S.cap.parsed.phone ? 'lead' : 'lead'; render(); },
  // Discard the capture result.
  capDiscard() { const C = S.cap; if (C.items && C.items.length > 1) { C.items.splice(C.idx, 1); capShow(Math.min(C.idx, C.items.length - 1)); } else { C.parsed = null; C.items = []; C.text = ''; C.warn = []; C.dups = []; C.model = ''; C.srcLabel = ''; C.imgName = ''; } render(); },
  // Change what the sender wants. Wanting to sell or rent out means they HAVE a property, so it is saved as a property, not a lead.
  capIntent(el) { const k = CAP_INTENTS.find((x) => x[0] === el.dataset.v); if (!k) return; const P = S.cap.parsed; P.intent = k[2]; P.isProperty = k[3]; S.cap.target = k[3] ? 'property' : 'lead'; render(); },
  // Show another item found in the screenshot.
  capItem(el) { capShow(Number(el.dataset.i)); render(); },
  // Start voice dictation.
  capVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (S.cap.listening) { try { ACTS._rec && (ACTS._rec as any).stop(); } catch (e) { } S.cap.listening = false; render(); return; }
    if (!SR) { S.cap.text = CAP_SAMPLES[0]; toast('Live transcription isn’t available in this browser — a sample note was filled in'); return; }
    try { const r = new SR(); r.lang = 'en-IN'; r.interimResults = false; r.onresult = (ev) => { S.cap.text = (S.cap.text + ' ' + Array.from(ev.results).map((x) => x[0].transcript).join(' ')).trim(); }; r.onend = () => { S.cap.listening = false; render(); }; r.onerror = () => { S.cap.listening = false; render(); }; r.start(); ACTS._rec = r; S.cap.listening = true; render(); } catch (e) { S.cap.text = CAP_SAMPLES[0]; toast('Could not start the microphone — a sample note was filled in'); }
  },
  // Approve the capture: creates the lead/prospect.
  capApprove() {
    const p = S.cap.parsed; const tg = S.cap.target; const chkd = checkCapture(p);
    if (tg !== 'property' && !p.name.trim()) { fail({ 'cap.parsed.name': 'Add a name first.' }); return; }
    if (tg === 'lead') { const bud = p.max ? (p.intent === 'buy' ? '₹' + (p.min ? p.min + '–' : '') + p.max + ' L' : '₹' + (p.min ? p.min + '–' : '') + p.max + 'k/mo') : '—'; S.leads.unshift({ id: 'l' + Date.now(), name: p.name, phone: p.phone ? '+91 ' + p.phone : '+91 —', waSame: true, wa: '', source: S.cap.srcLabel || 'AI capture', intent: p.intent, stage: 'Lead', sub: '', budget: bud, want: [p.bhk ? p.bhk + ' BHK' : '', p.kind !== 'Residential' ? p.kind.toLowerCase() : '', p.area ? p.area + ' sq ft' : '', p.loc].filter(Boolean).join(' · ') || p.note.slice(0, 60), basic: { locText: p.loc, min: Number(p.min) || 0, max: Number(p.max) || 0, bhk: Number(p.bhk) || 0 }, assigned: ME().name, tags: [], created: iso(today), act: [['System', 'Created by AI capture and approved by ' + ME().name, dateTxt(iso(today))], ['Note', p.note.slice(0, 160), dateTxt(iso(today))]] }); toast('Lead created from your note'); go('#/leads'); }
    else if (tg === 'prospect') { const c = { id: 'c' + Date.now(), name: p.name, type: p.intent === 'buy' ? 'Buyer' : 'Tenant', nri: false, city: S.org.city, source: S.cap.srcLabel || 'AI capture', assigned: ME().name, phone: p.phone ? '+91 ' + p.phone : '+91 —', waSame: true, wa: '', waOk: true, email: '', lang: 'English', notes: p.note.slice(0, 120), created: iso(today) }; S.prospects.push(c); S.d.req = newReq(); Object.assign(S.d.req, { cid: c.id, purpose: p.intent === 'buy' ? 'sale' : 'rent', bhk: Number(p.bhk) || 0, locs: p.loc ? [p.loc] : [], min: p.min, max: p.max, amin: p.area, type: p.kind === 'Commercial' ? 'Commercial' : p.kind === 'Land' ? 'Plot' : 'Apartment / Flat' }); toast('Prospect created — review the requirement'); go('#/requirements/new'); }
    else if (tg === 'owner') {
      const same = S.prospects.find((x) => x.name.trim().toLowerCase() === p.name.trim().toLowerCase());
      if (same) toast(p.name + ' is already a contact (' + same.id + ').');
      else { S.prospects.push({ id: 'c' + Date.now(), name: p.name, type: p.intent === 'rent' ? 'Landlord' : 'Owner', nri: false, city: S.org.city, source: S.cap.srcLabel || 'AI capture', assigned: ME().name, phone: p.phone ? '+91 ' + p.phone : '+91 —', waSame: true, wa: '', waOk: true, email: '', lang: 'English', notes: [p.project, p.unit, p.note].filter(Boolean).join(' · ').slice(0, 160), created: iso(today) }); toast('Owner contact saved'); }
    }
    else {
      // A property someone has to sell or rent out: save it as a draft listing and stay here, so the next one in the screenshot can follow.
      const d = newProperty(); const pj = (p.project || '').trim().toLowerCase(); const proj = pj.length >= 4 ? S.projects.find((x) => x.name && (pj.includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(pj))) : null;
      Object.assign(d, { purpose: p.intent === 'buy' ? 'sale' : 'rent', cat: p.kind, sub: capSub(p.kind, p.sub), bhk: Number(p.bhk) || 3, sbu: p.area, carpet: p.area ? String(Math.round(Number(p.area) * 0.8)) : '', price: p.intent === 'buy' ? p.max : '', rent: p.intent === 'rent' && p.max ? String(Number(p.max) * 1000) : '', projectId: proj ? proj.id : null });
      d.owner.name = p.name; d.owner.mobile = p.phone; d.addr.street = [p.unit, p.project, p.loc].filter(Boolean).join(', ');
      S.d.property = d; S.d.propEditId = null; S.files['prop:__draft'] = []; S.tab.pf = 0; ACTS.saveProperty({ dataset: { draft: '1', stay: '1' } }); toast('Draft property saved' + (proj ? ' under ' + proj.name : '') + ' — find it under Properties → Draft');
    }
    const C = S.cap; if (C.items && C.items.length > 1) { C.items.splice(C.idx, 1); capShow(Math.min(C.idx, C.items.length - 1)); render(); } else { C.parsed = null; C.items = []; C.text = ''; C.warn = []; C.dups = []; C.model = ''; C.srcLabel = ''; C.imgName = ''; }
  }
});
// Change handler: file inputs (upload documents) and select-like controls.
_doc.addEventListener('change', (e) => {
  const el = e.target; if (!el || el.type !== 'file' || !el.dataset) return;
  if (el.dataset.capshot) { const f = (el.files || [])[0]; if (f) readScreenshot(f); el.value = ''; }
  if (el.dataset.capaudio) { const f = (el.files || [])[0]; if (f) { S.cap.text = CAP_SAMPLES[0]; toast('Recording transcribed (sample for the prototype)'); } el.value = ''; }
});
/* ---- v5: dynamic forms — fields follow the choices made */
// Classify a property as flat/house/plot/office/retail/warehouse (mirrors the API).
function ptKind(cat, sub, title?) {
  if (cat === 'Land') return 'plot';
  const s = String(sub || title || '');
  if (cat === 'Commercial') return /warehouse|godown/i.test(s) ? 'warehouse' : /office/i.test(s) ? 'office' : 'retail';
  return /villa|bungalow|independent house/i.test(s) ? 'house' : 'flat';
}
// Field layout per property kind: which inputs and units each kind shows.
const PT: Record<string, Rec> = {
  flat: { bhk: 1, baths: 1, floor: 1, lift: 1, balc: 1, furn: 1, age: 1, park: 1, feat: 1, ext: 1, side: 0, olook: 1, face: 1 },
  house: { bhk: 1, baths: 1, floors: 1, furn: 1, age: 1, park: 1, feat: 1, ext: 1, side: 1, olook: 1, face: 1, plotA: 1 },
  office: { wash: 1, floor: 1, lift: 1, seats: 1, furn: 1, age: 1, park: 1, feat: 1, side: 0, olook: 0, face: 1 },
  retail: { wash: 1, floor: 1, front: 1, furn: 1, age: 1, park: 1, feat: 1, side: 1, olook: 0, face: 1 },
  warehouse: { wash: 1, ht: 1, docks: 1, power: 1, age: 1, park: 1, side: 1, olook: 0, face: 0 },
  plot: { plot: 1, dims: 1, road: 1, wall: 1, corner: 1, use: 1, side: 1, olook: 1, face: 1 }
};
// Furnishing options per kind.
const FURN = { flat: ['Unfurnished', 'Semi-furnished', 'Furnished'], house: ['Unfurnished', 'Semi-furnished', 'Furnished'], office: ['Bare shell', 'Semi-furnished', 'Fully fitted'], retail: ['Bare shell', 'Semi-furnished', 'Fully fitted'], warehouse: ['Bare shell'], plot: ['—'] };
// Land-use options for plots.
const LAND_USE = ['Residential', 'Commercial', 'Agricultural', 'Industrial', 'Mixed use'];
// Preferred tenant types.
const TENANTS = ['Family', 'Bachelors', 'Company', 'Students'];
// Ownership types.
const OWNERSHIP = ['Freehold', 'Leasehold', 'Co-operative society', 'Power of attorney'];
// Row of detail cells, skipping empty ones.
const rowOf = (...a) => { a = a.filter(Boolean); return a.length ? `<div class="row">${a.join('')}</div>` : ''; };
/* the same idea for requirements */
// Classify a requirement (mirrors the API).
function reqKind(r) { const t = r.type || ''; return t === 'Plot' ? 'plot' : t === 'Commercial' ? 'comm' : /house|villa/i.test(t) ? 'house' : /flat|apartment/i.test(t) ? 'flat' : 'any'; }
// Does the requirement specify BHK?
const reqHasBhk = (r) => ['flat', 'house'].includes(reqKind(r)) && Number(r.bhk) > 0;
// Short spec text of a requirement ('3 BHK', 'Plot', 'Office ...').
const reqSpec = (r) => (reqHasBhk(r) ? r.bhk + ' BHK' : reqKind(r) === 'plot' ? 'Plot' : reqKind(r) === 'comm' ? (r.csub || 'Commercial') : '');
// Commercial sub-types.
const COMM_SUBS = ['Office', 'Retail', 'Showroom', 'Warehouse'];
// Human label of a property's kind.
function propKindLabel(p) { if (p.cat === 'Land') return 'Plot'; if (p.cat === 'Commercial') return 'Commercial'; return ptKind(p.cat, p.sub, p.title) === 'house' ? (/villa/i.test(p.sub || p.title || '') ? 'Villa' : 'Independent house') : 'Apartment / Flat'; }
// Commercial sub-type of a property.
const commSubOf = (p) => COMM_SUBS.find((x) => new RegExp(x, 'i').test(p.sub || p.title || '')) || '';
// Does a property's type fit a requirement's wanted type?
const typeOK = (r, p) => { if (!r.type) return true; const pt = propKindLabel(p); if (r.type === pt) return true; if (/house|villa/i.test(r.type) && /house|villa/i.test(pt)) return true; return false; };
// Score properties against a requirement (locality 30 + budget 40 + BHK/area 30). Port of the API's matching.ts.
function matchesFor(r) {
  const k = reqKind(r);
  return S.props.filter((p) => p.purpose === r.purpose && p.status === 'Available' && typeOK(r, p) && !(k === 'comm' && r.csub && commSubOf(p) && commSubOf(p) !== r.csub)).map((p) => {
    const val = p.purpose === 'sale' ? p.priceL : p.rentK; let s = 0; const why = [];
    if (!r.locs.length || r.locs.some((l) => p.loc.toLowerCase().includes(l.toLowerCase()))) { s += 30; why.push(['Locality', 30, true]); } else why.push(['Locality', 0, false]);
    const mn = Number(r.min) || 0, mx = Number(r.max) || 1e9;
    if (val >= mn && val <= mx) { s += 40; why.push(['Budget', 40, true]); } else if (val >= mn * 0.9 && val <= mx * 1.1) { s += 25; why.push(['Budget (within flex)', 25, true]); } else why.push(['Budget', 0, false]);
    if (k === 'flat' || k === 'house') {
      if (!Number(r.bhk)) { s += 30; why.push(['BHK (any)', 30, true]); } else if (p.bhk === Number(r.bhk)) { s += 30; why.push(['BHK', 30, true]); } else if (Math.abs(p.bhk - Number(r.bhk)) === 1) { s += 15; why.push(['BHK (±1)', 15, true]); } else why.push(['BHK', 0, false]);
    } else {
      const a = p.sbu || p.area || 0; const lo = Number(r.amin) || 0, hi = Number(r.amax) || 1e9;
      if (!r.amin && !r.amax) { s += 30; why.push(['Area (any)', 30, true]); } else if (a >= lo && a <= hi) { s += 30; why.push(['Area', 30, true]); } else if (a >= lo * 0.85 && a <= hi * 1.15) { s += 15; why.push(['Area (±15%)', 15, true]); } else why.push(['Area', 0, false]);
    }
    if (r.pface && r.pface !== 'Any') why.push(['Facing ' + r.pface, 0, p.facing === r.pface]);
    return { p, score: s, why };
  }).filter((m) => m.score >= 40).sort((a, b) => b.score - a.score);
}
// Add/edit requirement form.
function reqForm0() {
  const d = S.d.req; const P = 'd.req.'; const k = reqKind(d); const sale = d.purpose === 'sale'; const unit = sale ? 'lakh (₹)' : '₹ thousand / month';
  const base = ['Salt Lake', 'New Town', 'Ballygunge', 'Alipore', 'Rajarhat', 'Bidhannagar'];
  const locs = [...base, ...d.locs.filter((x) => !base.includes(x))];
  const res = k === 'flat' || k === 'house'; const comm = k === 'comm'; const plot = k === 'plot';
  const bhk = res ? `<div class="fld"><span class="l">BHK</span>${chipSet(P + 'bhk', [[0, 'Any'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5+']], Number(d.bhk))}</div>` : '';
  const sub = comm ? `<div class="fld"><span class="l">Commercial type</span>${chipSet(P + 'csub', COMM_SUBS, d.csub)}</div>` : '';
  const area = plot ? `<div class="row">${fld('Plot area min', P + 'amin', { suf: 'sq ft' })}${fld('Plot area max', P + 'amax', { suf: 'sq ft' })}${fld('Road width (min)', P + 'road', { suf: 'ft' })}</div><div class="fld"><span class="l">Boundary wall</span>${chipSet(P + 'wall', ['Any', 'Yes', 'No'], d.wall)}</div>` : `<div class="row">${fld('Area measured as', P + 'areaType', { opts: ['Super built-up', 'Built-up', 'Carpet'], hint: 'Same three-way standard as properties' })}${fld('Area min', P + 'amin', { suf: 'sq ft' })}${fld('Area max', P + 'amax', { suf: 'sq ft' })}</div>`;
  const prefs = plot ? '' : rowOf(fld('Parking', P + 'parking', { opts: ['Not needed', '1 open', '1 covered · must-have', '2+'] }), (k === 'flat' || (comm && d.csub === 'Office')) && fld('Lift required', P + 'lift', { opts: ['Yes', 'No'] }), (k === 'flat' || (comm && d.csub !== 'Warehouse')) && fld('Floor preference', P + 'floor', { opts: ['Any', 'Ground', 'Middle', 'Top', '3rd and above'] }));
  const furn = plot || (comm && d.csub === 'Warehouse') ? '' : `<div class="fld"><span class="l">Furnishing</span>${chipSet(P + 'furn', ['Any', ...(comm ? ['Bare shell', 'Semi-furnished', 'Fully fitted'] : ['Unfurnished', 'Semi-furnished', 'Furnished'])], d.furn)}</div>`;
  const purposeBlock = sale
    ? `<div class="fld"><span class="l">Financing</span>${chipSet(P + 'fin', ['Cash', 'Home loan'], d.fin)}</div>${plot ? '' : `<div class="fld"><span class="l">Possession</span>${chipSet(P + 'possession', ['Any', 'Ready to move', 'Under construction'], d.possession)}</div>`}`
    : `${res ? `<div class="fld"><span class="l">Tenant type</span>${chipSet(P + 'tenant', ['Any', 'Family', 'Bachelors', 'Company'], d.tenant)}</div>` : comm ? `<div class="fld"><span class="l">Business use</span>${fld('', P + 'use', { ph: 'e.g. IT office, clinic, cloud kitchen', aria: 'Business use' })}</div>` : ''}<div class="fld"><span class="l">Lease length</span>${chipSet(P + 'lease', ['Any', '11 months', '1–3 years', '3+ years'], d.lease)}</div>`;
  return page('Add requirement', 'What the prospect wants — the form changes with the property type and purpose', btn('Cancel', { k: 'sec', href: '#/requirements' }) + btn('Save requirement', { a: 'data-act="saveReq"' }),
    `<div class="card"><div class="row">${fld('Prospect', P + 'cid', { req: 1, opts: S.prospects.map((c) => [c.id, c.name]) })}<div class="fld"><span class="l">Purpose</span>${purposeSet(P + 'purpose', d.purpose)}</div></div>
    <div class="fld"><span class="l">Property type</span>${chipSet(P + 'type', ['Apartment / Flat', 'Independent house', 'Villa', 'Plot', 'Commercial'], d.type)}</div>${sub}
    <div class="fld"><span class="l">Locality</span>${chipMulti(P + 'locs', locs, d.locs)}<div style="display:flex;gap:8px;max-width:360px"><div class="inp" style="flex:1"><input id="f_d_req_locNew" data-f="d.req.locNew" placeholder="Add locality"></div>${btn('+ Add', { k: 'ghost', a: 'data-act="addLoc"' })}</div></div>
    <div class="row">${fld('Budget min', P + 'min', { suf: unit })}${fld('Budget max', P + 'max', { suf: unit })}</div>
    ${bhk}${area}${fld(plot ? 'Plot facing' : 'Facing / entry', P + 'pface', { opts: ['Any', ...DIRS] })}${prefs}${furn}
    <div class="fld"><span class="l">Timeline</span>${chipSet(P + 'timeline', ['Immediate', '1–2 months', '3–6 months', 'Just exploring'], d.timeline)}</div>${purposeBlock}${rowOf(fld('Priority', P + 'pri', { opts: ['Normal', 'High', 'Urgent'] }), fld('Source', P + 'src', { opts: ['Direct', 'Referral', '99acres', 'MagicBricks', 'Housing', 'WhatsApp', 'Walk-in'] }), fld('Handled by', P + 'by', { opts: S.team.map((t) => t.name) }))}${fld('Notes', P + 'notes', { rows: 3 })}</div>`);
}
Object.assign(ACTS, {
  // Change a requirement's status (Active / On hold / Fulfilled).
  setReqStatus(el) { const r = S.reqs.find((x) => x.id === el.dataset.id); if (!r) return; r.status = el.dataset.v; toast('Requirement marked ' + el.dataset.v.toLowerCase()); },
});
Object.assign(ACTS, {
  // Set any state path (data-p) to a value (data-v). (later version — overrides the earlier one above)
  setf(el) { setp(S, el.dataset.p, el.dataset.v); afterInput(el.dataset.p, el); render(); },
  // Use plot details in the requirement.
  plotUse() { const d = S.d.property; d.sbu = String(Math.round(Number(d.plotL) * Number(d.plotW))); render(); },
  // Validate and save a requirement. (later version — overrides the earlier one above)
  saveReq() {
    const d = clone(S.d.req); if (!Number(d.max)) { fail({ 'd.req.max': 'Enter a maximum budget.' }); return; }
    const k = reqKind(d); const res = k === 'flat' || k === 'house';
    const extra = []; if (d.furn && d.furn !== 'Any' && k !== 'plot') extra.push(d.furn); if (d.purpose === 'rent' && d.tenant !== 'Any' && res) extra.push(d.tenant); if (d.purpose === 'sale' && d.possession !== 'Any' && k !== 'plot') extra.push(d.possession); if (d.purpose === 'rent' && d.lease !== 'Any') extra.push(d.lease + ' lease'); if (d.pface && d.pface !== 'Any') extra.push(d.pface + ' facing'); if (k === 'plot') { if (d.wall !== 'Any') extra.push('Boundary wall: ' + d.wall); if (d.road) extra.push('Road ≥ ' + d.road + ' ft'); }
    const r: any = { id: 'REQ-' + (2037 + S.reqs.length), cid: d.cid, purpose: d.purpose, type: d.type, csub: k === 'comm' ? d.csub : '', locs: d.locs, min: Number(d.min) || 0, max: Number(d.max), bhk: res ? Number(d.bhk) || 0 : 0, amin: Number(d.amin) || 0, amax: Number(d.amax) || 0, area: (d.amin || d.amax) ? `${d.amin || '—'}–${d.amax || '—'} sq ft` + (k === 'plot' ? ' (plot)' : ' (' + d.areaType.toLowerCase() + ')') : 'Any', parking: k === 'plot' ? '—' : d.parking, timeline: d.timeline, status: 'Active', notes: [extra.join(' · '), d.notes].filter(Boolean).join(' — '), fin: d.purpose === 'sale' ? d.fin : '', created: iso(today) };
    REQ_EXTRA.forEach((k) => { r[k] = d[k] === undefined ? '' : d[k]; }); if (!r.by) r.by = ME().name;
    S.reqs.push(r); S.tab.matchReq = r.id; S.toast = 'Requirement saved'; go('#/requirements/' + r.id); clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = ''; render(); }, 2200);
  },
  // Save a follow-up. (later version — overrides the earlier one above)
  saveFu() {
    const d = S.d.fu; const w = { today: ['today', 'Today'], tomorrow: ['upcoming', 'Tomorrow'], '3days': ['upcoming', 'In 3 days'], pick: ['upcoming', ''] }[d.when] || ['today', 'Today'];
    if (d.when === 'pick' && !d.date) { fail({ 'd.fu.date': 'Choose a date.' }); return; }
    if (d.kind === 'Visit' && !d.prop) { fail({ 'd.fu.prop': 'Choose the property for the visit.' }); return; }
    if (d.kind === 'Email' && !String(d.subject || '').trim()) { fail({ 'd.fu.subject': 'Add a subject line.' }); return; }
    let when = d.when === 'pick' ? dayLbl(parseISO(d.date)) : w[1]; if (d.time && d.kind !== 'Email') when += ' · ' + d.time;
    const pr = d.kind === 'Visit' ? propById(d.prop) : null; const note = (d.kind === 'Email' ? d.subject + (d.note ? ' — ' + d.note : '') : d.kind === 'Meeting' && d.place ? d.note + (d.note ? ' · ' : '') + 'At ' + d.place : d.note) || d.kind + ' follow-up';
    S.fus.unshift({ id: 'f' + Date.now(), who: d.who, kind: d.kind, note: (pr ? pr.id + ' · ' : '') + note, due: d.when === 'today' ? 'today' : 'upcoming', when, p: d.p, done: false }); S.modal = null; toast('Follow-up added'); go('#/followups');
  },
  // Validate and save a visit. (later version — overrides the earlier one above)
  saveVisit() {
    const d = S.d.visit; if (!d.props.length) { toast('Pick at least one property.'); return; } if (!d.date || !d.time) { toast('Choose a date and time.'); return; }
    if (d.mode === 'video' && !String(d.link || '').trim()) { fail({ 'd.visit.link': 'Add the video-call link or app (Meet, Zoom, WhatsApp video).' }); return; }
    if (d.mode !== 'video' && !String(d.meet || '').trim() && S.d.visit.needMeet) { fail({ 'd.visit.meet': 'Add a meeting point.' }); return; }
    let n = Math.max(...S.visits.map((v) => Number(v.id.slice(4)))); d.props.forEach((pid, i) => { const v = { id: 'VIS-' + (n + 1 + i), cid: d.cid, prop: pid, date: d.date, time: d.time, dur: d.mode === 'video' ? 30 : 45, status: 'Scheduled', agent: 'Anil Sharma', notes: d.mode === 'video' ? 'Video call · ' + d.link : (d.meet ? 'Meet at ' + d.meet : ''), mode: d.mode, log: ['Visit scheduled' + (d.mode === 'video' ? ' (video call)' : '')] }; syncWhen(v); S.visits.push(v); });
    S.cal.anchor = d.date; S.tab.visitView = S.tab.visitView || 'cal'; S.modal = null; toast(d.props.length + ' ' + (d.mode === 'video' ? 'video call' : 'visit') + (d.props.length > 1 ? 's' : '') + ' scheduled for ' + dayLbl(parseISO(d.date))); go('#/visits');
  },
  // Record a brokerage payment. (later version — overrides the earlier one above)
  doPay(el) {
    const b = S.brok.find((x) => x.deal === el.dataset.id); const p = S.d.pay; const a = Number(String(p.amt).replace(/[^0-9]/g, '')); if (!a) { fail({ 'd.pay.amt': 'Enter an amount.' }); return; }
    const m = p.mode; const need = { Cheque: [['chqNo', 'Enter the cheque number.'], ['bank', 'Enter the bank name.']], UPI: [['ref', 'Enter the UPI transaction ID.']], NEFT: [['ref', 'Enter the UTR number.']], RTGS: [['ref', 'Enter the UTR number.']] }[m] || [];
    const e = {}; need.forEach((x) => { if (!String(p[x[0]] || '').trim()) e['d.pay.' + x[0]] = x[1]; }); if (Object.keys(e).length) { fail(e); return; }
    const sd = brokState(b).sides.find((x) => x.k === p.from); if (a > sd.pend) { fail({ 'd.pay.amt': 'That is more than the ' + inr(sd.pend) + ' pending from this side.' }); return; }
    const ref = m === 'Cheque' ? 'Chq ' + p.chqNo + ' · ' + p.bank : m === 'Cash' ? (p.rcpt ? 'Receipt ' + p.rcpt : '') : m === 'Card' ? (p.last4 ? '•••• ' + p.last4 : '') + (p.ref ? ' ' + p.ref : '') : p.ref;
    b.pay.push({ amt: a, from: p.from, date: p.date || iso(today), mode: m, ref, note: p.note }); S.modal = null; toast('Payment recorded');
  },
  // Add a party (buyer, owner, lawyer, bank ...) to a deal. (later version — overrides the earlier one above)
  doParty(el) {
    const d = S.deals.find((x) => x.id === el.dataset.id); const p = S.d.party; if (!p.name.trim()) { fail({ 'd.party.name': 'Enter a name.' }); return; }
    if (p.role === 'Bank contact' && !String(p.org || '').trim()) { fail({ 'd.party.org': 'Enter the bank name.' }); return; }
    d.parties.push({ role: p.role, name: p.name.trim() + (p.org ? ' (' + p.org.trim() + ')' : ''), phone: '+91 ' + (p.phone || '—') }); S.modal = null; render();
  },
  // Close a deal as lost with a reason. (later version — overrides the earlier one above)
  doLost(el) {
    const d = S.deals.find((x) => x.id === el.dataset.id); const L = S.d.lost; if (L.reason === 'Others' && !String(L.note || '').trim()) { fail({ 'd.lost.note': 'Please say what happened — required when the reason is “Others”.' }); return; }
    const wasNeg = d.stage === 'negotiation'; d.lostFrom = d.stage; d.stage = 'lost'; d.stageSince = iso(today); d.prob = 0; d.lostReason = L.reason + (L.extra ? ' (' + L.extra + ')' : '') + (L.note ? ' — ' + L.note : '');
    d.lostOn = iso(today); if (L.ret) propById(d.prop).status = 'Available'; if (L.react) S.reqs.filter((r) => r.cid === d.cid).forEach((r) => { r.status = 'Active'; });
    mlog(d, (wasNeg ? 'Closed Lost — ' : 'Deal lost — ') + d.lostReason, iso(today)); S.modal = null; toast(wasNeg ? 'Moved to Closed Lost · reason saved' : 'Deal marked as Lost · Admin notified');
  },
  // Invite a team member (creates the team row; set their password afterwards). (later version — overrides the earlier one above)
  doInvite() {
    const d = S.d.invite; const e = {}; if (!String(d.name || '').trim()) e['d.invite.name'] = 'Enter the person’s name.'; if (!String(d.email || '').trim() && !String(d.phone || '').trim()) e['d.invite.email'] = 'Add an email or a mobile number for the invite.'; if (d.role === 'Field staff' && !String(d.area || '').trim()) e['d.invite.area'] = 'Add the areas this person covers.'; if (Object.keys(e).length) { fail(e); return; }
    S.team.push({ name: d.name.trim(), role: d.role, phone: '+91 ' + (d.phone || '—'), corp: '+91 ' + (d.corp || '—'), alt: d.alt ? '+91 ' + d.alt : '', email: d.email || '', area: d.role === 'Field staff' ? d.area : '', status: 'Invited', leads: 0, seeNumbers: d.role !== 'Field staff' }); S.modal = null; toast('Added ' + d.name + ' — now set their password');
  }
});
// Saved reference to the previous modalExtra so the v5 version can extend it.
const _modalExtra50 = modalExtra;
modalExtra = function (m, wrap, cancel, D) {
  // Pick the modal body by its type.
  switch (m.t) {
    case 'fu': {
      const f = D.fu; const k = f.kind; const who = [...S.prospects.map((c) => c.name), ...S.leads.map((l) => l.name)].filter((v, i, a) => a.indexOf(v) === i);
      const av = S.props.filter((p) => ['Available', 'On hold'].includes(p.status));
      return wrap('Add follow-up', `${fld('Lead / Prospect', 'd.fu.who', { opts: who })}<div class="fld"><span class="l">Type</span>${chipSet('d.fu.kind', ['Call', 'WhatsApp', 'Visit', 'Email', 'Meeting'], k)}</div>
        ${k === 'Visit' ? fld('Property to visit', 'd.fu.prop', { req: 1, opts: [['', 'Choose a property…'], ...av.map((p) => [p.id, propLabel(p)])], hint: 'Schedule the visit itself from Visits — this is the reminder to confirm it' }) : ''}
        ${k === 'Email' ? fld('Subject', 'd.fu.subject', { req: 1, ph: 'e.g. Brochure and price list' }) : ''}${k === 'Meeting' ? fld('Place or link', 'd.fu.place', { ph: 'Office, site, or meeting link' }) : ''}
        <div class="fld"><span class="l">For</span>${purposeSet('d.fu.p', f.p)}</div><div class="fld"><span class="l">When</span>${chipSet('d.fu.when', [['today', 'Today'], ['tomorrow', 'Tomorrow'], ['3days', 'In 3 days'], ['pick', 'Pick a date']], f.when)}</div>
        ${f.when === 'pick' || k !== 'Email' ? `<div class="row">${f.when === 'pick' ? fld('Date', 'd.fu.date', { type: 'date', req: 1 }) : ''}${k !== 'Email' ? fld('Time (optional)', 'd.fu.time', { type: 'time' }) : ''}</div>` : ''}
        <div class="fld"><span class="l">Priority</span>${chipSet('d.fu.pri', ['Low', 'Normal', 'High'], f.pri)}</div>${fld('Note', 'd.fu.note', { rows: 3, ph: k === 'Call' ? 'What to discuss on the call' : k === 'WhatsApp' ? 'What to send (brochure, listing, location pin…)' : k === 'Visit' ? 'e.g. Confirm visit and share parking details' : k === 'Email' ? 'Anything to include in the email' : 'Agenda' })}`, cancel + btn('Save follow-up', { a: 'data-act="saveFu"' }));
    }
    case 'visit': {
      const v = D.visit; const av = S.props.filter((p) => ['Available', 'On hold'].includes(p.status)); const c = prosById(v.cid); const video = v.mode === 'video';
      const clash = S.visits.filter((x) => x.date === v.date && x.time === v.time && x.status !== 'Cancelled');
      return wrap('Schedule visit', `${fld('Prospect', 'd.visit.cid', { opts: S.prospects.map((x) => [x.id, x.name]), rer: 1 })}${c && c.nri && !video ? `<div class="note">${ico('info', 18)}<div>${esc(c.name)} is an NRI — a video call may suit better.</div></div>` : ''}
        <div class="fld"><span class="l">How will they see it?</span>${chipSet('d.visit.mode', [['site', 'On-site visit'], ['video', 'Video call']], video ? 'video' : 'site')}</div>
        <div class="fld"><span class="l">Properties</span><div class="sub" style="font-size:12px">Pre-filled from matches. Properties in different places get separate ${video ? 'calls' : 'visit records'}.</div>${av.map((p) => chk(v.props.includes(p.id), `${propLabel(p)} <span class="sub">· ${PURPOSE[p.purpose]}</span>`, `data-act="togf" data-p="d.visit.props" data-v="${p.id}"`)).join('')}</div>
        <div class="row">${fld('Date', 'd.visit.date', { type: 'date' })}${fld('Time', 'd.visit.time', { type: 'time' })}</div>${clash.length ? `<div class="note" style="background:var(--warn-soft);border-color:var(--warn-line);color:var(--warn)">${ico('info', 18)}<div>${clash.length} visit${clash.length > 1 ? 's are' : ' is'} already booked at ${fmt12(v.time)} on ${dayLbl(parseISO(v.date))}.</div></div>` : ''}
        ${video ? fld('Video-call link or app', 'd.visit.link', { req: 1, ph: 'https://meet.google.com/… or “WhatsApp video”' }) : fld('Meeting point', 'd.visit.meet', { ph: 'e.g. Sector V metro gate', hint: 'Optional — shared with the prospect' })}
        <div class="fld"><span class="l">Reminder</span>${chipSet('d.visit.remind', ['Call', 'WhatsApp'], v.remind)}</div>${video ? '' : chk(v.pin, 'Share location pin with prospect', 'data-act="togb" data-p="d.visit.pin"')}`, cancel + btn('Confirm', { a: 'data-act="saveVisit"' }), 600);
    }
    case 'pay': {
      const p = D.pay; const mo = p.mode;
      const mf = mo === 'Cheque' ? `<div class="row">${fld('Cheque number', 'd.pay.chqNo', { req: 1 })}${fld('Bank', 'd.pay.bank', { req: 1 })}</div>` : mo === 'UPI' ? fld('UPI transaction ID', 'd.pay.ref', { req: 1, ph: '12-digit UPI reference' }) : mo === 'NEFT' || mo === 'RTGS' ? fld('UTR number', 'd.pay.ref', { req: 1 }) : mo === 'Cash' ? fld('Receipt number (optional)', 'd.pay.rcpt', { hint: 'Give a signed receipt for every cash payment' }) : `<div class="row">${fld('Card last 4 digits', 'd.pay.last4')}${fld('Approval code (optional)', 'd.pay.ref')}</div>`;
      return wrap('Record payment', `<div class="fld"><span class="l">Received from</span>${chipSet('d.pay.from', ['buyer', 'owner'], p.from)}</div><div class="row">${fld('Amount', 'd.pay.amt', { pre: '₹' })}${fld('Mode', 'd.pay.mode', { opts: ['UPI', 'NEFT', 'RTGS', 'Cheque', 'Cash', 'Card'], rer: 1 })}</div>${mf}${fld('Date received', 'd.pay.date', { type: 'date' })}${fld('Note', 'd.pay.note', { rows: 2 })}`, cancel + btn('Save payment', { a: `data-act="doPay" data-id="${m.id}"` }));
    }
    case 'party': {
      const p = D.party; const org = { 'Bank contact': 'Bank name', Lawyer: 'Firm / chambers', 'Associate broker': 'Agency' }[p.role];
      return wrap('Add party', `${fld('Role', 'd.party.role', { opts: ['Lawyer', 'Bank contact', 'Associate broker', 'Witness', 'Other'], rer: 1 })}${fld('Name', 'd.party.name', { req: 1 })}${org ? fld(org, 'd.party.org', { req: p.role === 'Bank contact' }) : ''}${fld('Phone', 'd.party.phone', { pre: '+91' })}${p.role === 'Associate broker' ? '<div class="note">' + ico('info', 18) + '<div>Brokerage sharing with an associate broker is set under the deal’s Brokerage tab.</div></div>' : ''}`, cancel + btn('Add party', { a: `data-act="doParty" data-id="${m.id}"` }));
    }
    case 'lost': {
      const d = S.deals.find((x) => x.id === m.id); const neg = d.stage === 'negotiation'; const L = D.lost; const r = L.reason;
      const more = r === 'Others' ? fld('Please specify', 'd.lost.note', { req: 1, rows: 2 }) : r === 'Loan rejected' ? fld('Bank (optional)', 'd.lost.extra', { ph: 'e.g. HDFC' }) + fld('Notes', 'd.lost.note', { rows: 2 }) : r === 'Bought elsewhere (buyer withdrew)' ? fld('Where / how (optional)', 'd.lost.extra', { ph: 'e.g. Another broker, direct from owner' }) + fld('Notes', 'd.lost.note', { rows: 2 }) : r === 'Price gap' ? fld('Gap (optional)', 'd.lost.extra', { ph: 'e.g. ₹5 L apart' }) + fld('Notes', 'd.lost.note', { rows: 2 }) : fld('Notes', 'd.lost.note', { rows: 2 });
      return wrap(neg ? 'Mark as Closed Lost' : 'Mark as Lost', `<div class="note" style="background:var(--err-soft);border-color:var(--err);color:var(--err)">${ico('info', 18)}<div>${neg ? 'The negotiation did not succeed. The deal moves to Closed Lost and the reason is kept.' : 'You are about to mark this deal as Lost — are you sure?'}</div></div>${fld('Reason', 'd.lost.reason', { opts: ['Price gap', 'Bought elsewhere (buyer withdrew)', 'Owner withdrew', 'Title not clear', 'Loan rejected', 'Terms not agreed', 'Others'], rer: 1 })}${more}${chk(L.ret, 'Return property to Available', 'data-act="togb" data-p="d.lost.ret"')}${chk(L.react, 'Reactivate requirement', 'data-act="togb" data-p="d.lost.react"')}`, cancel + btn('Mark Closed Lost', { k: 'danger', a: `data-act="doLost" data-id="${d.id}"` }));
    }
    case 'invite': {
      const i = D.invite;
      return wrap('Add team member', `<div class="row">${fld('Full name', 'd.invite.name', { req: 1 })}${fld('Email', 'd.invite.email', { hint: 'Used to sign in' })}</div><div class="row">${fld('Mobile', 'd.invite.phone', { pre: '+91' })}${fld('Corporate number', 'd.invite.corp', { pre: '+91' })}</div>${fld('Alternative number', 'd.invite.alt', { pre: '+91' })}${fld('Role', 'd.invite.role', { opts: ROLES, rer: 1 })}${i.role === 'Field staff' ? fld('Areas covered', 'd.invite.area', { req: 1, ph: 'e.g. Salt Lake, New Town', hint: 'Field staff only see leads and properties in these areas' }) : ''}${i.role === 'Admin' ? '<div class="note" style="background:var(--warn-soft);border-color:var(--warn-line);color:var(--warn)">' + ico('info', 18) + '<div>Admins can see everything, change permissions and approve exports. Give this role sparingly.</div></div>' : ''}<div class="sub" style="font-size:12px">What this role can see or change is set under Team → Roles &amp; permissions.</div>`, cancel + btn('Add member', { a: 'data-act="doInvite"' }));
    }
  }
  return _modalExtra50(m, wrap, cancel, D);
};
/* side-effects for the dynamic bits */
// Saved reference to the previous afterInput (v5 layer wraps it).
const _afterInput50 = afterInput;
afterInput = function (p, el) {
  _afterInput50(p, el);
  // Property category/sub-type changed: reset the dependent fields.
  if (p === 'd.property.cat' || p === 'd.property.sub') {
    const d = S.d.property; if (p === 'd.property.cat' && !(SUBTYPES[d.cat] || []).includes(d.sub)) d.sub = SUBTYPES[d.cat][0];
    const k = ptKind(d.cat, d.sub); const fo = FURN[k]; if (!fo.includes(d.furn)) d.furn = fo[0];
    if (k === 'plot' && d.pstatus !== 'Ready for Possession' && d.pstatus !== 'Under Construction') d.pstatus = 'Ready for Possession';
    if (PT[k].bhk && !Number(d.bhk)) d.bhk = 2;
    if (d.purpose === 'rent' && d.cat !== 'Residential') d.tenants = [];
  }
  if (p === 'd.req.type') { const r = S.d.req; const k = reqKind(r); if ((k === 'flat' || k === 'house') && r.bhk === 0) r.bhk = 3; if (k === 'plot') { r.parking = 'Not needed'; } }
  if (p === 'd.visit.mode' && S.d.visit.mode === 'video') S.d.visit.pin = false;
};
/* deal form: property list follows the deal type */
// Second wrap of afterInput (adds more dependent-field logic).
const _afterInput50b = afterInput;
afterInput = function (p, el) {
  _afterInput50b(p, el);
  if (p === 'd.deal.kind') { const d = S.d.deal; const pr = propById(d.prop); const want = (d.kind === 'rent' || d.kind === 'lease') ? 'rent' : 'sale'; if (pr && pr.purpose !== want) d.prop = ''; }
};
/* ------------------------------------------------------------ events */
/* Global event listeners (delegated). */
// Click handler (delegated): closes pop-ups, runs ACTS[data-act], follows in-app links with pushState, opens table rows.
_doc.addEventListener('click', (e) => {
  const t = e.target;
  if (!t.closest('[data-popwrap]')) { let ch = false; if (S.pq.open) { S.pq.open = false; ch = true; } if (S.newMenuOpen) { S.newMenuOpen = false; ch = true; } if (ch) render(); }
  if (S.nav && !t.closest('.side') && !t.closest('.menu-btn')) { S.nav = false; render(); }
  const el = t.closest('[data-act]');
  if (el && !el.disabled && el.getAttribute('disabled') == null) { const f = ACTS[el.dataset.act]; if (f) { f(el, e); if (el.tagName === 'A') { S.nav = false; const h0 = el.getAttribute('href'); if (h0 && h0.startsWith('#/')) { e.preventDefault(); go(h0); } } return; } }
  { const an = t.closest('a[href^="#/"]'); if (an) { e.preventDefault(); go(an.getAttribute('href')); return; } }
  const row = t.closest('tr[data-href]'); if (row && !t.closest('a,button')) go(row.dataset.href);
});
// Input handler: every control has data-f='state.path'; typing writes the value into S, runs afterInput() side effects and re-renders when asked.
_doc.addEventListener('input', (e) => {
  const el = e.target; const p = el.dataset && el.dataset.f; if (!p) return;
  setp(S, p, el.value); afterInput(p, el); if (S.err && S.err[p]) { delete S.err[p]; const fl = el.closest && el.closest('.fld'); if (fl) { fl.classList.remove('err'); const em = fl.querySelector('.emsg'); if (em) em.remove(); } }
  if (p === 'pq.q') S.pq.open = true; if (p === 'loc.q') S.loc.focus = true; if (p === 'am.q') S.am.open = true;
  // Built-up / variant changed: recompute the dependent areas.
  if (p === 'd.property.sbu' || p === 'd.property.var') {
    const d = S.d.property; const s = Number(d.sbu) || 0; const v = Number(d.var) || 0; d.bu = s ? String(Math.round(s * (1 - v / 200))) : ''; d.carpet = s ? String(Math.round(s * (1 - v / 100))) : '';
    const a = document.getElementById('f_d_property_bu') as HTMLInputElement | null; const b = document.getElementById('f_d_property_carpet') as HTMLInputElement | null; if (a) a.value = d.bu; if (b) b.value = d.carpet;
  }
  if (el.dataset.render) render();
});
// Identity helper kept for the upload handler.
const resolveScope = (v) => v;
// Change handler: file inputs (upload documents) and select-like controls.
_doc.addEventListener('change', (e) => { const el = e.target; if (el && el.type === 'file' && el.dataset && el.dataset.upload) { const raw = el.dataset.upload; addFiles(resolveScope(raw), Array.from(el.files || []), el.dataset.cat || catFor(raw), el); el.value = ''; } });
// Drag & drop upload zones: highlight on dragover/dragleave, accept files on drop.
_doc.addEventListener('dragover', (e) => { const z = e.target.closest && e.target.closest('[data-drop]'); if (z) { e.preventDefault(); z.classList.add('over'); } });
_doc.addEventListener('dragleave', (e) => { const z = e.target.closest && e.target.closest('[data-drop]'); if (z) z.classList.remove('over'); });
_doc.addEventListener('drop', (e) => { const z = e.target.closest && e.target.closest('[data-drop]'); if (!z) return; e.preventDefault(); z.classList.remove('over'); const raw = z.dataset.drop; addFiles(resolveScope(raw), Array.from(e.dataTransfer.files || []), z.dataset.cat || catFor(raw), null); });
// Focus handler: opens the location / amenity suggestion lists when their input gets focus.
_doc.addEventListener('focusin', (e) => { const f = e.target.dataset && e.target.dataset.focus; if (f === 'loc' && !S.loc.focus) { S.loc.focus = true; render(); } if (f === 'pq' && !S.pq.open) { S.pq.open = true; render(); } });
// Keyboard: '/' focuses global search, Escape closes modals and pop-ups.
_doc.addEventListener('keydown', (e) => { if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) && !S.modal) { const g = document.getElementById('gs'); if (g) { e.preventDefault(); g.focus(); } } if (e.key === 'Escape') { if (S.modal) { S.modal = null; render(); } else if (S.newMenuOpen || S.pq.open) { S.newMenuOpen = false; S.pq.open = false; render(); } } });
// Browser back/forward buttons: re-render for the new URL.
_win.addEventListener('popstate', () => { S.nav = false; S.newMenuOpen = false; S.err = {}; render(); window.scrollTo(0, 0); });

/* ------------------------------------------------------------ import wizard */
/* Bulk import wizard for properties/leads/prospects from CSV/XLSX or pasted text. */
S.imports = S.imports || [];
S.imp = { kind: 'properties', step: 0, file: '', raw: [], sheet: '', opts: { header: true, defaultPurpose: 'sale', createProjects: true, source: 'Import', assigned: 'Anil Sharma' }, map: {}, actions: {}, filter: 'all', limit: 40, paste: '', result: null, _key: '', _rows: null };
// Importable fields per dataset with labels/required flags.
const IMP_FIELDS = {
  properties: [['purpose', 'Purpose (Sale / Rent-Lease)'], ['cat', 'Category'], ['sub', 'Property type'], ['project', 'Project / building'], ['unit', 'Flat / unit no.'], ['loc', 'Locality / address', 1], ['bhk', 'BHK'], ['area', 'Area (sq ft)'], ['furn', 'Furnishing'], ['price', 'Sale price'], ['rent', 'Monthly rent'], ['status', 'Status'], ['owner', 'Owner name'], ['ownerPhone', 'Owner mobile'], ['source', 'Source']],
  prospects: [['name', 'Full name', 1], ['phone', 'Mobile', 1], ['alt', 'Alternate mobile'], ['email', 'Email'], ['type', 'Prospect type (Buyer / Tenant / Owner)'], ['city', 'City'], ['source', 'Source'], ['lang', 'Language'], ['nri', 'NRI (Yes / No)'], ['notes', 'Notes']],
  leads: [['name', 'Name', 1], ['phone', 'Mobile', 1], ['source', 'Source'], ['intent', 'Interested in (Buy / Rent)'], ['want', 'Requirement'], ['bmin', 'Budget min'], ['bmax', 'Budget max'], ['notes', 'Notes']]
};
// Header synonyms used to auto-map spreadsheet columns.
const IMP_SYN = {
  properties: { purpose: ['purpose', 'listingtype', 'saleorrent', 'forsaleorrent', 'transaction', 'saletype', 'dealtype', 'typeoflisting'], cat: ['category', 'propertycategory'], sub: ['subtype', 'propertytype', 'type', 'unittype'], project: ['project', 'projectname', 'society', 'building', 'buildingname', 'complex'], unit: ['unit', 'unitno', 'flatno', 'flat', 'flatnumber', 'apartmentno', 'tower'], loc: ['locality', 'location', 'address', 'micromarket', 'neighbourhood', 'neighborhood', 'sector'], bhk: ['bhk', 'bedrooms', 'beds', 'bedroom'], area: ['areasqft', 'sqft', 'superbuiltup', 'builtuparea', 'carpetarea', 'size', 'areainsqft', 'totalarea', 'area'], furn: ['furnishing', 'furnished'], price: ['price', 'saleprice', 'expectedprice', 'askingprice', 'priceinr', 'pricelakh', 'cost'], rent: ['rent', 'monthlyrent', 'rentpm', 'rentpermonth', 'rentinr'], status: ['status', 'availability'], owner: ['ownername', 'owner', 'landlord'], ownerPhone: ['ownerphone', 'ownermobile', 'ownercontact', 'phone', 'mobile', 'contactnumber'], source: ['source', 'listedby'] },
  prospects: { name: ['name', 'fullname', 'clientname', 'prospectname', 'contactname', 'customername'], phone: ['phone', 'mobile', 'mobileno', 'mobilenumber', 'contactnumber', 'phonenumber', 'whatsapp', 'cell'], alt: ['alternatephone', 'altphone', 'alternate', 'alternatemobile', 'phone2', 'mobile2', 'secondaryphone'], email: ['email', 'emailid', 'emailaddress', 'mail'], type: ['prospecttype', 'clienttype', 'type', 'category', 'role'], city: ['city', 'town', 'location'], source: ['source', 'leadsource', 'origin'], lang: ['language', 'preferredlanguage', 'lang'], nri: ['nri', 'isnri'], notes: ['notes', 'remarks', 'comments', 'note'] },
  leads: { name: ['name', 'fullname', 'leadname', 'customername', 'enquirername'], phone: ['phone', 'mobile', 'mobileno', 'mobilenumber', 'contactnumber', 'phonenumber', 'whatsapp'], source: ['source', 'leadsource', 'origin', 'portal'], intent: ['interest', 'interestedin', 'intent', 'lookingto', 'enquiryfor', 'buyorrent'], want: ['requirement', 'enquiry', 'message', 'propertyrequired', 'details', 'lookingfor'], bmin: ['budgetmin', 'minbudget', 'budgetfrom'], bmax: ['budgetmax', 'maxbudget', 'budgetto', 'budget'], notes: ['notes', 'remarks', 'comments', 'note'] }
};
// Help text for each import kind.
const IMP_INFO = {
  properties: { title: 'Properties', desc: 'Listings from an Excel sheet or portal export', need: 'Locality, plus price (sale) or monthly rent', route: '#/properties' },
  prospects: { title: 'Prospects', desc: 'Buyers, tenants and owners you already know', need: 'Name and a valid mobile number', route: '#/prospects' },
  leads: { title: 'Leads', desc: 'Enquiries from portals, ads or a spreadsheet', need: 'Name and a valid mobile number', route: '#/leads' }
};
// Sample rows for the 'download template' and 'try sample' buttons.
const IMP_SAMPLE = {
  properties: 'Purpose,Category,Property type,Project,Flat / unit no.,Locality,BHK,Area (sq ft),Furnishing,Price,Monthly rent,Status,Owner name,Owner mobile,Source\nSale,Residential,Apartment / Flat,Skyline Heights,B-502,"New Town, Kolkata",3,1350,Semi-furnished,₹1.12 Cr,,Available,R. Mukherjee,98300 11223,Owner\nSale,Residential,Apartment / Flat,Skyline Heights,C-1101,"New Town, Kolkata",2,980,Unfurnished,78 L,,Available,P. Sen,+91 97480 55661,Broker\nRent,Residential,Apartment / Flat,Merlin Verve,Tower 4 - 3rd floor,"Sector V, Salt Lake",2,1040,Furnished,,₹34000,Available,A. Iyer,9830012345,Owner\nSale,Residential,Apartment / Flat,Merlin Verve,"Tower 3, 7th floor","Sector V, Salt Lake",3,1450,Semi-furnished,₹1.35 Cr,,Available,S. Ghosh,98300 99887,Owner\nLease,Commercial,Office,,Unit 4A,"Sector V, Salt Lake",0,900,Semi-furnished,,₹92000,Available,T. Dutta,98310 22110,Owner\nSale,Land,Residential plot,,Plot 12,Rajarhat,0,2880,,45 L,,Available,M. Khan,90070 44551,Referral\nSale,Residential,Villa,,12 Palm Avenue,Garia,4,2400,Unfurnished,,,Available,K. Basu,98362 77812,Owner\nBarter,Residential,Apartment / Flat,,A-9,Alipore,2,850,Furnished,64 L,,Available,J. Roy,98311 66770,Owner',
  prospects: 'Full name,Mobile,Alternate mobile,Email,Type,City,Source,Language,NRI,Assigned to,Notes\nArjun Mehta,98301 22334,,arjun.mehta@email.com,Buyer,Kolkata,99acres,English,No,Anil Sharma,Wants 3 BHK near metro\nSneha Pal,+91 97483 11220,,sneha.pal@email,Tenant,Kolkata,Friend & Family,Bengali,No,Anil Sharma,\nPriya Nair,98765 43210,,priya.n@email.com,Buyer,Kolkata,99acres,English,No,Anil Sharma,Already in the CRM\nRavi Kumar,12345,,,Buyer,Kolkata,Magicbricks,Hindi,No,Anil Sharma,Phone number is invalid\n,98300 77889,,,Buyer,Kolkata,Direct Reference,English,No,Anil Sharma,Name is missing\nNeeta Shah,+971 50 123 4567,,neeta.shah@email.com,Buyer,Dubai,Referral,Gujarati,Yes,Anil Sharma,Investor\nArjun Mehta,98301 22334,,,Buyer,Kolkata,99acres,English,No,Anil Sharma,Repeated in the file',
  leads: 'Name,Mobile,Source,Interested in,Requirement,Budget min,Budget max,Assigned to,Notes\nMeera Joshi,98301 44556,Magicbricks,Buy,3 BHK · Salt Lake,1.1 Cr,1.5 Cr,Anil Sharma,\nDeepak Rao,97481 22090,99acres,Rent,2 BHK · Ballygunge,30000,40000,Anil Sharma,\nKavita Shah,97480 00455,Magicbricks,Buy,3 BHK · Salt Lake,1.1 Cr,1.4 Cr,Anil Sharma,Name already exists\nAsha Verma,99999 1,Housing.com,Buy,Plot,40 L,60 L,Anil Sharma,Invalid phone\nTarun Sen,90071 33221,Own website,Lease,Office · Sector V,80000,1.1 L,Anil Sharma,\nTarun Sen,90071 33221,Own website,Lease,Office · Sector V,80000,1.1 L,Anil Sharma,Repeated in the file'
};
// Normalise a header for comparison.
const normKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// Digits-only phone key for duplicate detection (masked numbers return null).
const digitsKey = (s) => { if (/[•x*]/i.test(String(s))) return null; const d = String(s || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : null; };
// Normalise a pasted phone number to '+91 xxxxx xxxxx'.
function normPhone(s) {
  let d = String(s || '').replace(/[^\d+]/g, ''); if (!d) return { empty: true, ok: false }; const plus = d.startsWith('+'); d = d.replace(/\D/g, '');
  if (plus && !d.startsWith('91')) return d.length >= 8 && d.length <= 15 ? { ok: true, fmt: '+' + d, key: d.slice(-10), intl: true } : { ok: false };
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2); if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? { ok: true, fmt: '+91 ' + d.slice(0, 5) + ' ' + d.slice(5), key: d } : { ok: false };
}
// Map free text to 'sale' / 'rent'.
const normPurpose = (s) => (/rent|lease|let\b/i.test(s) ? 'rent' : /sale|sell|resale|buy|primary/i.test(s) ? 'sale' : '');
// Map free text to Residential / Commercial / Land.
const normCat = (s) => (/land|plot|farm/i.test(s) ? 'Land' : /comm|office|shop|retail|ware|showroom|industrial/i.test(s) ? 'Commercial' : /resid|flat|apart|villa|house|bhk|bunga|pent/i.test(s) ? 'Residential' : '');
// Map free text to a furnishing value.
const normFurn = (s) => (!s ? '' : /^un/i.test(s) ? 'Unfurnished' : /semi/i.test(s) ? 'Semi-furnished' : /furn/i.test(s) ? 'Furnished' : '');
// Map free text to a property status.
const normStatus = (s) => (!s ? 'Available' : /hold/i.test(s) ? 'On hold' : /sold/i.test(s) ? 'Sold' : /rented|leased/i.test(s) ? 'Rented/Leased' : 'Available');
// Parse '1,200 sq ft' / '110 sqm' into square feet.
function parseArea(s) { const t = String(s || '').toLowerCase().replace(/,/g, ''); const n = parseFloat(t); if (isNaN(n)) return 0; if (/sq\s*m|sqm|meter/.test(t)) return Math.round(n * 10.764); if (/yd|yard|gaj/.test(t)) return Math.round(n * 9); if (/acre/.test(t)) return Math.round(n * 43560); if (/katha/.test(t)) return Math.round(n * 720); return Math.round(n); }
// Keep price text as typed (parsed later).
function parseMoneyText(s) { return String(s || '').trim(); }
// Parse CSV/TSV text into rows (handles quotes).
function parseDelimited(text) {
  text = text.replace(/^\uFEFF/, ''); const first = text.split(/\r?\n/)[0] || ''; const cnt = (c) => first.split(c).length - 1; const d = cnt('\t') >= Math.max(cnt(','), cnt(';')) && cnt('\t') > 0 ? '\t' : cnt(';') > cnt(',') ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === d) { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += c; }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.map((r) => r.map((x) => x.trim())).filter((r) => r.some((x) => x !== ''));
}
// Prepare header + preview rows for the import table.
function impTable() { const I = S.imp; const raw = I.raw; if (!raw.length) return { headers: [], data: [] }; const w = Math.max(...raw.map((r) => r.length)); const norm = raw.map((r) => Array.from({ length: w }, (_, i) => r[i] == null ? '' : String(r[i]))); return I.opts.header ? { headers: norm[0].map((h, i) => h || 'Column ' + (i + 1)), data: norm.slice(1) } : { headers: norm[0].map((_, i) => 'Column ' + (i + 1)), data: norm }; }
// Auto-map spreadsheet columns to fields by header synonyms.
function autoMap() {
  const I = S.imp; const { headers } = impTable(); const syn = IMP_SYN[I.kind]; const used = {}; const map = {};
  headers.forEach((h, ci) => { const k = normKey(h); let best = null; Object.keys(syn).forEach((f) => { if (used[f]) return; if (syn[f].includes(k)) best = best || f; }); if (!best) Object.keys(syn).forEach((f) => { if (used[f] || best) return; if (syn[f].some((s) => s.length >= 4 && k.includes(s))) best = f; }); if (best) { used[best] = 1; map[ci] = best; } });
  I.map = map; I.actions = {}; I._key = '';
}
// Load parsed rows into the import wizard state.
function loadImportRows(rows, name) {
  const I = S.imp; if (rows.length < 2) { toast('That file has a header but no data rows.'); return; }
  if (rows.length > 5001) { rows = rows.slice(0, 5001); toast('Only the first 5,000 rows are imported at a time.'); }
  I.raw = rows; I.file = name; I.step = 1; I.result = null; I.filter = 'all'; I.limit = 40; autoMap(); render(); window.scrollTo(0, 0);
}
// Load pasted/CSV text into the wizard.
function loadImportText(text, name) { loadImportRows(parseDelimited(text), name); }
// Lazy-load the SheetJS library for .xlsx files.
function loadXLSX(): Promise<any> { return new Promise((res, rej) => { if ((window as any).XLSX) return res((window as any).XLSX); const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; const t = setTimeout(() => rej(new Error('timeout')), 9000); s.onload = () => { clearTimeout(t); (window as any).XLSX ? res((window as any).XLSX) : rej(new Error('missing')); }; s.onerror = () => { clearTimeout(t); rej(new Error('load')); }; document.head.appendChild(s); }); }
// Read the chosen file (csv/txt/xlsx) and load it.
function importFileChosen(file) {
  if (!file) return; const n = file.name;
  if (file.size > 8 * 1048576) { toast('File is over 8 MB — split it and import in parts.'); return; }
  if (/\.(csv|tsv|txt)$/i.test(n)) { const r = new FileReader(); r.onload = () => loadImportText(String(r.result), n); r.onerror = () => toast('Could not read that file.'); r.readAsText(file); }
  else if (/\.xlsx?$/i.test(n)) { toast('Reading Excel file…'); loadXLSX().then((X) => { const r = new FileReader(); r.onload = () => { try { const wb = X.read(r.result, { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[0]]; const rows = X.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }).map((a) => a.map(String)).filter((a) => a.some((x) => x.trim() !== '')); S.imp.sheet = wb.SheetNames[0]; loadImportRows(rows, n); } catch (e) { toast('Could not read that Excel file — save it as CSV and try again.'); } }; r.readAsArrayBuffer(file); }).catch(() => toast('Excel files need an internet connection to read here — save the sheet as CSV, or paste the rows below.')); }
  else toast('Use a .csv, .tsv or .xlsx file — or paste rows from Excel.');
}
/* ---- analysis */
// Column index of each mapped field.
function impFieldIndex() { const idx: Rec = {}; Object.keys(S.imp.map).forEach((ci) => { const f = S.imp.map[ci]; if (f && idx[f] == null) idx[f] = Number(ci); }); return idx; }
// Required fields that are not mapped yet.
function impMissing() {
  const I = S.imp; const idx = impFieldIndex(); const m = [];
  IMP_FIELDS[I.kind].filter((f) => f[2]).forEach((f) => { if (idx[f[0]] == null) m.push(f[1]); });
  if (I.kind === 'properties' && idx.price == null && idx.rent == null) m.push('Sale price or Monthly rent');
  return m;
}
// Validate every row: errors, warnings, duplicates (within file and against existing data), default action.
function impAnalyze() {
  const I = S.imp; const key = I.kind + '|' + I.file + '|' + I.raw.length + '|' + I.opts.header + '|' + JSON.stringify(I.map) + '|' + JSON.stringify(I.opts) + '|' + S.props.length + S.prospects.length + S.leads.length;
  if (I._key === key && I._rows) return I._rows;
  const { data } = impTable(); const idx = impFieldIndex(); const kind = I.kind; const out = []; const seen = {};
  const team = S.team.map((t) => t.name.toLowerCase());
  data.forEach((cells, i) => {
    const v = (f) => (idx[f] == null ? '' : String(cells[idx[f]] || '').trim());
    const errors = [], warns = []; let rec: Rec = {}, dup: any = null, label = '';
    if (kind === 'properties') {
      const pr = v('purpose'); let purpose = pr ? normPurpose(pr) : I.opts.defaultPurpose; if (pr && !purpose) errors.push('Purpose “' + pr + '” not recognised — use Sale or Rent/Lease');
      const loc = v('loc'); if (!loc) errors.push('Locality / address is missing');
      const priceL = parseL(v('price')), rentK = parseK(v('rent'));
      if (purpose === 'sale' && !priceL) errors.push('Sale price is missing'); if (purpose === 'rent' && !rentK) errors.push('Monthly rent is missing');
      if (purpose === 'sale' && priceL && priceL < 5) warns.push('Price looks very low (' + fmtL(priceL) + ')'); if (purpose === 'rent' && rentK > 500) warns.push('Rent looks very high (' + fmtRent(rentK) + ')');
      const area = parseArea(v('area')); if (!area) warns.push('Area missing — matching works better with it');
      const sub = v('sub'); let cat = normCat(v('cat')) || normCat(sub); if (!cat) { cat = 'Residential'; warns.push('Category guessed as Residential'); }
      const own = v('ownerPhone'); if (own && !normPhone(own).ok) warns.push('Owner mobile looks invalid');
      const bhk = parseInt(v('bhk'), 10) || 0; const furn = normFurn(v('furn')); if (v('furn') && !furn) warns.push('Furnishing “' + v('furn') + '” not recognised');
      rec = { purpose, cat, sub: sub || (cat === 'Residential' ? 'Apartment / Flat' : cat === 'Commercial' ? 'Office' : 'Residential plot'), project: v('project'), unit: v('unit'), loc, bhk, area, furn: furn || '—', priceL, rentK, status: normStatus(v('status')), owner: v('owner') || '—', ownerPhone: normPhone(own).ok ? normPhone(own).fmt : '', source: v('source') || I.opts.source };
      label = (rec.bhk ? rec.bhk + ' BHK ' : '') + rec.sub + ' · ' + (rec.unit ? rec.unit + ', ' : '') + rec.loc + (purpose === 'sale' ? (priceL ? ' · ' + fmtL(priceL) : '') : (rentK ? ' · ' + fmtRent(rentK) : ''));
      const k = normKey(rec.unit + rec.loc) + '|' + purpose; if (rec.loc) {
        const ex = S.props.find((p) => p.purpose === purpose && normKey(p.unit + p.loc) === normKey(rec.unit + rec.loc) && (!rec.area || !p.area || Math.abs(p.area - rec.area) / p.area <= 0.05) && (rec.unit || p.unit === rec.loc));
        if (ex) dup = { kind: 'existing', strong: true, type: 'prop', id: ex.id, label: 'Same address & area as ' + ex.id };
        else if (seen[k]) dup = { kind: 'file', strong: true, label: 'Repeated in this file (row ' + (seen[k] + 1) + ')' };
        else { const wk = S.props.find((p) => p.purpose === purpose && normKey(p.loc) === normKey(rec.loc) && rec.area && p.area === rec.area && (purpose === 'sale' ? p.priceL === priceL : p.rentK === rentK)); if (wk) dup = { kind: 'existing', strong: false, type: 'prop', id: wk.id, label: 'Looks like ' + wk.id + ' (same locality, area and price)' }; }
        if (!seen[k]) seen[k] = i + 1;
      }
    } else {
      const name = v('name'); if (!name) errors.push('Name is missing');
      const ph = normPhone(v('phone')); if (ph.empty) errors.push('Mobile is missing'); else if (!ph.ok) errors.push('Mobile “' + v('phone') + '” is not a valid number');
      const as: string = ''; if (as && !team.includes(as.toLowerCase())) warns.push('“' + as + '” is not on your team — assigned to ' + I.opts.assigned);
      const em = v('email'); if (em && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(em)) warns.push('Email looks invalid');
      const assigned = as && team.includes(as.toLowerCase()) ? S.team.find((t) => t.name.toLowerCase() === as.toLowerCase()).name : I.opts.assigned;
      if (kind === 'prospects') {
        const tp = v('type'); const type = /own|land/i.test(tp) ? 'Owner' : /ten|rent/i.test(tp) ? 'Tenant' : /buy/i.test(tp) || !tp ? 'Buyer' : 'Buyer'; if (tp && !/buy|ten|rent|own|land/i.test(tp)) warns.push('Type “' + tp + '” not recognised — set to Buyer');
        const alt = v('alt'); if (alt && !normPhone(alt).ok) warns.push('Alternate mobile looks invalid');
        rec = { name, phone: ph.ok ? ph.fmt : '', key: ph.key || '', email: em, type, city: v('city') || 'Kolkata', source: v('source') || I.opts.source, lang: v('lang') || 'English', nri: /^(y|yes|true|1|nri)/i.test(v('nri')) || !!(ph.intl), assigned, notes: v('notes') };
        label = name + ' · ' + (rec.phone || '—') + ' · ' + type;
        const kk = ph.key ? 'p' + ph.key : ''; const exP = S.prospects.find((c) => (ph.key && digitsKey(c.phone) === ph.key) || (name && c.name.toLowerCase() === name.toLowerCase()));
        if (exP) { const strong = ph.key && digitsKey(exP.phone) === ph.key; dup = { kind: 'existing', strong, type: 'pros', id: exP.id, label: strong ? 'Same mobile as ' + exP.name : 'Same name as an existing prospect (' + exP.name + ')' }; }
        else if (kk && seen[kk]) dup = { kind: 'file', strong: true, label: 'Repeated in this file (row ' + seen[kk] + ')' };
        if (kk && !seen[kk]) seen[kk] = i + 1;
      } else {
        const it = v('intent'); const intent = /rent|lease/i.test(it) ? 'rent' : 'buy';
        const bmin = v('bmin'), bmax = v('bmax'); const budget = bmin || bmax ? (bmin || '—') + '–' + (bmax || '—') : '—';
        rec = { name, phone: ph.ok ? ph.fmt : '', key: ph.key || '', source: v('source') || I.opts.source, intent, want: v('want') || '—', budget, assigned, notes: v('notes') };
        label = name + ' · ' + (rec.phone || '—') + ' · ' + (intent === 'buy' ? 'Buy' : 'Rent/Lease');
        const kk = ph.key ? 'l' + ph.key : ''; const exL = S.leads.find((l) => (ph.key && digitsKey(l.phone) === ph.key) || (name && l.name.toLowerCase() === name.toLowerCase())); const exC = !exL && S.prospects.find((c) => (ph.key && digitsKey(c.phone) === ph.key) || (name && c.name.toLowerCase() === name.toLowerCase()));
        if (exL) { const strong = ph.key && digitsKey(exL.phone) === ph.key; dup = { kind: 'existing', strong, type: 'lead', id: exL.id, label: strong ? 'Same mobile as lead ' + exL.name : 'Same name as an existing lead (' + exL.name + ')' }; }
        else if (exC) dup = { kind: 'existing', strong: !!(ph.key && digitsKey(exC.phone) === ph.key), type: 'pros', id: exC.id, label: 'Already a prospect: ' + exC.name, noMerge: true };
        else if (kk && seen[kk]) dup = { kind: 'file', strong: true, label: 'Repeated in this file (row ' + seen[kk] + ')' };
        if (kk && !seen[kk]) seen[kk] = i + 1;
      }
    }
    const status = errors.length ? 'error' : dup ? 'dup' : warns.length ? 'warn' : 'ok';
    const defAction = errors.length ? 'skip' : dup ? (dup.strong ? 'skip' : 'import') : 'import';
    out.push({ i, cells, rec, label, errors, warns, dup, status, defAction });
  });
  I._key = key; I._rows = out; I.actions = {}; out.forEach((r) => { I.actions[r.i] = r.defAction; }); return out;
}
// Chosen action for a row (skip/create/update/merge) or its default.
const impAction = (r) => (S.imp.actions[r.i] || r.defAction);
/* ---- run + undo */
// Apply the import: create/update records, keep an undo snapshot, write the import history.
function impRun() {
  const I = S.imp; const rows = impAnalyze(); const H = { id: 'imp' + Date.now(), at: iso(today), kind: I.kind, file: I.file, counts: { total: rows.length, imported: 0, merged: 0, skipped: 0, errors: 0 }, created: { props: [], projects: [], prospects: [], leads: [] }, merged: [], undone: false };
  const stamp = Date.now();
  rows.forEach((r) => {
    const act = impAction(r);
    if (r.status === 'error') { H.counts.errors++; return; }
    if (act === 'skip') { H.counts.skipped++; return; }
    if (act === 'merge' && r.dup && r.dup.kind === 'existing' && !r.dup.noMerge) {
      const t = r.dup.type; const arr = t === 'prop' ? S.props : t === 'pros' ? S.prospects : S.leads; const ix = arr.findIndex((x) => x.id === r.dup.id); if (ix < 0) { H.counts.skipped++; return; }
      const cur = arr[ix]; H.merged.push({ t, id: cur.id, before: clone(cur) }); const fill = (k, v, blank?) => { if (v && (cur[k] == null || cur[k] === '' || cur[k] === '—' || cur[k] === 0)) cur[k] = v; };
      if (t === 'prop') { fill('priceL', r.rec.priceL); fill('quotedL', r.rec.priceL); fill('rentK', r.rec.rentK); fill('furn', r.rec.furn); fill('owner', r.rec.owner); fill('bhk', r.rec.bhk); fill('area', r.rec.area); fill('ownerPhone', r.rec.ownerPhone); }
      else if (t === 'pros') { fill('email', r.rec.email); fill('city', r.rec.city); fill('lang', r.rec.lang); fill('notes', r.rec.notes); }
      else { fill('want', r.rec.want); fill('budget', r.rec.budget); cur.act.unshift(['System', 'Details updated from import ' + I.file, 'Just now']); }
      H.counts.merged++; return;
    }
    if (I.kind === 'properties') {
      const x = r.rec; let pid = null;
      if (x.project) { let pr = S.projects.find((p) => p.name.toLowerCase() === x.project.toLowerCase()); if (!pr && I.opts.createProjects) { pr = { ...newProject(), id: 'p' + stamp + r.i, name: x.project, status: 'ready', complete: '', configs: [], units: '' }; S.projects.push(pr); H.created.projects.push(pr.id); } if (pr) pid = pr.id; }
      const pre = (x.cat === 'Residential' ? 'R' : x.cat === 'Commercial' ? 'C' : 'L') + (x.purpose === 'sale' ? 'S' : 'R'); let n = S.props.filter((p) => p.id.startsWith(pre)).length + 1; while (S.props.some((p) => p.id === pre + String(n).padStart(3, '0'))) n++;
      const id = pre + String(n).padStart(3, '0');
      S.props.push({ id, purpose: x.purpose, cat: x.cat, title: (x.bhk ? x.bhk + ' BHK ' : '') + x.sub, projectId: pid, unit: [x.unit, x.project && !pid ? x.project : ''].filter(Boolean).join(', ') || x.loc, loc: x.loc, bhk: x.bhk, area: x.area, furn: x.furn, priceL: x.priceL, quotedL: x.priceL, rentK: x.rentK, status: x.status, source: x.source, owner: x.owner, ownerPhone: x.ownerPhone });
      H.created.props.push(id); H.counts.imported++;
    } else if (I.kind === 'prospects') {
      const x = r.rec; const id = 'c' + stamp + r.i; S.prospects.push({ id, name: x.name, type: x.type, nri: x.nri, city: x.city, source: x.source, assigned: x.assigned, phone: x.phone, email: x.email, lang: x.lang, notes: x.notes }); H.created.prospects.push(id); H.counts.imported++;
    } else {
      const x = r.rec; const id = 'l' + stamp + r.i; S.leads.unshift({ id, name: x.name, phone: x.phone, source: x.source, intent: x.intent, stage: 'Lead', sub: '', budget: x.budget, want: x.want, assigned: x.assigned, tags: [], act: [['System', 'Imported from ' + I.file, 'Just now']].concat(x.notes ? [['Note', x.notes, 'Just now']] : []) }); H.created.leads.push(id); H.counts.imported++;
    }
  });
  S.imports.unshift(H); I.result = H; I.step = 3; I._key = ''; render(); window.scrollTo(0, 0);
}
// Undo an earlier import run.
function impUndo(id) {
  const H = S.imports.find((x) => x.id === id); if (!H || H.undone) return;
  H.created.props.forEach((pid) => { const i = S.props.findIndex((p) => p.id === pid); if (i >= 0) S.props.splice(i, 1); delete S.files['prop:' + pid]; });
  H.created.projects.forEach((pid) => { if (!S.props.some((p) => p.projectId === pid)) { const i = S.projects.findIndex((p) => p.id === pid); if (i >= 0) S.projects.splice(i, 1); } });
  H.created.prospects.forEach((cid) => { const i = S.prospects.findIndex((p) => p.id === cid); if (i >= 0) S.prospects.splice(i, 1); });
  H.created.leads.forEach((lid) => { const i = S.leads.findIndex((p) => p.id === lid); if (i >= 0) S.leads.splice(i, 1); });
  H.merged.forEach((m) => { const arr = m.t === 'prop' ? S.props : m.t === 'pros' ? S.prospects : S.leads; const i = arr.findIndex((x) => x.id === m.id); if (i >= 0) arr[i] = m.before; });
  H.undone = true; S.imp._key = '';
}
// Download rows with errors as CSV.
function impErrorCsv() {
  const I = S.imp; const { headers } = impTable(); const rows = impAnalyze().filter((r) => r.status === 'error');
  // Quote one CSV cell (double any inner quotes).
  const q = (c) => '"' + String(c).replace(/"/g, '""') + '"';
  return [headers.concat(['Import problems']).map(q).join(',')].concat(rows.map((r) => r.cells.concat([r.errors.join('; ')]).map(q).join(','))).join('\n');
}
/* ---- view */
// Import wizard screen: choose kind -> upload -> map columns -> review -> done.
function importView() {
  const I = S.imp; const steps = ['Choose data', 'Match columns', 'Check & fix', 'Done']; const info = IMP_INFO[I.kind];
  const stepper = `<div class="step">${steps.map((s, i) => `<div class="${i < I.step ? 'done' : i === I.step ? 'cur' : ''}" ${i < I.step && I.step < 3 ? `role="button" tabindex="0" data-act="impStep" data-v="${i}" style="cursor:pointer"` : ''}>${i + 1}. ${s}</div>`).join('')}</div>`;
  let body = '';
  // Step 0: the file-pick screen.
  if (I.step === 0) {
    const kinds = Object.keys(IMP_INFO).map((k) => `<button type="button" class="card" data-act="impKind" data-v="${k}" style="text-align:left;gap:4px;border:${I.kind === k ? '2px solid var(--p)' : '1px solid var(--line)'};background:${I.kind === k ? 'var(--p-soft)' : 'var(--surface)'};padding:16px"><div class="head"><b style="font-size:16px">${IMP_INFO[k].title}</b><div class="grow"></div>${I.kind === k ? badge('Selected', 'blue') : ''}</div><span class="sub">${IMP_INFO[k].desc}</span><span class="sub" style="font-size:12px">Needs: ${IMP_INFO[k].need}</span></button>`).join('');
    const o = I.opts;
    const optHtml = I.kind === 'properties' ? `<div class="row">${fld('If there is no Purpose column, treat rows as', 'imp.opts.defaultPurpose', { opts: [['sale', 'Sale'], ['rent', 'Rent/Lease']], rer: 1 })}${fld('Default source', 'imp.opts.source', { opts: ['Import', 'Owner', 'Broker', 'Developer', 'Portal', 'Referral'] })}</div>${chk(o.createProjects, 'Create projects that are not in my list yet', 'data-act="togb" data-p="imp.opts.createProjects"')}` : `<div class="row">${fld('Default source', 'imp.opts.source', { opts: ['Import', '99acres', 'Magicbricks', 'Housing.com', 'Direct Reference', 'Friend & Family', 'Own website'] })}</div>`;
    const hist = S.imports.length ? card(`<h2>Recent imports</h2><div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${S.imports.slice(0, 6).map((h) => `<div class="li"><div class="grow"><b>${esc(h.file)}</b><div class="sub" style="font-size:12px">${IMP_INFO[h.kind].title} · ${esc(dayLbl(parseISO(h.at)))} · ${h.counts.imported} added · ${h.counts.merged} merged · ${h.counts.skipped + h.counts.errors} skipped</div></div>${h.undone ? badge('Undone') : btn('Undo import', { k: 'sec sm', a: `data-act="impUndo" data-id="${h.id}"` })}</div>`).join('')}</div>`) : '';
    body = `<div class="row" style="gap:12px">${kinds}</div>${card(`<h2>Add your file</h2><div class="grid2"><div class="stack"><label class="dz" data-idrop="1">${ico('upload', 26)}<div><b>Drag &amp; drop your file here</b> or <span style="color:var(--p);font-weight:600">choose a file</span></div><div class="sub" style="font-size:12px">.csv · .tsv · .xlsx — up to 8 MB, first 5,000 rows</div><input type="file" hidden data-import-file="1" accept=".csv,.tsv,.txt,.xlsx,.xls"></label><div class="fld"><span class="l">…or paste rows copied from Excel or Google Sheets</span><textarea id="imp_paste" data-f="imp.paste" rows="4" placeholder="Name&#9;Mobile&#9;City&#10;Arjun Mehta&#9;98301 22334&#9;Kolkata" aria-label="Paste rows">${esc(I.paste)}</textarea></div><div class="chips">${btn('Use pasted rows', { k: 'ghost', a: 'data-act="impPaste"' })}${btn('Try with sample data', { k: 'sec', a: 'data-act="impSample"' })}${btn('Show template', { k: 'sec', a: 'data-act="impTemplate"' })}</div></div>
      <div class="stack"><div class="card" style="background:var(--bg);gap:8px"><b>Before you start</b><div class="sub" style="font-size:13px">• The first row should be column names.<br>• Mobile numbers can be 10 digits, with +91, or with spaces.<br>• Prices can be like ₹1.2 Cr, 85 L or 8500000.<br>• Extra columns are ignored. You match columns in the next step.<br>• Rows that look like duplicates are flagged before anything is added.</div></div><div class="card" style="background:var(--bg);gap:8px"><b>Options</b>${optHtml}</div></div></div>`)}${hist}`;
  } else if (I.step === 1) {
    const { headers, data } = impTable(); const idx = impFieldIndex(); const miss = impMissing(); const used = {};
    const opts = [['', 'Don’t import this column']].concat(IMP_FIELDS[I.kind].map((f) => [f[0], f[1] + (f[2] ? ' *' : '')]));
    const rowsH = headers.map((h, ci) => { const f = I.map[ci] || ''; const dupF = f && used[f]; if (f) used[f] = 1; const sample = data.slice(0, 3).map((r) => r[ci]).filter(Boolean); return `<tr><td><b>${esc(h)}</b></td><td class="sub" style="max-width:280px;font-size:12px">${sample.map((s) => `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s)}</div>`).join('') || '—'}</td><td style="min-width:260px">${fld('', 'imp.map.' + ci, { opts, rer: 1, aria: 'Map column ' + h })}</td><td>${f ? (dupF ? badge('Already used', 'warn') : badge('Matched', 'ok')) : badge('Ignored')}</td></tr>`; }).join('');
    body = `${card(`<div class="head"><h2>Match your columns</h2><div class="grow"></div>${badge(esc(I.file))}${badge(data.length + ' rows')}</div>${miss.length ? `<div class="note" style="background:var(--err-soft);border-color:var(--err);color:var(--err)">${ico('info', 18)}<div>Still needed: ${esc(miss.join(', '))}. Pick a column for each below.</div></div>` : `<div class="note ok">${ico('check', 18)}<div>All required fields are matched. Anything you leave as “Don’t import” is skipped.</div></div>`}${chk(I.opts.header, 'First row contains column names', 'data-act="impHeader"')}<div class="scroll-x"><table class="tbl"><thead><tr><th>Your column</th><th>Sample values</th><th>Goes into</th><th></th></tr></thead><tbody>${rowsH}</tbody></table></div><div class="head" style="border-top:1px solid var(--line);padding-top:14px">${btn('Back', { k: 'sec', a: 'data-act="impStep" data-v="0"' })}<div class="grow"></div>${btn('Check my data', { a: 'data-act="impStep" data-v="2"', c: miss.length ? '' : '' })}</div>`)}`;
  } else if (I.step === 2) {
    const rows = impAnalyze(); const cnt = (s) => rows.filter((r) => r.status === s).length; const f = I.filter;
    const eff = rows.map((r) => impAction(r)); const willAdd = rows.filter((r, i) => r.status !== 'error' && eff[i] === 'import').length; const willMerge = rows.filter((r, i) => r.status !== 'error' && eff[i] === 'merge').length;
    const shown = rows.filter((r) => f === 'all' || r.status === f);
    const tiles = [['Rows', rows.length, ''], ['Ready', cnt('ok') + cnt('warn'), 'var(--ok)'], ['Duplicates', cnt('dup'), 'var(--warn)'], ['Errors', cnt('error'), 'var(--err)']].map((t) => `<div class="stat" style="min-width:120px"><span class="sub" style="font-size:12px">${t[0]}</span><b style="color:${t[2] || 'inherit'}">${t[1]}</b></div>`).join('');
    const stB = (r) => r.status === 'error' ? badge('Error', 'err') : r.status === 'dup' ? badge(r.dup.strong ? 'Duplicate' : 'Possible duplicate', 'warn') : r.status === 'warn' ? badge('Check', 'blue') : badge('OK', 'ok');
    const optsFor = (r) => r.status === 'error' ? [['skip', 'Skip']] : r.dup ? (r.dup.kind === 'existing' && !r.dup.noMerge ? [['skip', 'Skip'], ['merge', 'Merge into existing'], ['import', 'Import as new']] : [['skip', 'Skip'], ['import', 'Import as new']]) : [['import', 'Import'], ['skip', 'Skip']];
    const tr = shown.slice(0, I.limit).map((r) => `<tr><td class="sub">${r.i + 2}</td><td>${stB(r)}</td><td style="min-width:240px"><b style="font-weight:600">${esc(r.label || '—')}</b>${r.errors.concat(r.warns).concat(r.dup ? [r.dup.label] : []).map((m, k) => `<div style="font-size:12px;color:${k < r.errors.length ? 'var(--err)' : 'var(--muted)'}">${esc(m)}</div>`).join('')}</td><td style="min-width:170px">${fld('', 'imp.actions.' + r.i, { opts: optsFor(r), rer: 1, aria: 'Action for row ' + (r.i + 2) })}</td></tr>`).join('');
    const bulk = cnt('dup') ? `<div class="chips">${btn('Skip all duplicates', { k: 'sec sm', a: 'data-act="impBulk" data-v="skip"' })}${btn('Merge duplicates where possible', { k: 'sec sm', a: 'data-act="impBulk" data-v="merge"' })}${btn('Import possible duplicates as new', { k: 'sec sm', a: 'data-act="impBulk" data-v="weak"' })}</div>` : '';
    body = `<div class="row" style="gap:12px">${tiles}</div>${card(`<div class="head"><h2>Check &amp; fix</h2><div class="grow"></div>${cnt('error') ? btn('Copy problem rows', { k: 'sec sm', a: 'data-act="impErrors"' }) : ''}</div><div class="chips">${[['all', 'All ' + rows.length], ['ok', 'OK ' + cnt('ok')], ['warn', 'Check ' + cnt('warn')], ['dup', 'Duplicates ' + cnt('dup')], ['error', 'Errors ' + cnt('error')]].map((x) => chip(x[1], f === x[0], `data-act="impFilter" data-v="${x[0]}"`)).join('')}</div>${bulk}<div class="scroll-x"><table class="tbl"><thead><tr><th>Row</th><th>Status</th><th>Record</th><th>What to do</th></tr></thead><tbody>${tr || '<tr><td colspan="4" class="sub">No rows in this group.</td></tr>'}</tbody></table></div>${shown.length > I.limit ? `<div style="text-align:center">${btn('Show 40 more (' + (shown.length - I.limit) + ' left)', { k: 'sec sm', a: 'data-act="impMore"' })}</div>` : ''}<div class="head" style="border-top:1px solid var(--line);padding-top:14px">${btn('Back', { k: 'sec', a: 'data-act="impStep" data-v="1"' })}<div class="grow"></div><span class="sub">${willAdd} to add · ${willMerge} to merge · ${rows.length - willAdd - willMerge} skipped</span>${btn('Import ' + (willAdd + willMerge) + ' record' + (willAdd + willMerge === 1 ? '' : 's'), { a: 'data-act="impRun"', c: '' })}</div>`)}`;
  } else {
    const H = I.result || S.imports[0]; if (!H) { I.step = 0; return importView(); }
    body = card(`<div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 0;text-align:center"><div style="width:64px;height:64px;border-radius:50%;background:var(--ok-soft);color:var(--ok);display:flex;align-items:center;justify-content:center">${ico('check', 32)}</div><h2 style="font-size:20px">${H.undone ? 'Import undone' : 'Import complete'}</h2><div class="sub">${esc(H.file)} · ${IMP_INFO[H.kind].title}</div></div><div class="row" style="gap:12px">${[['Added', H.counts.imported], ['Merged', H.counts.merged], ['Skipped', H.counts.skipped], ['Errors', H.counts.errors]].map((x) => `<div class="stat"><span class="sub" style="font-size:12px">${x[0]}</span><b>${x[1]}</b></div>`).join('')}</div>${H.created.projects.length ? `<div class="sub">${H.created.projects.length} new project${H.created.projects.length > 1 ? 's were' : ' was'} created from the Project column.</div>` : ''}<div class="head" style="border-top:1px solid var(--line);padding-top:14px">${btn('Import another file', { k: 'sec', a: 'data-act="impReset"' })}${H.undone ? '' : btn('Undo this import', { k: 'danger', a: `data-act="impUndo" data-id="${H.id}"` })}<div class="grow"></div>${btn('View ' + IMP_INFO[H.kind].title.toLowerCase(), { href: IMP_INFO[H.kind].route })}</div>`);
  }
  return page('Import data', 'Bring in properties, prospects or leads from Excel or CSV', '', `${stepper}${body}`);
}
/* ---- actions */
Object.assign(ACTS, {
  // Sign out and return to the login page.
  logout() { ADAPTER.logout(); },
  // Choose what to import (properties, leads...).
  impKind(el) { S.imp.kind = el.dataset.v; S.imp.map = {}; render(); },
  // Move to a wizard step.
  impStep(el) { const v = Number(el.dataset.v); if (v === 2 && impMissing().length) { toast('Match the required columns first: ' + impMissing().join(', ')); return; } S.imp.step = v; S.imp.limit = 40; render(); window.scrollTo(0, 0); },
  // Toggle 'first row is header'.
  impHeader() { S.imp.opts.header = !S.imp.opts.header; autoMap(); render(); },
  // Filter preview rows.
  impFilter(el) { S.imp.filter = el.dataset.v; S.imp.limit = 40; render(); },
  // Show more preview rows.
  impMore() { S.imp.limit += 40; render(); },
  // Apply an action to many rows.
  impBulk(el) { const v = el.dataset.v; impAnalyze().forEach((r) => { if (!r.dup || r.status === 'error') return; if (v === 'skip') S.imp.actions[r.i] = 'skip'; else if (v === 'merge' && r.dup.kind === 'existing' && !r.dup.noMerge) S.imp.actions[r.i] = 'merge'; else if (v === 'weak' && !r.dup.strong) S.imp.actions[r.i] = 'import'; }); render(); },
  // Apply the import.
  impRun() { impRun(); },
  // Undo an import run.
  impUndo(el) { impUndo(el.dataset.id); toast('Import undone — added records removed, merged records restored.'); },
  // Start the wizard over.
  impReset() { Object.assign(S.imp, { step: 0, file: '', raw: [], map: {}, actions: {}, result: null, paste: '', filter: 'all', limit: 40, _key: '', _rows: null }); render(); },
  // Load sample rows.
  impSample() { S.imp.file = 'sample_' + S.imp.kind + '.csv'; loadImportText(IMP_SAMPLE[S.imp.kind], 'sample_' + S.imp.kind + '.csv'); },
  // Import pasted text.
  impPaste() { const t = (S.imp.paste || '').trim(); if (!t) { toast('Paste some rows first.'); return; } loadImportText(t, 'pasted-rows.csv'); },
  // Download the CSV template.
  impTemplate() { S.modal = { t: 'importText', title: 'Template — ' + IMP_INFO[S.imp.kind].title, text: IMP_SAMPLE[S.imp.kind].split('\n').slice(0, 3).join('\n'), note: 'Copy this into a spreadsheet, keep the first row, and replace the sample rows with yours.' }; render(); },
  // Download error rows.
  impErrors() { S.modal = { t: 'importText', title: 'Rows that need fixing', text: impErrorCsv(), note: 'Copy these rows into a sheet, fix the problems, and import them again.' }; render(); },
  // Open the import wizard for a kind.
  importFor(el) { S.imp.kind = el.dataset.k; if (S.imp.step === 3) ACTS.impReset(); S.imp.map = {}; go('#/import'); }
});
// Change handler: file inputs (upload documents) and select-like controls.
_doc.addEventListener('change', (e) => { const el = e.target; if (el && el.type === 'file' && el.dataset && el.dataset.importFile) { importFileChosen(el.files && el.files[0]); el.value = ''; } });
// Drag & drop upload zones: highlight on dragover/dragleave, accept files on drop.
_doc.addEventListener('dragover', (e) => { const z = e.target.closest && e.target.closest('[data-idrop]'); if (z) { e.preventDefault(); z.classList.add('over'); } });
_doc.addEventListener('dragleave', (e) => { const z = e.target.closest && e.target.closest('[data-idrop]'); if (z) z.classList.remove('over'); });
_doc.addEventListener('drop', (e) => { const z = e.target.closest && e.target.closest('[data-idrop]'); if (!z) return; e.preventDefault(); z.classList.remove('over'); importFileChosen(e.dataTransfer.files && e.dataTransfer.files[0]); });

/* ---- v6: Edit + Delete on every list page, with a linked-data check before anything is deleted ------------------
 * Every list row gets two small buttons (only for roles with write access to that module):
 *   ✎ Edit   — projects/properties: their existing edit forms; leads, prospects, requirements, visits, follow-ups:
 *              the same "add" form, pre-filled, saving back into the same record; deals/brokerage: their detail page
 *              (where every part of a deal is already editable).
 *   🗑 Delete — first checks whether the record is used anywhere else (usesOf). If it is, a "Can't delete" dialog lists
 *              where; otherwise a confirmation dialog, then the record (and its own documents) is removed.
 * The API enforces the same rules (beforeRemove hooks), so nothing linked can be deleted even by two users at once. */

// Trash-can icon for the delete buttons.
IC.trash = 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3';

// Everything the edit/delete code needs to know about each kind of record.
//   mod   = permission module (write access needed)   list = the array in S that holds it
//   key   = primary key field (default 'id')           scope = document-scope prefix (files stored as '<scope>:<id>')
//   label = word used in dialogs                       name = how one record is named in dialogs
//   back  = list page to return to after deleting it from its own detail page
const REC = {
  project: { mod: 'projects', list: () => S.projects, scope: 'proj', label: 'project', back: '#/projects', name: (x) => x.name },
  property: { mod: 'properties', list: () => S.props, scope: 'prop', label: 'property', back: '#/properties', name: (x) => x.id + ' · ' + x.title },
  lead: { mod: 'leads', list: () => S.leads, scope: 'lead', label: 'lead', back: '#/leads', name: (x) => x.name },
  prospect: { mod: 'prospects', list: () => S.prospects, scope: 'pros', label: 'prospect', back: '#/prospects', name: (x) => x.name },
  req: { mod: 'requirements', list: () => S.reqs, scope: 'req', label: 'requirement', back: '#/requirements', name: (x) => x.id + ' · ' + ((prosById(x.cid) || {}).name || '—') },
  visit: { mod: 'visits', list: () => S.visits, scope: 'visit', label: 'visit', back: '#/visits', name: (x) => x.id + ' · ' + ((prosById(x.cid) || {}).name || '—') + ' · ' + x.prop },
  fu: { mod: 'visits', list: () => S.fus, label: 'follow-up', back: '#/followups', name: (x) => x.kind + ' · ' + x.who },
  deal: { mod: 'deals', list: () => S.deals, scope: 'deal', label: 'deal', back: '#/deals', name: (x) => x.id + ' · ' + ((prosById(x.cid) || {}).name || '—') },
  brok: { mod: 'brokerage', list: () => S.brok, key: 'deal', scope: 'brok', label: 'brokerage record', back: '#/brokerage', name: (x) => 'Brokerage of ' + x.deal },
};
// Find one record of a kind by its id.
const recOf = (k, id) => REC[k].list().find((x) => String(x[REC[k].key || 'id']) === String(id));
// "3 visits" / "1 visit"
const nOf = (n, one, many?) => n + ' ' + (n === 1 ? one : many || one + 's');
// Short comma list of ids, "VIS-3387, VIS-3394 and 2 more".
const idList = (arr) => { const a = arr.slice(0, 4).join(', '); return arr.length > 4 ? a + ' and ' + (arr.length - 4) + ' more' : a; };
// Was this lead converted into a prospect? (by link, or — for older data — by stage + same name)
const prospectOfLead = (l) => S.prospects.find((c) => c.id === l.prospectId) || (l.stage === 'Converted' ? S.prospects.find((c) => c.name === l.name) : null);

/** Where is this record used? Returns a list of human-readable reasons; empty = safe to delete. */
function usesOf(k, id) {
  const r = recOf(k, id); if (!r) return [];
  const u = [];
  // Add a line to the summary only when the list is not empty.
  const add = (arr, one, many?, ids?, where?) => { if (arr.length) u.push(nOf(arr.length, one, many) + (where ? ' ' + where : '') + (ids ? ': ' + idList(ids) : '')); };
  // Describe a project change.
  if (k === 'project') {
    const ps = S.props.filter((p) => p.projectId === id);
    add(ps, 'property is', 'properties are', ps.map((p) => p.id), 'listed in this project');
  }
  // Describe a property change.
  if (k === 'property') {
    const vs = S.visits.filter((v) => v.prop === id); add(vs, 'visit', 'visits', vs.map((v) => v.id), 'booked for this property');
    const ds = S.deals.filter((d) => d.prop === id); add(ds, 'deal', 'deals', ds.map((d) => d.id), 'made on this property');
    const fs = S.fus.filter((f) => !f.done && String(f.note || '').startsWith(id + ' · ')); add(fs, 'open follow-up mentions this property', 'open follow-ups mention this property', fs.map((f) => f.who));
  }
  // Describe a lead change.
  if (k === 'lead') {
    const c = prospectOfLead(r); if (c) u.push('This lead was converted into the prospect ' + c.name + ' (' + c.id + ')');
    const fs = S.fus.filter((f) => !f.done && f.who === r.name); add(fs, 'open follow-up', 'open follow-ups', null, 'for ' + r.name);
  }
  // Describe a prospect change.
  if (k === 'prospect') {
    const rq = S.reqs.filter((x) => x.cid === id); add(rq, 'requirement', 'requirements', rq.map((x) => x.id));
    const vs = S.visits.filter((v) => v.cid === id); add(vs, 'visit', 'visits', vs.map((v) => v.id));
    const ds = S.deals.filter((d) => d.cid === id); add(ds, 'deal', 'deals', ds.map((d) => d.id));
    const fs = S.fus.filter((f) => !f.done && f.who === r.name); add(fs, 'open follow-up', 'open follow-ups', null, 'for ' + r.name);
    const ls = S.leads.filter((l) => prospectOfLead(l) === r); add(ls, 'lead was', 'leads were', ls.map((l) => l.name), 'converted into this prospect');
    const ps = S.props.filter((p) => p.owner === r.name); add(ps, 'property lists', 'properties list', ps.map((p) => p.id), r.name + ' as the owner');
  }
  // Describe a deal change.
  if (k === 'deal') {
    const b = S.brok.find((x) => x.deal === id);
    if (r.stage === 'closed_won') u.push('The deal is closed (won) — ' + r.prop + ' is marked ' + (r.kind === 'sale' ? 'Sold' : 'Rented/Leased'));
    if (b && (b.pay || []).length) u.push(nOf(b.pay.length, 'brokerage payment', 'brokerage payments') + ' recorded against this deal');
    if (b && b.inv) u.push('Brokerage invoices have been issued for this deal');
  }
  // Describe a brokerage change.
  if (k === 'brok') {
    const d = S.deals.find((x) => x.id === r.deal);
    if (d) u.push('It belongs to deal ' + d.id + ' — brokerage is created and removed together with its deal');
    if ((r.pay || []).length) u.push(nOf(r.pay.length, 'payment', 'payments') + ' recorded');
  }
  return u;
}

// The ✎ / 🗑 buttons shown at the end of a list row (nothing for read-only roles).
function rowActs(k, id) {
  if (!canW(REC[k].mod)) return '';
  const r = recOf(k, id); const nm = r ? REC[k].name(r) : id;
  return `<span class="ra" style="display:inline-flex;gap:6px;white-space:nowrap;flex:none"><button type="button" class="btn sec sm" data-act="rowEdit" data-k="${k}" data-id="${esc(id)}" title="Edit" aria-label="Edit ${esc(nm)}">${ico('edit', 16)}</button><button type="button" class="btn sec sm" style="color:var(--err)" data-act="rowDel" data-k="${k}" data-id="${esc(id)}" title="Delete" aria-label="Delete ${esc(nm)}">${ico('trash', 16)}</button></span>`;
}
// Table cell holding the row action buttons.
const rowActsTd = (k, id) => `<td style="width:1%;text-align:right" data-l="Actions">${rowActs(k, id)}</td>`;
// Matching header cell for the actions column.
const rowActsTh = () => '<th style="width:1%" aria-label="Actions"></th>';

// '+91 98630 34210' -> '98630 34210' (the forms add the +91 themselves)
const no91 = (s) => String(s || '').replace(/^\+91\s*/, '');
// Records being edited through the "add" forms (null = the form is adding a new record).
S.d.edit = { lead: null, prospect: null, req: null, visit: null, fu: null };
// Clear every open edit form (lead, prospect, visit, follow-up).
const clearModalEdits = () => { S.d.edit.lead = S.d.edit.prospect = S.d.edit.visit = S.d.edit.fu = null; };

// Fill the "add" form drafts from an existing record.
const EDIT_LOAD = {
  // Summary text for a lead.
  lead(l) {
    const b = l.basic || {}; const chips = ['Direct Reference', 'Friend & Family', 'Portal', 'Associate Broker', 'Owner'];
    const portal = !chips.includes(l.source);
    S.d.lead = Object.assign(newLead(), { name: l.name, phone: no91(l.phone), waSame: l.waSame !== false, wa: no91(l.wa), source: portal ? 'Portal' : l.source, portal: portal ? l.source : '99acres', intent: l.intent, ptype: b.type || 'Apartment / Flat', bhk: b.bhk || 3, csub: b.csub || 'Office', locality: b.locText || '', bmin: b.min ? String(b.min) : '', bmax: b.max ? String(b.max) : '', want: String(l.want || '').split(' — ').slice(1).join(' — '), refBy: l.refBy || '', assigned: l.assigned || 'Anil Sharma' });
    S.modal = { t: 'lead' };
  },
  prospect(c) { S.d.prospect = Object.assign(newProspect(), clone(c), { phone: no91(c.phone), wa: no91(c.wa), alt: no91(c.alt) }); S.modal = { t: 'prospect' }; },
  // Summary text for a requirement.
  req(r) {
    S.d.req = Object.assign(newReq(), { cid: r.cid, purpose: r.purpose, type: r.type, csub: r.csub || 'Office', locs: (r.locs || []).slice(), min: r.min ? String(r.min) : '', max: r.max ? String(r.max) : '', bhk: r.bhk || 3, amin: r.amin ? String(r.amin) : '', amax: r.amax ? String(r.amax) : '', timeline: r.timeline || 'Immediate', fin: r.fin || 'Cash', notes: r.notes || '' });
    if (r.parking && r.parking !== '—') S.d.req.parking = r.parking;
    REQ_EXTRA.forEach((k) => { if (r[k] !== undefined && r[k] !== '') S.d.req[k] = r[k]; });
    go('#/requirements/new');
  },
  visit(v) { S.d.visit = { cid: v.cid, props: [v.prop], date: v.date, time: v.time, mode: v.mode || 'site', link: v.mode === 'video' ? String(v.notes || '').replace(/^Video call · /, '') : '', meet: String(v.notes || '').startsWith('Meet at ') ? v.notes.slice(8) : '', remind: 'WhatsApp', pin: true }; S.modal = { t: 'visit' }; },
  // Summary text for a follow-up.
  fu(f) {
    const m = String(f.note || '').match(/^([A-Z]{2}\d{3}) · (.*)$/); const prop = f.kind === 'Visit' && m ? m[1] : ''; const note = prop ? m[2] : f.note || '';
    S.d.fu = Object.assign(newFu(), { who: f.who, kind: f.kind, p: f.p || 'sale', pri: f.pri || 'Normal', note, prop, when: 'keep', date: '', time: '' }); S.modal = { t: 'fu' };
  },
};

// When a person/lead is renamed, keep the places that refer to them by name in step.
function renameRefs(oldName, newName) {
  if (!oldName || oldName === newName) return;
  S.fus.forEach((f) => { if (f.who === oldName) f.who = newName; });
  S.props.forEach((p) => { if (p.owner === oldName) p.owner = newName; });
}

// The original "save" actions create a NEW record. In edit mode we let them validate and build the record as usual,
// then fold the freshly built record back into the one being edited (keeping its id, history and status).
const SAVE_MERGE = {
  saveLead: (orig) => function () {
    const id = S.d.edit.lead; if (!id) return orig.apply(this, arguments);
    const n0 = S.leads.length; orig.apply(this, arguments); if (S.leads.length === n0) return; // validation failed
    const nw = S.leads.shift(); const l = S.leads.find((x) => x.id === id); if (!l) return;
    renameRefs(l.name, nw.name);
    Object.assign(l, { name: nw.name, phone: nw.phone, waSame: nw.waSame, wa: nw.wa, source: nw.source, intent: nw.intent, budget: nw.budget, want: nw.want, basic: nw.basic, refBy: nw.refBy, assigned: nw.assigned });
    (nw.links || []).forEach((x) => { if (!(l.links || []).some((y) => y.url === x.url)) (l.links = l.links || []).push(x); });
    (l.act = l.act || []).unshift([ME().name, 'Lead details edited', dateTxt(iso(today))]);
    S.d.edit.lead = null; S.d.lead = newLead(); toast('Lead updated'); go('#/leads/' + id);
  },
  saveProspect: (orig) => function (el) {
    const id = S.d.edit.prospect; if (!id) return orig.apply(this, arguments);
    const n0 = S.prospects.length; orig.call(this, { dataset: {} }); if (S.prospects.length === n0) return;
    const nw = S.prospects.pop(); const c = S.prospects.find((x) => x.id === id); if (!c) return;
    renameRefs(c.name, nw.name);
    const { id: _i, created: _c, ...rest } = nw; Object.assign(c, rest);
    S.d.edit.prospect = null; S.d.prospect = newProspect(); toast('Prospect updated'); go('#/prospects/' + id);
  },
  saveReq: (orig) => function () {
    const id = S.d.edit.req; if (!id) return orig.apply(this, arguments);
    const n0 = S.reqs.length; orig.apply(this, arguments); if (S.reqs.length === n0) return;
    const nw = S.reqs.pop(); const r = S.reqs.find((x) => x.id === id); if (!r) return;
    const { id: _i, status: _s, ...rest } = nw; Object.assign(r, rest);
    S.d.edit.req = null; S.tab.matchReq = id; S.toast = 'Requirement updated'; go('#/requirements/' + id);
  },
  saveVisit: (orig) => function () {
    const id = S.d.edit.visit; if (!id) return orig.apply(this, arguments);
    const n0 = S.visits.length; orig.apply(this, arguments); if (S.visits.length === n0) return;
    const added = S.visits.splice(n0); const first = added.shift(); const v = S.visits.find((x) => x.id === id); if (!v) return;
    // extra properties ticked while editing become new visits with fresh ids
    let n = Math.max(...S.visits.map((x) => Number(x.id.slice(4)) || 0)); added.forEach((x) => { x.id = 'VIS-' + (++n); S.visits.push(x); });
    const changed = v.date !== first.date || v.time !== first.time;
    Object.assign(v, { cid: first.cid, prop: first.prop, date: first.date, time: first.time, dur: first.dur, notes: first.notes, mode: first.mode });
    syncWhen(v); (v.log = v.log || []).push(changed ? 'Visit edited — moved to ' + v.when : 'Visit details edited');
    S.d.edit.visit = null; toast('Visit updated' + (added.length ? ' · ' + nOf(added.length, 'more visit') + ' added' : '')); go('#/visits/' + id);
  },
  saveFu: (orig) => function () {
    const id = S.d.edit.fu; if (!id) return orig.apply(this, arguments);
    const keep = S.d.fu.when === 'keep'; const n0 = S.fus.length; orig.apply(this, arguments); if (S.fus.length === n0) return;
    const nw = S.fus.shift(); const f = S.fus.find((x) => x.id === id); if (!f) return;
    Object.assign(f, { who: nw.who, kind: nw.kind, note: nw.note, p: nw.p, pri: S.d.fu.pri }); if (!keep) Object.assign(f, { due: nw.due, when: nw.when });
    S.d.edit.fu = null; S.d.fu = newFu(); toast('Follow-up updated'); go('#/followups');
  },
};

// Delete a record (after usesOf() said it is free) and tidy up what belonged only to it.
function deleteRecord(k, id) {
  const R = REC[k]; const key = R.key || 'id'; const arr = R.list(); const i = arr.findIndex((x) => String(x[key]) === String(id)); if (i < 0) return;
  arr.splice(i, 1);
  if (R.scope) delete S.files[R.scope + ':' + id]; // its own documents
  if (k === 'deal') { const bi = S.brok.findIndex((b) => b.deal === id); if (bi >= 0) S.brok.splice(bi, 1); delete S.files['brok:' + id]; }
  if (k === 'property' || k === 'req') S.alerts = (S.alerts || []).filter((a) => a.prop !== id && a.req !== id); // match alerts
  if (k === 'lead') S.alerts = (S.alerts || []).filter((a) => a.req !== 'LEAD-' + id); // a deleted lead must not keep a "fits <lead>" match alert
  if (k === 'req' && S.tab.matchReq === id) S.tab.matchReq = '';
}

Object.assign(ACTS, {
  // ✎ on a list row
  rowEdit(el, e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const k = el.dataset.k; const id = el.dataset.id; const r = recOf(k, id); if (!r) return;
    if (!canW(REC[k].mod)) { toast('You have read-only access to ' + REC[k].mod + '.'); return; }
    if (k === 'project') return ACTS.editProject({ dataset: { id } });
    if (k === 'property') return ACTS.editProperty({ dataset: { id } });
    if (k === 'deal') return go('#/deals/' + id);
    if (k === 'brok') return go('#/brokerage/' + r.deal);
    clearModalEdits(); S.d.edit[k] = id; S.newMenuOpen = false; S.err = {};
    EDIT_LOAD[k](r); render();
  },
  // 🗑 on a list row: blocked dialog if the record is in use, otherwise a confirmation dialog
  rowDel(el, e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const k = el.dataset.k; const id = el.dataset.id; if (!recOf(k, id)) return;
    if (!canW(REC[k].mod)) { toast('You have read-only access to ' + REC[k].mod + '.'); return; }
    const uses = usesOf(k, id);
    S.modal = uses.length ? { t: 'delBlocked', k, id, uses } : { t: 'delAsk', k, id }; render();
  },
  // "Delete" inside the confirmation dialog
  rowDelDo(el) {
    const k = el.dataset.k; const id = el.dataset.id; const r = recOf(k, id); if (!r) { S.modal = null; render(); return; }
    const uses = usesOf(k, id); if (uses.length) { S.modal = { t: 'delBlocked', k, id, uses }; render(); return; } // became linked meanwhile
    const nm = REC[k].name(r); deleteRecord(k, id); S.modal = null;
    toast(REC[k].label[0].toUpperCase() + REC[k].label.slice(1) + ' deleted · ' + nm);
    // if we are on that record's own page, go back to the list
    if (location.pathname.split('/').map(decodeURIComponent).includes(String(id))) go(REC[k].back); else render();
  },
});
// Wrap the save actions so they understand edit mode.
Object.keys(SAVE_MERGE).forEach((a) => { ACTS[a] = SAVE_MERGE[a](ACTS[a]); });
// Opening an "add" dialog the normal way (+ New, Add lead …) must never continue an unfinished edit.
ACTS.openModal = (function (orig) { return function (el, e) { const m = el && el.dataset && el.dataset.m; if (m && S.d.edit[m]) { S.d.edit[m] = null; if (m === 'lead') S.d.lead = newLead(); if (m === 'prospect') S.d.prospect = newProspect(); if (m === 'fu') S.d.fu = newFu(); if (m === 'visit') S.d.visit = newVisit(); } return orig(el, e); }; })(ACTS.openModal);
ACTS.newReq = (function (orig) { return function (el) { S.d.edit.req = null; return orig(el); }; })(ACTS.newReq);

// Dialogs: "Can't delete", "Delete?", and edit-mode titles for the add dialogs.
const _modalExtra60 = modalExtra;
modalExtra = function (m, wrap, cancel, D) {
  // Deletion is blocked because other records depend on this one.
  if (m.t === 'delBlocked') {
    const R = REC[m.k]; const r = recOf(m.k, m.id);
    return wrap('This ' + R.label + ' can’t be deleted', `<div class="note" style="background:var(--err-soft);border-color:var(--err);color:var(--err)">${ico('info', 18)}<div><b>${esc(r ? R.name(r) : m.id)}</b> is still used elsewhere in the CRM, so deleting it would break those records.</div></div><div class="fld"><span class="l">Where it is used</span><ul style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px">${m.uses.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div><div class="sub" style="font-size:13px">${m.k === 'brok' ? 'Delete the deal instead (only possible while no payment has been recorded).' : m.k === 'deal' ? 'Closed deals and deals with brokerage payments are kept for your records. If the deal fell through, mark it as Lost instead.' : 'Remove or reassign these first, then try again.' + (m.k === 'property' ? ' To take a listing off the market without deleting it, change its status (e.g. On hold).' : '')}</div>`, btn('OK', { a: 'data-act="closeModal"' }));
  }
  // Ask the user to confirm the deletion.
  if (m.t === 'delAsk') {
    const R = REC[m.k]; const r = recOf(m.k, m.id); if (!r) return '';
    const nDocs = R.scope ? (S.files[R.scope + ':' + m.id] || []).length + (m.k === 'deal' ? (S.files['brok:' + m.id] || []).length : 0) : 0;
    const extra = m.k === 'deal' && S.brok.some((b) => b.deal === m.id) ? ' Its (empty) brokerage record is removed too.' : '';
    return wrap('Delete this ' + R.label + '?', `<div class="note" style="background:var(--warn-soft);border-color:var(--warn-line);color:var(--warn)">${ico('info', 18)}<div><b>${esc(R.name(r))}</b> will be permanently deleted.${nDocs ? ' ' + nOf(nDocs, 'attached document is', 'attached documents are') + ' deleted with it.' : ''}${extra} This can’t be undone.</div></div><div class="sub" style="font-size:13px">It isn’t linked to any other record, so nothing else is affected.</div>`, cancel + btn('Delete', { k: 'danger', a: `data-act="rowDelDo" data-k="${m.k}" data-id="${esc(m.id)}"` }));
  }
  let html = _modalExtra60(m, wrap, cancel, D);
  // Edit mode: same form, but titled "Edit …" and (for follow-ups) showing the current due time.
  const ek = { lead: 'lead', prospect: 'prospect', visit: 'visit', fu: 'fu' }[m.t];
  // Re-open the form for the record being edited.
  if (html && ek && S.d.edit[ek]) {
    const T = { lead: ['Add lead', 'Edit lead'], prospect: ['Add prospect', 'Edit prospect'], visit: ['Schedule visit', 'Edit visit'], fu: ['Add follow-up', 'Edit follow-up'] }[ek];
    html = html.split('aria-label="' + T[0] + '"').join('aria-label="' + T[1] + '"').split('<div class="mh">' + T[0] + '</div>').join('<div class="mh">' + T[1] + '</div>');
    if (ek === 'prospect') html = html.replace(/<button[^>]*data-act="saveProspect" data-(req|prop)="1"[^>]*>.*?<\/button>/g, '');
    if (ek === 'visit') html = html.replace('>Confirm<', '>Save changes<');
    if (ek === 'fu') { const f = S.fus.find((x) => x.id === S.d.edit.fu); if (f && D.fu.when === 'keep') html = html.replace('<div class="mb">', `<div class="mb"><div class="note">${ico('clock', 18)}<div>Currently due: <b>${esc(f.when)}</b>. Pick a new time below only if it changes.</div></div>`); }
  }
  return html;
};

// Requirement form: "Edit requirement" title in edit mode.
const _reqForm60 = reqForm;
reqForm = function () { const h = _reqForm60(); return S.d.edit.req ? h.replace('Add requirement', 'Edit requirement').replace('>Save requirement<', '>Save changes<') : h; };

// Leaving an edit (closing the dialog / leaving the form) drops edit mode, so the next "Add …" really adds.
const _render60 = render;
render = function () {
  if (!S.modal) clearModalEdits();
  if (S.d.edit.req) { const R = parse(); if (!(R.a === 'requirements' && R.b === 'new')) S.d.edit.req = null; }
  return _render60();
};

/* ------------------------------------------------------------ team, roles & my account (screens added in the screen review) */
/* Team page: members (add / edit / set password / deactivate / remove) and the role-permission matrix.
 * My account page: your details and "change password". Both save through the same /sync and /auth endpoints as the rest. */
const LV_LABEL = { none: 'No access', read: 'View', write: 'Edit' };
// Is the signed-in user the owner? (only the owner may change the permission matrix)
const isOwner = () => ME().role === 'Owner';
// '+91 98765 43210' -> '98765 43210' (the form shows the +91 prefix itself); '+91 —' -> ''
const phoneIn = (v) => { const x = String(v || '').replace(/^\+91\s*/, '').trim(); return x === '—' || x === '-' ? '' : x; };
// Typed digits -> stored text. A masked value that was not touched keeps what is already stored.
const phoneOut = (orig, typed) => { const x = String(typed || '').trim(); if (!x) return '+91 —'; return x.includes('•') ? orig : '+91 ' + x; };
// Status badge for team members (Inactive/Disabled are shown as Deactivated).
const memberBadge = (st) => badge(st === 'Disabled' || st === 'Inactive' ? 'Deactivated' : st, st === 'Active' ? 'ok' : st === 'Invited' ? 'warn' : 'err');

// Team: members table + roles & permissions.
function teamView() {
  const adm = canW('team'); const own = isOwner(); const meName = ME().name;
  const members = S.team.filter((t) => !(S.q.team || '').trim() || kw(hay(t), S.q.team)).map((t) => {
    const isO = t.role === 'Owner'; const locked = isO && !own; const off = t.status === 'Disabled' || t.status === 'Inactive'; const n = esc(t.name);
    const contact = [t.email, t.phone && phoneIn(t.phone) ? t.phone : ''].filter(Boolean).map(esc).join(' · ') || '—';
    const acts = adm && !locked ? [
      btn('Edit', { k: 'ghost sm', a: `data-act="editMember" data-n="${n}"` }),
      btn(t.status === 'Invited' || !t.email ? 'Set password' : 'Reset password', { k: 'ghost sm', a: `data-act="setPw" data-n="${n}"` }),
      !isO && t.name !== meName ? btn(off ? 'Activate' : 'Deactivate', { k: 'ghost sm', a: `data-act="memberStatus" data-n="${n}"` }) : '',
      !isO && t.name !== meName ? btn('Remove', { k: 'ghost sm', a: `data-act="removeMember" data-n="${n}"` }) : '',
    ].join('') : '<span class="sub">—</span>';
    return `<tr><td><b>${n}</b>${t.name === meName ? ' <span class="sub">(you)</span>' : ''}${t.area ? `<div class="sub" style="font-size:12px">Covers ${esc(t.area)}</div>` : ''}</td><td>${esc(t.role)}</td><td>${contact}</td>
      <td>${isO ? '<span class="sub">Always</span>' : adm ? chk(!!t.seeNumbers, 'Full numbers', `data-act="seeNum" data-n="${n}"`) : (t.seeNumbers ? 'Full numbers' : 'Masked')}</td>
      <td>${memberBadge(t.status)}</td><td class="sub">${t.last ? esc(fmtStamp(t.last)) : 'Never'}</td><td><div class="head" style="gap:6px;flex-wrap:wrap">${acts}</div></td></tr>`;
  }).join('');
  const roleHead = ROLES.map((r) => `<th>${esc(r)}</th>`).join('');
  const modRows = S.perms.mods.map(([m, label]) => `<tr><td><b>${esc(label)}</b></td>${ROLES.map((r, c) => {
    const v = (S.perms.lv[m] || [])[c] || 'none';
    return `<td>${own ? `<div class="seg">${['none', 'read', 'write'].map((x) => `<button type="button" class="${v === x ? 'on' : ''}" data-act="permLv" data-m="${m}" data-c="${c}" data-v="${x}">${LV_LABEL[x]}</button>`).join('')}</div>` : badge(LV_LABEL[v], v === 'write' ? 'ok' : v === 'read' ? 'warn' : '')}</td>`;
  }).join('')}</tr>`).join('');
  const actRows = S.perms.act.map(([k, label, flags]) => `<tr><td><b>${esc(label)}</b></td>${ROLES.map((r, c) => `<td>${own ? chk(!!flags[c], '', `data-act="permAct" data-k="${k}" data-c="${c}" aria-label="${esc(label + ' — ' + r)}"`) : (flags[c] ? badge('Allowed', 'ok') : badge('Not allowed'))}</td>`).join('')}</tr>`).join('');
  const act = adm ? btn('Add member', { i: 'plus', a: 'data-act="addMember"' }) : '';
  return page('Team', S.team.length + ' member' + (S.team.length === 1 ? '' : 's') + ' · who can sign in and what they can do', act,
    `<div class="stack">${card(`<h2>Members</h2><div class="scroll-x"><table class="tbl"><thead><tr><th>Name</th><th>Role</th><th>Contact</th><th>Phone numbers</th><th>Status</th><th>Last sign-in</th><th>Actions</th></tr></thead><tbody>${members}</tbody></table></div>
      <div class="sub" style="font-size:12px">New members sign in with their email and the password you set. “Deactivate” blocks sign-in but keeps their records; “Remove” deletes the sign-in. “Full numbers” lets that person see unmasked phone numbers.</div>`, 'flush')}
    ${card(`<div class="head"><h2>Roles &amp; permissions</h2><div class="grow"></div>${own ? '' : badge('View only')}</div><div class="sub" style="font-size:12px">The owner always has full access. ${own ? 'Changes save automatically and apply to each person the next time they load the CRM.' : 'Only the owner can change these settings.'}</div>
      <div class="scroll-x"><table class="tbl"><thead><tr><th>Module</th>${roleHead}</tr></thead><tbody>${modRows}</tbody></table></div>`, 'flush')}
    ${card(`<h2>Special permissions</h2><div class="scroll-x"><table class="tbl"><thead><tr><th>Permission</th>${roleHead}</tr></thead><tbody>${actRows}</tbody></table></div>`, 'flush')}
    ${card(`<h2>Recent activity</h2><div class="list" style="margin:0 calc(var(--pad)*-1) calc(var(--pad)*-1)">${(S.audit || []).map((a) => `<div class="li"><div class="grow">${auditLine(a)}</div><span class="sub">${esc(fmtStamp(a.at))}</span></div>`).join('') || '<div class="li sub">Nothing recorded yet. Team changes, password resets and export decisions appear here.</div>'}</div>`)}</div>`);
}
// One readable sentence for an audit-log entry (everything escaped).
function auditLine(a) {
  const w = esc(a.actor), t = esc(a.target), d = a.detail || {};
  // Pick the action by its type.
  switch (a.action) {
    case 'team.create': return `<b>${w}</b> added <b>${t}</b>${d.role ? ' as ' + esc(d.role) : ''}`;
    case 'team.update': return `<b>${w}</b> edited <b>${t}</b>${d.changed && d.changed.length ? ' <span class="sub">(' + d.changed.map(esc).join(', ') + ')</span>' : ''}`;
    case 'team.status': return `<b>${w}</b> ${d.to === 'Disabled' ? 'deactivated' : 'activated'} <b>${t}</b>`;
    case 'team.remove': return `<b>${w}</b> removed <b>${t}</b>`;
    case 'team.password.reset': return `<b>${w}</b> set a new password for <b>${t}</b>`;
    case 'account.password.change': return `<b>${w}</b> changed their own password`;
    case 'export.request': return `<b>${w}</b> requested a ${esc(d.kind || '')} export${d.rows != null ? ' (' + d.rows + ' rows)' : ''}`;
    case 'export.decide': return `<b>${w}</b> ${esc(String(d.status || 'decided').toLowerCase())} <b>${esc(d.requestedBy || '')}</b>'s ${esc(d.kind || '')} export`;
    default: return `<b>${w}</b> · ${esc(a.action)} ${t}`;
  }
}


// My account: details + change password.
function accountView() {
  const me = ME(); if (!S.d.pw) S.d.pw = { cur: '', next: '', again: '' };
  return page('My account', 'Your sign-in details', '',
    `<div class="grid2"><div class="stack">${card(`<h2>Profile</h2>${kv([['Name', esc(me.name)], ['Role', esc(me.role)], ['Email', esc(me.email || '—')], ['Mobile', esc(me.phone || '—')]])}<div class="sub" style="font-size:12px">To change your name, role or contact details, ask the owner or an Admin (Team page).</div>`)}</div>
    <div class="stack">${card(`<h2>Change password</h2>${fld('Current password', 'd.pw.cur', { type: 'password' })}${fld('New password', 'd.pw.next', { type: 'password', hint: 'At least 8 characters' })}${fld('Confirm new password', 'd.pw.again', { type: 'password' })}<div>${btn('Update password', { a: 'data-act="doChangePw"' })}</div>`)}
    ${card(`<h2>Session</h2><div class="sub">Sign out on this device.</div><div>${btn('Sign out', { k: 'sec', a: 'data-act="logout"' })}</div>`)}</div></div>`);
}

Object.assign(ACTS, {
  // Open the add-member dialog with empty fields.
  addMember() { S.d.invite = { name: '', email: '', phone: '', corp: '', alt: '', role: 'Agent', area: '' }; S.err = {}; S.modal = { t: 'invite' }; render(); },
  // Open the edit-member dialog.
  editMember(el) { const t = S.team.find((x) => x.name === el.dataset.n); if (!t) return; S.d.mem = { email: t.email || '', role: t.role, phone: phoneIn(t.phone), corp: phoneIn(t.corp), alt: phoneIn(t.alt), area: t.area || '' }; S.err = {}; S.modal = { t: 'member', n: t.name }; render(); },
  // Save the member form: validated here, then sent through the Team API.
  doMember() {
    const t = S.team.find((x) => x.name === S.modal.n); const d = S.d.mem; const e = {};
    if (d.email && !/^\S+@\S+\.\S+$/.test(d.email.trim())) e['d.mem.email'] = 'Enter a valid email.';
    if (d.role === 'Field staff' && !String(d.area || '').trim()) e['d.mem.area'] = 'Add the areas this person covers.';
    if (Object.keys(e).length) { fail(e); return; }
    if (t.role !== 'Owner') t.role = d.role;
    Object.assign(t, { email: d.email.trim(), phone: phoneOut(t.phone, d.phone), corp: phoneOut(t.corp, d.corp), alt: d.alt ? phoneOut(t.alt, d.alt) : '', area: t.role === 'Field staff' ? d.area.trim() : '' });
    S.modal = null; S.err = {}; toast('Saved ' + t.name); },
  // Open the set / reset password dialog.
  setPw(el) { const t = S.team.find((x) => x.name === el.dataset.n); if (!t) return; S.d.spw = { email: t.email || '', next: '', again: '' }; S.err = {}; S.modal = { t: 'setpw', n: t.name }; render(); },
  // Set a member's password: validated here, saved through the Team API (an Invited member becomes Active).
  async doSetPw() {
    const t = S.team.find((x) => x.name === S.modal.n); const d = S.d.spw; const e = {};
    if (!/^\S+@\S+\.\S+$/.test(String(d.email || '').trim())) e['d.spw.email'] = 'Enter the email they will sign in with.';
    if (!d.next || d.next.length < 8) e['d.spw.next'] = 'Use at least 8 characters.';
    if (d.again !== d.next) e['d.spw.again'] = 'The two passwords do not match.';
    if (Object.keys(e).length) { fail(e); return; }
    try {
      await ADAPTER.api('/team/' + encodeURIComponent(t.name) + '/password', { method: 'POST', body: { password: d.next, email: d.email.trim() } });
      t.email = d.email.trim().toLowerCase(); if (t.status === 'Invited') t.status = 'Active'; S.modal = null; S.err = {}; render(); toast('Password set — ' + t.name + ' can sign in now.');
    } catch (x) { fail({ 'd.spw.next': x && x.message ? x.message : 'Could not set the password. Wait a moment and try again.' }); }
  },
  // Ask before removing a member.
  removeMember(el) { S.modal = { t: 'rmmember', n: el.dataset.n }; render(); },
  doRmMember() { const n = S.modal.n; const t = S.team.find((x) => x.name === n); if (!t || t.role === 'Owner' || n === ME().name) { S.modal = null; render(); return; } S.team = S.team.filter((x) => x.name !== n); S.modal = null; toast(n + ' removed'); },
  // Settings: staff exports need approval.
  exportApprovalTog() { S.org.exportApproval = !S.org.exportApproval; render(); },
  // My account: change my own password.
  async doChangePw() {
    const p = S.d.pw; const e = {};
    if (!p.cur) e['d.pw.cur'] = 'Enter your current password.';
    if (!p.next || p.next.length < 8) e['d.pw.next'] = 'Use at least 8 characters.'; else if (p.next === p.cur) e['d.pw.next'] = 'Choose a password different from the current one.';
    if (p.again !== p.next) e['d.pw.again'] = 'The two passwords do not match.';
    if (Object.keys(e).length) { fail(e); return; }
    try { await ADAPTER.api('/auth/password', { method: 'POST', body: { current: p.cur, next: p.next } }); S.d.pw = { cur: '', next: '', again: '' }; S.err = {}; render(); toast('Password updated.'); }
    catch (x) { fail({ 'd.pw.cur': x && x.message ? x.message : 'Could not update the password.' }); }
  },
});
// After adding a member, go straight to "set password" (the system does not e-mail invites).
const _doInviteTeam = ACTS.doInvite;
ACTS.doInvite = function (el, e) {
  const before = S.team.length; _doInviteTeam.call(this, el, e);
  if (S.team.length > before) { const t = S.team[S.team.length - 1]; S.d.spw = { email: t.email || '', next: '', again: '' }; S.err = {}; S.modal = { t: 'setpw', n: t.name, fresh: 1 }; render(); }
};
// Dialogs for the team screens + a notifications list built from real data.
const _modalExtraTeam = modalExtra;
modalExtra = function (m, wrap, cancel, D) {
  // Pick the modal body by its type.
  switch (m.t) {
    case 'member': {
      const t = S.team.find((x) => x.name === m.n); if (!t) return null; const d = D.mem;
      return wrap('Edit ' + esc(t.name), `<div class="row">${fld('Email', 'd.mem.email')}${t.role === 'Owner' ? fld('Role', 'd.mem.role', { opts: ['Owner'] }) : fld('Role', 'd.mem.role', { opts: ROLES, rer: 1 })}</div><div class="row">${fld('Mobile', 'd.mem.phone', { pre: '+91' })}${fld('Corporate number', 'd.mem.corp', { pre: '+91' })}</div>${fld('Alternative number', 'd.mem.alt', { pre: '+91', hint: 'Numbers you cannot see are shown masked — leave them as they are to keep them.' })}${d.role === 'Field staff' ? fld('Areas covered', 'd.mem.area', { req: 1, ph: 'e.g. Salt Lake, New Town' }) : ''}`, cancel + btn('Save', { a: 'data-act="doMember"' }));
    }
    case 'setpw': {
      const t = S.team.find((x) => x.name === m.n); if (!t) return null;
      return wrap((m.fresh ? 'Set a password for ' : 'Password for ') + esc(t.name), `<div class="sub">${m.fresh ? esc(t.name) + ' is added. ' : ''}They sign in with this email and password. Share the password privately; they can change it under My account.</div>${fld('Sign-in email', 'd.spw.email', { req: 1 })}${fld('New password', 'd.spw.next', { type: 'password', req: 1, hint: 'At least 8 characters' })}${fld('Confirm password', 'd.spw.again', { type: 'password' })}`, (m.fresh ? btn('Later', { k: 'sec', a: 'data-act="closeModal"' }) : cancel) + btn('Save password', { a: 'data-act="doSetPw"' }));
    }
    case 'rmmember':
      return wrap('Remove ' + esc(m.n) + '?', `<div class="note" style="background:var(--err-soft);border-color:var(--err);color:var(--err)">${ico('info', 18)}<div>Their sign-in is deleted and cannot be undone. Records they created stay in the CRM.</div></div><div class="sub">To stop access but keep them on the team, use Deactivate instead.</div>`, cancel + btn('Remove', { k: 'danger', a: 'data-act="doRmMember"' }));
    case 'notif': {
      const td = iso(today); const tm = iso(addDays(today, 1)); const it = [];
      S.leads.filter((l) => l.stage === 'Lead').slice(0, 3).forEach((l) => it.push(['New lead · ' + l.name, l.source || '', '#/leads/' + l.id]));
      S.alerts.filter((a) => !a.seen).slice(0, 3).forEach((a) => it.push(['New property match', a.prop + ' fits ' + a.req, '#/matches']));
      S.visits.filter((v) => (v.date === td || v.date === tm) && !['Cancelled', 'Completed'].includes(v.status)).slice(0, 4).forEach((v) => it.push(['Visit ' + (v.date === td ? 'today' : 'tomorrow'), v.id + ' · ' + fmt12(v.time), '#/visits/' + v.id]));
      { const n = S.fus.filter((f) => !f.done && f.due === 'today').length; if (n) it.push(['Follow-ups due today', n + ' open', '#/followups']); }
      if (canA('approveExports')) { const n = S.exportReq.filter((r) => r.status === 'Pending').length; if (n) it.push(['Export requests waiting', n + ' to review', '#/export']); }
      if (canA('masters')) { const n = S.mreq.filter((r) => r.status === 'Pending').length; if (n) it.push(['Change requests waiting', n + ' for the masters lists', '#/masters']); }
      return wrap('Notifications', `<div class="list" style="margin:-20px">${it.map((n) => `<a class="li" href="${n[2]}" data-act="closeModal"><div class="grow"><b>${esc(n[0])}</b><div class="sub">${esc(n[1])}</div></div></a>`).join('') || '<div class="li sub">You are all caught up.</div>'}</div>`, btn('Notification settings', { k: 'ghost', href: '#/settings', a: 'data-act="closeModal"' }) + btn('Close', { k: 'sec', a: 'data-act="closeModal"' }), 480);
    }
  }
  return _modalExtraTeam(m, wrap, cancel, D);
};

/* ------------------------------------------------------------ send matches to a client (WhatsApp) */
// Phone is a mobile browser? Then wa.me opens the WhatsApp app directly and the 'send via' choice is hidden.
const IS_MOBILE_UA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
// Who a requirement belongs to, with the number to message (WhatsApp number if different from the phone).
function sendTarget(r: Rec) {
  const p: Rec | undefined = r.lead ? S.leads.find((l) => l.id === r.lead) : prosById(r.cid); if (!p) return null;
  const num = p.waSame === false && p.wa ? p.wa : p.phone;
  return { p, name: p.name as string, num: String(num || ''), notWa: p.waOk === false, isLead: !!r.lead, email: String(p.email || '') };
}
// Digits for a wa.me / whatsapp:// link: country code + number. Empty when the number is hidden or too short.
function waDigits(num: string) { if (num.includes('•')) return ''; const d = num.replace(/\D/g, ''); return d.length === 10 ? '91' + d : d.length >= 11 ? d : ''; }
// Budget range of a requirement as text (lakhs/crores for sale, monthly for rent).
const sendBudget = (r: Rec) => (r.purpose === 'sale' ? fmtL(r.min) + '–' + fmtL(r.max) : fmtRent(r.min) + '–' + fmtRent(r.max));
// Properties picked in the Send modal (all ticked unless unticked).
const sendPicked = (m: Rec) => String(m.ids || '').split(',').filter(Boolean).filter((id) => S.d.send.sel[id] !== false);
// Shareable documents of the picked properties that are ticked.
const sendDocs = (m: Rec) => sendPicked(m).flatMap((pid) => filesOf('prop:' + pid).filter((f: Rec) => f.share && S.d.shareSel[f.id] !== false));
// What the browser sends to POST /api/share/matches: ids only. The server reads the properties, client and files from the database.
function shareBody(m: Rec, r: Rec, t: Rec, channel: string) {
  return { channel, prospectId: t.isLead ? undefined : t.p.id, leadId: t.isLead ? t.p.id : undefined, requirementId: t.isLead ? undefined : r.id, propertyIds: sendPicked(m),
    documentIds: sendDocs(m).map((f: Rec) => f.id), note: String(S.d.send.note || '').trim() || undefined, subject: channel === 'email' ? String(S.d.send.subject || '').trim() || undefined : undefined, origin: location.origin };
}
// The 'Send to client' dialog: pick properties, check the message, send by WhatsApp, then confirm it was sent.
function sendModal(m: Rec, wrap: (...a: any[]) => string, cancel: string) {
  const r = pendingReqs().find((x) => x.id === m.req); const t = r && sendTarget(r);
  if (!r || !t) return wrap('Send to client', '<div class="sub">This requirement is no longer available.</div>', cancel);
  const D = S.d.send; const ids = String(m.ids || '').split(',').filter(Boolean); const picked = sendPicked(m);
  if (m.step === 'ready') {
    const nd = sendDocs(m).length;
    return wrap('WhatsApp message ready', `<div class="note ok">${ico('chat', 18)}<div>The message for <b>${esc(t.name)}</b> has a link to the PDF${nd ? ' and ' + nd + ' document link' + (nd === 1 ? '' : 's') : ''}. Press <b>Open WhatsApp</b>, then <b>Send</b> there.</div></div>
      <div class="card" style="background:var(--bg)"><div class="sub" style="font-size:12px;white-space:pre-wrap;word-break:break-all">${esc(D.msg)}</div></div>`,
    btn('Back', { k: 'sec', a: 'data-act="sendBack"' }) + btn('Copy message', { k: 'ghost', a: 'data-act="sendCopy"' }) + btn('Open WhatsApp', { i: 'chat', a: 'data-act="sendOpenGo"' }), 560);
  }
  if (m.step === 'confirm') {
    return wrap('Did you send it?', `<div class="note ok">${ico('chat', 18)}<div>WhatsApp should have opened for <b>${esc(t.name)}</b> with the message ready. Press <b>Send</b> there, then come back and confirm.</div></div>
      <div class="sub" style="font-size:12px">The PDF and the documents are inside the message as links (valid for 7 days). We log this in ${esc(t.name)}’s timeline only after you confirm.</div>`,
    btn('Not yet', { k: 'sec', a: 'data-act="sendBack"' }) + btn('Copy message', { k: 'ghost', a: 'data-act="sendCopy"' }) + btn('Open again', { k: 'ghost', i: 'chat', a: 'data-act="sendOpen"' }) + btn('Yes, I sent it', { i: 'check', a: 'data-act="sendDone"' }), 560);
  }
  const hidden = !canA('seeNumbers') || t.num.includes('•');
  // Email needs: the server set up, a saved email address on a prospect, and permission to see contact details.
  const mailWhy = S.mailOk === false ? 'Email is not set up yet (the admin adds the email settings in Railway).' : t.isLead ? 'Convert this lead to a prospect with an email address to email them.' : !t.email ? t.name + ' has no email address saved.' : !canA('seeNumbers') ? 'Your role cannot see contact details.' : '';
  const canMail = S.mailOk !== false && !mailWhy; const em = D.ch === 'email' && canMail;
  const subjDefault = picked.length + (picked.length === 1 ? ' home' : ' homes') + ' that match what you asked for';
  const introDefault = 'Based on what you told us (' + [reqSpec(r), r.locs.join(', '), sendBudget(r)].filter(Boolean).join(', ') + '), these are the best matches right now.';
  const props = ids.map((id) => { const p: Rec = propById(id); const ms = matchesFor(r).find((x) => x.p.id === id); if (!p) return ''; return chk(D.sel[id] !== false, `<b>${esc(p.title)}</b> <span class="sub">· ${esc(p.loc)} · ${fmtPrice(p)}</span>${ms ? ' ' + badge(ms.score + '%', 'ok') : ''}`, `data-act="sendPropTog" data-id="${id}"`); }).join('');
  const docs = ids.flatMap((pid) => filesOf('prop:' + pid).filter((f: Rec) => f.share).map((f: Rec) => ({ pid, f })));
  return wrap('Send to client', `
    <div class="head"><div class="av">${initials(t.name)}</div><div class="grow"><b>${esc(t.name)}</b> ${badge(t.isLead ? 'Lead' : 'Prospect')}<div class="sub">${esc(maskNum(t.num))}${t.email ? ' · ' + esc(t.email) : ''}</div></div></div>
    <div class="chips" style="margin:6px 0 2px">${[reqSpec(r), r.locs.join(', '), sendBudget(r)].filter(Boolean).map((x) => badge(x)).join('')}</div>
    ${t.notWa ? `<div class="note" style="background:var(--warn-soft);border-color:var(--warn-line);color:var(--warn)">${ico('info', 18)}<div>${esc(t.name)}’s number is flagged as <b>not on WhatsApp</b>. Update the number or send by email.</div></div>` : ''}
    ${hidden ? `<div class="note" style="background:var(--warn-soft);border-color:var(--warn-line);color:var(--warn)">${ico('info', 18)}<div>The number is hidden for your role. Reveal it from the client’s page or ask an admin before sending.</div></div>` : ''}
    <div class="fld"><span class="l">Properties to send (${picked.length} of ${ids.length})</span><div class="card" style="background:var(--bg);gap:2px">${props}</div></div>
    <div class="fld"><span class="l">Send by</span><div class="chips">${chip('WhatsApp', !em, 'data-act="setf" data-p="d.send.ch" data-v="wa"')}${chip('Email', em, canMail ? 'data-act="setf" data-p="d.send.ch" data-v="email"' : `data-act="toast" data-t="${esc(mailWhy)}"`)}</div>${!canMail ? `<small>${esc(mailWhy)}</small>` : ''}</div>
    <div class="note ok">${ico('file', 18)}<div><b>One PDF of ${picked.length} propert${picked.length === 1 ? 'y' : 'ies'}</b>: price, size, amenities and why each one fits. ${em ? 'It is attached to the email together with the documents below.' : 'It goes as a link in the WhatsApp message (links work 7 days), together with the documents below.'}</div></div>
    ${em ? fld('Subject', 'd.send.subject', { ph: subjDefault }) : ''}${fld('Short note (optional)', 'd.send.note', { rows: 2, ph: 'e.g. Happy to arrange a visit this weekend', hint: em ? 'Shown at the top of the email.' : 'Added to the WhatsApp message.' })}${em ? `<div class="sub" style="font-size:12px">Goes to ${esc(t.email)}. Replies come to ${esc(S.me)}.</div>` : ''}
    ${docs.length ? `<div class="card" style="background:var(--bg);gap:2px"><b>Documents to send with the PDF</b><div class="sub" style="font-size:12px;margin-bottom:4px">${em ? 'Attached to the email.' : 'Sent as links in the message.'} Only files marked Shareable are listed.</div>${docs.map((x) => chk(S.d.shareSel[x.f.id] !== false, esc(x.f.name) + ' <span class="sub">· ' + x.pid + '</span>', `data-act="shareDocTog" data-id="${x.f.id}"`)).join('')}</div>` : ''}
    ${IS_MOBILE_UA || em ? '' : `<div class="fld"><span class="l">Open with</span>${chipSet('d.send.via', [['app', 'WhatsApp app'], ['web', 'WhatsApp Web'], ['copy', 'Copy message only']], D.via)}<small>The app opens if WhatsApp Desktop is installed; WhatsApp Web asks for a QR scan the first time.</small></div>`}`,
  cancel + (em ? btn(S.mailBusy ? 'Sending…' : 'Send email', { i: 'mail', a: 'data-act="sendMail"' + (!picked.length || S.mailBusy ? ' disabled' : '') }) : btn(S.mailBusy ? 'Preparing…' : D.via === 'copy' && !IS_MOBILE_UA ? 'Copy message' : 'Send on WhatsApp', { i: 'chat', a: 'data-act="sendGo"' + (!picked.length || t.notWa || S.mailBusy ? ' disabled' : '') })), 640);
}
// Chain the new dialog in front of the existing ones.
const _modalExtraSend = modalExtra;
modalExtra = function (m: Rec, wrap: (...a: any[]) => string, cancel: string, D: Rec) { return m.t === 'send' ? sendModal(m, wrap, cancel) : _modalExtraSend(m, wrap, cancel, D); };
// Link to open for the chosen route (phone browsers use wa.me; desktop picks app, Web or copy).
function waLink(to: string, text: string) {
  const q = encodeURIComponent(text);
  if (IS_MOBILE_UA) return 'https://wa.me/' + to + '?text=' + q;
  return S.d.send.via === 'web' ? 'https://web.whatsapp.com/send?phone=' + to + '&text=' + q : 'whatsapp://send?phone=' + to + '&text=' + q;
}
// Copy text to the clipboard (silently ignores browsers that refuse).
function copyText(txt: string) { try { navigator.clipboard.writeText(txt).catch(() => { }); } catch (e) { } }
Object.assign(ACTS, {
  // 'Send to client' on the Matches screen: needs ticked properties.
  shareSel() {
    const a: string[] = S.tab.matchSel || []; if (!a.length) { toast('Tick one or more properties first.'); return; }
    const r = pendingReqs().find((x) => x.id === S.tab.matchReq); if (!r) { toast('Choose a requirement first.'); return; }
    S.d.send = { sel: {}, via: 'app', ch: 'wa', msg: '', lastAuto: '', subject: '', intro: '', note: '' }; S.modal = { t: 'send', ids: a.join(','), req: r.id, step: 'compose' }; render();
    // Ask the server once whether email is set up, so the Email option can be enabled or explained.
    if (S.mailOk === undefined && ADAPTER.api) ADAPTER.api('/mail/status').then((x: Rec) => { S.mailOk = !!(x && x.configured); render(); }).catch(() => { S.mailOk = false; render(); });
  },
  // Tick / untick one property in the Send dialog.
  sendPropTog(el: Rec) { const id = el.dataset.id; S.d.send.sel[id] = S.d.send.sel[id] === false; render(); },
  // Throw away hand edits and rebuild the text.
  sendReset(el: Rec, ev: Rec) { if (ev && ev.preventDefault) ev.preventDefault(); S.d.send.msg = ''; render(); },
  // Open WhatsApp (or copy) with the message, then ask the broker to confirm.
  // Ask the server for the WhatsApp message (a link to the PDF + a link per document), then let the broker open WhatsApp.
  async sendGo() {
    const m = S.modal; const r = pendingReqs().find((x) => x.id === m.req); const t = r && sendTarget(r); if (!r || !t || S.mailBusy || !ADAPTER.api) return;
    if (!canA('seeNumbers')) { toast('Your role cannot see numbers, so it cannot send either.'); return; }
    const to = waDigits(t.num); if (!to) { toast('This number is hidden or incomplete. Reveal or fix it first.'); return; }
    if (t.notWa) { toast('This number is not on WhatsApp.'); return; }
    if (!sendPicked(m).length) { toast('Tick at least one property.'); return; }
    S.mailBusy = true; render();
    try {
      const x: Rec = await ADAPTER.api('/share/matches', { method: 'POST', body: shareBody(m, r, t, 'whatsapp') });
      S.d.send.msg = x.message; S.mailBusy = false;
      if (!IS_MOBILE_UA && S.d.send.via === 'copy') { copyText(x.message); S.modal = Object.assign({}, m, { step: 'confirm' }); render(); toast('Message copied. Paste it into the chat.'); return; }
      S.modal = Object.assign({}, m, { step: 'ready' }); render();
      if (x.skipped) toast(x.skipped + ' document' + (x.skipped === 1 ? ' has' : 's have') + ' no file uploaded and ' + (x.skipped === 1 ? 'was' : 'were') + ' left out.');
    } catch (e: any) { S.mailBusy = false; render(); toast((e && e.message) || 'Could not prepare the WhatsApp message.'); }
  },
  // Button in the 'message ready' step: open WhatsApp (a real click, so browsers allow it), then ask for the confirmation.
  sendOpenGo() { ACTS.sendOpen(); S.modal = Object.assign({}, S.modal, { step: 'confirm' }); render(); },
  // Do the opening itself (also used by 'Open again').
  sendOpen() {
    const m = S.modal; const r = pendingReqs().find((x) => x.id === m.req); const t = r && sendTarget(r); if (!r || !t) return;
    const to = waDigits(t.num); const txt = S.d.send.msg;
    if (!IS_MOBILE_UA && S.d.send.via === 'copy') { copyText(txt); toast('Message copied. Paste it into the chat.'); return; }
    copyText(txt);
    const url = waLink(to, txt); if (url.startsWith('whatsapp:')) window.location.href = url; else window.open(url, '_blank', 'noopener');
  },
  // Back from the confirm step to the message.
  sendBack() { S.modal = Object.assign({}, S.modal, { step: 'compose' }); render(); },
  // Copy the text again.
  sendCopy() { copyText(S.d.send.msg); toast('Message copied'); },
  // Send the PDF (and the ticked documents) by email through the server, then log it like a WhatsApp send.
  async sendMail() {
    const m = S.modal; const r = pendingReqs().find((x) => x.id === m.req); const t = r && sendTarget(r); if (!r || !t || t.isLead || S.mailBusy || !ADAPTER.api) return;
    const ids = sendPicked(m); if (!ids.length) { toast('Tick at least one property.'); return; }
    S.mailBusy = true; render();
    try {
      const x: Rec = await ADAPTER.api('/share/matches', { method: 'POST', body: shareBody(m, r, t, 'email') });
      const dn = Math.max(0, (x.documents || 0)); const note = 'Emailed a PDF of ' + ids.length + ' matched propert' + (ids.length === 1 ? 'y' : 'ies') + ' (' + ids.join(', ') + ')' + (dn ? ' + ' + dn + ' document' + (dn === 1 ? '' : 's') : '') + ' for ' + r.id;
      S.fus.unshift({ id: 'f' + Date.now(), who: t.name, kind: 'Email', note, due: '', when: dateTxt(iso(today)), done: true, p: r.purpose });
      S.mailBusy = false; S.tab.matchSel = []; S.modal = null; render();
      toast('Email sent to ' + t.name + ' with the PDF' + (dn ? ' and ' + dn + ' document' + (dn === 1 ? '' : 's') : '') + (x.linked ? ' (' + x.linked + ' as download link' + (x.linked === 1 ? '' : 's') + ')' : '') + (x.skipped ? '. ' + x.skipped + ' document' + (x.skipped === 1 ? ' has' : 's have') + ' no file uploaded and ' + (x.skipped === 1 ? 'was' : 'were') + ' not sent.' : ''));
    } catch (e: any) { S.mailBusy = false; render(); toast((e && e.message) || 'The email could not be sent.'); }
  },
  // 'Share' on a property page: really sends the PDF (and ticked documents) to the chosen prospect, by email or WhatsApp.
  async shareVia(el: Rec) {
    const ids = String((S.modal && S.modal.ids) || '').split(',').filter(Boolean); const c: Rec | undefined = prosById(S.d.shareTo); const v = el.dataset.v;
    if (!c) { toast('Choose a prospect first.'); return; } if (!ADAPTER.api || S.mailBusy) return;
    if (!canA('seeNumbers')) { toast('Your role cannot see numbers, so it cannot send either.'); return; }
    const docIds = ids.flatMap((pid) => filesOf('prop:' + pid).filter((f: Rec) => f.share && S.d.shareSel[f.id] !== false)).map((f: Rec) => f.id);
    const pu = (propById(ids[0]) || {}).purpose; S.mailBusy = true; render();
    try {
      const x: Rec = await ADAPTER.api('/share/matches', { method: 'POST', body: { channel: v === 'Email' ? 'email' : 'whatsapp', prospectId: c.id, propertyIds: ids, documentIds: docIds, origin: location.origin } });
      S.mailBusy = false; S.modal = null;
      const tail = ' of ' + ids.length + ' propert' + (ids.length === 1 ? 'y' : 'ies') + (docIds.length ? ' + ' + docIds.length + ' document' + (docIds.length === 1 ? '' : 's') : '');
      if (v === 'Email') { S.fus.unshift({ id: 'f' + Date.now(), who: c.name, kind: 'Email', note: 'Emailed a PDF' + tail, due: '', when: dateTxt(iso(today)), done: true, p: pu }); render(); toast('Email sent to ' + c.name + ' with the PDF' + (docIds.length ? ' and documents' : '')); return; }
      copyText(x.message); const to = waDigits(String(c.waSame === false && c.wa ? c.wa : c.phone)); const q = encodeURIComponent(x.message);
      S.fus.unshift({ id: 'f' + Date.now(), who: c.name, kind: 'WhatsApp', note: 'WhatsApp message with PDF link' + tail, due: '', when: dateTxt(iso(today)), done: true, p: pu }); render();
      if (!to) { toast('The number is hidden or incomplete. The message is copied: paste it into WhatsApp.'); return; }
      if (IS_MOBILE_UA) { const w = window.open('https://wa.me/' + to + '?text=' + q, '_blank', 'noopener'); if (!w) toast('Message copied. Allow pop-ups, or paste it into WhatsApp.'); else toast('WhatsApp opened for ' + c.name + '. Press Send there.'); }
      else { window.location.href = 'whatsapp://send?phone=' + to + '&text=' + q; toast('WhatsApp opened for ' + c.name + '. Press Send there. (The message is also copied.)'); }
    } catch (e: any) { S.mailBusy = false; render(); toast((e && e.message) || 'Could not send.'); }
  },
  // The broker confirmed they pressed Send: log it on the client's timeline.
  sendDone() {
    const m = S.modal; const r = pendingReqs().find((x) => x.id === m.req); const t = r && sendTarget(r); if (!r || !t) return;
    const ids = sendPicked(m); const note = 'Sent a PDF of ' + ids.length + ' matched propert' + (ids.length === 1 ? 'y' : 'ies') + ' (' + ids.join(', ') + ') for ' + r.id;
    if (t.isLead) t.p.act.unshift(['WhatsApp', note, dateTxt(iso(today))]);
    else S.fus.unshift({ id: 'f' + Date.now(), who: t.name, kind: 'WhatsApp', note, due: '', when: dateTxt(iso(today)), done: true, p: r.purpose });
    S.tab.matchSel = []; S.modal = null; toast('Logged: ' + note); render();
  },
});

if (location.hash && location.hash.startsWith('#/')) history.replaceState({}, '', location.hash.slice(1));
else if (location.pathname === '/' || location.pathname === '') history.replaceState({}, '', '/dashboard');
ADAPTER.attach && ADAPTER.attach({ toast, render });
render();


return () => { _off.forEach((f) => f()); clearTimeout(_saveT); try { host.innerHTML = ''; } catch (e) { } };
}
