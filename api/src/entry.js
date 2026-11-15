import { WorkerEntrypoint } from 'cloudflare:workers';
import worker from './worker.js';
import { createOracle } from './oracle.js';
import { publishedResponse } from './published.js';
// Only this restricted entrypoint is bound to the public Worker.
export class CatalogService extends WorkerEntrypoint {
  #oracle;
  async fetch(request) {
    try { this.#oracle??=createOracle(this.env); return await publishedResponse(request,this.#oracle); }
    catch { return Response.json({error:'Catálogo no disponible'},{status:503,headers:{'Cache-Control':'no-store'}}); }
  }
}
export default worker;
