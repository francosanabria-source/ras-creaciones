import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { validateImage, mediaRoute } from '../src/media.js';
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64'));
const req=(type='image/png',bytes=png,origin='https://api.test')=>new Request('https://api.test/admin/content/1/photo?revision=1&alt=Una%20foto',{method:'POST',headers:{'Content-Type':type,Origin:origin},body:bytes});
test('image validation checks size, actual bytes, dimensions and declared format',async()=>{
  const result=await validateImage(png,'image/png',webcrypto);
  assert.equal(result.width,1); assert.equal(result.hash.length,64);
  await assert.rejects(validateImage(png,'image/jpeg',webcrypto));
  await assert.rejects(validateImage(new TextEncoder().encode('<svg/>'),'image/png',webcrypto));
  await assert.rejects(validateImage(new Uint8Array(5242881),'image/png',webcrypto));
  await assert.rejects(validateImage(png.subarray(0,24),'image/png',webcrypto));
});
test('photo uploads require write role, exact origin and expected revision',async()=>{
  const repository={saveMedia:async()=>assert.fail('must not save')};
  assert.equal((await mediaRoute(req(),{ENABLE_CONTENT_WRITES:'true'},{role:'viewer'},repository)).status,403);
  assert.equal((await mediaRoute(req('image/png',png,'https://evil.test'),{ENABLE_CONTENT_WRITES:'true'},{role:'owner'},repository)).status,403);
  assert.equal((await mediaRoute(req(),{},{role:'owner'},repository)).status,503);
});
test('photo saves forward verified actor and preserve conflict status',async()=>{
  const actor={role:'owner',subject:'real-owner',issuer:'https://team.cloudflareaccess.com'};
  const repository={saveMedia:async(identity,payload)=>{assert.equal(identity,actor);assert.equal(payload.content_id,1);assert.equal(payload.mime_type,'image/png');return {status:'conflict'};}};
  const response=await mediaRoute(req(),{ENABLE_CONTENT_WRITES:'true',PUBLIC_ORIGIN:'https://public.test'},actor,repository);
  assert.equal(response.status,409);
});
