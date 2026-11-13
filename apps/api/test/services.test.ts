// Service-level tests for the Team, Export-approval and Auth rules. Runs without a database:
// a tiny in-memory stand-in replaces Prisma. Run:  npm run test:services   (from apps/api)
import 'reflect-metadata';
import * as assert from 'assert';
import * as bcrypt from 'bcryptjs';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { TeamService } from '../src/team/team.service';
import { ExportsService } from '../src/exports/exports.service';
import { AuditService } from '../src/audit/audit.service';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';

// ---------------------------------------------------------------- in-memory Prisma stand-in
let seq = 0;
function makeDb() {
  const users: any[] = [], exportRequests: any[] = [], audit: any[] = [];
  const match = (row: any, where: any) => Object.entries(where || {}).every(([k, v]: any) => (v && typeof v === 'object' && 'in' in v ? v.in.includes(row[k]) : row[k] === v));
  return {
    users, exportRequests, audit,
    user: {
      findUnique: async ({ where }: any) => { const u = users.find((x) => match(x, where)); return u ? { ...u } : null; },
      findMany: async () => users.map((u) => ({ ...u })),
      create: async ({ data }: any) => { const u = { id: 'u' + ++seq, createdAt: new Date(), lastLoginAt: null, sessionsValidFrom: null, passwordHash: null, ...data }; users.push(u); return { ...u }; },
      update: async ({ where, data }: any) => { const u = users.find((x) => match(x, where)); Object.assign(u, data); return { ...u }; },
      delete: async ({ where }: any) => { users.splice(users.findIndex((x) => match(x, where)), 1); },
    },
    exportRequest: {
      findUnique: async ({ where }: any) => { const r = exportRequests.find((x) => match(x, where)); return r ? { ...r } : null; },
      findMany: async ({ where }: any = {}) => exportRequests.filter((r) => match(r, where)).map((r) => ({ ...r })),
      create: async ({ data }: any) => { const r = { requestedAt: new Date(), status: 'Pending', decidedBy: null, decidedAt: null, filters: {}, rowCount: 0, ...data }; exportRequests.push(r); return { ...r }; },
      update: async ({ where, data }: any) => { const r = exportRequests.find((x) => match(x, where)); Object.assign(r, data); return { ...r }; },
    },
    auditLog: {
      create: async ({ data }: any) => { audit.push({ id: 'a' + ++seq, at: new Date(), ...data }); },
      findMany: async () => [...audit].reverse(),
    },
  };
}

// who may do what (same shape as Organization.perms): Admin & Manager can approve; Agent can export leads only
const ACTIONS: Record<string, string[]> = {
  Admin: ['approveExports', 'exportLeads', 'exportProperties', 'exportProspects'],
  Manager: ['approveExports', 'exportLeads', 'exportProperties', 'exportProspects'],
  Agent: ['exportLeads'], 'Field staff': [],
};
const perms: any = { can: async (u: any, a: string) => u.role === 'Owner' || (ACTIONS[u.role] || []).includes(a), perms: async () => ({ mods: [], act: [] }), level: async () => 'write', canSeeNumbers: async () => true };

function setup() {
  const db: any = makeDb();
  const audit = new AuditService(db);
  const team = new TeamService(db, audit);
  const exps = new ExportsService(db, perms, audit);
  return { db, audit, team, exps };
}
const mk = (db: any, o: any) => db.user.create({ data: { phone: '', corpPhone: '', altPhone: '', seeNumbers: false, status: 'Active', email: null, ...o } });
const asAuth = (u: any) => ({ id: u.id, name: u.name, role: u.role, email: u.email });
const rejects = async (p: Promise<any>, type: any, msg?: RegExp) => {
  try { await p; } catch (e: any) { assert.ok(e instanceof type, `expected ${type.name}, got ${e?.constructor?.name}: ${e?.message}`); if (msg) assert.match(e.message, msg); return; }
  assert.fail(`expected ${type.name}, but nothing was thrown`);
};

