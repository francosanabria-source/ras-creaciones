export const formatMoney = value => '$ ' + Number(value).toLocaleString('es-AR');
export const normalize = value => String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export function restoreCart(products) {
  try {
    const stored = JSON.parse(localStorage.getItem('ras-cart-demo') || '{}');
    if (!stored || Array.isArray(stored) || typeof stored !== 'object') return {};
    return Object.fromEntries(Object.entries(stored).filter(([id, quantity]) =>
      products.some(p => p.id === id) && Number.isInteger(quantity) && quantity > 0 && quantity <= 99));
  } catch { return {}; }
}
export function orderSummary(cart, products) {
  const lines = products.filter(p => cart[p.id]).map(p => `- ${cart[p.id]} x ${p.name} = ${formatMoney(cart[p.id] * p.price)}`);
  const total = products.reduce((sum, p) => sum + (cart[p.id] || 0) * p.price, 0);
  return `Ras Creaciones - pedido de muestra\n${lines.join('\n')}\nTotal ilustrativo: ${formatMoney(total)}\n(Este resumen no constituye una compra real)`;
}
