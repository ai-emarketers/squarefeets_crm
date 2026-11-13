#!/usr/bin/env node
// SquareFeets CRM — QA agent (API + data-rules test suite).
//
// What it does: signs in, then exercises every module through the same /api/sync endpoint the website uses,
// checking create / edit / delete, the "linked data cannot be deleted" rules, permissions, input robustness and
// that every web page loads. It cleans up everything it creates, so it is safe to run against a dev database.
//
// Run (API on :4000, web on :3000):   node tools/qa-agent/qa-agent.mjs
// Options (env):  API_URL=http://localhost:4000/api  WEB_URL=http://localhost:3000
//                 QA_EMAIL=anil@sharmaproperty.in    QA_PASSWORD=ChangeMe@123
// Needs Node 18+ (built-in fetch). No npm packages. Exit code 1 when any check fails; report -> tools/qa-agent/report.md

const isNode = typeof process !== 'undefined' && !!process.versions?.node;

/** Run every suite. `cfg.api` / `cfg.web` are base URLs ('' = same origin when run inside the browser). */
export async function runQa(cfg = {}) {
  const API = (cfg.api ?? '/api').replace(/\/$/, '');
  const WEB = cfg.web ?? '';
  const EMAIL = cfg.email || 'anil@sharmaproperty.in';
  const PASS = cfg.password || 'ChangeMe@123';
  const results = []; // { suite, name, pass, note }
  let suite = '';
  const started = Date.now();
  const RUN = 'QA' + Date.now().toString(36).toUpperCase(); // unique tag for everything this run creates

  // ---- tiny test helpers ----------------------------------------------------------------------------------
  const check = (name, cond, note = '') => { results.push({ suite, name, pass: !!cond, note: cond ? '' : String(note) }); return !!cond; };
  const skip = (name, note = '') => results.push({ suite, name, pass: true, skipped: true, note });
  const http = async (method, path, { token, body, raw } = {}) => {
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = 'Bearer ' + token;
    try {
      const r = await fetch((path.startsWith('http') ? '' : API) + path, { method, headers, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) });
      let json = null; const text = await r.text(); try { json = JSON.parse(text); } catch { /* not json */ }
      return { status: r.status, json, text };
    } catch (e) { return { status: 0, json: null, text: String(e.message || e) }; }
  };
  const login = async (email, password) => { const r = await http('POST', '/auth/login', { body: { email, password } }); return { ...r, token: r.json?.token }; };

  // ---- 0. reachability ------------------------------------------------------------------------------------
  suite = '0 Health';
  const h = await http('GET', '/health');
  if (!check('API /health answers 200 {status:ok}', h.status === 200 && h.json?.status === 'ok', `status ${h.status} ${h.text.slice(0, 120)}`)) {
    return finish('API is not reachable — start it with `npm run dev:api` and check API_URL.');
  }

  // ---- 1. authentication ----------------------------------------------------------------------------------
  suite = '1 Auth';
  const bad = await login(EMAIL, 'definitely-wrong');
  check('wrong password -> 401', bad.status === 401, bad.status);
  check('wrong password returns no token', !bad.token);
  const unknown = await login('nobody@nowhere.test', 'x'.repeat(10));
  check('unknown email -> 401', unknown.status === 401, unknown.status);
  const empty = await http('POST', '/auth/login', { body: {} });
  check('empty login body -> 4xx (not 500)', empty.status >= 400 && empty.status < 500, empty.status);
  const sqli = await login("' OR '1'='1", "' OR '1'='1");
  check("SQL-injection style login rejected", sqli.status >= 400 && sqli.status < 500 && !sqli.token, sqli.status);
  const ok = await login(EMAIL, PASS);
  if (!check('valid login -> 2xx with token', ok.status < 300 && !!ok.token, `status ${ok.status} ${ok.text.slice(0, 120)}`)) return finish('Cannot sign in; remaining suites skipped.');
  const T = ok.token;
  check('login response hides password hash', !/password|hash/i.test(JSON.stringify(ok.json?.user || {})), JSON.stringify(ok.json?.user));
  const me = await http('GET', '/auth/me', { token: T });
  check('/auth/me returns the signed-in user', me.status === 200 && (me.json?.email || '').toLowerCase() === EMAIL.toLowerCase(), me.text.slice(0, 120));
  check('/auth/me without token -> 401', (await http('GET', '/auth/me')).status === 401);
  check('/auth/me with garbage token -> 401', (await http('GET', '/auth/me', { token: 'not.a.jwt' })).status === 401);
  check('/bootstrap without token -> 401', (await http('GET', '/bootstrap')).status === 401);
  check('/sync without token -> 401', (await http('POST', '/sync', { body: {} })).status === 401);
  check('wrong current password on change-password refused', (await http('POST', '/auth/password', { token: T, body: { current: 'wrong-current', next: 'Whatever#12345' } })).status >= 400);

  // ---- 2. bootstrap shape + referential integrity ---------------------------------------------------------
  suite = '2 Bootstrap';
  const boot = async (tok = T) => (await http('GET', '/bootstrap', { token: tok })).json;
  let B = await boot();
  check('bootstrap returns JSON', !!B && typeof B === 'object');
  if (!B) return finish('Bootstrap failed.');
  for (const k of ['projects', 'props', 'leads', 'prospects', 'reqs', 'visits', 'fus', 'deals', 'brok', 'amen', 'team']) check(`collection "${k}" is a non-empty array`, Array.isArray(B[k]) && B[k].length > 0, `${k}: ${Array.isArray(B[k]) ? B[k].length : typeof B[k]}`);
  for (const k of ['org', 'perms', 'masters', 'profile']) check(`"${k}" object present`, !!B[k] && typeof B[k] === 'object');
  const ids = (a, f = 'id') => new Set((a || []).map((x) => x[f]));
  for (const k of ['projects', 'props', 'leads', 'prospects', 'reqs', 'visits', 'fus', 'deals']) check(`${k}: ids are unique`, ids(B[k]).size === B[k].length);
  const pIds = ids(B.projects), propIds = ids(B.props), cIds = ids(B.prospects);
  const badProp = B.props.filter((p) => p.projectId && !pIds.has(p.projectId)).map((p) => p.id);
  check('every property.projectId points to an existing project', !badProp.length, badProp.join(', '));
  const badReq = B.reqs.filter((r) => r.cid && !cIds.has(r.cid)).map((r) => r.id);
  check('every requirement.cid points to an existing prospect', !badReq.length, badReq.join(', '));
  const badVis = B.visits.filter((v) => (v.cid && !cIds.has(v.cid)) || (v.prop && !propIds.has(v.prop))).map((v) => v.id);
  check('every visit points to an existing prospect + property', !badVis.length, badVis.join(', '));
  const dealIds = ids(B.deals);
  const badBrok = B.brok.filter((b) => !dealIds.has(b.deal)).map((b) => b.deal);
  check('every brokerage record belongs to an existing deal', !badBrok.length, badBrok.join(', '));
  check('no password / hash field leaks anywhere in bootstrap', !/"(password|passwordHash|pwd|hash)"\s*:/i.test(JSON.stringify(B)));
  check('owner appears in team list', B.team.some((t) => (t.email || '').toLowerCase() === EMAIL.toLowerCase()));
  check('owner has full (write) access on every module', Object.values(B.profile.levels || {}).every((l) => l === 'write'), JSON.stringify(B.profile.levels));
  const baseline = Object.fromEntries(['projects', 'props', 'leads', 'prospects', 'reqs', 'visits', 'fus', 'deals', 'brok', 'amen', 'team'].map((k) => [k, B[k].length]));

  // ---- helpers for writes ---------------------------------------------------------------------------------
  const sync = async (changes, tok = T) => (await http('POST', '/sync', { token: tok, body: changes })).json || { ok: false, rejected: [{ reason: 'no json (HTTP error)' }] };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const strip = (o) => { const c = clone(o); delete c._o; delete c.createdAt; delete c.updatedAt; return c; };
  const find = (coll, id, pk = 'id') => (B[coll] || []).find((x) => x[pk] === id);
  const reload = async () => { B = await boot(); return B; };
  const refused = (r) => r && r.ok === false && r.rejected && r.rejected.length > 0;
  const cleanup = []; // [coll, id] pairs deleted at the end, children first
  const put = (coll, doc, extra) => sync({ [coll]: { put: [{ ...doc, ...extra }] } });
  const del = (coll, id) => sync({ [coll]: { del: [id] } });

  // ---- 3. per-module lifecycle: create -> read -> edit -> duplicate guard -> delete ------------------------
  suite = '3 CRUD lifecycle';
  // [collection, label, field to edit, primary key]
  const modules = [
    ['projects', 'Project', 'name', 'id'], ['props', 'Property', 'title', 'id'], ['leads', 'Lead', 'name', 'id'],
    ['prospects', 'Prospect', 'name', 'id'], ['reqs', 'Requirement', 'notes', 'id'], ['visits', 'Visit', 'notes', 'id'],
    ['fus', 'Follow-up', 'note', 'id'],
  ];
  const made = {}; // collection -> id of the QA record
  const wire = { projects: {}, props: {}, reqs: {}, visits: {}, fus: {} };
  for (const [coll, label, field, pk] of modules) {
    const tpl = B[coll][0];
    const id = `${RUN}-${coll}`;
    made[coll] = id;
    // point the clone at records that exist (or at the other QA records created earlier in this run)
    const link = {};
    if (coll === 'props') link.projectId = made.projects || tpl.projectId;
    if (coll === 'reqs') link.cid = made.prospects || tpl.cid;
    if (coll === 'visits') { link.cid = made.prospects || tpl.cid; link.prop = made.props || tpl.prop; }
    const doc = { ...strip(tpl), [pk]: id, [field]: `${label} ${RUN}`, ...link };
    if (coll === 'projects') doc.name = `QA Project ${RUN}`;
    if (coll === 'props') doc.title = `QA Property ${RUN}`;
    if (coll === 'leads') { doc.name = `QA Lead ${RUN}`; doc.stage = 'New'; delete doc.prospectId; }
    if (coll === 'prospects') doc.name = `QA Prospect ${RUN}`;
    if (coll === 'fus') { doc.done = true; doc.who = `QA Person ${RUN}`; }
    const r1 = await put(coll, doc, { _new: true });
    check(`${label}: create accepted`, r1.ok === true, JSON.stringify(r1.rejected));
    await reload();
    const got = find(coll, id, pk);
    check(`${label}: appears in bootstrap after create`, !!got);
    check(`${label}: saved field round-trips`, got && got[field] === doc[field], `${got && got[field]} != ${doc[field]}`);
    check(`${label}: count grew by exactly 1`, B[coll].length === baseline[coll] + 1, `${B[coll].length} vs ${baseline[coll] + 1}`);
    // duplicate create (same id, _new) must be refused — protects against two people creating the same id
    const dup = await put(coll, doc, { _new: true });
    check(`${label}: duplicate id with _new is refused`, refused(dup), JSON.stringify(dup));
    // edit (full-document replace, as the UI sends it)
    const edited = { ...strip(got), [field]: `${doc[field]} EDITED` };
    const r2 = await put(coll, edited);
    check(`${label}: edit accepted`, r2.ok === true, JSON.stringify(r2.rejected));
    await reload();
    check(`${label}: edit persisted, no duplicate row`, find(coll, id, pk)?.[field] === edited[field] && B[coll].length === baseline[coll] + 1);
    // field that is removed from the document is cleared on replace (optional fields)
    cleanup.unshift([coll, id]);
  }

  // ---- 4. delete-protection rules (linked data cannot be deleted) -----------------------------------------
  suite = '4 Delete protection';
  const reason = (r) => (r?.rejected?.[0]?.reason || '').toLowerCase();
  // QA chain created above: project <- property <- visit ; prospect <- requirement,visit ; lead (no links)
  let r = await del('projects', made.projects);
  check('project with a property cannot be deleted', refused(r) && /can't be deleted|still used/.test(reason(r)), JSON.stringify(r));
  r = await del('props', made.props);
  check('property with a visit cannot be deleted', refused(r) && /can't be deleted|still used/.test(reason(r)), JSON.stringify(r));
  r = await del('prospects', made.prospects);
  check('prospect with a requirement / visit cannot be deleted', refused(r) && /can't be deleted|still used/.test(reason(r)), JSON.stringify(r));
  await reload();
  check('refused deletes left all three records in place', !!find('projects', made.projects) && !!find('props', made.props) && !!find('prospects', made.prospects));
  // lead with an open follow-up
  const leadName = find('leads', made.leads).name;
  const openFu = { ...strip(B.fus[0]), id: `${RUN}-openfu`, who: leadName, done: false };
  r = await put('fus', openFu, { _new: true });
  check('open follow-up for the QA lead created', r.ok === true, JSON.stringify(r.rejected));
  cleanup.unshift(['fus', `${RUN}-openfu`]);
  r = await del('leads', made.leads);
  check('lead with an open follow-up cannot be deleted', refused(r), JSON.stringify(r));
  r = await del('fus', `${RUN}-openfu`);
  check('follow-ups can always be deleted', r.ok === true, JSON.stringify(r));
  cleanup.shift();
  // seeded records that the website links to other data
  await reload();
  for (const [coll, id, what, pk] of [['projects', 'p1', 'seed project with properties', 'id'], ['props', 'RS001', 'seed property with visits/deals', 'id'], ['prospects', 'c1', 'seed prospect with requirement/deals', 'id'], ['leads', 'l1', 'seed converted lead', 'id'], ['deals', 'DEAL-0142', 'seed deal with brokerage', 'id'], ['deals', 'DEAL-0139', 'seed closed-won deal', 'id'], ['brok', 'DEAL-0142', 'seed brokerage with payments', 'deal']]) {
    if (!find(coll, id, pk)) { skip(`${what} (${id}) cannot be deleted`, 'record not in this database'); continue; }
    const rr = await del(coll, id);
    await reload();
    check(`${what} (${id}) cannot be deleted`, refused(rr) && !!find(coll, id, pk), JSON.stringify(rr));
  }
  // now release the chain in the right order: visit -> requirement -> property -> prospect -> project -> lead
  for (const [coll, label] of [['visits', 'Visit'], ['reqs', 'Requirement'], ['props', 'Property'], ['prospects', 'Prospect'], ['projects', 'Project'], ['leads', 'Lead'], ['fus', 'Follow-up']]) {
    const rr = await del(coll, made[coll]);
    check(`${label}: deletes once nothing uses it`, rr.ok === true, JSON.stringify(rr.rejected));
  }
  cleanup.length = 0; // everything created in suite 3/4 is gone
  await reload();
  for (const k of ['projects', 'props', 'leads', 'prospects', 'reqs', 'visits', 'fus']) check(`${k}: back to the starting count (${baseline[k]})`, B[k].length === baseline[k], `${B[k].length}`);

  // ---- 5. settings: organisation, masters, amenities, team + role permissions ----------------------------
  suite = '5 Settings & team';
  const org0 = clone(B.org);
  let rr = await sync({ org: { ...org0, city: `QA City ${RUN}` } });
  await reload();
  check('organisation profile can be edited', rr.ok === true && B.org.city === `QA City ${RUN}`, JSON.stringify(rr));
  await sync({ org: org0 }); await reload();
  check('organisation profile restored', B.org.city === org0.city);
  rr = await sync({ amen: { put: [{ id: `qa-${RUN}`, label: `QA Amenity ${RUN}`, cat: 'Commercial' }] } });
  await reload();
  check('amenity can be added', rr.ok === true && B.amen.some((a) => a.id === `qa-${RUN}`), JSON.stringify(rr));
  rr = await sync({ amen: { del: [`qa-${RUN}`] } }); await reload();
  check('amenity can be removed', rr.ok === true && !B.amen.some((a) => a.id === `qa-${RUN}`));
  rr = await sync({ masters: { ...B.masters } });
  check('masters save accepted for the owner', rr.ok === true, JSON.stringify(rr));

  const agentName = `QA Agent ${RUN}`, agentEmail = `qa.agent.${RUN.toLowerCase()}@example.test`, agentPw = 'QaAgent#12345';
  rr = await sync({ team: { put: [{ name: agentName, role: 'Agent', email: agentEmail, phone: '+91 90000 11111', status: 'Active' }] } });
  await reload();
  check('team member can be added', rr.ok === true && B.team.some((t) => t.name === agentName), JSON.stringify(rr));
  const pw = await http('POST', `/team/${encodeURIComponent(agentName)}/password`, { token: T, body: { password: agentPw, email: agentEmail } });
  check('owner can set the team member password', pw.status < 300, `${pw.status} ${pw.text.slice(0, 100)}`);
  const short = await http('POST', `/team/${encodeURIComponent(agentName)}/password`, { token: T, body: { password: 'short' } });
  check('password shorter than 8 characters is refused', short.status >= 400);
  const ag = await login(agentEmail, agentPw);
  if (check('team member can sign in', ag.status < 300 && !!ag.token, `${ag.status} ${ag.text.slice(0, 100)}`)) {
    const AB = await boot(ag.token);
    check('agent bootstrap works', !!AB && Array.isArray(AB.leads));
    check('agent is not the owner', AB.profile?.role === 'Agent', AB.profile?.role);
    const agentSees = !!AB.profile?.seeNumbers;
    if (!agentSees) {
      const leaked = JSON.stringify([AB.leads, AB.prospects, AB.team]).match(/\+91 \d{5} \d{5}/g) || [];
      check('agent without "see numbers" gets masked phone numbers', leaked.length === 0, leaked.slice(0, 3).join(' | '));
    } else skip('phone masking for agent', 'this role is allowed to see numbers');
    const noPerm = await sync({ perms: { ...B.perms } }, ag.token);
    check('only the owner can change role permissions', refused(noPerm) || noPerm.ok === false, JSON.stringify(noPerm));
    const noTeam = await sync({ team: { put: [{ name: `QA Intruder ${RUN}`, role: 'Owner', email: 'x@example.test' }] } }, ag.token);
    await reload();
    check('agent cannot add team members (or at least not Owners)', !B.team.some((t) => t.name === `QA Intruder ${RUN}` && t.role === 'Owner'), JSON.stringify(noTeam));
    const delSeed = await sync({ projects: { del: ['p1'] } }, ag.token);
    check('agent cannot delete a linked project', refused(delSeed) || delSeed.ok === false, JSON.stringify(delSeed));
    const own = await sync({ team: { del: [B.team.find((t) => t.role === 'Owner')?.name] } }, ag.token);
    await reload();
    check('the Owner row can never be removed', B.team.some((t) => t.role === 'Owner'), JSON.stringify(own));
  }
  rr = await sync({ team: { del: [agentName] } }); await reload();
  check('team member can be removed', rr.ok === true && !B.team.some((t) => t.name === agentName));
  check('removed member can no longer sign in', (await login(agentEmail, agentPw)).status === 401);
  check('team count back to baseline', B.team.length === baseline.team, `${B.team.length}`);

  // ---- 6. robustness: odd input must be handled, never crash the server ------------------------------------
  suite = '6 Robustness';
  const nasty = [`O'Brien "quoted" <script>alert(1)</script>`, `'; DROP TABLE "Lead"; --`, `₹ ¢ 日本語 🏠 \\ backslash`, 'x'.repeat(5000)];
  for (const [i, text] of nasty.entries()) {
    const id = `${RUN}-nasty${i}`;
    const doc = { ...strip(B.leads[0]), id, name: text, stage: 'New' }; delete doc.prospectId;
    const w = await put('leads', doc, { _new: true });
    await reload();
    const back = find('leads', id);
    check(`special text #${i + 1} stored and returned unchanged`, w.ok === true && back && back.name === text, JSON.stringify(w.rejected || '') + (back ? ' got ' + String(back.name).slice(0, 40) : ' missing'));
    await del('leads', id);
  }
  const garbage = [
    ['null body', null], ['unknown collection', { nonsense: { put: [{ id: 1 }] } }], ['put without id', { leads: { put: [{ name: 'no id' }] } }],
    ['put of a string', { leads: { put: ['oops'] } }], ['del of unknown id', { leads: { del: ['does-not-exist-' + RUN] } }], ['kv key outside whitelist', { kv: { evil: [1] } }],
  ];
  for (const [name, body] of garbage) {
    const g = await http('POST', '/sync', { token: T, body: body ?? {} });
    check(`sync with ${name} does not crash (no 5xx)`, g.status > 0 && g.status < 500, `${g.status} ${g.text.slice(0, 100)}`);
  }
  const bigBad = await http('POST', '/sync', { token: T, body: '{not json', raw: true });
  check('malformed JSON body -> 4xx', bigBad.status >= 400 && bigBad.status < 500, bigBad.status);
  await reload();
  check('no junk records created by garbage input', B.leads.length === baseline.leads, `${B.leads.length} vs ${baseline.leads}`);
  const hp = await Promise.all(Array.from({ length: 15 }, () => http('GET', '/bootstrap', { token: T })));
  check('15 parallel bootstrap requests all succeed', hp.every((x) => x.status === 200), hp.map((x) => x.status).join(','));
  const t0 = Date.now(); await boot(); const ms = Date.now() - t0;
  check('bootstrap responds in under 3 s', ms < 3000, ms + ' ms');

  // ---- 7. web pages (only when a web URL is known) -------------------------------------------------------
  suite = '7 Web pages';
  if (isNode && !cfg.web) skip('web page checks', 'WEB_URL not set');
  else {
    const routes = ['/login', '/dashboard', '/team', '/account', '/projects', '/projects/new', '/properties', '/properties/new', '/leads', '/prospects', '/prospects/new', '/requirements', '/requirements/new', '/visits', '/followups', '/deals', '/brokerage', '/reports', '/settings', '/team'];
    for (const p of routes) {
      try {
        const res = await fetch(WEB + p); const html = await res.text();
        check(`GET ${p} -> 200 HTML, no server error`, res.status === 200 && /<html/i.test(html) && !/Application error|Internal Server Error/i.test(html), `${res.status}`);
      } catch (e) { check(`GET ${p}`, false, e.message); }
    }
    try { const a = await fetch(WEB + '/api/health'); check('web proxy forwards /api/health to the API', a.status === 200, a.status); } catch (e) { check('web proxy /api', false, e.message); }
  }

  return finish();

  // ---- report ----------------------------------------------------------------------------------------------
  async function finish(abort) {
    // best-effort cleanup of anything left behind by a failed run
    try { for (const [c, id] of cleanup) await del(c, id); } catch { /* ignore */ }
    const passed = results.filter((x) => x.pass && !x.skipped).length, skipped = results.filter((x) => x.skipped).length, failed = results.filter((x) => !x.pass);
    return { run: RUN, seconds: +((Date.now() - started) / 1000).toFixed(1), total: results.length, passed, skipped, failed: failed.length, failures: failed, results, aborted: abort || null };
  }
}

/** Markdown report from a runQa() result. */
export function toMarkdown(res) {
  const lines = [`# SquareFeets CRM — QA report`, '', `Run **${res.run}** · ${new Date().toISOString()} · ${res.seconds}s`, '',
    `**${res.passed} passed · ${res.failed} failed · ${res.skipped} skipped** (${res.total} checks)`, ''];
  if (res.aborted) lines.push(`> ⚠️ ${res.aborted}`, '');
  const bySuite = {};
  for (const x of res.results) (bySuite[x.suite] ||= []).push(x);
  for (const [s, xs] of Object.entries(bySuite)) {
    lines.push(`## ${s}  (${xs.filter((x) => x.pass).length}/${xs.length})`, '');
    for (const x of xs) lines.push(`- ${x.skipped ? '⏭️' : x.pass ? '✅' : '❌'} ${x.name}${x.note ? ` — ${x.note}` : ''}`);
    lines.push('');
  }
  return lines.join('\n');
}

// ---- command-line entry (Node only) ----------------------------------------------------------------------------
if (isNode && process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  const { writeFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const e = process.env;
  const res = await runQa({ api: e.API_URL || 'http://localhost:4000/api', web: e.WEB_URL || 'http://localhost:3000', email: e.QA_EMAIL, password: e.QA_PASSWORD });
  let lastSuite = '';
  for (const x of res.results) {
    if (x.suite !== lastSuite) { console.log(`\n== ${x.suite}`); lastSuite = x.suite; }
    console.log(`${x.skipped ? 'SKIP' : x.pass ? ' ok ' : 'FAIL'}  ${x.name}${x.note ? '  — ' + x.note : ''}`);
  }
  console.log(`\n${res.passed} passed, ${res.failed} failed, ${res.skipped} skipped in ${res.seconds}s${res.aborted ? '\nABORTED: ' + res.aborted : ''}`);
  writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'report.md'), toMarkdown(res));
  process.exit(res.failed || res.aborted ? 1 : 0);
}
