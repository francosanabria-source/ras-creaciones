import React from 'react';
import { createRoot } from 'react-dom/client';
import './base.css';
const root = createRoot(document.getElementById('root'));
if (__ADMIN_BUILD__ || (import.meta.env.DEV && location.pathname.startsWith('/admin'))) {
  const { AdminApp } = await import('./admin/AdminApp.jsx');
  let client, preview = false;
  if (import.meta.env.DEV) {
    const role = new URLSearchParams(location.search).get('preview');
    if (['owner','editor','viewer'].includes(role)) {
      const { createPreviewClient } = await import('./admin/preview.js');
      client = createPreviewClient(role); preview = true;
    }
  }
  root.render(<AdminApp client={client} preview={preview}/>);
} else {
  if(import.meta.env.DEV && new URLSearchParams(location.search).get('preview')==='demo') {
    const { Storefront }=await import('./storefront/Storefront.jsx');root.render(<Storefront/>);
  }else{const { PublicApp }=await import('./storefront/PublicApp.jsx');root.render(<PublicApp/>);}
}
