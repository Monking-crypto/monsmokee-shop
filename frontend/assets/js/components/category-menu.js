// category-menu.js - menu danh mục: dropdown trên desktop, bottom sheet trên mobile
import { api } from '../core/api.js';
import { escapeHtml } from '../core/ui.js';

let panel;
export async function initCategoryMenu(host) {
  panel = document.createElement('div');
  panel.className = 'catmenu';
  panel.hidden = true;
  panel.innerHTML = `<div class="catmenu__scrim" data-close></div>
    <nav class="catmenu__panel" aria-label="Danh mục sản phẩm"><h2>Danh mục sản phẩm</h2><ul id="catmenu-list"></ul></nav>`;
  host.append(panel);
  panel.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target.closest('a')) closeCategoryMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCategoryMenu(); });
  try {
    const cats = await api.get('/categories');
    panel.querySelector('#catmenu-list').innerHTML = cats.map((c) =>
      `<li><a href="san-pham.html?category=${encodeURIComponent(c.slug)}"><i class="bi bi-${escapeHtml(c.icon)}" aria-hidden="true"></i>${escapeHtml(c.ten_danh_muc)}</a></li>`).join('');
  } catch { panel.querySelector('#catmenu-list').innerHTML = '<li class="ms-muted p-2">Không tải được danh mục</li>'; }
}
export const toggleCategoryMenu = () => { panel.hidden = !panel.hidden; };
export const closeCategoryMenu = () => { if (panel) panel.hidden = true; };
