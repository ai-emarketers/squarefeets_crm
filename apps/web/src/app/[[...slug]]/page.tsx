// Main CRM screen (client component).
'use client';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '@/lib/api';
import { createAdapter } from '@/engine/sync';
import { startCrm } from '@/engine/crm-engine';

/** Every CRM screen (/dashboard, /properties/RS001, /deals/DEAL-0142 …) is rendered by the UI engine mounted here. */
// Optional catch-all route: one page handles /, /dashboard, /leads, /deals/DEAL-0142 ... The engine reads the URL itself.
export default function CrmApp() {
  // `host` is the empty <div> the engine renders the whole UI into.
  const host = useRef<HTMLDivElement>(null);
  // 'loading' until bootstrap is done; 'error' if the API cannot be reached
  const [state, setState] = useState<'loading' | 'error'>('loading');
  const [error, setError] = useState('');

  // Runs once on load: check login -> fetch /bootstrap -> start the engine.
  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    const toLogin = () => { window.location.href = '/login'; };
    if (!getToken()) { toLogin(); return; }          // not signed in -> login page
    (async () => {
      try {
        const boot = await api('/bootstrap');           // everything the user may see, from the database
        if (cancelled || !host.current) return;
        // start the UI engine; createAdapter wires saving (diff + POST /sync), uploads and logout
        stop = startCrm(host.current, boot, createAdapter(toLogin));
        setState('loading');
      } catch (e: any) {
        // expired / invalid token -> sign in again; any other failure shows the retry screen
        if (e instanceof ApiError && e.status === 401) { clearToken(); toLogin(); return; }
        setError(e?.message || 'Could not load your data');
        setState('error');
      }
    })();
    // cleanup when the page unmounts: stop the engine's listeners
    return () => { cancelled = true; stop?.(); };
  }, []);

  return (
    <>
      {/* the engine mounts the whole CRM UI here */}
      <div ref={host} id="app" />
      {/* friendly error screen when the API/DB is down */}
      {state === 'error' && (
        <div style={{ padding: 32, maxWidth: 520, margin: '10vh auto', textAlign: 'center' }}>
          <h2>Can’t reach the CRM server</h2>
          <p className="sub">{error}</p>
          <p className="sub">Check that the API is running (<code>npm run dev:api</code>) and the database is up (<code>npm run db:up</code>).</p>
          <button className="btn" onClick={() => window.location.reload()}>Try again</button>
        </div>
      )}
    </>
  );
}
