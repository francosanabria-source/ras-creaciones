import React, { useEffect, useState } from 'react';
import { Dialog } from '../components/Dialog.jsx';
import catalog from '../generated/catalog.json';
import {privateImage} from '../lib/api.js';

export function ContentEditor({ item, type, onClose, onSave, canPublish, upload }) {
  const [draft, setDraft] = useState(() => ({
    ...(item?.id ? { id: item.id, revision: item.revision } : {}), type: item?.type || type,
    title: item?.title || '', slug: item?.slug || '', body: item?.body || '', state: item?.state || 'draft',
    attributes: { category: '', price: 0, image: '', description: '', topics: [], ...item?.attributes },
  }));
  const [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const [file,setFile]=useState(null),[photoPreview,setPhotoPreview]=useState(''),[photoNotice,setPhotoNotice]=useState(''),[alt,setAlt]=useState(item?.title||'');
  useEffect(()=>{if(!file){setPhotoPreview('');return;}const url=URL.createObjectURL(file);setPhotoPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
  async function uploadPhoto(){
    if(!file||saving)return;setSaving(true);setError('');setPhotoNotice('');
    try{const result=await upload(draft.id,draft.revision,alt,file);setDraft(prev=>({...prev,revision:result.revision,attributes:{...prev.attributes,image:result.image}}));setFile(null);setDirty(true);setPhotoNotice('Foto guardada en Oracle. Los otros cambios del formulario se guardan por separado.');}
    catch(err){setError(err.message||'No pudimos cargar la foto. Conservá el archivo.');}finally{setSaving(false);}
  }
  useEffect(() => {
    const leave = e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', leave); return () => window.removeEventListener('beforeunload', leave);
  }, [dirty]);
  const change = (key, value, attribute = false) => {
    setDirty(true); setDraft(prev => attribute ? { ...prev, attributes: { ...prev.attributes, [key]: value } } : { ...prev, [key]: value });
  };
  const close = () => { if (!saving && (!dirty || window.confirm('¿Descartar los cambios sin guardar?'))) onClose(); };
  async function submit(event) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError('');
    try {
      await onSave({ ...draft, state: event.nativeEvent.submitter?.value || draft.state,
        attributes: { ...draft.attributes, topics: draft.attributes.topics.map(topic => topic.trim()).filter(Boolean) } });
      setDirty(false); onClose();
    } catch (err) { setError(err.message || 'No se pudo guardar. Tus cambios siguen en el formulario.'); }
    finally { setSaving(false); }
  }
  return <Dialog className="admin-dialog" titleId="editorTitle" onClose={close}>
    <form onSubmit={submit} className="admin-editor"><header className="editor-heading"><div><span className="admin-eyebrow">Tu espacio creativo</span>
      <h2 id="editorTitle">{item ? 'Editar contenido' : 'Crear contenido'}</h2></div><button type="button" className="admin-icon" aria-label="Cerrar editor" disabled={saving} onClick={close}>×</button></header>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <div className="row g-3"><div className="col-md-8"><label className="form-label" htmlFor="entry-title">Nombre</label><input className="form-control" id="entry-title" value={draft.title} required maxLength="240" onChange={e => change('title', e.target.value)}/></div>
        <div className="col-md-4"><label className="form-label" htmlFor="entry-slug">Enlace corto</label><input className="form-control" id="entry-slug" value={draft.slug} required maxLength="160" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="mi-creacion" onChange={e => change('slug', e.target.value)}/></div>
        {draft.type === 'product' && <><div className="col-md-6"><label className="form-label" htmlFor="entry-price">Precio en pesos</label><input id="entry-price" className="form-control" type="number" min="0" max="1000000000" step="1" value={draft.attributes.price} required onChange={e => change('price', Number(e.target.value), true)}/></div>
          <div className="col-md-6"><label className="form-label" htmlFor="entry-category">Categoría</label><select id="entry-category" className="form-select" value={draft.attributes.category} onChange={e => change('category', e.target.value, true)}><option value="">Sin categoría</option><option value="insumos">Insumos</option><option value="herramientas">Herramientas</option><option value="creaciones">Creaciones</option></select></div></>}
        <div className="col-12"><label className="form-label" htmlFor="entry-description">Descripción breve</label><textarea id="entry-description" className="form-control" rows="2" maxLength="500" value={draft.attributes.description} onChange={e => change('description', e.target.value, true)}/></div>
        <div className="col-12"><label className="form-label" htmlFor="entry-body">Contenido</label><textarea id="entry-body" className="form-control" rows="4" maxLength="5000" value={draft.body} onChange={e => change('body', e.target.value)}/></div>
        {draft.type === 'workshop' && <div className="col-12"><label className="form-label" htmlFor="entry-topics">Programa: un tema por línea</label><textarea id="entry-topics" className="form-control" rows="4" value={draft.attributes.topics.join('\n')} onChange={e => change('topics', e.target.value.split('\n'), true)}/></div>}
        <div className="col-md-7"><label className="form-label" htmlFor="entry-image">Imagen disponible</label><select id="entry-image" className="form-select" value={catalog.products.some(p => p.image === draft.attributes.image) ? draft.attributes.image : ''} onChange={e => change('image', e.target.value, true)}><option value="">Elegir imagen de muestra</option>{catalog.products.map(p => <option key={p.id} value={p.image}>{p.name}</option>)}</select>
          <label className="form-label mt-3" htmlFor="entry-image-url">URL de imagen</label><input id="entry-image-url" className="form-control" value={draft.attributes.image} maxLength="2048" onChange={e => change('image', e.target.value, true)}/>
          <label className="form-label mt-3" htmlFor="entry-photo">Seleccionar foto</label><input id="entry-photo" className="form-control" type="file" accept="image/jpeg,image/png,image/webp" disabled={!draft.id||!upload||saving} onChange={e=>{const selected=e.target.files[0];if(!selected)return;if(selected.size>5242880||!['image/jpeg','image/png','image/webp'].includes(selected.type)){setError('Elegí una foto JPEG, PNG o WebP de hasta 5 MiB.');return;}setError('');setPhotoNotice('');setFile(selected);setDirty(true);}}/>
          <small className="text-secondary">{!draft.id?'Primero guardá el contenido y volvé a abrirlo para adjuntar su portada.':'JPEG, PNG o WebP, hasta 5 MiB y 16 millones de píxeles. Al subir se guarda la foto; si el contenido está publicado, se actualiza también en la web.'}</small>
          <label className="form-label mt-3" htmlFor="entry-photo-alt">Descripción de la foto</label><input id="entry-photo-alt" className="form-control" value={alt} maxLength="500" onChange={e=>setAlt(e.target.value)}/>
          <button type="button" className="btn btn-outline-primary mt-3" disabled={!file||!alt.trim()||saving} onClick={uploadPhoto}>{saving?'Guardando…':'Subir portada'}</button>{photoNotice&&<p className="mt-2" role="status">{photoNotice}</p>}</div>
        <div className="col-md-5"><div className="editor-image">{photoPreview?<img src={photoPreview} alt="Foto seleccionada"/>:draft.attributes.image&&/^(https:\/\/|\/images\/)/.test(draft.attributes.image)?<img src={privateImage(draft.attributes.image)} alt="Vista previa del contenido"/>:<span>Tu imagen aparecerá acá</span>}</div></div>
      </div><footer className="editor-actions"><button type="button" className="btn btn-light" disabled={saving} onClick={close}>Cancelar</button>
        <button className="btn btn-outline-primary" type="submit" value="draft" disabled={saving}>{saving ? 'Guardando…' : 'Guardar borrador'}</button>
        {canPublish && <button className="btn btn-primary" type="submit" value="published" disabled={saving}>{draft.state === 'published' ? 'Guardar y mantener publicado' : 'Publicar'}</button>}
        {item && canPublish && <button className="btn btn-outline-secondary" type="submit" value="archived" disabled={saving}>Archivar</button>}
      </footer></form></Dialog>;
}
