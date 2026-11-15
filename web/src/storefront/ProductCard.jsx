import React from 'react';
import { formatMoney } from './cart.js';
export function ProductCard({ product: p, favorite, onFavorite, onAdd }) {
  return <article className="product-card"><div className="product-art">{p.image?<img loading="lazy" src={p.image} alt={p.imageAlt}/>:<span className="photo-placeholder" aria-label="Sin foto">♡</span>}
    {p.badge && <span className="product-badge">{p.badge}</span>}
    <button className="favorite-btn" aria-label={`Guardar ${p.name} en favoritos`} aria-pressed={favorite} onClick={onFavorite}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"/></svg>
    </button></div><div className="product-content"><span className="product-category">{p.category}</span><h3>{p.name}</h3><p>{p.description}</p>
      <div className="product-bottom"><strong>{formatMoney(p.price)}</strong><button className="add-btn" aria-label={`Agregar ${p.name} al carrito`} onClick={onAdd}>Agregar <span aria-hidden="true">＋</span></button></div>
    </div></article>;
}
