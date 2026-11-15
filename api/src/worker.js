import { AccessError, createAccess, permits, capabilitiesFor } from './access.js';
import { createOracle } from './oracle.js';
import { adminRoute } from './admin.js';
import { mediaRoute } from './media.js';

const json = (body, status, extra = {}) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra },
});

// Content writes require both an authorized role and ENABLE_CONTENT_WRITES.
export function createWorker({ authenticate = createAccess(), diagnostic, admin } = {}) {
  return {
    async fetch(request, env) {
      let identity;
      try { identity = await authenticate(request, env); }
      catch (error) {
        const status = error instanceof AccessError ? error.status : 503;
        return json({ error: status === 503 ? 'Servicio no disponible' : 'Acceso denegado' }, status);
      }
      if (!permits(identity.role, 'content:read')) return json({ error: 'Acceso denegado' }, 403);
      const path = new URL(request.url).pathname;
      const mediaResponse=await mediaRoute(request,env,identity,admin);
      if(mediaResponse) return mediaResponse;
      if (path.startsWith('/admin/')) {
        const response = await adminRoute(request, env, identity, admin, json);
        if (response) return response;
      }
      if (path === '/admin' || path === '/admin/' || path.startsWith('/assets/') || path.startsWith('/images/')) {
        if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Método no permitido' }, 405);
        if (!env.ASSETS?.fetch) return json({ error: 'El panel todavía no está instalado' }, 503);
        const url = new URL(request.url);
        if (path === '/admin' || path === '/admin/') url.pathname = '/index.html';
        const result = await env.ASSETS.fetch(new Request(url, request));
        const headers = new Headers(result.headers); headers.set('Cache-Control', 'private, no-store');
        return new Response(result.body, { status: result.status, headers });
      }
      if (!['/', '/session'].includes(path)) return json({ error: 'Recurso no disponible' }, 404);
      if (request.method !== 'GET') return json({ error: 'Método no permitido' }, 405, { Allow: 'GET' });
      if (path === '/session') return json({ role: identity.role, capabilities: capabilitiesFor(identity.role) }, 200);
      if (typeof diagnostic !== 'function') return json({ error: 'Servicio no disponible' }, 503);
      try { return json(await diagnostic(), 200); }
      catch { return json({ error: 'No se pudo consultar Oracle' }, 502); }
    },
  };
}

// Keep OAuth/JWKS caches inside the isolate; membership is queried on every call.
// A changed configuration rebuilds both clients. No roles are cached.
export function createRuntime({ fetchImpl = fetch, keyResolver } = {}) {
  let previous, worker;
  return {
    async fetch(request, env) {
      const config = [env.ORACLE_BASE_URL, env.ORACLE_CLIENT_ID, env.ORACLE_CLIENT_SECRET,
        env.ACCESS_ISSUER, env.ACCESS_AUD];
      try {
        if (!worker || !previous || config.some((value, i) => value !== previous[i])) {
          const oracle = createOracle(env, { fetchImpl });
          worker = createWorker({
            authenticate: createAccess({ findMember: oracle.findMember, keyResolver }),
            diagnostic: oracle.diagnostic,
            admin: oracle.admin,
          });
          previous = config;
        }
        return await worker.fetch(request, env);
      } catch { return json({ error: 'Servicio no disponible' }, 503); }
    },
  };
}

export default createRuntime();
