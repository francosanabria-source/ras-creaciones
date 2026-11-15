import test from 'node:test';
import assert from 'node:assert/strict';
import { createOracle } from '../src/oracle.js';

const base = 'https://database.oraclecloudapps.com/ords/ras_app/';
const env = { ORACLE_BASE_URL: base, ORACLE_CLIENT_ID: 'test-client', ORACLE_CLIENT_SECRET: 'test-secret' };
const identity = { issuer: 'https://team.cloudflareaccess.com', subject: 'test-person' };
function server({ rows = [{ role: 'owner', enabled: 1 }], tokenStatus = 200, memberStatus = 200, retry = false } = {}) {
  let tokenCalls = 0, queries = 0;
  return {
    counts: () => ({ tokenCalls, queries }),
    fetch: async (url, options) => {
      assert.equal(options.redirect, 'manual');
      if (url.href === `${base}oauth/token`) {
        tokenCalls++;
        assert.equal(options.method, 'POST');
        assert.equal(options.headers.Authorization, `Basic ${btoa('test-client:test-secret')}`);
        assert.equal(options.body, 'grant_type=client_credentials');
        return Response.json({ access_token: `token-${tokenCalls}`, token_type: 'bearer', expires_in: 3600 }, { status: tokenStatus });
      }
      if (url.pathname.includes('/rc-auth/members/')) {
        queries++;
        assert.equal(url.pathname, '/ords/ras_app/rc-auth/members/test-person');
        assert.equal(url.searchParams.get('issuer'), identity.issuer);
        assert.match(options.headers.Authorization, /^Bearer token-/);
        return Response.json({ items: rows, hasMore: false }, { status: retry && queries === 1 ? 401 : memberStatus });
      }
      assert.equal(url.href, `${base}prueba/estado`);
      return Response.json({ items: [{ resultado: 'Conexion correcta' }] });
    },
  };
}
test('Oracle owner comes from the protected lookup, tokens cached but memberships refreshed', async () => {
  const fake = server();
  const db = createOracle(env, { fetchImpl: fake.fetch });
  assert.deepEqual(await db.findMember(identity), { role: 'owner', enabled: true });
  assert.deepEqual(await db.findMember(identity), { role: 'owner', enabled: true });
  assert.deepEqual(fake.counts(), { tokenCalls: 1, queries: 2 });
  assert.deepEqual(await db.diagnostic(), { conexion: true, resultado: 'Conexion correcta' });
});
for (const [name, rows, expected] of [
  ['absent', [], null], ['disabled', [{ role: 'owner', enabled: 0 }], { role: 'owner', enabled: false }],
  ['viewer', [{ role: 'viewer', enabled: 1 }], { role: 'viewer', enabled: true }],
]) test(`Oracle maps ${name} membership`, async () => {
  assert.deepEqual(await createOracle(env, { fetchImpl: server({ rows }).fetch }).findMember(identity), expected);
});
for (const rows of [[{ role: 'root', enabled: 1 }], [{ role: 'owner', enabled: '1' }],
  [{ role: 'owner', enabled: 1 }, { role: 'editor', enabled: 1 }]]) {
  test(`rejects ambiguous or malformed Oracle membership ${JSON.stringify(rows)}`, async () => {
    await assert.rejects(createOracle(env, { fetchImpl: server({ rows }).fetch }).findMember(identity));
  });
}
test('Oracle OAuth and query errors do not become authorized members', async () => {
  for (const options of [{ tokenStatus: 401 }, { memberStatus: 500 }]) {
    await assert.rejects(createOracle(env, { fetchImpl: server(options).fetch }).findMember(identity));
  }
});
test('a rejected bearer token is renewed once', async () => {
  const fake = server({ retry: true });
  assert.equal((await createOracle(env, { fetchImpl: fake.fetch }).findMember(identity)).role, 'owner');
  assert.deepEqual(fake.counts(), { tokenCalls: 2, queries: 2 });
});
test('configuration refuses non-HTTPS, embedded credentials and missing secrets', () => {
  for (const bad of [{}, { ...env, ORACLE_BASE_URL: 'http://database.test/ords/ras_app/' },
    { ...env, ORACLE_BASE_URL: 'https://user:password@database.test/ords/ras_app/' },
    { ...env, ORACLE_CLIENT_SECRET: '' }]) assert.throws(() => createOracle(bad));
});

