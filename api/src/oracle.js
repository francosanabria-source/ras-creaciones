const invalid = () => new Error('Oracle service unavailable');

function fail(stage, reason, status) {
  // Only controlled labels and numeric HTTP status. Never log URLs, bodies,
  // credentials, JWTs, OAuth tokens or identities.
  console.warn('RAS_API_DIAGNOSTIC', { stage, reason, ...(status === undefined ? {} : { status }) });
  throw invalid();
}

async function readJSON(response, stage, maxBytes = 65536) {
  if (!response.ok) fail(stage, 'http-error', response.status);
  let text;
  try {
    const reader = response.body?.getReader(), decoder = new TextDecoder();
    let length = 0; text = '';
    if (!reader) fail(stage, 'invalid-json');
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > maxBytes) { await reader.cancel(); fail(stage, 'oversized-payload'); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  }
  catch { fail(stage, 'body-read-error'); }
  try { return JSON.parse(text); }
  catch { fail(stage, 'invalid-json'); }
}

export function createOracle(env, { fetchImpl = fetch } = {}) {
  let base;
  try { base = new URL(env.ORACLE_BASE_URL); } catch { fail('configuration', 'invalid-oracle-base-url'); }
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash ||
      !/^\/ords\/[a-zA-Z0-9_-]+\/$/.test(base.pathname)) fail('configuration', 'invalid-oracle-base-url');
  if (!env.ORACLE_CLIENT_ID) fail('configuration', 'missing-oracle-client-id');
  if (!env.ORACLE_CLIENT_SECRET) fail('configuration', 'missing-oracle-client-secret');
  let token, validUntil = 0;
  // Workers supports manual/follow only. Manual returns 3xx to readJSON,
  // which rejects it without forwarding Authorization to another origin.
  const options = () => ({ redirect: 'manual', signal: AbortSignal.timeout(8000) });
  async function send(url, init, stage) {
    try { return await fetchImpl(url, init); }
    catch { fail(stage, 'network-error'); }
  }
  async function bearer() {
    if (token && Date.now() < validUntil) return token;
    const credentials = `${encodeURIComponent(env.ORACLE_CLIENT_ID)}:${encodeURIComponent(env.ORACLE_CLIENT_SECRET)}`;
    const data = await readJSON(await send(new URL('oauth/token', base), {
      ...options(), method: 'POST',
      headers: { Authorization: `Basic ${btoa(credentials)}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: 'grant_type=client_credentials',
    }, 'oracle-oauth'), 'oracle-oauth');
    if (typeof data.access_token !== 'string' || !data.access_token ||
        data.token_type?.toLowerCase() !== 'bearer' ||
        !Number.isFinite(data.expires_in) || data.expires_in <= 0) fail('oracle-oauth', 'invalid-payload');
    token = data.access_token;
    validUntil = Date.now() + Math.max(0, Math.min(data.expires_in, 3600) - 30) * 1000;
    return token;
  }
  async function adminRequest(resource, identity, offset, body) {
    const url = new URL(`rc-admin/${resource}`, base);
    if (!body) {
      url.searchParams.set('actor_issuer', identity.issuer);
      url.searchParams.set('actor_subject', identity.subject);
      url.searchParams.set('offset', String(offset));
    }
    const response = await send(url, { ...options(), method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${await bearer()}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify({ ...body, actor_issuer: identity.issuer, actor_subject: identity.subject }) } : {}),
    }, 'oracle-admin');
    // Up to 100 records including body and serialized JSON attributes.
    // OAuth and membership retain their much smaller response limit.
    return readJSON(response, 'oracle-admin', body ? 65536 : 8 * 1024 * 1024);
  }
  async function collection(resource, identity, offset) {
    const data = await adminRequest(resource, identity, offset);
    if (!data || !Array.isArray(data.items) || data.items.length > 100) fail('oracle-admin', 'invalid-payload');
    return { items: data.items.map(row => ({ ...row, ...(resource === 'content' ? {
      attributes: typeof row.attributes === 'string' ? JSON.parse(row.attributes) : (row.attributes ?? {}),
    } : {}) })), hasMore: data.hasMore === true };
  }
  async function publishedRequest(path, offset) {
    const url=new URL(`rc-published/${path}`,base);
    if(offset!==undefined) url.searchParams.set('offset',String(offset));
    return send(url,{...options(),headers:{Authorization:`Bearer ${await bearer()}`,Accept:path==='content'?'application/json':'image/*'}},'oracle-public');
  }
  return {
    async listPublished(offset=0) {
      const data=await readJSON(await publishedRequest('content',offset),'oracle-public',8*1024*1024);
      if(!Array.isArray(data.items)) fail('oracle-public','invalid-payload');
      return {items:data.items.map(row=>({...row,attributes:typeof row.attributes==='string'?JSON.parse(row.attributes):row.attributes})),hasMore:data.hasMore===true};
    },
    publicMedia:id=>publishedRequest(`media/${id}`),
    admin: {
      async saveMedia(identity,data) {
        const response=await send(new URL('rc-media/upload',base),{redirect:'manual',signal:AbortSignal.timeout(30000),method:'POST',
          headers:{Authorization:`Bearer ${await bearer()}`,'Content-Type':'application/json'},
          body:JSON.stringify({...data,actor_issuer:identity.issuer,actor_subject:identity.subject})},'oracle-media');
        return readJSON(response,'oracle-media');
      },
      async privateMedia(identity,id) {
        const url=new URL(`rc-media/image/${id}`,base);url.searchParams.set('actor_issuer',identity.issuer);url.searchParams.set('actor_subject',identity.subject);
        return send(url,{...options(),headers:{Authorization:`Bearer ${await bearer()}`}},'oracle-media');
      },
      listContent: (identity, offset = 0) => collection('content', identity, offset),
      listMembers: (identity, offset = 0) => collection('members', identity, offset),
      listAudit: (identity, offset = 0) => collection('audit', identity, offset),
      saveContent: (identity, data) => adminRequest('content', identity, 0, data),
    },
    async findMember({ issuer, subject }) {
      if (typeof issuer !== 'string' || typeof subject !== 'string' || !subject || subject.length > 255) throw invalid();
      const url = new URL(`rc-auth/members/${encodeURIComponent(subject)}`, base);
      url.searchParams.set('issuer', issuer);
      let response;
      for (let attempt = 0; attempt < 2; attempt++) {
        response = await send(url, { ...options(), headers: {
          Authorization: `Bearer ${await bearer()}`, Accept: 'application/json',
        } }, 'oracle-membership');
        if (response.status !== 401 || attempt === 1) break;
        await response.body?.cancel();
        token = undefined; validUntil = 0;
      }
      const data = await readJSON(response, 'oracle-membership');
      if (!Array.isArray(data.items) || data.items.length > 1 || data.hasMore === true) fail('oracle-membership', 'invalid-payload');
      if (!data.items.length) return null;
      const row = data.items[0];
      if (!row || !['owner', 'editor', 'viewer'].includes(row.role) || ![0, 1].includes(row.enabled)) fail('oracle-membership', 'invalid-payload');
      return { role: row.role, enabled: row.enabled === 1 };
    },
    async diagnostic() {
      const data = await readJSON(await send(new URL('prueba/estado', base), { ...options(), headers: { Accept: 'application/json' } }, 'oracle-diagnostic'), 'oracle-diagnostic');
      if (data.items?.[0]?.resultado !== 'Conexion correcta') fail('oracle-diagnostic', 'invalid-payload');
      return { conexion: true, resultado: 'Conexion correcta' };
    },
  };
}
