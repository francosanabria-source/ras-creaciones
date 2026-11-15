import { createRemoteJWKSet, jwtVerify } from 'jose';

export class AccessError extends Error {
  constructor(status) { super('Access denied'); this.status = status; }
}

const capabilities = {
  viewer: ['content:read'],
  editor: ['content:read', 'content:write', 'content:publish'],
  owner: ['content:read', 'content:write', 'content:publish', 'members:manage', 'audit:read'],
};
export function permits(role, capability) {
  return Object.hasOwn(capabilities, role) && capabilities[role].includes(capability);
}

export function capabilitiesFor(role) {
  return Object.hasOwn(capabilities, role) ? [...capabilities[role]] : [];
}

// The resolver is provided by the Oracle integration once its real contract
// has been inspected. No header, email list or client-supplied role substitutes it.
export function createAccess({ findMember, keyResolver } = {}) {
  const remoteKeys = new Map();
  return async function authenticate(request, env) {
    const issuer = env.ACCESS_ISSUER;
    if (typeof issuer !== 'string' ||
        !/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/.test(issuer) ||
        typeof env.ACCESS_AUD !== 'string' || !env.ACCESS_AUD.trim()) {
      console.warn('RAS_API_DIAGNOSTIC', { stage: 'access-configuration', reason: 'invalid-issuer-or-audience' });
      throw new AccessError(503);
    }
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!token || token.length > 16384) throw new AccessError(401);
    let payload;
    try {
      let resolver = keyResolver;
      if (!resolver) {
        if (!remoteKeys.has(issuer)) {
          remoteKeys.set(issuer, createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)));
        }
        resolver = remoteKeys.get(issuer);
      }
      ({ payload } = await jwtVerify(token, resolver, {
        issuer, audience: env.ACCESS_AUD, algorithms: ['RS256'],
        requiredClaims: ['exp', 'iat', 'sub'],
      }));
      if (payload.type !== 'app' || typeof payload.sub !== 'string' || !payload.sub.trim()) {
        throw new Error('Invalid application identity');
      }
    } catch { throw new AccessError(401); }
    if (typeof findMember !== 'function') throw new AccessError(503);
    let member;
    try { member = await findMember({ issuer, subject: payload.sub }); }
    catch { throw new AccessError(503); }
    if (!member || member.enabled !== true || !permits(member.role, 'content:read')) {
      throw new AccessError(403);
    }
    return { issuer, subject: payload.sub, role: member.role };
  };
}
