import { imageSize } from 'image-size';
import { permits } from './access.js';
const limit=5242880;
const json=(value,status)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function framedImage(bytes,type){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const name=offset=>String.fromCharCode(...bytes.subarray(offset,offset+4));
  if(type==='png'){
    let offset=8,hasData=false;
    if(bytes.length<45||name(12)!=='IHDR'||view.getUint32(8)!==13)return false;
    while(offset+12<=bytes.length){const length=view.getUint32(offset),chunk=name(offset+4);if(offset+length+12>bytes.length||chunk==='acTL')return false;if(chunk==='IDAT'&&length>0)hasData=true;offset+=length+12;if(chunk==='IEND')return length===0&&hasData&&offset===bytes.length;}
    return false;
  }
  if(type==='webp'){
    if(bytes.length<20||view.getUint32(4,true)+8!==bytes.length)return false;
    let offset=12,hasData=false;
    while(offset+8<=bytes.length){const length=view.getUint32(offset+4,true),chunk=name(offset);if(['ANIM','ANMF'].includes(chunk)||offset+length+8>bytes.length)return false;if(['VP8 ','VP8L'].includes(chunk)&&length>=5)hasData=true;offset+=8+length+(length%2);}
    return hasData&&offset===bytes.length;
  }
  if(type==='jpg'){
    if(bytes.length<16||bytes.at(-2)!==255||bytes.at(-1)!==217)return false;
    let offset=2;
    while(offset+4<bytes.length){if(bytes[offset++]!==255)return false;while(bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===217)return false;const length=view.getUint16(offset);if(length<2||offset+length>bytes.length-2)return false;if(marker===218)return offset+length<bytes.length-2;offset+=length;}
  }
  return false;
}
export async function validateImage(bytes,type,cryptoImpl=crypto) {
  if(!bytes.length||bytes.length>limit) throw Error('size');
  const expected={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[type];
  if(!expected) throw Error('type');
  const dimensions=imageSize(bytes);
  if(!framedImage(bytes,expected))throw Error('truncated-or-animated');
  if(dimensions.type!==expected||!dimensions.width||!dimensions.height||dimensions.width>8192||dimensions.height>8192||dimensions.width*dimensions.height>16000000) throw Error('dimensions');
  const hash=[...new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  return {...dimensions,hash};
}
async function readImage(request) {
  const reader=request.body?.getReader();if(!reader) throw Error('empty');
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('size');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const value of chunks){bytes.set(value,offset);offset+=value.length;}return bytes;
}
export async function mediaRoute(request,env,identity,repository) {
  const url=new URL(request.url),upload=url.pathname.match(/^\/admin\/content\/([1-9]\d{0,14})\/photo$/),view=url.pathname.match(/^\/admin\/media\/([1-9]\d{0,14})$/);
  if(!upload&&!view)return null;
  if(view){
    if(request.method!=='GET')return json({error:'Método no permitido'},405);
    try{const result=await repository.privateMedia(identity,view[1]);const type=result.headers.get('Content-Type')?.split(';')[0];
      if(result.status===404)return json({error:'Imagen no disponible'},404);
      if(!result.ok||!['image/jpeg','image/png','image/webp'].includes(type))throw Error('media');
      return new Response(result.body,{headers:{'Content-Type':type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
    }catch{return json({error:'No pudimos cargar la foto'},503);}
  }
  if(request.method!=='POST')return json({error:'Método no permitido'},405);
  if(!permits(identity.role,'content:write'))return json({error:'Acceso denegado'},403);
  if(env.ENABLE_CONTENT_WRITES!=='true')return json({error:'La edición no está habilitada'},503);
  if(request.headers.get('Origin')!==url.origin)return json({error:'Origen no permitido'},403);
  const revision=url.searchParams.get('revision'),alt=url.searchParams.get('alt')?.trim();
  if(!/^[1-9]\d{0,14}$/.test(revision??'')||!alt||alt.length>500)return json({error:'Revisá la descripción y la revisión de la foto'},400);
  let bytes,checked;const type=request.headers.get('Content-Type')?.split(';')[0];
  try{bytes=await readImage(request);checked=await validateImage(bytes,type);}catch{return json({error:'Elegí una foto JPEG, PNG o WebP válida, de hasta 5 MiB y 16 millones de píxeles.'},400);}
  try{
    const origin=new URL(env.PUBLIC_ORIGIN);if(origin.protocol!=='https:'||origin.origin!==env.PUBLIC_ORIGIN)throw Error('config');
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    const result=await repository.saveMedia(identity,{content_id:Number(upload[1]),revision:Number(revision),alt_text:alt,mime_type:type,byte_length:bytes.length,sha256_hex:checked.hash,data_base64:btoa(binary),image_origin:origin.origin});
    if(result.status==='conflict')return json({error:'Otra persona modificó este contenido. Recargalo antes de subir la foto.'},409);
    if(result.status==='denied')return json({error:'Acceso denegado'},403);
    if(result.status!=='ok'||!Number.isSafeInteger(result.media_id)||!Number.isSafeInteger(result.revision))throw Error('response');
    return json({status:'ok',media_id:result.media_id,revision:result.revision,image:`${origin.origin}/media/${result.media_id}`},200);
  }catch{return json({error:'No pudimos confirmar la carga. Conservá el archivo y recargá para comprobar el estado.'},503);}
}
