import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from 'jose';
import { createAccess, permits } from '../src/access.js';
import { createWorker, createRuntime } from '../src/worker.js';

// Real signatures; only the external identity key store and Oracle repository
// are replaced. No network or real user data is involved in these tests.
const issuer = 'https://test-team.cloudflareaccess.com';
const config = { ACCESS_ISSUER: issuer, ACCESS_AUD: 'test-application' };
const pair = await generateKeyPair('RS256');
const jwk = { ...await exportJWK(pair.publicKey), kid: 'test-key' };
const keys = createLocalJWKSet({ keys: [jwk] });
const member = { role: 'editor', enabled: true };
const token = (claims = {}, key = pair.privateKey) => new SignJWT({ type: 'app', ...claims })
  .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
  .setIssuer(claims.iss ?? issuer).setAudience(claims.aud ?? 'test-application')
  .setSubject(claims.sub ?? 'test-person').setIssuedAt()
  .setExpirationTime(claims.exp ?? '5m').sign(key);
const request = (jwt, path = '/', method = 'GET') => new Request(`https://api.test${path}`, {
  method, headers: jwt ? { 'Cf-Access-Jwt-Assertion': jwt } : {},
});
const access = (findMember = async () => member) => createAccess({ findMember, keyResolver: keys });

test('valid identity is looked up by issuer and subject, not an email header', async () => {
  const authenticate = access(async identity => {
    assert.deepEqual(identity, { issuer, subject: 'test-person' });
    return member;
  });
  assert.equal((await authenticate(request(await token()), config)).role, 'editor');
});

for (const [name, claims] of [
  ['expired', { exp: 1 }], ['wrong audience', { aud: 'other' }],
  ['wrong issuer', { iss: 'https://other.cloudflareaccess.com' }],
  ['empty subject', { sub: '' }], ['service token', { type: 'service' }],
]) {
  test(`rejects ${name} before Oracle lookup`, async () => {
    await assert.rejects(access(() => { assert.fail('must not query membership'); })(request(await token(claims)), config), { status: 401 });
  });
}
test('rejects forged, malformed and absent tokens', async () => {
  const attacker = await generateKeyPair('RS256');
  for (const value of [undefined, 'invalid', await token({}, attacker.privateKey)]) {
    await assert.rejects(access()(request(value), config), { status: 401 });
  }
});
for (const value of [null, { role: 'owner', enabled: false }, { role: 'admin', enabled: true }]) {
  test(`denies inactive or unknown member ${JSON.stringify(value)}`, async () => {
    await assert.rejects(access(async () => value)(request(await token()), config), { status: 403 });
  });
}
test('missing configuration and unavailable membership fail closed', async () => {
  const req = request(await token());
  await assert.rejects(access()(req, {}), { status: 503 });
  await assert.rejects(createAccess({ keyResolver: keys })(req, config), { status: 503 });
  await assert.rejects(access(async () => { throw new Error('private oracle detail'); })(req, config), { status: 503 });
});
test('roles cannot escalate privileges and unknown capabilities are denied', () => {
  assert.equal(permits('viewer', 'content:read'), true);
  assert.equal(permits('viewer', 'content:write'), false);
  assert.equal(permits('editor', 'content:write'), true);
  assert.equal(permits('editor', 'members:manage'), false);
  assert.equal(permits('owner', 'members:manage'), true);
  assert.equal(permits('owner', 'unknown'), false);
  assert.equal(permits('unknown', 'content:read'), false);
});
test('worker authenticates before invoking Oracle and never exposes internal errors', async () => {
  let calls = 0;
  const worker = createWorker({ authenticate: access(), diagnostic: async () => {
    calls++; return { conexion: true, resultado: 'Conexion correcta' };
  } });
  const denied = await worker.fetch(request(), config);
  assert.equal(denied.status, 401);
  assert.equal(calls, 0);
  const allowed = await worker.fetch(request(await token()), config);
  assert.equal(allowed.status, 200);
  assert.deepEqual(await allowed.json(), { conexion: true, resultado: 'Conexion correcta' });
  assert.equal(allowed.headers.get('cache-control'), 'no-store');
  const broken = createWorker({ authenticate: access(), diagnostic: async () => { throw new Error('secret'); } });
  const failure = await broken.fetch(request(await token()), config);
  assert.equal(failure.status, 502);
  assert.equal((await failure.text()).includes('secret'), false);
});
test('worker refuses writes and unknown paths and disconnected adapters', async () => {
  const jwt = await token();
  const worker = createWorker({ authenticate: access() });
  assert.equal((await worker.fetch(request(jwt, '/', 'POST'), config)).status, 405);
  assert.equal((await worker.fetch(request(jwt, '/unregistered'), config)).status, 404);
  assert.equal((await worker.fetch(request(jwt), config)).status, 503);
});

test('session exposes Oracle-backed role and its exact capabilities without identity secrets', async () => {
  for (const [role, expected] of [
    ['owner', ['content:read', 'content:write', 'content:publish', 'members:manage', 'audit:read']],
    ['editor', ['content:read', 'content:write', 'content:publish']],
    ['viewer', ['content:read']],
  ]) {
    const worker = createWorker({ authenticate: access(async () => ({ role, enabled: true })) });
    const result = await worker.fetch(request(await token(), '/session'), config);
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { role, capabilities: expected });
    assert.equal((await worker.fetch(request(await token(), '/session', 'POST'), config)).status, 405);
  }
});

test('complete runtime verifies JWT, queries Oracle and observes revocation on next request', async () => {
  let enabled = 1, lookups = 0;
  const runtime = createRuntime({ keyResolver: keys, fetchImpl: async url => {
    if (url.pathname.endsWith('/oauth/token')) return Response.json({ access_token: 'test-access', token_type: 'bearer', expires_in: 3600 });
    lookups++;
    return Response.json({ items: [{ role: 'owner', enabled }], hasMore: false });
  } });
  const runtimeEnv = { ...config, ORACLE_BASE_URL: 'https://oracle.test/ords/ras_app/',
    ORACLE_CLIENT_ID: 'test-client', ORACLE_CLIENT_SECRET: 'test-secret' };
  assert.equal((await runtime.fetch(request('forged', '/session'), runtimeEnv)).status, 401);
  assert.equal(lookups, 0);
  const jwt = await token();
  const allowed = await runtime.fetch(request(jwt, '/session'), runtimeEnv);
  assert.equal(allowed.status, 200);
  assert.equal((await allowed.json()).role, 'owner');
  enabled = 0;
  assert.equal((await runtime.fetch(request(jwt, '/session'), runtimeEnv)).status, 403);
  assert.equal(lookups, 2);
  assert.equal((await runtime.fetch(request(jwt, '/session'), {})).status, 503);
});