let passed = 0;
async function t(name: string, fn: () => Promise<void>) { try { await fn(); passed++; console.log('  ok  ', name); } catch (e: any) { console.error('  FAIL', name, '\n      ', e.message); process.exitCode = 1; } }

(async () => {
  console.log('TeamService');
  await t('creates a member as Invited and logs it', async () => {
    const { db, team } = setup(); const owner = await mk(db, { name: 'Anil', role: 'Owner', email: 'a@x.in' });
    const u = await team.save(asAuth(owner), { name: 'Ravi', role: 'Agent', email: 'RAVI@x.in' }, 'create');
    assert.equal(u.status, 'Invited'); assert.equal(u.email, 'ravi@x.in');
    assert.equal(db.audit[0].action, 'team.create');
  });
  await t('rejects duplicate name, duplicate email, bad email, bad role, Owner role', async () => {
    const { db, team } = setup(); const owner = await mk(db, { name: 'Anil', role: 'Owner', email: 'a@x.in' }); const me = asAuth(owner);
    await team.save(me, { name: 'Ravi', role: 'Agent', email: 'r@x.in' }, 'create');
    await rejects(team.save(me, { name: 'Ravi' }, 'create'), ConflictException);
    await rejects(team.save(me, { name: 'Sam', email: 'r@x.in' }, 'create'), ConflictException, /already used by Ravi/);
    await rejects(team.save(me, { name: 'Sam', email: 'nope' }, 'create'), BadRequestException);
    await rejects(team.save(me, { name: 'Sam', role: 'Boss' }, 'create'), BadRequestException);
    await rejects(team.save(me, { name: 'Sam', role: 'Owner' }, 'create'), BadRequestException);
    await rejects(team.save(me, { name: ' ' }), BadRequestException);
    await rejects(team.save(me, { name: 'Nobody' }, 'update'), NotFoundException);
  });
  await t('only the owner edits the owner; nobody changes own role or deactivates self / owner', async () => {
    const { db, team } = setup(); const owner = await mk(db, { name: 'Anil', role: 'Owner', email: 'a@x.in' }); const admin = await mk(db, { name: 'Meera', role: 'Admin', email: 'm@x.in' });
    await rejects(team.save(asAuth(admin), { name: 'Anil', phone: '1' }), ForbiddenException);
    await rejects(team.save(asAuth(admin), { name: 'Meera', role: 'Agent' }), BadRequestException, /own role/);
    await rejects(team.save(asAuth(admin), { name: 'Meera', status: 'Disabled' }), BadRequestException, /own account/);
    await rejects(team.save(asAuth(owner), { name: 'Anil', status: 'Disabled' }), BadRequestException, /owner cannot be deactivated/);
  });
  await t('deactivating ends sessions, keeps data, normalises Inactive, and logs the status change', async () => {
    const { db, team } = setup(); const owner = await mk(db, { name: 'Anil', role: 'Owner', email: 'a@x.in' }); await mk(db, { name: 'Ravi', role: 'Agent', email: 'r@x.in' });
    const u = await team.save(asAuth(owner), { name: 'Ravi', status: 'Inactive' });
    assert.equal(u.status, 'Disabled'); assert.ok(u.sessionsValidFrom instanceof Date); assert.equal(u.email, 'r@x.in');
    assert.equal(db.audit.at(-1).action, 'team.status'); assert.deepEqual(db.audit.at(-1).detail, { from: 'Active', to: 'Disabled' });
  });
  await t('a masked phone number from the web app does not overwrite the real one', async () => {
    const { db, team } = setup(); const owner = await mk(db, { name: 'Anil', role: 'Owner', email: 'a@x.in' }); await mk(db, { name: 'Ravi', role: 'Agent', phone: '9876543210' });
    const u = await team.save(asAuth(owner), { name: 'Ravi', phone: '98•••••10', role: 'Manager' });
    assert.equal(u.phone, '9876543210'); assert.equal(u.role, 'Manager');
    assert.deepEqual(db.audit.at(-1).detail.changed, ['role']);
    assert.ok(!JSON.stringify(db.audit).includes('9876543210'), 'phone numbers must never reach the audit log');
  });
  await t('remove: owner and self protected, missing returns false, normal removal is logged', async () => {
    const { db, team } = setup(); const owner = await mk(db, { name: 'Anil', role: 'Owner', email: 'a@x.in' }); const admin = await mk(db, { name: 'Meera', role: 'Admin' }); await mk(db, { name: 'Ravi', role: 'Agent' });
    await rejects(team.remove(asAuth(admin), 'Anil'), ForbiddenException);
    await rejects(team.remove(asAuth(admin), 'Meera'), BadRequestException);
    assert.equal(await team.remove(asAuth(admin), 'Ghost'), false);
    assert.equal(await team.remove(asAuth(owner), 'Ravi'), true);
    assert.equal(db.users.length, 2); assert.equal(db.audit.at(-1).action, 'team.remove');
  });
  await t('setPassword: permissions, validation, activation rules, session reset, no password in the log', async () => {
    const { db, team } = setup(); const owner = await mk(db, { name: 'Anil', role: 'Owner', email: 'a@x.in' }); const admin = await mk(db, { name: 'Meera', role: 'Admin', email: 'm@x.in' });
    await mk(db, { name: 'Ravi', role: 'Agent', email: 'r@x.in', status: 'Invited' }); await mk(db, { name: 'Off', role: 'Agent', email: 'o@x.in', status: 'Disabled' }); await mk(db, { name: 'NoMail', role: 'Agent' });
    const agent = await mk(db, { name: 'Zed', role: 'Agent', email: 'z@x.in' });
    await rejects(team.setPassword(asAuth(agent), 'Ravi', 'longenough1'), ForbiddenException);
    await rejects(team.setPassword(asAuth(admin), 'Ravi', 'short'), BadRequestException);
    await rejects(team.setPassword(asAuth(admin), 'Anil', 'longenough1'), ForbiddenException);
    await rejects(team.setPassword(asAuth(admin), 'Ghost', 'longenough1'), NotFoundException);
    await rejects(team.setPassword(asAuth(admin), 'NoMail', 'longenough1'), BadRequestException, /email/);
    await rejects(team.setPassword(asAuth(admin), 'Ravi', 'longenough1', 'm@x.in'), ConflictException);
    await team.setPassword(asAuth(admin), 'Ravi', 'Secret#2026');
    const ravi = db.users.find((u: any) => u.name === 'Ravi');
    assert.equal(ravi.status, 'Active'); assert.ok(await bcrypt.compare('Secret#2026', ravi.passwordHash)); assert.ok(ravi.sessionsValidFrom);
    await team.setPassword(asAuth(admin), 'Off', 'Secret#2026'); assert.equal(db.users.find((u: any) => u.name === 'Off').status, 'Disabled');
    await team.setPassword(asAuth(admin), 'Meera', 'Another#2026'); assert.equal(db.users.find((u: any) => u.name === 'Meera').sessionsValidFrom, null, 'own reset must not log you out');
    await team.setPassword(asAuth(owner), 'NoMail', 'Secret#2026', 'new@x.in'); assert.equal(db.users.find((u: any) => u.name === 'NoMail').email, 'new@x.in');
    assert.ok(!JSON.stringify(db.audit).includes('Secret#2026')); assert.equal(db.audit.at(-1).action, 'team.password.reset');
  });

  console.log('ExportsService');
  await t('create: needs the export action, forces the requester, rejects unknown kinds and duplicates', async () => {
    const { db, exps } = setup(); const agent = asAuth(await mk(db, { name: 'Ravi', role: 'Agent' })); const field = asAuth(await mk(db, { name: 'Fay', role: 'Field staff' }));
    const r = await exps.create(agent, { id: 'ex1', kind: 'leads', filters: { from: 'x' }, rowCount: 12 });
    assert.equal(r.by, 'Ravi'); assert.equal(r.status, 'Pending'); assert.equal(r.n, 12);
    await rejects(exps.create(agent, { kind: 'properties' }), ForbiddenException);
    await rejects(exps.create(field, { kind: 'leads' }), ForbiddenException);
    await rejects(exps.create(agent, { kind: 'deals' }), BadRequestException);
    await rejects(exps.create(agent, { id: 'ex1', kind: 'leads' }), ConflictException);
  });
  await t('decide: approvers only, not own request, only once; download only by requester after approval', async () => {
    const { db, exps } = setup(); const agent = asAuth(await mk(db, { name: 'Ravi', role: 'Agent' })); const mgr = asAuth(await mk(db, { name: 'Meera', role: 'Manager' })); const owner = asAuth(await mk(db, { name: 'Anil', role: 'Owner' }));
    await exps.create(agent, { id: 'ex1', kind: 'leads' }); await exps.create(mgr, { id: 'ex2', kind: 'leads' }); await exps.create(owner, { id: 'ex3', kind: 'leads' });
    await rejects(exps.decide(agent, 'ex1', 'Approved'), ForbiddenException);
    await rejects(exps.decide(mgr, 'ex2', 'Approved'), ForbiddenException, /own request/);
    await rejects(exps.decide(mgr, 'ex1', 'Downloaded' as any), BadRequestException);
    await rejects(exps.decide(mgr, 'nope', 'Approved'), NotFoundException);
    await rejects(exps.markDownloaded(agent, 'ex1'), BadRequestException, /not approved/);
    const ok = await exps.decide(mgr, 'ex1', 'Approved'); assert.equal(ok.status, 'Approved'); assert.equal(ok.decidedBy, 'Meera');
    await rejects(exps.decide(mgr, 'ex1', 'Rejected'), BadRequestException, /already approved/);
    await rejects(exps.markDownloaded(mgr, 'ex1'), ForbiddenException);
    assert.equal((await exps.markDownloaded(agent, 'ex1')).status, 'Downloaded');
    assert.equal((await exps.decide(owner, 'ex3', 'Rejected')).status, 'Rejected', 'the owner may decide their own');
    assert.ok(db.audit.some((a: any) => a.action === 'export.decide'));
  });
  await t('list: approvers see everything, others only their own', async () => {
    const { db, exps } = setup(); const a = asAuth(await mk(db, { name: 'Ravi', role: 'Agent' })); const b = asAuth(await mk(db, { name: 'Sam', role: 'Agent' })); const mgr = asAuth(await mk(db, { name: 'Meera', role: 'Manager' }));
    await exps.create(a, { id: 'e1', kind: 'leads' }); await exps.create(b, { id: 'e2', kind: 'leads' });
    assert.equal((await exps.list(a)).length, 1); assert.equal((await exps.list(mgr)).length, 2);
  });
  await t('web-app sync: creates new requests, applies real decisions, refuses forged status changes', async () => {
    const { db, exps } = setup(); const agent = asAuth(await mk(db, { name: 'Ravi', role: 'Agent' })); const mgr = asAuth(await mk(db, { name: 'Meera', role: 'Manager' }));
    const refused: string[] = []; const rej = (id: string, why: string) => refused.push(id + ': ' + why);
    await exps.syncFromClient(agent, [{ id: 'ex9', kind: 'leads', f: {}, n: 4, by: 'Someone Else', status: 'Approved' }], rej);
    const row = () => db.exportRequests[0]; assert.equal(row().requestedBy, 'Ravi', 'requester is forced'); assert.equal(row().status, 'Pending', 'a new request always starts Pending');
    await exps.syncFromClient(agent, [{ id: 'ex9', kind: 'leads', status: 'Approved' }], rej);
    assert.equal(row().status, 'Pending'); assert.equal(refused.length, 1, 'self-approval must be refused: ' + refused);
    await exps.syncFromClient(mgr, [{ id: 'ex9', kind: 'leads', status: 'Approved' }], rej);
    assert.equal(row().status, 'Approved'); assert.equal(row().decidedBy, 'Meera');
    await exps.syncFromClient(agent, [{ id: 'ex9', kind: 'leads', status: 'Downloaded' }], rej);
    assert.equal(row().status, 'Downloaded');
  });

  console.log('Auth');
  const jwt: any = { signAsync: async () => 'token' };
  await t('changePassword: wrong current = 400 (not 401), short/same rejected, success is logged', async () => {
    const { db, audit } = setup(); const u = await mk(db, { name: 'Ravi', role: 'Agent', email: 'r@x.in', passwordHash: await bcrypt.hash('OldPass#123', 10) });
    const auth = new AuthService(db, jwt, perms, audit);
    await rejects(auth.changePassword(u.id, 'wrong', 'NewPass#123'), BadRequestException, /Current password is wrong/);
    await rejects(auth.changePassword(u.id, 'OldPass#123', 'short'), BadRequestException);
    await rejects(auth.changePassword(u.id, 'OldPass#123', 'OldPass#123'), BadRequestException, /different/);
    await rejects(auth.changePassword('missing', 'x', 'NewPass#123'), UnauthorizedException);
    await auth.changePassword(u.id, 'OldPass#123', 'NewPass#123');
    assert.ok(await bcrypt.compare('NewPass#123', db.users[0].passwordHash)); assert.equal(db.audit.at(-1).action, 'account.password.change'); assert.equal(db.users[0].sessionsValidFrom, null);
  });
  await t('login records last sign-in and blocks Disabled / Inactive members', async () => {
    const { db, audit } = setup(); const h = await bcrypt.hash('Pass#12345', 10);
    const ok = await mk(db, { name: 'Ravi', role: 'Agent', email: 'r@x.in', passwordHash: h }); await mk(db, { name: 'Off', role: 'Agent', email: 'o@x.in', passwordHash: h, status: 'Disabled' }); await mk(db, { name: 'Old', role: 'Agent', email: 'old@x.in', passwordHash: h, status: 'Inactive' });
    const auth = new AuthService(db, jwt, perms, audit);
    const res = await auth.login('R@x.in ', 'Pass#12345'); assert.equal(res.token, 'token'); assert.ok(db.users.find((x: any) => x.id === ok.id).lastLoginAt instanceof Date);
    await rejects(auth.login('o@x.in', 'Pass#12345'), UnauthorizedException); await rejects(auth.login('old@x.in', 'Pass#12345'), UnauthorizedException); await rejects(auth.login('r@x.in', 'bad'), UnauthorizedException);
  });
  await t('JWT: tokens issued before a reset / deactivation are refused, newer ones and disabled users handled', async () => {
    const { db } = setup(); const strat = new JwtStrategy(db, { get: () => 'secret' } as any);
    const u = await mk(db, { name: 'Ravi', role: 'Agent', email: 'r@x.in' }); const now = Math.floor(Date.now() / 1000);
    assert.equal((await strat.validate({ sub: u.id, iat: now - 100 })).name, 'Ravi');
    db.users[0].sessionsValidFrom = new Date(now * 1000);
    await rejects(strat.validate({ sub: u.id, iat: now - 100 }), UnauthorizedException);
    assert.equal((await strat.validate({ sub: u.id, iat: now })).name, 'Ravi', 'a token issued after the reset still works');
    db.users[0].status = 'Disabled'; await rejects(strat.validate({ sub: u.id, iat: now + 5 }), UnauthorizedException);
    await rejects(strat.validate({ sub: 'gone', iat: now }), UnauthorizedException);
  });

  console.log(process.exitCode ? '\nSome tests FAILED' : `\nAll ${passed} tests passed`);
})();
