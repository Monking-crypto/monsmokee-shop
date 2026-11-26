// products.js - danh mục, bộ lọc và tải thêm sản phẩm theo trang
import { getCategories, getProducts } from '../core/catalog.js';
import { CONFIG } from '../core/config.js';
import { escapeHtml, qs } from '../core/ui.js';
import { mountHeader } from '../components/header.js';
import { mountFooter } from '../components/footer.js';
import { mountBottomNav } from '../components/bottom-nav.js';
import { productCard, productSkeletons, bindProductCards } from '../components/product-card.js';

const root = qs('#products-content');
const PAGE_SIZE = 12;
let categories = [];
let category = null;
let params = new URLSearchParams(location.search);
let products = [];
let pagination = { page: 1, total: 0, has_more: false };
let loading = false;
let observer;

const categoryName = () => category?.ten_danh_muc || 'Tất cả sản phẩm';
const selectedValues = (key) => params.get(key) || '';

function urlFor(changes = {}) {
  const next = new URLSearchParams(location.search);
  Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
  const query = next.toString();
  return `san-pham.html${query ? `?${query}` : ''}`;
}

function appliedFilters() {
  if (CONFIG.LIVE.catalog) {
    const sortNames = { price_asc: 'Giá tăng', price_desc: 'Giá giảm', newest: 'Mới nhất' };
    return params.has('sort') && sortNames[params.get('sort')]
      ? `<button type="button" class="filter-chip" data-remove="sort">Sắp xếp: ${sortNames[params.get('sort')]} ×</button>`
      : '';
  }
  const names = { in_stock: 'Còn hàng', discount: 'Đang giảm giá' };
  const sortNames = { price_asc: 'Giá tăng', price_desc: 'Giá giảm', newest: 'Mới nhất' };
  return [...Object.keys(names), 'sort'].filter((key) => params.has(key)).map((key) => {
    const value = params.get(key);
    const label = key === 'sort' ? sortNames[value] || value : names[key];
    return `<button type="button" class="filter-chip" data-remove="${key}">${label}: ${key === 'sort' ? '' : 'Có'} ×</button>`;
  }).join('');
}

function renderFilters() {
  if (CONFIG.LIVE.catalog) {
    return `<form id="product-filters" class="product-filters">
      <label><span>Sắp xếp</span><select name="sort">
        <option value="newest" ${selectedValues('sort') === 'newest' || !selectedValues('sort') ? 'selected' : ''}>Mới nhất</option>
        <option value="price_asc" ${selectedValues('sort') === 'price_asc' ? 'selected' : ''}>Giá tăng</option>
        <option value="price_desc" ${selectedValues('sort') === 'price_desc' ? 'selected' : ''}>Giá giảm</option>
      </select></label>
      <button class="ms-btn ms-btn--green" type="submit">Sắp xếp</button>
    </form>`;
  }
  return `<form id="product-filters" class="product-filters">
    <label class="filter-check"><input name="in_stock" type="checkbox" value="1" ${params.has('in_stock') ? 'checked' : ''}> Chỉ hàng còn</label>
    <label class="filter-check"><input name="discount" type="checkbox" value="1" ${params.has('discount') ? 'checked' : ''}> Đang giảm giá</label>
    <label><span>Sắp xếp</span><select name="sort">
      <option value="newest" ${selectedValues('sort') === 'newest' || !selectedValues('sort') ? 'selected' : ''}>Mới nhất</option>
      <option value="price_asc" ${selectedValues('sort') === 'price_asc' ? 'selected' : ''}>Giá tăng</option>
      <option value="price_desc" ${selectedValues('sort') === 'price_desc' ? 'selected' : ''}>Giá giảm</option>
    </select></label>
    <button class="ms-btn ms-btn--green" type="submit">Bộ lọc</button>
  </form>`;
}

function renderSkeleton() {
  root.querySelector('#product-results').innerHTML = `<div class="ms-grid">${productSkeletons(8)}</div>`;
}

function filteredProducts() {
  if (CONFIG.LIVE.catalog) return products;
  return products.filter((product) => {
    const inStock = typeof product.con_hang === 'boolean'
      ? product.con_hang
      : Number(product.so_luong_ton) > 0;
    return (!params.has('in_stock') || inStock)
      && (!params.has('discount') || Number(product.phan_tram_giam) > 0);
  });
}