test('diagnostics identify the failing Oracle stage without logging credentials or response bodies', async t => {
  const logger = t.mock.method(console, 'warn', () => {});
  await assert.rejects(createOracle(env, { fetchImpl: server({ tokenStatus: 401 }).fetch }).findMember(identity));
  assert.deepEqual(logger.mock.calls[0].arguments, ['RAS_API_DIAGNOSTIC', {
    stage: 'oracle-oauth', reason: 'http-error', status: 401,
  }]);
  await assert.rejects(createOracle(env, { fetchImpl: server({ memberStatus: 500 }).fetch }).findMember(identity));
  assert.deepEqual(logger.mock.calls.at(-1).arguments, ['RAS_API_DIAGNOSTIC', {
    stage: 'oracle-membership', reason: 'http-error', status: 500,
  }]);
  const logs = JSON.stringify(logger.mock.calls.map(call => call.arguments));
  for (const sensitive of ['test-client', 'test-secret', 'token-1', 'test-person']) {
    assert.equal(logs.includes(sensitive), false);
  }
});

test('diagnostics distinguish network failure from invalid membership data', async t => {
  const logger = t.mock.method(console, 'warn', () => {});
  await assert.rejects(createOracle(env, { fetchImpl: async () => { throw new Error('private-secret'); } }).findMember(identity));
  assert.deepEqual(logger.mock.calls[0].arguments, ['RAS_API_DIAGNOSTIC', {
    stage: 'oracle-oauth', reason: 'network-error',
  }]);
  await assert.rejects(createOracle(env, { fetchImpl: server({ rows: [{ role: 'root', enabled: 1 }] }).fetch }).findMember(identity));
  assert.deepEqual(logger.mock.calls.at(-1).arguments, ['RAS_API_DIAGNOSTIC', {
    stage: 'oracle-membership', reason: 'invalid-payload',
  }]);
  assert.equal(JSON.stringify(logger.mock.calls.map(call => call.arguments)).includes('private-secret'), false);
});

test('Oracle requests work with the redirect modes supported by Cloudflare Workers', async () => {
  const upstream = server();
  const db = createOracle(env, { fetchImpl: async (url, options) => {
    // Characterization of the documented Workers boundary: unlike Node,
    // workerd throws before sending a request with redirect: error.
    if (!['follow', 'manual'].includes(options.redirect)) throw new TypeError('Invalid redirect value');
    return upstream.fetch(url, options);
  } });
  assert.equal((await db.findMember(identity)).role, 'owner');
});

test('an Oracle redirect is rejected without forwarding credentials to its destination', async t => {
  t.mock.method(console, 'warn', () => {});
  const calls = [], modes = [];
  const db = createOracle(env, { fetchImpl: async (url, options) => {
    calls.push(url.href);
    modes.push(options.redirect);
    return new Response(null, { status: 302, headers: { Location: 'https://untrusted.test/' } });
  } });
  await assert.rejects(db.findMember(identity));
  assert.deepEqual(modes, ['manual']);
  assert.deepEqual(calls, [`${base}oauth/token`]);
});

test('admin adapter supplies verified actor and parses stored JSON attributes', async () => {
  const db = createOracle(env, { fetchImpl: async (url, options) => {
    if (url.pathname.endsWith('/oauth/token')) return Response.json({ access_token: 'test-token', token_type: 'bearer', expires_in: 3600 });
    assert.equal(options.redirect, 'manual');
    assert.equal(url.pathname, '/ords/ras_app/rc-admin/content');
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal(body.actor_issuer, identity.issuer); assert.equal(body.actor_subject, identity.subject);
      assert.equal(body.title, 'Test');
      return Response.json({ status: 'ok', id: 1, revision: 1 });
    }
    assert.equal(url.searchParams.get('actor_subject'), identity.subject);
    assert.equal(url.searchParams.get('offset'), '100');
    return Response.json({ items: [{ id: 1, title: 'Test', attributes: '{"price":100}' }], hasMore: false });
  } });
  const result = await db.admin.listContent(identity, 100);
  assert.deepEqual(result.items[0].attributes, { price: 100 });
  assert.equal((await db.admin.saveContent(identity, { title: 'Test' })).status, 'ok');
});

test('admin pages can contain one hundred complete content records within a bounded response', async () => {
  const items = Array.from({ length: 100 }, (_, i) => ({ id: i+1, body: 'a'.repeat(5000), attributes: '{"price":100}' }));
  const db = createOracle(env, { fetchImpl: async url => url.pathname.endsWith('/oauth/token')
    ? Response.json({ access_token: 'test-token', token_type: 'bearer', expires_in: 3600 })
    : Response.json({ items, hasMore: false }) });
  assert.equal((await db.admin.listContent(identity)).items.length, 100);
});
