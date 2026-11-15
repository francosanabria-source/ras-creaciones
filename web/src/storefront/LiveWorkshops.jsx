import React from 'react';
export function LiveWorkshops({workshops,onAction}){
  return <section className="workshops" id="seminarios" onClick={onAction}><div className="container"><div className="section-label">Aprendamos juntas y juntos</div><div className="section-top"><div><h2 className="section-heading">Seminarios con inspiración</h2><p className="section-intro">Explorá nuevas técnicas, conectá con tu creatividad y disfrutá del proceso.</p></div><span style={{color:'#C59F62',fontSize:34}} aria-hidden="true">✶</span></div>
    <div className="workshop-grid">{workshops.map(w=><article className="workshop-card" key={w.id}><div className="workshop-visual">{w.image?<img src={w.image} alt={w.imageAlt} loading="lazy"/>:<span className="photo-placeholder">♡</span>}<span className="workshop-type">Seminario creativo</span></div><div className="workshop-info"><h3>{w.title}</h3><p>{w.summary}</p><div className="workshop-meta">Fechas a confirmar</div><button className="workshop-link" data-workshop={w.id}>Ver programa <span>↗</span></button></div></article>)}</div>
    {!workshops.length&&<p className="section-intro">Pronto compartiremos nuevos seminarios.</p>}
  </div></section>;
}
