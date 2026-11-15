import React from 'react';
import { it, expect, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminApp } from '../src/admin/AdminApp.jsx';
const entry = { id: 1, revision: 1, type: 'product', title: 'Cintas', slug: 'cintas', body: '', state: 'draft', attributes: { price: 4800 } };
function client(role) {
  return { session: async () => ({ role, capabilities: role === 'owner' ? ['content:read','content:write','content:publish','members:manage','audit:read'] : role === 'editor' ? ['content:read','content:write','content:publish'] : ['content:read'] }),
    list: vi.fn(async () => ({ items: [entry], hasMore: false })), save: vi.fn(async () => ({ status: 'ok', id: 1, revision: 2 })) };
}
it('editor can edit content but sees no team or audit controls', async () => {
  const user = userEvent.setup(), api = client('editor'); render(<AdminApp client={api}/>);
  await screen.findByText('Editor');
  expect(screen.queryByRole('button', { name: 'Equipo' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Actividad' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Productos' }));
  await user.click(await screen.findByRole('button', { name: 'Editar Cintas' }));
  const title = screen.getByLabelText('Nombre'); await user.clear(title); await user.type(title, 'Cintas nuevas');
  await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
  await waitFor(() => expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cintas nuevas', id: 1, revision: 1 })));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it('failed saves retain edits and show an actionable error', async () => {
  const user = userEvent.setup(), api = client('editor'); api.save.mockRejectedValue(new Error('Otra persona modificó este contenido.'));
  render(<AdminApp client={api}/>); await screen.findByText('Editor');
  await user.click(screen.getByRole('button', { name: 'Productos' }));
  await user.click(await screen.findByRole('button', { name: 'Editar Cintas' }));
  await user.type(screen.getByLabelText('Nombre'), ' editadas');
  await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Otra persona');
  expect(screen.getByLabelText('Nombre')).toHaveValue('Cintas editadas');
});
it('owner sees protected team and activity views; viewer cannot create or edit', async () => {
  const owner = render(<AdminApp client={client('owner')}/>); await screen.findByText('Owner');
  expect(screen.getByRole('button', { name: 'Equipo' })).toBeVisible(); expect(screen.getByRole('button', { name: 'Actividad' })).toBeVisible();
  owner.unmount(); render(<AdminApp client={client('viewer')}/>); await screen.findByText('Consulta');
  expect(screen.queryByRole('button', { name: /Nuevo producto/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Editar Cintas/ })).not.toBeInTheDocument();
});
it('a missing session never renders private content and offers re-entry', async () => {
  const api = client('owner'); api.session = async () => { throw Object.assign(new Error('Acceso denegado'), { status: 401 }); };
  render(<AdminApp client={api}/>);
  expect(await screen.findByRole('heading', { name: 'Volvé a ingresar' })).toBeVisible();
  expect(api.list).not.toHaveBeenCalled();
});
it('photo upload updates the revision without discarding other text edits',async()=>{
  const user=userEvent.setup(),api=client('owner');api.upload=vi.fn(async()=>({revision:2,image:'https://ras-creaciones.tienda26.workers.dev/media/7',media_id:7}));
  Object.defineProperty(URL,'createObjectURL',{configurable:true,value:vi.fn(()=> 'blob:preview')});Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:vi.fn()});
  render(<AdminApp client={api}/>);await screen.findByText('Owner');
  await user.click(await screen.findByRole('button',{name:'Editar Cintas'}));
  await user.type(screen.getByLabelText('Nombre'),' nuevas');
  const file=new File(['photo'],'photo.png',{type:'image/png'});
  await user.upload(screen.getByLabelText('Seleccionar foto'),file);
  await user.click(screen.getByRole('button',{name:'Subir portada'}));
  await screen.findByText(/Foto guardada en Oracle/);
  expect(api.upload).toHaveBeenCalledWith(1,1,'Cintas',file);
  expect(screen.getByLabelText('Nombre')).toHaveValue('Cintas nuevas');
  await user.click(screen.getByRole('button',{name:'Guardar borrador'}));
  expect(api.save).toHaveBeenCalledWith(expect.objectContaining({revision:2,title:'Cintas nuevas',attributes:expect.objectContaining({image:'https://ras-creaciones.tienda26.workers.dev/media/7'})}));
});
it('an older collection cannot replace data after navigating to another view', async () => {
  const user = userEvent.setup(), api = client('owner'); let resolveContent;
  api.list.mockImplementation(resource => resource === 'content'
    ? new Promise(resolve => { resolveContent = resolve; })
    : Promise.resolve({ items: [{ id: 2, subject: 'editor-test', role: 'editor', enabled: 1 }], hasMore: false }));
  render(<AdminApp client={api}/>); await screen.findByText('Owner');
  await user.click(screen.getByRole('button', { name: 'Equipo' }));
  expect(await screen.findByText('editor-test')).toBeVisible();
  await act(async () => resolveContent({ items: [entry], hasMore: false }));
  expect(screen.getByText('editor-test')).toBeVisible();
});
