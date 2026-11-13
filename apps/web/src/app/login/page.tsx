'use client';
import { FormEvent, useEffect, useState } from 'react';
import { api, getToken, setToken } from '@/lib/api';

// Sign-in page (route /login). Calls POST /api/auth/login, stores the JWT in localStorage, then opens /dashboard.
// Layout: brand panel + form, side by side on wide screens and stacked on narrow ones (styles: .lg-* in globals.css).
export default function Login() {
  // form state: typed email/password, error text, 'request in progress' flag and whether the password is shown
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

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

  // The three selling points shown on the brand panel: [icon drawing, text]
  const points: [JSX.Element, string][] = [
    [<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.4 3.3-5.5 6.5-5.5s5.9 2.1 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.4 3.5 5.2" /></>, 'Leads, prospects and follow-ups'],
    [<><path d="M3 21V9l7-5 7 5v12" /><path d="M17 21V12l4 2.5V21" /><path d="M8 21v-5h4v5M7.5 11h5" /></>, 'Projects, properties and documents'],
    [<><path d="M4 7h16v12H4z" /><path d="M9 7V5h6v2M4 12h16" /></>, 'Deals, brokerage and approvals'],
  ];

  return (
    <main className="lg">
      {/* brand panel: logo, headline, selling points and a decorative skyline */}
      <section className="lg-brand">
        <div className="lg-mark">
          <div className="lg-logo">SF</div>
          <div className="lg-name"><b>SquareFeets Realty</b><span>CRM</span></div>
        </div>
        <div className="lg-pitch">
          <h1>Every lead, listing and deal in one place.</h1>
          <p>Follow each enquiry from first call to closed deal, and keep your team and your brokerage on the same page.</p>
        </div>
        <ul className="lg-points">
          {points.map(([icon, text]) => (
            <li key={text}>
              <span className="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9DB2FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg></span>
              {text}
            </li>
          ))}
        </ul>
        <svg className="lg-sky" viewBox="0 0 600 200" preserveAspectRatio="xMinYMax meet" fill="none" stroke="#3A4C86" strokeWidth="1.5" aria-hidden="true">
          <path d="M0 199.5H600" />
          <path d="M30 199V110h70v89M30 110l35-24 35 24M48 130h12M70 130h12M48 150h12M70 150h12M48 170h12M70 170h12" />
          <path d="M130 199V70h80v129M130 70h80M150 90h14M176 90h14M150 112h14M176 112h14M150 134h14M176 134h14M150 156h14M176 156h14M150 178h14M176 178h14" />
          <path d="M240 199V120h60v79M255 140h10M275 140h10M255 160h10M275 160h10M255 180h10M275 180h10" />
          <path d="M330 199V40h70v159M330 40l35-22 35 22M348 62h12M372 62h12M348 86h12M372 86h12M348 110h12M372 110h12M348 134h12M372 134h12M348 158h12M372 158h12M348 182h12M372 182h12" />
          <path d="M430 199V100h56v99M444 120h10M462 120h10M444 142h10M462 142h10M444 164h10M462 164h10" />
          <path d="M516 199V132h54v67M516 132l27-18 27 18M532 152h10M550 152h10" />
        </svg>
      </section>

      {/* form panel */}
      <section className="lg-form-wrap">
        <form className="lg-form" onSubmit={submit}>
          <div>
            <h2>Welcome back</h2>
            <p className="lg-lead">Sign in to your SquareFeets account.</p>
          </div>
          <div className="lg-field">
            <label htmlFor="lg-email">Email</label>
            <div className="lg-input">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 7l8.5 6 8.5-6" /></svg>
              <input id="lg-email" type="email" autoComplete="username" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>
          <div className="lg-field">
            <label htmlFor="lg-pw">Password</label>
            <div className="lg-input">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
              <input id="lg-pw" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              {/* toggles between hidden and visible password text */}
              <button type="button" className="lg-show" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
            </div>
          </div>
          {err && <div className="lg-err" role="alert">{err}</div>}
          <button className="lg-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="lg-help">New team member? Ask your Owner or Admin to send you an invite.</p>
        </form>
        <p className="lg-foot">© SquareFeets Realty · Secure sign-in</p>
      </section>
    </main>
  );
}
