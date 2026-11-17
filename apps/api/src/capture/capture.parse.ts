// Pure helpers for screenshot capture: the prompt sent to the vision model, and the clean-up of its answer into the
// shapes the CRM's AI capture screen uses. No network or database here, so it is unit-tested in test/capture.test.ts.

/** One need ("looking to buy/rent") or offer ("has a property for sale/rent") found in a screenshot, as the model returns it. */
export interface RawItem {
  intent?: 'wants_to_buy' | 'wants_to_rent' | 'wants_to_sell' | 'wants_to_rent_out' | string; // what the sender wants (preferred)
  evidence?: string;                    // the words in the chat that show the intent
  type?: 'need' | 'offer' | string;     // need = they want a property, offer = they have one to sell or rent out
  deal?: 'sale' | 'rent' | string;
  category?: string;                    // Residential | Commercial | Land
  subType?: string;                     // e.g. Office space, Flat, Warehouse, Plot
  bhk?: number | string | null;
  areaValue?: number | string | null; areaUnit?: string | null;
  project?: string; unit?: string; locality?: string;
  budgetMin?: number | string | null;   // full rupees (rent: per month)
  budgetMax?: number | string | null;   // need: top of the budget; offer: asking price or rent
  summary?: string;
}
/** The model's full answer. */
export interface RawCapture { contactName?: string; phone?: string; items?: RawItem[]; transcript?: string; confidence?: number | string; warnings?: string[] }

/** One item in the exact shape the CRM capture preview edits (see parseCapture in crm-engine.ts). */
export interface CaptureItem {
  name: string; phone: string; intent: 'buy' | 'rent'; kind: 'Residential' | 'Commercial' | 'Land';
  bhk: string; area: string; loc: string; min: string; max: string; note: string; isProperty: boolean;
  sub: string; project: string; unit: string; evidence: string;
}
export interface CaptureResult { items: CaptureItem[]; transcript: string; confidence: number; warnings: string[]; contactName: string; phone: string }

