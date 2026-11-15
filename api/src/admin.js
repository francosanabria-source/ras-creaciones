import { permits } from './access.js';
export class InputError extends Error { constructor(status, message) { super(message); this.status = status; } }
const bad = () => { throw new InputError(400, 'Revisá los datos del contenido'); };
const text = (value, max, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) bad();
  return value.trim();
};
export function validateContent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(k => !['id', 'revision', 'type', 'title', 'slug', 'body', 'state', 'attributes'].includes(k))) bad();
  if (!['product', 'workshop', 'page'].includes(value.type) || !['draft', 'published', 'archived'].includes(value.state)) bad();
  const slug = text(value.slug, 160, true);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) bad();
  const id = value.id ?? null, revision = value.revision ?? 0;
  if (id !== null && (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(revision) || revision < 1)) bad();
  const a = value.attributes;
  if (!a || Array.isArray(a) || typeof a !== 'object' || Object.keys(a).some(k => !['category', 'price', 'image', 'description', 'topics'].includes(k))) bad();
  const price = a.price ?? 0;
  if (!Number.isSafeInteger(price) || price < 0 || price > 1000000000) bad();
  const image = text(a.image ?? '', 2048);
  if (image && !/^\/images\/[a-f0-9]+\.(png|jpeg|jpg|webp|svg)$/.test(image)) {
    let url; try { url = new URL(image); } catch { bad(); }
    if (url.protocol !== 'https:' || url.username || url.password) bad();
  }
  const topics = a.topics ?? [];
  if (!Array.isArray(topics) || topics.length > 12) bad();
  return { id, revision, type: value.type, title: text(value.title, 240, true), slug,
    body: text(value.body ?? '', 5000), state: value.state,
    attributes: { category: text(a.category ?? '', 120), price, image, description: text(a.description ?? '', 500), topics: topics.map(t => text(t, 200, true)) } };
}
async function bodyJSON(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new InputError(415, 'Se requiere JSON');
  const reader = request.body?.getReader(); if (!reader) bad();
  const chunks = []; let length = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    length += value.length;
    if (length > 32768) { await reader.cancel(); throw new InputError(413, 'El contenido es demasiado grande'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { bad(); }
}

export async function adminRoute(request, env, identity, repository, json) {
  const url = new URL(request.url), resource = url.pathname.slice('/admin/'.length);
  const routes = { content: ['content:read', 'listContent'], members: ['members:manage', 'listMembers'], audit: ['audit:read', 'listAudit'] };
  if (!Object.hasOwn(routes, resource)) return null;
  const [readCapability, method] = routes[resource];
  if (!permits(identity.role, readCapability)) return json({ error: 'Acceso denegado' }, 403);
  try {
    if (request.method === 'GET') {
      const offset = url.searchParams.get('offset') ?? '0';
      if (!/^\d{1,7}$/.test(offset)) throw new InputError(400, 'Página inválida');
      if (typeof repository?.[method] !== 'function') return json({ error: 'Servicio no disponible' }, 503);
      return json(await repository[method](identity, Number(offset)), 200);
    }
    if (resource !== 'content' || request.method !== 'POST') return json({ error: 'Método no permitido' }, 405, { Allow: resource === 'content' ? 'GET, POST' : 'GET' });
    if (!permits(identity.role, 'content:write')) return json({ error: 'Acceso denegado' }, 403);
    if (env.ENABLE_CONTENT_WRITES !== 'true') return json({ error: 'La edición todavía no está habilitada' }, 503);
    if (request.headers.get('Origin') !== url.origin) return json({ error: 'Origen no permitido' }, 403);
    const data = validateContent(await bodyJSON(request));
    if (data.state === 'published' && !permits(identity.role, 'content:publish')) return json({ error: 'Acceso denegado' }, 403);
    if (typeof repository?.saveContent !== 'function') return json({ error: 'Servicio no disponible' }, 503);
    const result = await repository.saveContent(identity, data);
    if (result.status === 'conflict') return json({ error: 'Otra persona modificó este contenido. Recargalo antes de guardar.' }, 409);
    if (result.status === 'duplicate') return json({ error: 'Ya existe contenido con ese enlace.' }, 409);
    if (result.status === 'denied') return json({ error: 'Acceso denegado' }, 403);
    if (result.status !== 'ok' || !Number.isSafeInteger(result.id) || !Number.isSafeInteger(result.revision)) throw new Error('Invalid save response');
    return json(result, 200);
  } catch (error) {
    if (error instanceof InputError) return json({ error: error.message }, error.status);
    return json({ error: 'No se pudo completar la operación. Tus cambios no se confirmaron.' }, 503);
  }
}
