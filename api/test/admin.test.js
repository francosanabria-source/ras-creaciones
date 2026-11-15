import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from '../src/worker.js';
const identity = { issuer: 'https://team.cloudflareaccess.com', subject: 'test-person', role: 'editor' };
const content = { type: 'product', title: 'Cintas', slug: 'cintas', body: '', state: 'draft', attributes: { price: 4800, category: 'insumos', image: '', description: 'Cintas de raso', topics: [] } };
function req(path, method = 'GET', body, origin = 'https://api.test') {
  return new Request(`https://api.test${path}`, { method, headers: { Origin: origin, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
function app(role = 'editor', admin = {}) { return createWorker({ authenticate: async () => ({ ...identity, role }), admin }); }
test('editor can read content but cannot read members or audit', async () => {
  const worker = app('editor', { listContent: async actor => { assert.equal(actor.subject, 'test-person'); return { items: [] }; },
    listMembers: async () => assert.fail('must not access members'), listAudit: async () => assert.fail('must not access audit') });
  assert.equal((await worker.fetch(req('/admin/content'), {})).status, 200);
  assert.equal((await worker.fetch(req('/admin/members'), {})).status, 403);
  assert.equal((await worker.fetch(req('/admin/audit'), {})).status, 403);
});
test('owner can read protected team and audit collections', async () => {
  const worker = app('owner', { listMembers: async () => ({ items: [{ role: 'editor' }] }), listAudit: async () => ({ items: [] }) });
  assert.equal((await worker.fetch(req('/admin/members'), {})).status, 200);
  assert.equal((await worker.fetch(req('/admin/audit'), {})).status, 200);
});
test('viewer cannot save content even when a client fabricates a capability', async () => {
  const worker = app('viewer', { saveContent: async () => assert.fail('must not write') });
  assert.equal((await worker.fetch(req('/admin/content', 'POST', content), { ENABLE_CONTENT_WRITES: 'true' })).status, 403);
});
test('content writes require opt-in, exact same origin and valid JSON input', async () => {
  const worker = app('editor', { saveContent: async () => assert.fail('must not write') });
  assert.equal((await worker.fetch(req('/admin/content', 'POST', content), {})).status, 503);
  for (const origin of ['https://evil.test', 'null', '']) {
    assert.equal((await worker.fetch(req('/admin/content', 'POST', content, origin), { ENABLE_CONTENT_WRITES: 'true' })).status, 403);
  }
  for (const body of [{ ...content, slug: '<script>' }, { ...content, title: '' }, { ...content, attributes: { price: -1 } },
    { ...content, attributes: { ...content.attributes, image: 'javascript:alert(1)' } }, { ...content, actor_subject: 'forged' }]) {
    assert.equal((await worker.fetch(req('/admin/content', 'POST', body), { ENABLE_CONTENT_WRITES: 'true' })).status, 400);
  }
});
test('an authorized save uses verified actor and maps a revision conflict', async () => {
  const worker = app('editor', { saveContent: async (actor, data) => {
    assert.equal(actor.subject, 'test-person'); assert.equal(data.title, 'Cintas');
    return { status: 'ok', id: 7, revision: 1 };
  } });
  const result = await worker.fetch(req('/admin/content', 'POST', content), { ENABLE_CONTENT_WRITES: 'true' });
  assert.equal(result.status, 200); assert.equal((await result.json()).id, 7);
  const conflict = app('editor', { saveContent: async () => ({ status: 'conflict' }) });
  assert.equal((await conflict.fetch(req('/admin/content', 'POST', content), { ENABLE_CONTENT_WRITES: 'true' })).status, 409);
});
test('large bodies, non-JSON payloads and invalid paging are rejected', async () => {
  const worker = app('editor', { saveContent: async () => assert.fail('must not write') });
  const large = req('/admin/content', 'POST', { ...content, body: 'x'.repeat(40000) });
  assert.equal((await worker.fetch(large, { ENABLE_CONTENT_WRITES: 'true' })).status, 413);
  const plain = new Request('https://api.test/admin/content', { method: 'POST', headers: { Origin: 'https://api.test', 'Content-Type': 'text/plain' }, body: 'hello' });
  assert.equal((await worker.fetch(plain, { ENABLE_CONTENT_WRITES: 'true' })).status, 415);
  assert.equal((await worker.fetch(req('/admin/content?offset=-1'), {})).status, 400);
});
test('admin HTML and assets remain protected and are only served for GET requests', async () => {
  const worker = app('editor');
  const env = { ASSETS: { fetch: async () => new Response('<html>Admin</html>', { headers: { 'Content-Type': 'text/html' } }) } };
  assert.equal((await worker.fetch(req('/admin/'), env)).status, 200);
  assert.equal((await worker.fetch(req('/admin/', 'POST', {}), env)).status, 405);
  assert.equal((await worker.fetch(req('/admin/'), {})).status, 503);
});
