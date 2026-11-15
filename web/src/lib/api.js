export class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
export function privateImage(image){
  try{const url=new URL(image);if(url.origin==='https://ras-creaciones.tienda26.workers.dev'&&/^\/media\/[1-9]\d*$/.test(url.pathname))return `/admin${url.pathname}`;}catch{}
  return image;
}
async function request(path, options = {}) {
  let response;
  try { response = await fetch(path, { credentials: 'same-origin', redirect: 'manual', ...options }); }
  catch { throw new ApiError(0, 'No pudimos conectar. Revisá tu conexión y volvé a intentar.'); }
  if (response.status === 0 || (response.status >= 300 && response.status < 400) || !response.headers.get('Content-Type')?.includes('application/json')) {
    throw new ApiError(401, 'Tu sesión venció. Volvé a ingresar.');
  }
  const data = await response.json();
  if (!response.ok) throw new ApiError(response.status, data.error || 'No se pudo completar la operación.');
  return data;
}
export const api = {
  async session() {
    const data = await request('/session');
    if (!['owner', 'editor', 'viewer'].includes(data.role) || !Array.isArray(data.capabilities)) throw new ApiError(403, 'Acceso no disponible');
    return data;
  },
  async list(resource, offset = 0) {
    if (!['content', 'members', 'audit'].includes(resource)) throw new Error('Invalid resource');
    const data = await request(`/admin/${resource}?offset=${offset}`);
    if (!Array.isArray(data.items)) throw new ApiError(503, 'No pudimos cargar la información.');
    return data;
  },
  save: data => request('/admin/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  upload: (id,revision,alt,file)=>request(`/admin/content/${id}/photo?${new URLSearchParams({revision,alt})}`,{method:'POST',headers:{'Content-Type':file.type},body:file}),
};
