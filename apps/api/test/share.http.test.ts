// HTTP-level test for the share endpoints: boots a small Nest app with the REAL global guards (login + permissions) and a stubbed ShareService,
// to prove that POST /api/share/matches needs a login and valid input, and that GET /api/share/f/:token is public but only for valid tokens.
// Run:  npm run test:share:http   (from apps/api)
import 'reflect-metadata';
import * as assert from 'assert';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard, PermGuard } from '../src/auth/guards';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { PermissionsService } from '../src/auth/permissions.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ShareController } from '../src/share/share.controller';
import { ShareService } from '../src/share/share.service';
import { signToken } from '../src/share/share.token';

process.env.JWT_SECRET = 'test-secret';
const tmp = path.join(os.tmpdir(), 'sf-http-doc.pdf'); fs.writeFileSync(tmp, '%PDF-1.4 hello');
const calls: any[] = [];
const svc: any = {
  send: async (_u: any, b: any) => { calls.push(b); return { ok: true }; },
  resolve: async (p: any) => p.k === 'pdf' ? { kind: 'pdf', name: 'Matched properties - Priya.pdf', buf: Buffer.from('%PDF-1.4 x') } : p.k === 'doc' ? { kind: 'doc', name: 'Floor plan.pdf', mime: 'application/pdf', abs: tmp } : null,
};
const db: any = { user: { findUnique: async ({ where }: any) => (where.id === 'u1' ? { id: 'u1', name: 'Anil', role: 'Owner', email: 'a@x.in', status: 'Active', seeNumbers: true, sessionsValidFrom: null } : null) } };
const perms: any = { level: async () => 'write', can: async () => true };

@Module({
  controllers: [ShareController],
  providers: [{ provide: ShareService, useValue: svc }, { provide: PrismaService, useValue: db }, { provide: ConfigService, useValue: { get: () => 'test-secret' } }, { provide: PermissionsService, useValue: perms },
    JwtStrategy, { provide: APP_GUARD, useClass: JwtAuthGuard }, { provide: APP_GUARD, useClass: PermGuard }],
})
class TestModule {}

let passed = 0;
async function t(name: string, fn: () => Promise<void>) { try { await fn(); passed++; console.log('  ok  ' + name); } catch (e: any) { process.exitCode = 1; console.log('  FAIL ' + name + '\n       ' + (e && e.message)); } }

(async () => {
  const app = await NestFactory.create(TestModule, { logger: false }); app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: true }));
  await app.listen(0); const base = (await app.getUrl()).replace('[::1]', 'localhost').replace('127.0.0.1', 'localhost');
  const login = new JwtService({ secret: 'test-secret' }).sign({ sub: 'u1' });
  const post = (b: any, tok?: string) => fetch(base + '/api/share/matches', { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(b) });
  const good = { channel: 'email', prospectId: 'c1', requirementId: 'R1', propertyIds: ['RS001'] };

  console.log('POST /api/share/matches');
  await t('needs a login', async () => { assert.equal((await post(good)).status, 401); });
  await t('a signed-in user with valid input gets through to the service', async () => { calls.length = 0; const r = await post(good, login); assert.equal(r.status, 201); assert.equal(calls[0].propertyIds[0], 'RS001'); });
  await t('bad channel, no properties, or more than 10 properties are 400', async () => {
    assert.equal((await post({ ...good, channel: 'sms' }, login)).status, 400); assert.equal((await post({ ...good, propertyIds: [] }, login)).status, 400);
    assert.equal((await post({ ...good, propertyIds: Array.from({ length: 11 }, (_, i) => 'P' + i) }, login)).status, 400);
  });

  console.log('GET /api/share/f/:token (public)');
  const get = (tok: string, h: any = {}) => fetch(base + '/api/share/f/' + tok, { headers: h });
  await t('a valid PDF link downloads without any login, with safe headers', async () => {
    const r = await get(signToken({ k: 'pdf', u: 'u1' })); assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'application/pdf'); assert.match(String(r.headers.get('content-disposition')), /^attachment; filename\*=UTF-8''Matched%20properties/);
    assert.equal(r.headers.get('cache-control'), 'private, no-store'); assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.equal((await r.text()).slice(0, 5), '%PDF-');
  });
  await t('a valid document link streams the file', async () => { const r = await get(signToken({ k: 'doc', f: 'f1' })); assert.equal(r.status, 200); assert.equal(await r.text(), '%PDF-1.4 hello'); });
  await t('tampered, expired, unknown-kind and login tokens are all a plain 404', async () => {
    assert.equal((await get(signToken({ k: 'doc', f: 'f1' }) + 'x')).status, 404); assert.equal((await get(signToken({ k: 'doc', f: 'f1' }, 7, 1000))).status, 404);
    assert.equal((await get(signToken({ k: 'zip' }))).status, 404); assert.equal((await get(login)).status, 404); assert.equal((await get('nonsense')).status, 404);
  });
  await t('too many downloads from one address get 429', async () => {
    let last = 0; for (let i = 0; i < 130; i++) last = (await get('nonsense', { 'x-forwarded-for': '9.9.9.9' })).status; assert.equal(last, 429);
    assert.equal((await get(signToken({ k: 'doc', f: 'f1' }), { 'x-forwarded-for': '8.8.8.8' })).status, 200, 'another address is not affected');
  });

  await app.close(); console.log(process.exitCode ? '\nSome tests FAILED' : `\nAll ${passed} tests passed`);
})();
