import React from 'react';
import {it,expect,vi} from 'vitest';
import {render,screen} from '@testing-library/react';
import {PublicApp} from '../src/storefront/PublicApp.jsx';
it('real catalog renders published products instead of sample products',async()=>{
  const load=vi.fn(async()=>({items:[{id:8,type:'product',title:'Producto real',slug:'real',body:'',attributes:{price:123,category:'insumos',description:'Desde Oracle'}}],hasMore:false}));
  render(<PublicApp load={load}/>);
  expect(await screen.findByText('Producto real')).toBeVisible();
  expect(screen.queryByText('Kit de mostacillas pastel')).not.toBeInTheDocument();
});
it('an unavailable real catalog shows retry rather than a fictitious catalog',async()=>{
  render(<PublicApp load={async()=>{throw Error('offline')}}/>);
  expect(await screen.findByRole('button',{name:'Volver a intentar'})).toBeVisible();
  expect(screen.queryByText('Kit de mostacillas pastel')).not.toBeInTheDocument();
});
it('an empty real catalog preserves the site and clearly states that nothing is published',async()=>{
  render(<PublicApp load={async()=>({items:[],hasMore:false})}/>);
  expect(await screen.findByText('Estamos preparando nuevas creaciones.')).toBeVisible();
});
