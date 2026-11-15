export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(!['GET','HEAD'].includes(request.method)) return new Response('Método no permitido',{status:405});
    if(url.pathname==='/api/catalog'||/^\/media\/[1-9]\d{0,14}$/.test(url.pathname)) {
      if(request.method!=='GET') return new Response(null,{status:405});
      const internal=new URL('https://catalog.internal'+(url.pathname==='/api/catalog'?'/catalog':url.pathname));
      internal.search=url.search;
      try { return await env.CATALOG.fetch(new Request(internal)); }
      catch { return Response.json({error:'Catálogo no disponible'},{status:503,headers:{'Cache-Control':'no-store'}}); }
    }
    if(url.pathname.startsWith('/admin')||url.pathname==='/session') return new Response('No disponible',{status:404});
    return env.ASSETS.fetch(request);
  },
};
