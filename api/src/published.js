import { validateContent } from './admin.js';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function publishedResponse(request, repository) {
  if(request.method!=='GET') return json({error:'Método no permitido'},405);
  const url=new URL(request.url);
  try {
    if(url.pathname==='/catalog') {
      const offset=url.searchParams.get('offset')??'0';
      if(!/^\d{1,7}$/.test(offset)) return json({error:'Página inválida'},400);
      const data=await repository.listPublished(Number(offset));
      if(!Array.isArray(data.items)||data.items.length>100||typeof data.hasMore!=='boolean') throw Error('Invalid catalog');
      const items=data.items.map(row=>{
        if(row.state!=='published'||!Number.isSafeInteger(row.id)||row.id<1) throw Error('Non public row');
        const clean=validateContent({type:row.type,title:row.title,slug:row.slug,body:row.body??'',state:row.state,attributes:row.attributes});
        return {id:row.id,type:clean.type,title:clean.title,slug:clean.slug,body:clean.body,attributes:clean.attributes,
          image_alt:typeof row.image_alt==='string'?row.image_alt.slice(0,500):clean.title};
      });
      return json({items,hasMore:data.hasMore});
    }
    if(/^\/media\/[1-9]\d{0,14}$/.test(url.pathname)) {
      const result=await repository.publicMedia(url.pathname.split('/').at(-1));
      if(result.status===404) return json({error:'Imagen no disponible'},404);
      const type=result.headers.get('Content-Type')?.split(';')[0];
      if(!result.ok||!['image/jpeg','image/png','image/webp'].includes(type)) throw Error('Invalid media');
      return new Response(result.body,{headers:{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
    }
    return json({error:'Recurso no disponible'},404);
  } catch { return json({error:'No pudimos cargar el catálogo. Volvé a intentar.'},503); }
}
