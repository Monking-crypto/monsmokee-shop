// category-menu.js - menu danh mục: dropdown trên desktop, bottom sheet trên mobile
import { getCategories } from '../core/catalog.js';
import { CONFIG } from '../core/config.js';
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
          <li><a href="sieu-sale-thu-6.html">Siêu sale Thứ 6</a></li>
          <li><a href="can-han.html">Cận hạn giảm 50%</a></li>
          ${CONFIG.FEATURES.bestSellers && !CONFIG.LIVE.catalog ? '<li><a href="ban-chay.html">Bán chạy</a></li>' : ''}
        </ul>
        <ul id="catmenu-list"></ul>
      </nav></section>`;
  document.body.append(panel);
  panel.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closeCategoryMenu();
    else if (e.target.closest('a')) closeCategoryMenu();
    else if (e.target.closest('[data-retry-categories]')) loadCategories();
  });
  document.addEventListener('keydown', (e) => {
    if (panel.hidden) return;
    if (e.key === 'Escape') closeCategoryMenu();
    if (e.key === 'Tab') trapFocus(e);
  });
  await loadCategories();
}

async function loadCategories() {
  const list = panel.querySelector('#catmenu-list');
  list.setAttribute('aria-busy', 'true');
  list.innerHTML = '<li class="ms-skeleton" aria-label="Đang tải danh mục"></li>';
  try {
    const cats = await getCategories();
    list.innerHTML = cats.map((category) => `<li class="catmenu__item">
      <div class="catmenu__row"><a href="san-pham.html?category=${encodeURIComponent(category.slug)}"><i class="bi bi-${escapeHtml(category.icon)}" aria-hidden="true"></i>${escapeHtml(category.ten_danh_muc)}</a></div>
    </li>`).join('');
  } catch (error) {
    list.innerHTML = `<li class="ms-state"><strong>Không tải được danh mục</strong>${escapeHtml(error.message)}<button class="ms-btn ms-btn--ghost" type="button" data-retry-categories>Thử lại</button></li>`;
  } finally {
    list.setAttribute('aria-busy', 'false');
  }
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
