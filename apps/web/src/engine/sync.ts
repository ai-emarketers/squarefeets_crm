// sync.ts — adapter between the UI engine and the API (diff-based saving, file upload/open, logout).
import { api, ApiError, clearToken } from '@/lib/api';
import type { EngineState, Rec } from './engine-types';

/**
 * Bridges the UI engine and the API.
 *  - save(S): diffs the engine state against what the server already has and POSTs only the changes to /sync.
 *  - upload / openUrl: document binaries go to /files, are opened through the authenticated API.
 * New records keep their position in lists: each gets an `_o` order key between its neighbours.
 */
// collection name in the UI state -> its primary-key field (brokerage rows are keyed by `deal`)
const COLL: Record<string, string> = { projects: 'id', props: 'id', leads: 'id', prospects: 'id', reqs: 'id', visits: 'id', fus: 'id', deals: 'id', brok: 'deal' };
// small JSON collections stored in the KvStore table
const KV = ['mreq', 'alerts', 'viewLog', 'exportReq', 'exportLog', 'imports', 'roles'];
// single objects: organisation profile, permission matrix, masters
const SINGLES = ['org', 'perms', 'masters'];

// callbacks the engine gives us: toast() to show a message, render() to redraw
type Hooks = { toast?: (t: string) => void; render?: () => void };

