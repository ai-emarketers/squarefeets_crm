// Helpers that hide phone numbers / emails from users who may not see them, and protect real numbers from
// being overwritten by masked copies that the browser sends back.

// Object keys whose values are phone numbers / emails (masked wherever they appear in a record).
const PHONE_KEYS = new Set(['phone', 'mobile', 'wa', 'alt', 'corp', 'corpPhone', 'altPhone']);
const EMAIL_KEYS = new Set(['email']);

// "+91 98630 34210" -> "+91 98••• ••210" (first 2 and last 3 digits stay visible).
export function maskPhone(s: any): any {
  if (typeof s !== 'string' || !s || s.includes('•')) return s; // not text, empty or already masked
  const d = s.replace(/\D/g, '');                                // digits only
  if (d.length < 8) return s;                                    // too short to be a phone number
  const cc = d.length > 10 ? '+' + d.slice(0, d.length - 10) + ' ' : ''; // country code, if present
  const n = d.slice(-10);                                        // the 10-digit national number
  return `${cc}${n.slice(0, 2)}••• ••${n.slice(-3)}`;
}
// "anil@sharma.in" -> "a•••@sharma.in"
export function maskEmail(s: any): any {
  if (typeof s !== 'string' || !s || s.includes('•') || !s.includes('@')) return s;
  const [u, d] = s.split('@');
  return `${u.slice(0, 1)}•••@${d}`;
}
/** Recursively mask phone / email values anywhere inside an object or array. Returns a new copy. */
export function deepMask<T>(v: T): T {
  if (Array.isArray(v)) return v.map((x) => deepMask(x)) as any;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const o: any = {};
    for (const k of Object.keys(v as any)) {
      const x = (v as any)[k];
      if (PHONE_KEYS.has(k)) o[k] = maskPhone(x);        // known phone field
      else if (EMAIL_KEYS.has(k)) o[k] = maskEmail(x);   // known email field
      else o[k] = deepMask(x);                           // anything else: look deeper
    }
    return o;
  }
  return v;
}
/**
 * Merge an incoming (client) value over the stored one, never letting a masked value ("98••• ••210")
 * overwrite the real number that is stored. Objects merge key-by-key, arrays are replaced
 * (masked elements fall back to the element at the same index).
 * replace = true (full document from the web app's sync): keys the client no longer sends are DROPPED,
 * so a field deleted in the UI stays deleted. replace = false (REST PATCH): keys not sent are kept.
 */
export function mergeKeepReal(existing: any, incoming: any, replace = false): any {
  // Text: keep the stored value if the client sent back a masked copy.
  if (typeof incoming === 'string') return incoming.includes('•') && existing !== undefined ? existing : incoming;
  // Arrays: replaced by the client's array, but masked entries are restored from the same position.
  if (Array.isArray(incoming)) {
    return incoming.map((x, i) => mergeKeepReal(Array.isArray(existing) ? existing[i] : undefined, x, replace));
  }
  // Objects: merge key by key. PATCH keeps keys the client did not send; a full replace drops them.
  if (incoming && typeof incoming === 'object') {
    const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
    const out: any = replace ? {} : { ...base };
    for (const k of Object.keys(incoming)) out[k] = mergeKeepReal(base[k], incoming[k], replace);
    return out;
  }
  return incoming; // numbers, booleans, null
}
