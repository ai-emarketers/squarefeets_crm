'use client';
import { FormEvent, useEffect, useState } from 'react';
import { api, getToken, setToken } from '@/lib/api';

// Sign-in page (route /login). Calls POST /api/auth/login, stores the JWT in localStorage, then opens /dashboard.
export default function Login() {
  // form state: typed email/password, error text and a 'request in progress' flag
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // already signed in? skip the form and go straight to the dashboard
  useEffect(() => { if (getToken()) window.location.href = '/dashboard'; }, []);

  // Form submit: authenticate, remember the token, navigate. Errors from the API are shown inline.
  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const r = await api<{ token: string }>('/auth/login', { method: 'POST', body: { email, password } });
      setToken(r.token);                       // remembered for later API calls
      window.location.href = '/dashboard';
    } catch (ex: any) { setErr(ex?.message || 'Could not sign in'); }
    finally { setBusy(false); }
  }

  return (
    // Centered card using the prototype's CSS classes (card, fld, inp, btn, note).
    <main style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form onSubmit={submit} className="card" style={{ width: 'min(400px, 100%)', gap: 14 }}>
        <div className="brand" style={{ padding: 0 }}>
          <div className="logo">SF</div>
          <div><div style={{ fontWeight: 600 }}>SquareFeets Realty</div><div className="sub" style={{ fontSize: 12 }}>CRM</div></div>
        </div>
        <h1 style={{ fontSize: 20 }}>Sign in</h1>
        <label className="fld"><span className="l">Email</span>
          <div className="inp"><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div></label>
        <label className="fld"><span className="l">Password</span>
          <div className="inp"><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div></label>
        {err && <div className="note err" role="alert"><div>{err}</div></div>}
        <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );
}
