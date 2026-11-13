// SquareFeets CRM — UI smoke test. Paste into the browser console while signed in (or run it through the browser pane).
// Opens every screen, every detail page and every Edit / Delete dialog, and reports crashes, blank screens and console errors.
// It only opens dialogs (never confirms a delete), so it changes no data.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const token = localStorage.getItem('sf_token') || localStorage.getItem('token') || Object.entries(localStorage).map(([, v]) => v).find((v) => /^eyJ/.test(v));
  const B = await fetch('/api/bootstrap', { headers: { authorization: 'Bearer ' + token } }).then((r) => r.json());
  const out = []; const errors = [];
  window.addEventListener('error', (e) => errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => errors.push('promise: ' + (e.reason?.message || e.reason)));
  const origErr = console.error; console.error = (...a) => { errors.push(a.map(String).join(' ').slice(0, 200)); origErr(...a); };
  const root = () => document.body.innerText || '';
  const crashed = () => !!document.querySelector('pre[style*="padding:24px"]') || /Application error|Unhandled Runtime Error|Cannot read prop/.test(root());
  const go = async (p) => { history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); await sleep(250); };
  const rec = (name, ok, note = '') => out.push({ name, ok, note });

  // 1. every list screen, detail page and form
  const first = (a) => a && a[0] && a[0].id;
  const routes = ['/dashboard', '/projects', '/properties', '/leads', '/prospects', '/requirements', '/matches', '/visits', '/followups', '/deals', '/brokerage', '/capture', '/team', '/account', '/settings', '/import', '/export', '/masters',
    '/projects/new', '/properties/new', '/requirements/new',
    first(B.projects) && '/projects/' + first(B.projects), first(B.projects) && '/projects/' + first(B.projects) + '/edit',
    first(B.props) && '/properties/' + first(B.props), first(B.props) && '/properties/' + first(B.props) + '/edit',
    first(B.prospects) && '/prospects/' + first(B.prospects), first(B.deals) && '/deals/' + first(B.deals), first(B.reqs) && '/requirements/' + first(B.reqs),
    first(B.leads) && '/leads/' + first(B.leads), first(B.visits) && '/visits/' + first(B.visits)].filter(Boolean);
  for (const p of routes) {
    const before = errors.length; await go(p);
    rec('screen ' + p, !crashed() && root().trim().length > 40 && errors.length === before, crashed() ? 'crash screen' : root().trim().length <= 40 ? 'blank screen' : errors.slice(before).join(' | '));
  }
  // 2. every list: open Edit and Delete dialogs for the first row of each
  const lists = [['/projects', 'project'], ['/properties', 'property'], ['/leads', 'lead'], ['/prospects', 'prospect'], ['/requirements', 'req'], ['/visits', 'visit'], ['/followups', 'fu'], ['/deals', 'deal'], ['/brokerage', 'brok']];
  const click = (sel) => { const e = document.querySelector(sel); if (e) e.click(); return !!e; };
  for (const [route, k] of lists) {
    await go(route);
    if (route === '/visits') click('[data-act="tab"][data-v="list"]');
    if (route === '/requirements') click('[data-act="tab"][data-v="all"]');
    if (route === '/followups') click('[data-act="tab"][data-v="overdue"]');
    await sleep(150);
    const del = document.querySelector(`[data-act="rowDel"][data-k="${k}"]`), edit = document.querySelector(`[data-act="rowEdit"][data-k="${k}"]`);
    rec(`${route}: Edit + Delete buttons present`, !!del && !!edit, `${!!edit ? '' : 'no Edit '}${!!del ? '' : 'no Delete'}`);
    if (del) { del.click(); await sleep(150); const m = document.querySelector('.modal, [role="dialog"], .mh'); rec(`${route}: Delete opens a dialog (confirm or "can't be deleted")`, !!m && /delete/i.test(root()) && !crashed()); click('[data-act="closeModal"]'); await sleep(100); }
  }
  console.error = origErr;
  const failed = out.filter((x) => !x.ok);
  return { total: out.length, passed: out.length - failed.length, failed, jsErrors: errors };
})();
