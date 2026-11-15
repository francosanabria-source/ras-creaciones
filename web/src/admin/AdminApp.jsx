import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, privateImage } from '../lib/api.js';
import catalog from '../generated/catalog.json';
import { ContentEditor } from './ContentEditor.jsx';
import { formatMoney } from '../storefront/cart.js';
import './admin.css';

const labels = { product: 'Productos', workshop: 'Seminarios', page: 'Páginas' };
const states = { draft: 'Borrador', published: 'Publicado', archived: 'Archivado' };
const roleLabels = { owner: 'Owner', editor: 'Editor', viewer: 'Consulta' };
export function AdminApp({ client = api, preview = false }) {
  const loadGeneration = useRef(0);
  const [session, setSession] = useState(null), [sessionError, setSessionError] = useState(null);
  const [view, setView] = useState('home'), [data, setData] = useState({ items: [], hasMore: false });
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [offset, setOffset] = useState(0);
  const [editor, setEditor] = useState(null), [notice, setNotice] = useState(''), [query, setQuery] = useState('');
  const can = capability => session?.capabilities.includes(capability);
  const connect = useCallback(async () => { setSessionError(null); try { setSession(await client.session()); } catch (err) { setSession(null); setSessionError(err); } }, [client]);
  useEffect(() => { connect(); }, [connect]);
  const resource = ['members', 'audit'].includes(view) ? view : 'content';
  const load = useCallback(async () => {
    if (!session) return;
    const generation = ++loadGeneration.current;
    setLoading(true); setError('');
    try { const result = await client.list(resource, offset); if (generation === loadGeneration.current) setData(result); }
    catch (err) { if (generation === loadGeneration.current) { if ([401,403].includes(err.status)) { setSession(null); setSessionError(err); } else setError(err.message || 'No pudimos cargar la información.'); } }
    finally { if (generation === loadGeneration.current) setLoading(false); }
  }, [client, resource, offset, session]);
  useEffect(() => { load(); return () => { loadGeneration.current++; }; }, [load]);
  function navigate(next) { setView(next); setOffset(0); setQuery(''); setNotice(''); }
  if (!session) return <main className="admin-access"><img src={catalog.logo} alt="Ras Creaciones"/><h1>{sessionError ? ([401,403].includes(sessionError.status) ? 'Volvé a ingresar' : 'No pudimos conectar') : 'Preparando tu espacio…'}</h1>
    <p>{sessionError?.message || 'Estamos verificando tu acceso.'}</p>{sessionError && <><a className="btn btn-primary" href="/admin/">Ingresar nuevamente</a><button className="btn btn-light" onClick={connect}>Reintentar</button></>}</main>;
  const filtered = data.items.filter(row => (view === 'home' || !labels[view] || row.type === view) && `${row.title || ''} ${row.slug || ''}`.toLowerCase().includes(query.toLowerCase()));
  const count = state => data.items.filter(row => row.state === state).length;
  return <div className="admin-app">
    <aside className="admin-sidebar" inert={editor ? true : undefined}><a className="admin-brand" href="https://ras-creaciones.tienda26.workers.dev/"><img src={catalog.logo} alt=""/><span>Ras Creaciones<small>HECHO CON AMOR</small></span></a>
      <p className="sidebar-caption">TU ESPACIO</p><nav aria-label="Administración"><button aria-current={view === 'home' ? 'page' : undefined} onClick={() => navigate('home')}><span aria-hidden="true">⌂</span> Resumen</button>
        {Object.entries(labels).map(([type,label]) => <button key={type} aria-current={view === type ? 'page' : undefined} onClick={() => navigate(type)}><span aria-hidden="true">{type === 'product' ? '◇' : type === 'workshop' ? '✧' : '▤'}</span>{label}</button>)}
        {can('members:manage') && <button aria-current={view === 'members' ? 'page' : undefined} onClick={() => navigate('members')}><span aria-hidden="true">♧</span>Equipo</button>}
        {can('audit:read') && <button aria-current={view === 'audit' ? 'page' : undefined} onClick={() => navigate('audit')}><span aria-hidden="true">◷</span>Actividad</button>}
      </nav><div className="sidebar-bottom"><p>Cada detalle cuenta.<br/><em>Gracias por hacerlo con amor.</em></p><a href="https://ras-creaciones.tienda26.workers.dev/" target="_blank" rel="noreferrer">Ver tienda pública ↗</a></div>
    </aside>
    <div className="admin-workspace" inert={editor ? true : undefined}><header className="admin-topbar"><span>Ras Creaciones <span className="topbar-separator">/</span> Administración</span><div className="session-pill"><span className="session-dot"/><span>{roleLabels[session.role]}</span><button aria-label="Actualizar sesión" className="admin-icon" onClick={connect}>↻</button></div></header>
      <main className="admin-main">{preview && <div className="preview-banner">Vista previa local · Datos de muestra · No modifica Oracle</div>}
        <div className="admin-page-heading"><div><span className="admin-eyebrow">Hecho con amor, también por dentro</span><h1>{view === 'home' ? 'Hola, qué lindo crear.' : view === 'members' ? 'Nuestro equipo' : view === 'audit' ? 'Actividad del espacio' : labels[view]}</h1><p>{view === 'home' ? 'Un lugar para cuidar tus creaciones, tus ideas y lo que viene.' : view === 'members' ? 'Personas que tienen acceso a la administración.' : view === 'audit' ? 'Los cambios confirmados, en un mismo lugar.' : 'Dale forma a cada detalle de tu tienda.'}</p></div>
          {can('content:write') && ['home','product','workshop','page'].includes(view) && <button className="btn btn-primary" onClick={() => setEditor({ type: view === 'home' ? 'product' : view })}>＋ {view === 'workshop' ? 'Nuevo seminario' : view === 'page' ? 'Nueva página' : 'Nuevo producto'}</button>}
        </div>
        {notice && <div role="status" className="alert alert-success">{notice}</div>}
        {error ? <div className="admin-empty" role="alert"><h2>No pudimos cargar tu espacio</h2><p>{error}</p><button className="btn btn-primary" onClick={load}>Volver a intentar</button></div> : loading ? <div className="admin-empty" role="status">Cargando…</div> : <>
          {view === 'home' && <><section className="admin-welcome"><div><span className="admin-eyebrow">Tu marca, siempre creciendo</span><h2>Las buenas ideas<br/>merecen <em>su lugar.</em></h2><p>Organizá tus productos, prepará seminarios y revisá el contenido antes de compartirlo.</p><button className="btn btn-outline-primary" onClick={() => navigate('product')}>Explorar catálogo →</button></div><img src={catalog.products.find(p => p.id === 'cajita').image} alt="Regalo artesanal con moño"/></section>
            <section className="admin-stats" aria-label="Resumen de contenido">{[['Productos',data.items.filter(x => x.type === 'product').length],['Seminarios',data.items.filter(x => x.type === 'workshop').length],['Borradores',count('draft')],['Publicados',count('published')]].map(([label,value]) => <div key={label}><span>{label}</span><strong>{value}</strong><small>{data.hasMore ? 'En esta página' : 'En tu espacio'}</small></div>)}</section><h2 className="admin-section-title">Tu contenido, de un vistazo</h2></>}
          {['home','product','workshop','page'].includes(view) && <section className="admin-panel"><div className="panel-toolbar"><h2>{view === 'home' ? 'Últimos contenidos' : 'Catálogo'}</h2><label className="admin-search"><span className="visually-hidden">Buscar contenido</span><input className="form-control" placeholder="Buscar por nombre…" value={query} onChange={e => setQuery(e.target.value)}/></label></div>
            {!filtered.length ? <div className="admin-empty"><span aria-hidden="true">✧</span><h3>{query ? 'No encontramos coincidencias' : 'Acá empieza tu próxima idea'}</h3><p>{query ? 'Probá con otro nombre.' : 'Cuando agregues contenido, aparecerá en este espacio.'}</p></div> : <div className="table-responsive"><table className="table admin-table align-middle"><thead><tr><th>Contenido</th><th>Estado</th><th>Precio</th><th><span className="visually-hidden">Acciones</span></th></tr></thead><tbody>{filtered.map(row => <tr key={row.id}><td><div className="table-content">{row.attributes?.image && <img src={privateImage(row.attributes.image)} alt=""/>}<div><strong>{row.title}</strong><small>{labels[row.type]} · {row.slug}</small></div></div></td><td><span className={`state-badge ${row.state}`}>{states[row.state] || row.state}</span></td><td>{row.type === 'product' ? formatMoney(row.attributes?.price || 0) : '—'}</td><td>{can('content:write') && <button className="table-action" aria-label={`Editar ${row.title}`} onClick={() => setEditor({ item: row, type: row.type })}>Editar ↗</button>}</td></tr>)}</tbody></table></div>}
          </section>}
          {view === 'members' && <section className="admin-panel"><div className="panel-toolbar"><h2>Accesos verificados</h2></div><div className="table-responsive"><table className="table admin-table"><thead><tr><th>Identidad</th><th>Rol</th><th>Acceso</th></tr></thead><tbody>{data.items.map(row => <tr key={row.id}><td><code>{row.subject}</code></td><td>{roleLabels[row.role]}</td><td>{row.enabled === 1 ? 'Habilitado' : 'Deshabilitado'}</td></tr>)}</tbody></table></div><p className="panel-note">Las nuevas personas se vinculan después de su primer ingreso. La asignación de roles continúa por el procedimiento autorizado.</p></section>}
          {view === 'audit' && <section className="admin-panel"><div className="panel-toolbar"><h2>Registro de cambios</h2></div>{!data.items.length ? <div className="admin-empty"><p>Todavía no hay actividad registrada.</p></div> : <div className="table-responsive"><table className="table admin-table"><thead><tr><th>Fecha</th><th>Acción</th><th>Recurso</th><th>Resultado</th></tr></thead><tbody>{data.items.map(row => <tr key={row.id}><td>{row.occurred_at}</td><td>{row.action}</td><td>{row.resource} {row.resource_id}</td><td>{row.outcome}</td></tr>)}</tbody></table></div>}</section>}
          <div className="admin-pagination"><button className="btn btn-sm btn-light" disabled={offset === 0} onClick={() => setOffset(n => Math.max(0,n-100))}>← Anterior</button><span>Página {Math.floor(offset/100)+1}</span><button className="btn btn-sm btn-light" disabled={!data.hasMore} onClick={() => setOffset(n => n+100)}>Siguiente →</button></div>
        </>}
        <footer className="admin-footer">Ras Creaciones · Un poquito de amor en cada detalle.</footer>
      </main></div>
    {editor && <ContentEditor item={editor.item} type={editor.type} upload={client.upload} canPublish={can('content:publish')} onClose={() => {setEditor(null);load();}} onSave={async payload => { const result = await client.save(payload); setNotice(payload.state === 'published' ? 'Contenido publicado.' : payload.state === 'archived' ? 'Contenido archivado.' : 'Borrador guardado.'); await load(); return result; }}/ >}
  </div>;
}
