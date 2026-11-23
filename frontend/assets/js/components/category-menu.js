// category-menu.js - menu danh mục: dropdown trên desktop, bottom sheet trên mobile
import { api } from '../core/api.js';
import { escapeHtml } from '../core/ui.js';

let panel;
let opener;
let previousOverflow;

export async function initCategoryMenu(host) {
  panel = document.createElement('div');
  panel.className = 'catmenu';
  panel.hidden = true;
  panel.innerHTML = `<div class="catmenu__scrim" data-close></div>
    <section id="catmenu-dialog" class="catmenu__panel" role="dialog" aria-modal="true" aria-labelledby="catmenu-title" tabindex="-1">
      <header class="catmenu__header"><h2 id="catmenu-title">Danh mục sản phẩm</h2>
        <button class="catmenu__close" type="button" aria-label="Đóng danh mục" data-close>×</button></header>
      <nav aria-label="Danh mục sản phẩm">
        <ul class="catmenu__quick-links">
          <li><a href="index.html#sale-thu-6">Siêu sale Thứ 6</a></li>
          <li><a href="can-han.html">Cận hạn giảm 50%</a></li>
          <li><a href="ban-chay.html">Bán chạy</a></li>
        </ul>
        <ul id="catmenu-list"></ul>
      </nav></section>`;
  document.body.append(panel);
  panel.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closeCategoryMenu();
    else if (e.target.closest('a')) closeCategoryMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (panel.hidden) return;
    if (e.key === 'Escape') closeCategoryMenu();
    if (e.key === 'Tab') trapFocus(e);
  });
  try {
    const cats = await api.get('/categories');
    panel.querySelector('#catmenu-list').innerHTML = cats.map((c) => `<li class="catmenu__item">
      <div class="catmenu__row"><a href="san-pham.html?category=${encodeURIComponent(c.slug)}"><i class="bi bi-${escapeHtml(c.icon)}" aria-hidden="true"></i>${escapeHtml(c.ten_danh_muc)}</a>
      <button type="button" aria-label="Mở danh mục con ${escapeHtml(c.ten_danh_muc)}" aria-expanded="false"><i class="bi bi-chevron-down" aria-hidden="true"></i></button></div>
      <ul class="catmenu__children" hidden>${(c.children || []).map((child) =>
        `<li><a href="san-pham.html?category=${encodeURIComponent(c.slug)}&sub=${encodeURIComponent(child.slug)}">${escapeHtml(child.ten)}</a></li>`).join('')}</ul></li>`).join('');
    panel.querySelectorAll('.catmenu__row > button').forEach((btn) => btn.addEventListener('click', () => {
      const children = btn.closest('.catmenu__item').querySelector('.catmenu__children');
      children.hidden = !children.hidden;
      btn.setAttribute('aria-expanded', String(!children.hidden));
    }));
  } catch { panel.querySelector('#catmenu-list').innerHTML = '<li class="ms-muted p-2">Không tải được danh mục</li>'; }
}
export const toggleCategoryMenu = (event) => {
  if (!panel) return;
  if (panel.hidden) openCategoryMenu(event?.currentTarget);
  else closeCategoryMenu();
};
export const openCategoryMenu = (trigger = document.activeElement) => {
  if (!panel) return;
  opener = trigger instanceof HTMLElement ? trigger : document.getElementById('cat-btn');
  previousOverflow = document.body.style.overflow;
  panel.hidden = false;
  document.body.style.overflow = 'hidden';
  opener?.setAttribute('aria-expanded', 'true');
  panel.querySelector('.catmenu__close')?.focus();
};
export const closeCategoryMenu = () => {
  if (!panel) return;
  panel.hidden = true;
  document.body.style.overflow = previousOverflow || '';
  opener?.setAttribute('aria-expanded', 'false');
  opener?.focus();
};

function trapFocus(event) {
  const focusable = [...panel.querySelectorAll('a[href], button:not(:disabled)')];
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};
