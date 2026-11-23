// products.js - danh mục, bộ lọc và sắp xếp sản phẩm
import { api } from '../core/api.js';
import { escapeHtml, qs } from '../core/ui.js';
import { mountHeader } from '../components/header.js';
import { mountFooter } from '../components/footer.js';
import { mountBottomNav } from '../components/bottom-nav.js';
import { productCard, productSkeletons, bindProductCards } from '../components/product-card.js';

const root = qs('#products-content');
let params = new URLSearchParams(location.search);
const categorySlug = params.get('category') || '';
const categoryName = (c) => c?.ten_danh_muc || 'Tất cả sản phẩm';
const selectedValues = (key) => params.get(key) || '';

function urlFor(changes = {}) {
  const next = new URLSearchParams(location.search);
  Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
  const query = next.toString();
  return `san-pham.html${query ? `?${query}` : ''}`;
}

function appliedFilters() {
  const keys = [
    ['in_stock', 'Còn hàng'], ['discount', 'Đang giảm giá'],
    ['sort', 'Sắp xếp'], ['flavor', 'Hương vị'], ['pack', 'Đóng gói'],
  ];
  const titles = { best: 'Bán chạy', price_asc: 'Giá tăng', price_desc: 'Giá giảm', newest: 'Mới nhất' };
  return keys.filter(([key]) => params.has(key)).map(([key, label]) => {
    const value = params.get(key);
    return `<button type="button" class="filter-chip" data-remove="${key}">${label}: ${escapeHtml(titles[value] || value || 'Có')} ×</button>`;
  }).join('');
}

function renderSubcategories(category) {
  const selected = params.get('sub') || '';
  return `<div class="subcategory-rail">
    <a class="subcategory-card${selected ? '' : ' is-selected'}" href="${urlFor({ sub: '' })}"><i class="bi bi-grid" aria-hidden="true"></i><span>Tất cả</span></a>
    ${(category?.children || []).map((child) =>
      `<a class="subcategory-card${selected === child.slug ? ' is-selected' : ''}" href="${urlFor({ sub: child.slug })}"><i class="bi bi-box-seam" aria-hidden="true"></i><span>${escapeHtml(child.ten)}</span></a>`).join('')}
  </div>`;
}

function filterOptions(items, field) {
  return [...new Set(items.map((p) => p[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
}

function renderFilters(items) {
  const flavors = filterOptions(items, 'huong_vi'), packs = filterOptions(items, 'dong_goi');
  return `<form id="product-filters" class="product-filters">
    <label class="filter-check"><input name="in_stock" type="checkbox" value="1" ${params.has('in_stock') ? 'checked' : ''}> Chỉ hàng còn</label>
    <label class="filter-check"><input name="discount" type="checkbox" value="1" ${params.has('discount') ? 'checked' : ''}> Đang giảm giá</label>
    <label><span>Sắp xếp</span><select name="sort">
      <option value="">Mặc định</option><option value="best" ${selectedValues('sort') === 'best' ? 'selected' : ''}>Bán chạy</option>
      <option value="price_asc" ${selectedValues('sort') === 'price_asc' ? 'selected' : ''}>Giá tăng</option><option value="price_desc" ${selectedValues('sort') === 'price_desc' ? 'selected' : ''}>Giá giảm</option>
      <option value="newest" ${selectedValues('sort') === 'newest' ? 'selected' : ''}>Mới nhất</option></select></label>
    <label><span>Hương vị</span><select name="flavor"><option value="">Tất cả</option>${flavors.map((x) => `<option ${params.get('flavor') === x ? 'selected' : ''} value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('')}</select></label>
    <label><span>Đóng gói</span><select name="pack"><option value="">Tất cả</option>${packs.map((x) => `<option ${params.get('pack') === x ? 'selected' : ''} value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('')}</select></label>
    <button class="ms-btn ms-btn--green" type="submit">Bộ lọc</button>
  </form>`;
}

function renderSkeleton() {
  root.querySelector('#product-results').innerHTML = `<div class="ms-grid">${productSkeletons(10)}</div>`;
}

async function loadProducts() {
  renderSkeleton();
  const query = new URLSearchParams(location.search);
  try {
    const data = await api.get(`/products?${query.toString()}`);
    const result = root.querySelector('#product-results');
    result.innerHTML = data.items.length
      ? `<p class="products-count">Tìm thấy ${data.total} sản phẩm</p><div class="ms-grid">${data.items.map((p) => productCard(p)).join('')}</div>`
      : '<div class="ms-state"><strong>Không tìm thấy sản phẩm</strong>Thử thay đổi hoặc xóa bớt bộ lọc.</div>';
  } catch {
    root.querySelector('#product-results').innerHTML = '<div class="ms-state"><strong>Không tải được sản phẩm</strong>Vui lòng thử lại sau.</div>';
  }
}

async function render() {
  params = new URLSearchParams(location.search);
  root.innerHTML = '<div class="ms-skeleton products-skeleton"></div>';
  try {
    const categories = await api.get('/categories');
    const category = categories.find((c) => c.slug === categorySlug);
    const base = await api.get(`/products${category ? `?category=${encodeURIComponent(category.slug)}` : ''}`);
    const ageRestricted = ['bia', 'thuoc-la'].includes(category?.slug);
    root.innerHTML = `<div class="products-top"><button type="button" data-back aria-label="Quay lại">‹</button><h1>${escapeHtml(categoryName(category))}</h1><span></span></div>
      ${ageRestricted ? '<p class="age-notice">Sản phẩm dành cho người từ 18 tuổi trở lên</p>' : ''}
      ${renderSubcategories(category)}${renderFilters(base.items)}<div class="applied-filters">${appliedFilters()}</div><div id="product-results"></div>`;
    root.querySelector('[data-back]').addEventListener('click', () => {
      if (history.length > 1) history.back();
      else location.assign('index.html');
    });
    root.querySelector('#product-filters').addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const next = new URLSearchParams(location.search);
      ['sort', 'flavor', 'pack', 'in_stock', 'discount'].forEach((key) => next.delete(key));
      for (const [key, value] of data.entries()) if (value) next.set(key, value);
      history.pushState(null, '', `${location.pathname}?${next.toString()}`);
      render();
    });
    root.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => {
      const next = new URLSearchParams(location.search); next.delete(button.dataset.remove);
      history.pushState(null, '', `${location.pathname}?${next.toString()}`);
      render();
    }));
    await loadProducts();
  } catch {
    root.innerHTML = '<div class="ms-state"><strong>Không tải được danh mục</strong>Vui lòng thử lại sau.</div>';
  }
}

await mountHeader(qs('#site-header'));
mountFooter(qs('#site-footer'));
mountBottomNav(qs('#bottom-nav'), 'category');
bindProductCards(document);
await render();
window.addEventListener('popstate', render);