// Factory: returns the adapter object the engine calls (attach, loaded, save, upload, openUrl, hydrate, logout).
export function createAdapter(onLogout: () => void) {
  // `snap` = JSON string of each record as last known by the server; comparing against it reveals what changed
  const snap: Record<string, Map<string, string>> = {};
  const single: Record<string, string> = {};
  let inited = false;   // first save() only records the baseline

  let busy = false;     // a /sync request is in flight

  let dirty: EngineState | null = null; // newer state that arrived while busy (sent right after)
  let hooks: Hooks = {};

  // short helpers: stringify, and strip UI-only keys (thumb, url, hasBlob) from file records before saving
  const js = (v: unknown) => JSON.stringify(v);
  // Copy of a file record without UI-only keys, tagged with its scope.
  const fileDoc = (f: Rec, scope: string) => { const { thumb, url, hasBlob, ...rest } = f; return { ...rest, scope }; };

  // Pick an `_o` order number between a new record's neighbours so list order survives reloads.
  function orderFor(arr: Rec[], i: number) {
    const p = arr[i - 1]?._o, n = arr[i + 1]?._o;
    if (typeof p === 'number' && typeof n === 'number') return (p + n) / 2;
    if (typeof n === 'number') return n - 1;
    if (typeof p === 'number') return p + 1;
    return 0;
  }

  // Compare the current UI state with the snapshot and build { collection: { put: [...], del: [...] } }.
  function collect(S: EngineState) {
    const changes: Rec = {};
    const next: { coll: Record<string, Map<string, string>>; single: Record<string, string> } = { coll: {}, single: {} };
    let any = false;
    const fresh = new Set<string>(); // "coll:id" of records created since the last save
    const add = (k: string, sub: string, v: unknown) => { ((changes[k] ||= {})[sub] ||= []).push(v); any = true; };

    // 1) main collections: changed/new docs -> put, vanished ids -> del
    for (const coll of Object.keys(COLL)) {
      const arr: Rec[] = S[coll] || []; const pk = COLL[coll]; const cur = new Map<string, string>();
      arr.forEach((doc, i) => {
        const id = doc?.[pk]; if (id == null) return;
        const isNew = !snap[coll].has(String(id));
        if (isNew && doc._o == null) doc._o = orderFor(arr, i);
        const s = js(doc); cur.set(String(id), s);
        // _new tells the server this record was just created here, so it refuses (instead of overwriting) if another
        // user already created a record with the same id.
        if (isNew) fresh.add(coll + ':' + id);
        if (snap[coll].get(String(id)) !== s) add(coll, 'put', isNew ? { ...doc, _new: true } : doc);
      });
      for (const id of snap[coll].keys()) if (!cur.has(id)) add(coll, 'del', id);
      next.coll[coll] = cur;
    }
    // 2) single objects and KV collections: send the whole value when it changed
    for (const k of SINGLES) { const s = js(S[k]); next.single[k] = s; if (single[k] !== s) { changes[k] = S[k]; any = true; } }
    for (const k of KV) { const s = js(S[k] ?? []); next.single['kv.' + k] = s; if (single['kv.' + k] !== s) { (changes.kv ||= {})[k] = S[k] ?? []; any = true; } }
    // team (by name) and amenities (by id)
    for (const [coll, key] of [['team', 'name'], ['amen', 'id']] as const) {
      const cur = new Map<string, string>(); const prev = snap[coll];
      for (const doc of S[coll] || []) { const s = js(doc); cur.set(doc[key], s); if (prev.get(doc[key]) !== s) add(coll, 'put', doc); }
      for (const id of prev.keys()) if (!cur.has(id)) add(coll, 'del', id);
      next.coll[coll] = cur;
    }
    // files (document metadata) — drafts are not saved
    const curF = new Map<string, string>();
    for (const scope of Object.keys(S.files || {})) {
      if (scope.includes('__draft')) continue;
      for (const f of S.files[scope]) { const d = fileDoc(f, scope); const s = js(d); curF.set(f.id, s); if (snap.files.get(f.id) !== s) add('files', 'put', d); }
    }
    for (const id of snap.files.keys()) if (!curF.has(id)) add('files', 'del', id);
    next.coll.files = curF;
    return { changes, any, next, fresh };
  }

  // Send the pending changes. Only one request at a time; edits made meanwhile are re-sent afterwards.
  async function flush(S: EngineState): Promise<void> {
    if (busy) { dirty = S; return; }
    busy = true;
    try {
      const { changes, any, next, fresh } = collect(S);
      if (!any) return;
      // POST only the diff; the server answers with any rejected operations
      const res: Rec = await api('/sync', { method: 'POST', body: changes });
      Object.assign(snap, next.coll); Object.assign(single, next.single);
      // Forget rejected records so they are not treated as saved (they are re-sent / re-checked on the next edit).
      // New ones stay "new"; edits to existing ones are marked changed so they are sent again.
      for (const r of res?.rejected || []) if (r.id != null && snap[r.c]) {
        if (fresh.has(r.c + ':' + r.id)) snap[r.c].delete(String(r.id)); else snap[r.c].set(String(r.id), '');
      }
      // tell the user if the server refused something (e.g. no write permission)
      if (res?.rejected?.length) {
        const r = res.rejected[0];
        hooks.toast?.(`Some changes were not saved (${r.c}${r.id ? ' ' + r.id : ''}: ${r.reason}). Reload the page to see the saved data.`);
      }
    } catch (e: unknown) {
      // login expired -> go to the login page; other errors keep the data and retry on the next edit
      if (e instanceof ApiError && e.status === 401) { clearToken(); onLogout(); return; }
      hooks.toast?.('Could not reach the server — your last change is not saved yet. It will be retried on your next edit.');
    } finally {
      busy = false;
      if (dirty) { const d = dirty; dirty = null; void flush(d); }
    }
  }

  return {
    // engine -> adapter: receive the toast/render callbacks
    attach(h: Hooks) { hooks = h; },
    // direct API call for actions that are not part of the /sync diff (set / change password)
    api: (path: string, opts?: Rec) => api(path, opts),
    /** Called by the engine after BOOT is applied; the baseline is taken on the first save (after normalisation). */
    loaded(_S: EngineState) {},
    // engine calls this after every change. First call = take the baseline, later calls = flush the diff.
    save(S: EngineState) {
      if (!inited) {
        for (const c of Object.keys(COLL)) snap[c] = new Map((S[c] || []).map((d: Rec) => [String(d[COLL[c]]), js(d)]));
        snap.team = new Map((S.team || []).map((d: Rec) => [d.name, js(d)]));
        snap.amen = new Map((S.amen || []).map((d: Rec) => [d.id, js(d)]));
        const f = new Map<string, string>();
        for (const scope of Object.keys(S.files || {})) if (!scope.includes('__draft')) for (const x of S.files[scope]) f.set(x.id, js(fileDoc(x, scope)));
        snap.files = f;
        for (const k of SINGLES) single[k] = js(S[k]);
        for (const k of KV) single['kv.' + k] = js(S[k] ?? []);
        inited = true;
        void this.hydrate(S);
        return;
      }
      void flush(S);
    },
    // Upload the binary of a document record to /files/upload (metadata itself is synced via /sync).
    async upload(rec: Rec, file: File, scope: string) {
      try {
        const form = new FormData();
        form.append('file', file); form.append('id', rec.id); form.append('scope', scope); form.append('cat', rec.cat || 'Other');
        await api('/files/upload', { form });
        rec.hasBlob = true;
      } catch (e: unknown) { hooks.toast?.(`Could not store ${rec.name}: ${(e as Error)?.message || 'upload failed'}`); }
    },
    /** Resolve a stored file to a blob: URL (the API needs the bearer token, so <a href> cannot hit it directly). */
    async openUrl(rec: Rec, render: () => void) {
      if (rec.url || !rec.hasBlob) return;
      try {
        const res: Response = await api(`/files/${rec.id}/content`, { raw: true });
        if (!res.ok) return;
        const blob = await res.blob();
        rec.url = URL.createObjectURL(blob);
        if (/^image\//.test(rec.type || '') && !rec.thumb && blob.size < 3 * 1048576) rec.thumb = await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(blob); });
        render();
      } catch { /* ignore */ }
    },
    /** Thumbnails for stored images are fetched in the background so lists show pictures after a reload. */
    // Fetch thumbnails for up to 24 stored images so lists show pictures after a reload.
    async hydrate(S: EngineState) {
      let n = 0;
      for (const scope of Object.keys(S.files || {})) for (const f of S.files[scope]) {
        if (n >= 24) return;
        if (f.hasBlob && (/^image\//.test(f.type || '') || /\.(jpe?g|jfif|png|webp|gif|bmp|avif)$/i.test(f.name || '')) && !f.thumb && !f.url) { n++; await this.openUrl(f, () => hooks.render?.()); }
      }
    },
    // Sign out: forget the token and go to /login.
    logout() { clearToken(); onLogout(); },
  };
}