export const PROMPT = `You read screenshots of WhatsApp chats for an Indian real-estate broker (Kolkata) and extract leads.
Return ONLY a JSON object, no other text, with this shape:
{
  "contactName": string,   // the other person's name from the chat header or saved contact. "" if not visible. Headers may be cut off with "..." - give what you can see
  "phone": string,         // a phone number ONLY if one is printed on screen, exactly as shown. Otherwise "". Never invent or complete digits
  "items": [ {
    "intent": "wants_to_buy" | "wants_to_rent" | "wants_to_sell" | "wants_to_rent_out",
    "evidence": string,         // the exact words from the chat that show this intent, at most 20 words
    "category": "Residential" | "Commercial" | "Land",
    "subType": string,          // e.g. "Flat", "Office space", "Retail shop", "Warehouse", "Plot", "Independent house" or ""
    "bhk": number | null,
    "areaValue": number | null, "areaUnit": "sqft" | "sqm" | "acre" | "katha" | "bigha" | null,
    "project": string,          // building or project name, e.g. "Ecospace Residencia", "Jiva Homes". "" if none
    "unit": string,             // tower, floor and unit details, e.g. "Tower A, 3rd floor, Apartment 0302". "" if none
    "locality": string,         // area or road, e.g. "New Town", "Minto Park", "Rajarhat Road"
    "budgetMin": number | null, // FULL rupees. 1.2 crore = 12000000, 50 lakh = 5000000. Rent is per month
    "budgetMax": number | null, // wants_to_buy / wants_to_rent: top of the budget. wants_to_sell / wants_to_rent_out: the asking price or asking rent
    "summary": string           // one short English sentence including every useful detail not captured above (furnishing, parking, tenant type, ROI, lease tenure, size notes)
  } ],
  "transcript": string,    // the visible chat text, oldest first, "Name: message". Skip images
  "confidence": number,    // 0 to 1: how sure you are that names, numbers and amounts are exactly right
  "warnings": [string]     // anything unclear, cut off or missing that a human should check
}

HOW TO DECIDE THE INTENT (this matters most):
- The sender HAS a property: the message advertises or lists a property, with a size, building or place, and often a price. Examples: "RENT - fully furnished office space 673 sq ft in Landmark Building", "SALE - Ecospace Residencia 3BHK 1476 sq ft", "Flat 5C, carpet 1640, approx price 3.20 cr", "Total 11 acres" with a location. A listing that starts with the word RENT is wants_to_rent_out. A listing that starts with the word SALE, or that quotes a price to buy, is wants_to_sell.
- The sender WANTS a property: they say they are looking for, need, want to purchase or take on rent, have a requirement or a budget or fund. Example: "I am looking to purchase any preleased commercial space... Fund can be 50 lakhs to 3 crore" is wants_to_buy.
- Never choose wants_to_buy or wants_to_rent for a message that is a listing. Never choose wants_to_sell or wants_to_rent_out for a message that asks for a property.
- If one message lists several properties, return one item per property, each with its own intent. Keep unit numbers exactly as written.
- Messages on the right in green are the broker's own replies. They are context only: never treat them as the contact's need or offer.

EXAMPLES
Chat: "1. RENT - fully furnished office space 673 sq ft in Landmark Building 8th floor, Minto Park Crossing, without car park. ONLY Corporates / MNC. 2. SALE - Ecospace Residencia, New Town, Tower A, 3rd floor 3BHK with 1CP - 1476 sq ft - Apartment No.0302."
Items: [ {"intent":"wants_to_rent_out","evidence":"RENT - fully furnished office space 673 sq ft","category":"Commercial","subType":"Office space","areaValue":673,"areaUnit":"sqft","project":"Landmark Building","unit":"8th floor","locality":"Minto Park Crossing","budgetMin":null,"budgetMax":null,"summary":"Fully furnished office, no car park, only corporates / MNC. Rent not stated."}, {"intent":"wants_to_sell","evidence":"SALE - Ecospace Residencia ... 3BHK","category":"Residential","subType":"Flat","bhk":3,"areaValue":1476,"areaUnit":"sqft","project":"Ecospace Residencia","unit":"Tower A, 3rd floor, Apartment 0302","locality":"New Town","budgetMin":null,"budgetMax":null,"summary":"3 BHK with 1 car park. Price not stated."} ]
Chat: "I am looking to purchase any preleased commercial space as ROI deal of 9% with atleast 6yr+ tenure left. Fund can be 50 lakhs to 3 crore any size"
Items: [ {"intent":"wants_to_buy","evidence":"I am looking to purchase any preleased commercial space","category":"Commercial","subType":"Pre-leased commercial space","budgetMin":5000000,"budgetMax":30000000,"summary":"Wants a pre-leased commercial space with 9% ROI and at least 6 years of lease left, any size."} ]

OTHER RULES
- Do not guess missing values: use "" or null and add a warning. Never make up a price, phone number or area.
- Forwarded messages, brochures and PDF attachments: use any text shown, and add a warning that attachments are not readable from a screenshot.
- Amounts: convert lakh, lac, crore, cr, k and thousand to full rupees. "Approx" prices are fine; mention "approx" in the summary.
- Areas: copy the number written and its unit. If both carpet and super built-up are given, use super built-up as areaValue and put the carpet figure in the summary. 1 acre is written as acre.
- If the screenshot has no leads at all, return an empty items array and say why in warnings.`;

const toNum = (v: any): number | null => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) && n > 0 ? n : null; };
const str = (v: any) => (v === null || v === undefined ? '' : String(v).trim());
/** Square feet in each unit the model may report. Katha and bigha use the West Bengal values (1 katha = 720 sq ft, 1 bigha = 14,400 sq ft). */
const SQFT: Record<string, number> = { sqft: 1, sqm: 10.7639, acre: 43560, katha: 720, bigha: 14400 };
/** Trims a number to at most 2 decimals without trailing zeros: 12.5, 320, 0.45. */
const fmt = (n: number) => String(+n.toFixed(2));