function renderResults() {
  observer?.disconnect();
  const result = root.querySelector('#product-results');
  const visible = filteredProducts();
  const count = `<p class="products-count">Đã tải ${products.length} / ${pagination.total} sản phẩm · Đang hiển thị ${visible.length}</p>`;
  const grid = visible.length
    ? `<div class="ms-grid">${visible.map((product) => productCard(product)).join('')}</div>`
    : pagination.has_more
      ? `<div class="ms-state"><strong>Đang tìm sản phẩm phù hợp</strong>Danh sách sẽ tự tải thêm khi bạn cuộn xuống.</div>`
      : '<div class="ms-state"><strong>Không tìm thấy sản phẩm</strong>Thử thay đổi hoặc xóa bớt bộ lọc.</div>';
  const more = pagination.has_more
    ? `<div class="products-load-more">${loading ? `<div class="ms-grid">${productSkeletons(4)}</div>` : ''}<button class="ms-btn ms-btn--ghost" id="products-load-more" type="button" ${loading ? 'disabled' : ''}>${loading ? 'Đang tải…' : 'Tải thêm sản phẩm'}</button><span id="products-load-sentinel" aria-hidden="true"></span></div>`
    : '';
  result.innerHTML = `${count}${grid}${more}`;
  qs('#products-load-more')?.addEventListener('click', loadMore);
  const sentinel = qs('#products-load-sentinel');
  if (sentinel && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    }, { rootMargin: '300px' });
    observer.observe(sentinel);
  }
}

function buildQuery(page) {
  const query = new URLSearchParams({ page: String(page), per_page: String(PAGE_SIZE) });
  const sort = params.get('sort');
  if (['newest', 'price_asc', 'price_desc'].includes(sort)) query.set('sort', sort);
  if (params.get('q')) query.set('q', params.get('q'));
  if (category?.id) query.set('category_id', String(category.id));
  return query;
}

async function loadPage(pageNumber, append = false) {
  if (loading) return;
  loading = true;
  if (append) renderResults();
  else renderSkeleton();
  try {
    const data = await getProducts(buildQuery(pageNumber));
    products = append ? [...products, ...data.products] : data.products;
    pagination = data.pagination;
    renderResults();
  } catch (error) {
    if (append) {
      renderResults();
      root.querySelector('#product-results').insertAdjacentHTML('beforeend', `<div class="ms-state"><strong>Không tải được sản phẩm</strong>${escapeHtml(error.message)}<div class="mt-3"><button class="ms-btn ms-btn--green" id="products-retry" type="button">Thử lại</button></div></div>`);
    } else {
      root.querySelector('#product-results').innerHTML = `<div class="ms-state"><strong>Không tải được sản phẩm</strong>${escapeHtml(error.message)}<div class="mt-3"><button class="ms-btn ms-btn--green" id="products-retry" type="button">Thử lại</button></div></div>`;
    }
    qs('#products-retry')?.addEventListener('click', () => loadPage(pageNumber, append));
  } finally {
    loading = false;
    const button = qs('#products-load-more');
    if (button) {
      button.disabled = false;
      button.textContent = 'Tải thêm sản phẩm';
    }
  }
}

async function loadMore() {
  if (loading || !pagination.has_more) return;
  await loadPage(pagination.page + 1, true);
}

async function render() {
  params = new URLSearchParams(location.search);
  root.innerHTML = '<div class="ms-skeleton products-skeleton"></div>';
  try {
    categories = await getCategories();
    const categorySlug = params.get('category') || '';
    category = categories.find((item) => item.slug === categorySlug) || null;
    const ageRestricted = ['bia', 'thuoc-la'].includes(category?.slug);
    root.innerHTML = `<div class="products-top"><button type="button" data-back aria-label="Quay lại">‹</button><h1>${escapeHtml(categoryName())}</h1><span></span></div>
      ${ageRestricted ? '<p class="age-notice">Sản phẩm dành cho người từ 18 tuổi trở lên</p>' : ''}
      ${renderFilters()}<div class="applied-filters">${appliedFilters()}</div><div id="product-results"></div>`;
    root.querySelector('[data-back]').addEventListener('click', () => {
      if (history.length > 1) history.back();
      else location.assign('index.html');
    });
    root.querySelector('#product-filters').addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const next = new URLSearchParams(location.search);
      ['sort', 'in_stock', 'discount', 'sub', 'flavor', 'pack'].forEach((key) => next.delete(key));
      for (const [key, value] of data.entries()) if (value) next.set(key, value);
      history.pushState(null, '', `${location.pathname}?${next.toString()}`);
      render();
    });
    root.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => {
      const next = new URLSearchParams(location.search);
      next.delete(button.dataset.remove);
      history.pushState(null, '', `${location.pathname}?${next.toString()}`);
      render();
    }));
    products = [];
    pagination = { page: 1, total: 0, has_more: false };
    await loadPage(1);
  } catch (error) {
    root.innerHTML = `<div class="ms-state"><strong>Không tải được danh mục</strong>${escapeHtml(error.message)}<div class="mt-3"><button class="ms-btn ms-btn--green" id="category-retry" type="button">Thử lại</button></div></div>`;
    qs('#category-retry')?.addEventListener('click', render);
  }
}

await mountHeader(qs('#site-header'));
mountFooter(qs('#site-footer'));
mountBottomNav(qs('#bottom-nav'), 'category');
bindProductCards(document);
await render();
window.addEventListener('popstate', render);
