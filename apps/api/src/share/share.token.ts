// Signed, expiring tokens for the download links that go out on WhatsApp (and in emails when a file is too big to attach).
// A token is base64url(JSON) + "." + HMAC-SHA256 signature. It is signed with a key derived from JWT_SECRET (or SHARE_LINK_SECRET),
// with its own label, so a login token can never be used as a share token or the other way round.
import { createHmac, timingSafeEqual } from 'crypto';

/** How many days a link works (SHARE_LINK_DAYS, default 7). */
export const linkDays = () => Math.max(1, Number(process.env.SHARE_LINK_DAYS) || 7);
const key = () => createHmac('sha256', process.env.SHARE_LINK_SECRET || process.env.JWT_SECRET || 'dev-secret-change-me').update('squarefeets-share-link-v1').digest();
const sig = (body: string) => createHmac('sha256', key()).update(body).digest();

/** Create a token that stops working after `days` days (`now` in seconds is for tests). */
export function signToken(payload: Record<string, unknown>, days = linkDays(), now = Math.floor(Date.now() / 1000)) {
  const body = Buffer.from(JSON.stringify({ ...payload, e: now + Math.round(days * 86400) })).toString('base64url');
  return body + '.' + sig(body).toString('base64url');
}
/** Check signature and expiry. Returns the payload, or null for anything wrong (tampered, expired, malformed, not ours). */
export function verifyToken(token: string, now = Math.floor(Date.now() / 1000)): Record<string, any> | null {
  const parts = String(token || '').split('.'); if (parts.length !== 2 || !parts[0] || !parts[1] || parts[0].length > 8000) return null;
  const want = sig(parts[0]); let got: Buffer;
  try { got = Buffer.from(parts[1], 'base64url'); } catch { return null; }
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try { const p = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); return p && typeof p.e === 'number' && p.e > now ? p : null; } catch { return null; }
}
