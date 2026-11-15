import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Storefront } from '../src/storefront/Storefront.jsx';

describe('public storefront migration', () => {
  it('preserves the eight products and finds accented product names', async () => {
    const user = userEvent.setup(); render(<Storefront/>);
    expect(screen.getAllByRole('button', { name: /^Agregar .+ al carrito$/ })).toHaveLength(8);
    await user.type(screen.getByRole('textbox', { name: 'Buscar productos' }), 'corazon');
    expect(screen.getAllByRole('button', { name: /^Agregar .+ al carrito$/ })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Llavero corazón de resina' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Herramientas', exact: true }));
    expect(screen.getAllByRole('button', { name: /^Agregar .+ al carrito$/ })).toHaveLength(2);
  });
  it('updates a persisted cart, traps dialog focus and restores it on Escape', async () => {
    const user = userEvent.setup(); render(<Storefront/>);
    await user.click(screen.getByRole('button', { name: 'Agregar Cintas de raso x 5 al carrito' }));
    const opener = screen.getByRole('button', { name: 'Abrir carrito de compras' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByText('$ 4.800').length).toBeGreaterThan(0);
    await user.click(within(dialog).getByRole('button', { name: 'Agregar una unidad de Cintas de raso x 5' }));
    expect(within(dialog).getAllByText('$ 9.600').length).toBeGreaterThan(0);
    expect(JSON.parse(localStorage.getItem('ras-cart-demo'))).toEqual({ cintas: 2 });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(opener).toHaveFocus();
  });
  it('ignores invalid stored quantities and unknown products', () => {
    localStorage.setItem('ras-cart-demo', JSON.stringify({ unknown: 8, cintas: -5, mono: 1000 }));
    render(<Storefront/>);
    expect(screen.getByRole('status', { name: 'Cantidad de productos en carrito' })).toHaveTextContent('0');
  });
  it('opens seminar programs and never sends sample consultations', async () => {
    const user = userEvent.setup(); const fetcher = vi.spyOn(globalThis, 'fetch'); render(<Storefront/>);
    await user.click(screen.getAllByRole('button', { name: /Ver programa/ })[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Elección de materiales y texturas')).toBeVisible();
    await user.type(within(dialog).getByLabelText('Tu nombre'), 'Prueba');
    await user.type(within(dialog).getByLabelText('Tu email'), 'test@example.test');
    await user.click(within(dialog).getByRole('button', { name: 'Registrar consulta de prueba' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockRestore();
  });
});
