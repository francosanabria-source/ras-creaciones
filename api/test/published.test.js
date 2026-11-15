import test from 'node:test';
import assert from 'node:assert/strict';
import { publishedResponse } from '../src/published.js';
import { createWorker } from '../src/worker.js';
const req = (path, method='GET') => new Request('https://internal.test'+path,{method});
test('published entrypoint only exposes the public catalog and public image routes', async () => {
  const repository={listPublished:async()=>({items:[{id:1,type:'product',state:'published',title:'Cintas',slug:'cintas',attributes:{price:100},identity_subject:'never'}],hasMore:false})};
  const response=await publishedResponse(req('/catalog'),repository);
  assert.equal(response.status,200); assert.equal((await response.json()).items[0].identity_subject,undefined);
  assert.equal((await publishedResponse(req('/session'),repository)).status,404);
  assert.equal((await publishedResponse(req('/catalog','POST'),repository)).status,405);
});
test('public entrypoint fails closed for draft or malformed upstream data',async()=>{
  const repository={listPublished:async()=>({items:[{id:1,state:'draft'}],hasMore:false})};
  assert.equal((await publishedResponse(req('/catalog'),repository)).status,503);
});
test('public media returns only an allowed image format without caching',async()=>{
  const repository={publicMedia:async()=>new Response(new Uint8Array([1,2]),{headers:{'Content-Type':'image/png'}})};
  const result=await publishedResponse(req('/media/7'),repository);
  assert.equal(result.status,200); assert.equal(result.headers.get('Cache-Control'),'no-store');
  assert.equal((await publishedResponse(req('/media/../admin'),repository)).status,404);
});
test('default administrative entrypoint never opens public catalog routes', async()=>{
  const app=createWorker({authenticate:async()=>{throw Error('No identity')}});
  assert.equal((await app.fetch(req('/catalog'),{})).status,503);
});
