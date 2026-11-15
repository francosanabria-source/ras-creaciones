import React,{useEffect,useState} from 'react';
import {Storefront} from './Storefront.jsx';
import catalog from '../generated/catalog.json';
export async function loadCatalog(){
  const items=[];
  for(let page=0;page<50;page++){
    const response=await fetch(`/api/catalog?offset=${page*100}`,{credentials:'omit',cache:'no-store'});
    if(!response.ok)throw Error('unavailable');
    const data=await response.json();if(!Array.isArray(data.items))throw Error('invalid');items.push(...data.items);
    if(data.hasMore!==true)return {items,hasMore:false};
  }
  throw Error('Catalog too large');
}
export function PublicApp({load=loadCatalog}){
  const [data,setData]=useState(null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{let active=true;setError(false);load().then(result=>{if(active)setData(result);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[load,attempt]);
  if(!data)return <main className="catalog-loading" aria-busy={!error}><img src={catalog.logo} alt="Ras Creaciones"/><h1>{error?'No pudimos cargar la tienda':'Preparando tus próximas creaciones…'}</h1>{error&&<button className="btn btn-primary" onClick={()=>setAttempt(x=>x+1)}>Volver a intentar</button>}</main>;
  const products=data.items.filter(x=>x.type==='product').map(x=>({id:String(x.id),name:x.title,price:x.attributes.price,category:x.attributes.category,description:x.attributes.description||x.body,image:x.attributes.image,imageAlt:x.image_alt||x.title}));
  const workshops=data.items.filter(x=>x.type==='workshop').map(x=>({id:`w-${x.id}`,title:x.title,summary:x.attributes.description,description:x.body,topics:x.attributes.topics||[],image:x.attributes.image,imageAlt:x.image_alt||x.title}));
  return <Storefront catalogData={{products,workshops}} live/>;
}