/** Indian mobile number from whatever the model read: last 10 digits, must start with 6-9. Returns "" when it is not valid. */
export function cleanPhone(v: any): string {
  const d = str(v).replace(/\D/g, '');
  const ten = d.length >= 10 ? d.slice(-10) : '';
  return /^[6-9]\d{9}$/.test(ten) ? ten : '';
}

/** Turns the model's JSON into capture items. Money becomes lakh (buy or sale price) or thousand per month (rent), as the CRM forms expect. */
export function normalizeCapture(raw: RawCapture): CaptureResult {
  const warnings = (raw.warnings || []).map(str).filter(Boolean);
  const rawPhone = str(raw.phone); const phone = cleanPhone(rawPhone);
  if (rawPhone && !phone) warnings.push('The phone number on screen could not be read as a valid mobile number: ' + rawPhone);
  const name = str(raw.contactName);
  if (/(\.\.\.|…)$/.test(name)) warnings.push('The contact name looks cut off in the chat header. Check it before saving.');
  const items: CaptureItem[] = (raw.items || []).map((it) => {
    // The model's intent decides who wants what. Older answers with type/deal are still understood.
    const IN = str(it.intent).toLowerCase().replace(/[\s-]+/g, '_');
    const offer = IN ? IN === 'wants_to_sell' || IN === 'wants_to_rent_out' : str(it.type).toLowerCase() === 'offer';
    const rent = IN ? IN === 'wants_to_rent' || IN === 'wants_to_rent_out' : str(it.deal).toLowerCase() === 'rent';
    const cat = ['Residential', 'Commercial', 'Land'].find((c) => c.toLowerCase() === str(it.category).toLowerCase()) as CaptureItem['kind'] || 'Residential';
    const unit = SQFT[str(it.areaUnit).toLowerCase()]; const av = toNum(it.areaValue);
    const div = rent ? 1e3 : 1e5; // rent -> thousand per month, buy/sale -> lakh
    const lo = toNum(it.budgetMin), hi = toNum(it.budgetMax);
    return {
      name, phone, intent: rent ? 'rent' : 'buy', kind: cat, bhk: toNum(it.bhk) ? String(Math.round(toNum(it.bhk)!)) : '',
      area: av && unit ? String(Math.round(av * unit)) : '', loc: str(it.locality), min: lo ? fmt(lo / div) : '', max: hi ? fmt(hi / div) : '',
      note: str(it.summary), isProperty: offer, sub: str(it.subType), project: str(it.project), unit: str(it.unit), evidence: str(it.evidence).slice(0, 200),
    };
  });
  const c = parseFloat(String(raw.confidence)); const confidence = Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0.5;
  return { items, transcript: str(raw.transcript).slice(0, 4000), confidence, warnings, contactName: name, phone };
}

/** True when the cheap model's answer should be re-checked by the stronger model. */
export function needsFallback(raw: RawCapture | null): boolean {
  if (!raw || !Array.isArray(raw.items)) return true;                      // unreadable answer
  const c = parseFloat(String(raw.confidence));
  if (Number.isFinite(c) && c < 0.6) return true;                            // the model itself is unsure
  if (str(raw.phone) && !cleanPhone(raw.phone)) return true;                 // a phone number was seen but is not valid
  return false;
}

/** Pulls the JSON object out of a model reply (some models wrap it in ```json fences or add a sentence). */
export function extractJson(text: string): RawCapture | null {
  const t = str(text); if (!t) return null;
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i); const body = fenced ? fenced[1] : t;
  const a = body.indexOf('{'), b = body.lastIndexOf('}'); if (a < 0 || b <= a) return null;
  try { return JSON.parse(body.slice(a, b + 1)); } catch { return null; }
}
