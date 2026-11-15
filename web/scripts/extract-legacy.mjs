import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const web = path.join(root, 'web');
const html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
const document = parse(html);
const attrs = node => Object.fromEntries((node.attrs ?? []).map(a => [a.name, a.value]));
const all = (node, test) => [...(test(node) ? [node] : []), ...(node.childNodes ?? []).flatMap(n => all(n, test))];
const find = (node, test) => all(node, test)[0];
const byClass = name => n => (attrs(n).class ?? '').split(' ').includes(name);
const text = node => node?.nodeName === '#text' ? node.value : (node?.childNodes ?? []).map(text).join('');
const srcDir = path.join(web, 'src/generated');
await fs.mkdir(srcDir, { recursive: true });
await fs.mkdir(path.join(web, 'public/images'), { recursive: true });
const images = new Map();
for (const img of all(document, n => n.tagName === 'img')) {
  const src = attrs(img).src;
  if (!src?.startsWith('data:')) continue;
  if (!images.has(src)) {
    const match = /^data:image\/(png|jpeg|webp|svg\+xml);base64,(.+)$/s.exec(src);
    if (!match) throw new Error('Unexpected embedded image format');
    const data = Buffer.from(match[2], 'base64');
    const filename = `${createHash('sha256').update(data).digest('hex').slice(0, 16)}.${match[1] === 'svg+xml' ? 'svg' : match[1]}`;
    await fs.writeFile(path.join(web, 'public/images', filename), data);
    images.set(src, `/images/${filename}`);
  }
  img.attrs.find(a => a.name === 'src').value = images.get(src);
}
const products = JSON.parse(html.match(/const products = (\[.*?\]);/s)[1]);
const programs = JSON.parse(html.match(/const workshops = (\{.*?\});/s)[1]);
const cards = all(document, byClass('product-card'));
const catalog = products.map((product, i) => {
  const card = cards[i];
  const img = find(card, n => n.tagName === 'img');
  return { ...product, category: attrs(card)['data-category'], description: text(find(card, n => n.tagName === 'p')),
    image: attrs(img).src, imageAlt: attrs(img).alt, badge: text(find(card, byClass('product-badge'))) };
});
const workshops = all(document, byClass('workshop-card')).map(card => {
  const id = attrs(find(card, n => attrs(n)['data-workshop']))['data-workshop'];
  const img = find(card, n => n.tagName === 'img');
  return { id, ...programs[id], image: attrs(img).src, imageAlt: attrs(img).alt,
    summary: text(find(card, n => n.tagName === 'p')) };
});
await fs.writeFile(path.join(srcDir, 'catalog.json'), JSON.stringify({ products: catalog, workshops,
  logo: attrs(find(document, n => n.tagName === 'img')).src }, null, 2) + '\n');

const camel = value => value.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const names = { class: 'className', for: 'htmlFor', tabindex: 'tabIndex', viewbox: 'viewBox',
  autocomplete: 'autoComplete', maxlength: 'maxLength' };
const voids = new Set(['img', 'input', 'br', 'hr', 'meta', 'link']);
function jsx(node, top = false) {
  if (node.nodeName === '#text') return node.value.trim() ? `{${JSON.stringify(node.value)}}` : '';
  if (!node.tagName) return '';
  const a = attrs(node);
  const attributes = (node.attrs ?? []).map(({ name, value }) => {
    if (a.id === 'mainNav' && name === 'class') return 'className={mobileOpen ? "nav mobile-open" : "nav"}';
    if (a.id === 'menuToggle' && name === 'aria-expanded') return 'aria-expanded={mobileOpen}';
    if (name === 'style') return `style={${JSON.stringify(Object.fromEntries(value.split(';').filter(Boolean).map(s => {
      const [key, ...rest] = s.split(':'); return [camel(key.trim()), rest.join(':').trim()];
    })))}}`;
    const key = names[name] ?? (name.startsWith('aria-') || name.startsWith('data-') ? name : camel(name));
    return `${key}=${JSON.stringify(value)}`;
  });
  if (top) attributes.push('onClick={onAction}');
  if (a.id === 'cartCount') attributes.push('role="status"', 'aria-label="Cantidad de productos en carrito"');
  let children = (node.childNodes ?? []).map(n => jsx(n)).join('');
  if (a.id === 'cartCount') children = '{cartCount}';
  if (a.id === 'year') children = '{new Date().getFullYear()}';
  return `<${node.tagName} ${attributes.join(' ')}${voids.has(node.tagName) ? ' />' : `>${children}</${node.tagName}>`}`;
}
const sections = { Announcement: byClass('announcement'), Header: n => n.tagName === 'header', Hero: byClass('hero'),
  Categories: byClass('categories'), Values: byClass('story-strip'), Workshops: byClass('workshops'),
  About: byClass('about'), Contact: byClass('newsletter'), Footer: n => n.tagName === 'footer' };
const generated = ['// Mechanically migrated from the original demo; regenerate with npm run extract.', 'import React from "react";'];
for (const [name, selector] of Object.entries(sections)) {
  generated.push(`export function ${name}({onAction, cartCount = 0, mobileOpen = false}) { return (${jsx(find(document, selector), true)}); }`);
}
await fs.writeFile(path.join(srcDir, 'Sections.jsx'), generated.join('\n\n') + '\n');
let css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
css = css.replace(/\.modal(?![\w-])/g, '.ras-modal');
await fs.writeFile(path.join(srcDir, 'legacy.css'), css + '\n');
console.log(`Migrated ${images.size} unique images, ${catalog.length} products and ${workshops.length} workshops. Original index.html unchanged.`);
