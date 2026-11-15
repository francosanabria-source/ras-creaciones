import catalog from '../generated/catalog.json';
// Imported exclusively inside import.meta.env.DEV. Never authorizes API requests.
export function createPreviewClient(role) {
  let entries = [
    ...catalog.products.map((p,i) => ({ id:i+1, revision:1, type:'product', title:p.name, slug:p.id, body:'', state:i<5?'published':'draft', attributes:{ category:p.category, price:p.price, image:p.image, description:p.description, topics:[] } })),
    ...catalog.workshops.map((w,i) => ({ id:20+i, revision:1, type:'workshop', title:w.title, slug:w.id, body:w.description, state:'draft', attributes:{ category:'', price:0, image:w.image, description:w.summary, topics:w.topics } })),
  ];
  const capabilities = { owner:['content:read','content:write','content:publish','members:manage','audit:read'], editor:['content:read','content:write','content:publish'], viewer:['content:read'] };
  return {
    session: async () => ({role, capabilities:capabilities[role]}),
    list: async resource => ({items:resource==='content'?structuredClone(entries):resource==='members'?[{id:1,subject:'identidad-de-muestra',role:'owner',enabled:1}]:[],hasMore:false}),
    save: async value => {
      if (role==='viewer') throw new Error('Acceso de sólo lectura');
      const next = {...structuredClone(value), id:value.id??Math.max(...entries.map(x=>x.id))+1,revision:(value.revision??0)+1};
      entries=entries.filter(x=>x.id!==next.id).concat(next); return {status:'ok',id:next.id,revision:next.revision};
    },
  };
}
