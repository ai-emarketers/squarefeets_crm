// Small fetch wrapper used by every web call to the NestJS API.
// Base URL of the API. Default '/api' = same address as the website; next.config.mjs forwards it to the API server.
// Set NEXT_PUBLIC_API_URL only if the browser must call the API on a different address (e.g. https://api.example.com/api).
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');
// localStorage key holding the JWT.
const TOKEN_KEY = 'sfcrm-token';

// Token helpers (guarded for server-side rendering where `window` does not exist).
export const getToken = () => (typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY));
// Remember the sign-in token in the browser.
export const setToken = (t: string) => window.localStorage.setItem(TOKEN_KEY, t);
// Forget the sign-in token (sign out).
export const clearToken = () => window.localStorage.removeItem(TOKEN_KEY);

// Error carrying the HTTP status so callers can react to 401 (expired login) etc.
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// api('/leads') -> GET; api('/x', {method:'POST', body}) -> JSON POST; {form} -> multipart upload; {raw:true} -> return the Response (for files).
export async function api<T = any>(path: string, opts: { method?: string; body?: any; form?: FormData; raw?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const t = getToken();                                  // attach the login token

  if (t) headers.Authorization = `Bearer ${t}`;
  // choose body encoding: multipart for uploads, JSON otherwise
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
  const res = await fetch(API_URL + path, { method: opts.method || (body ? 'POST' : 'GET'), headers, body });
  // raw mode lets the caller handle the response (used for downloading file blobs)
  if (opts.raw) return res as any;
  // turn error responses into ApiError, using Nest's `message` (string or validation array)
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = Array.isArray(j.message) ? j.message.join(', ') : j.message || msg; } catch { /* not json */ }
    throw new ApiError(res.status, msg);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
