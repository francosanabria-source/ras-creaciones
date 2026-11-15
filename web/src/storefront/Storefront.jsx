import React, { useEffect, useState } from 'react';
import { Announcement, Header, Hero, Categories, Values, Workshops, About, Contact, Footer } from '../generated/Sections.jsx';
import catalog from '../generated/catalog.json';
import { ProductCard } from './ProductCard.jsx';
import { LiveWorkshops } from './LiveWorkshops.jsx';
import { Dialog } from '../components/Dialog.jsx';
import { formatMoney, normalize, restoreCart, orderSummary } from './cart.js';
import '../generated/legacy.css';
import './storefront.css';

export function Storefront({catalogData=catalog,live=false}) {
  const { products, workshops } = catalogData;
  const [cart, setCart] = useState(() => restoreCart(products));
  const [favorites, setFavorites] = useState({});
  const [filter, setFilter] = useState('todos'), [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false), [dialog, setDialog] = useState(null), [notice, setNotice] = useState('');
  useEffect(() => { try { localStorage.setItem('ras-cart-demo', JSON.stringify(cart)); } catch {} }, [cart]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 3500); return () => clearTimeout(timer); }, [notice]);
  const count = Object.values(cart).reduce((sum, n) => sum + n, 0);
  const total = products.reduce((sum, p) => sum + (cart[p.id] || 0) * p.price, 0);
  const visible = products.filter(p => (filter === 'todos' || p.category === filter) && normalize(p.name).includes(normalize(query.trim())));
  const program = workshops.find(w => w.id === dialog);
  function quantity(id, delta) {
    setCart(previous => { const next = { ...previous }, value = Math.min(99, (previous[id] || 0) + delta);
      if (value <= 0) delete next[id]; else next[id] = value; return next; });
  }
  function action(event) {
    const target = event.target.closest('button,a'); if (!target) return;
    if (target.dataset.jump) { setFilter(target.dataset.jump); setQuery(''); }
    if (target.dataset.workshop) setDialog(target.dataset.workshop);
    if (target.id === 'openCart') setDialog('cart');
    if (['openContact', 'footerContact'].includes(target.id)) setDialog('contact');
    if (target.id === 'menuToggle') setMobileOpen(value => !value);
    else if (target.closest('.nav')) setMobileOpen(false);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(orderSummary(cart, products)); setNotice('Resumen del pedido copiado'); }
    catch { setNotice('No se pudo copiar el resumen. Probá desde otro navegador.'); }
  }
  return <>
    <div inert={dialog ? true : undefined}>
      <a className="skip" href="#inicio">Ir al contenido</a><Announcement/><Header onAction={action} cartCount={count} mobileOpen={mobileOpen}/>
      <main id="inicio"><Hero/><Categories onAction={action}/>
        <section className="shop" id="tienda"><div className="container">
          <div className="shop-head"><div className="section-label">Nuestra tiendita</div><div className="section-top"><div><h2 className="section-heading">Elegí tus favoritos</h2>
          <p className="section-intro">{live?'Pequeñas cosas que hacen grandes creaciones. Conocé nuestro catálogo.':'Pequeñas cosas que hacen grandes creaciones. Mirá algunos ejemplos de nuestro catálogo.'}</p></div></div></div>
          <div className="shop-subrow"><div className="filters" aria-label="Categorías de productos">
            {Object.entries({ todos: 'Todos', insumos: 'Insumos', herramientas: 'Herramientas', creaciones: 'Creaciones' }).map(([key, label]) =>
              <button key={key} className={`filter-btn ${filter === key ? 'active' : ''}`} aria-pressed={filter === key} onClick={() => { setFilter(key); setQuery(''); }}>{label}</button>)}
          </div><label className="search-field"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg><span className="visually-hidden">Buscar productos</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar productos..." autoComplete="off"/></label></div>
          <div className="products-grid">{visible.map(p => <ProductCard key={p.id} product={p} favorite={!!favorites[p.id]}
            onFavorite={() => { setFavorites(prev => ({ ...prev, [p.id]: !prev[p.id] })); setNotice(favorites[p.id] ? 'Eliminado de favoritos' : 'Guardado en favoritos de muestra'); }}
            onAdd={() => { quantity(p.id, 1); setNotice(`${p.name} agregado al carrito`); }}/>)}</div>
          {!visible.length && <p className="empty-search">{live&&!products.length?'Estamos preparando nuevas creaciones.':'No encontramos productos con esa búsqueda. Probá con otra palabra.'}</p>}
          <p className="demo-note">{live?'ⓘ El carrito arma un resumen: todavía no procesa compras ni pagos.':'ⓘ Los productos, precios e imágenes de esta tienda son ilustrativos.'}</p>
        </div></section><Values/>{live?<LiveWorkshops workshops={workshops} onAction={action}/>:<Workshops onAction={action}/>}<About/><Contact onAction={action}/>
      </main><Footer onAction={action}/><a className="team-link" href="https://ras-creaciones-api.tienda26.workers.dev/admin/">Acceso al equipo</a>
    </div>
    {dialog === 'cart' && <Dialog className="cart-drawer open" titleId="cartTitle" onClose={() => setDialog(null)}>
      <div className="drawer-head"><div><h2 id="cartTitle">Tu carrito ♥</h2><p>Un poquito de inspiración para llevar</p></div><button className="close-btn" aria-label="Cerrar carrito" onClick={() => setDialog(null)}>×</button></div>
      <div className="cart-list">{!count ? <div className="cart-empty"><span className="empty-heart">♡</span><h3>Tu carrito te espera</h3><p>Elegí algunos productos para armar tu pedido de muestra.</p></div> : products.filter(p => cart[p.id]).map(p =>
        <div className="cart-line" key={p.id}><div><h3>{p.name}</h3><div className="unit">{formatMoney(p.price)} c/u</div>
          <div className="qty-control"><button aria-label={`Quitar una unidad de ${p.name}`} onClick={() => quantity(p.id, -1)}>−</button><strong>{cart[p.id]}</strong><button aria-label={`Agregar una unidad de ${p.name}`} onClick={() => quantity(p.id, 1)}>+</button></div></div>
          <div className="cart-line-price">{formatMoney(p.price * cart[p.id])}<button className="remove-item" onClick={() => setCart(prev => { const next = { ...prev }; delete next[p.id]; return next; })}>Quitar</button></div></div>)}</div>
      <div className="cart-footer"><div className="cart-total"><span>Subtotal ilustrativo</span><strong>{formatMoney(total)}</strong></div><button className="btn btn-primary" disabled={!count} onClick={copy}>Copiar pedido de muestra</button><small>Esto no procesa pagos ni envía pedidos: solamente copia un resumen.</small></div>
    </Dialog>}
    {dialog && dialog !== 'cart' && <Dialog titleId="modalTitle" onClose={() => setDialog(null)}><div className="modal-box">
      <button className="close-btn" aria-label="Cerrar ventana" onClick={() => setDialog(null)}>×</button><div className="section-label">{program ? 'Seminarios de muestra' : 'Hablemos de tu idea'}</div>
      <h2 id="modalTitle">{program?.title ?? '¿Qué te gustaría crear?'}</h2><p>{program?.description ?? 'Dejanos una consulta de prueba sobre materiales, creaciones o seminarios.'}</p>
      {program && <ul className="topic-list">{program.topics.map(topic => <li key={topic}>{topic}</li>)}</ul>}
      <form onSubmit={event => { event.preventDefault(); setDialog(null); setNotice('Consulta de muestra completada: no se envió ni se guardó información.'); }}>
        <div className="form-grid"><div className="form-field"><label htmlFor="formName">Tu nombre</label><input id="formName" required autoComplete="name"/></div>
          <div className="form-field"><label htmlFor="formEmail">Tu email</label><input id="formEmail" type="email" required autoComplete="email"/></div></div>
        <div className="form-field"><label htmlFor="formMessage">Mensaje (opcional)</label><textarea id="formMessage" rows="3"/></div>
        <button className="btn btn-primary" type="submit">Registrar consulta de prueba</button><p className="modal-disclaimer">Este formulario es ilustrativo: no guarda ni envía información.</p>
      </form></div></Dialog>}
    {notice && <div className="toast show" role="status" aria-live="polite">{notice}</div>}
  </>;
}
