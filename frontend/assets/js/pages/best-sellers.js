// best-sellers.js - bảng xếp hạng bán chạy có lọc danh mục và phân trang
import { api } from '../core/api.js';
import { escapeHtml, qs } from '../core/ui.js';
import { mountHeader } from '../components/header.js';
import { mountFooter } from '../components/footer.js';
import { mountBottomNav } from '../components/bottom-nav.js';
import { productCard, bindProductCards } from '../components/product-card.js';

const categoryRoot = qs('#best-categories');
const results = qs('#best-results');
const pageSize = 20;
let categories = [];
let selectedCategory = '';
let products = [];
let total = 0;
let loading = false;

function renderCategories() {
  categoryRoot.innerHTML = `<button type="button" class="${selectedCategory ? '' : 'is-active'}" data-category="" aria-pressed="${!selectedCategory}">Tất cả</button>
    ${categories.map((category) => `<button type="button" class="${selectedCategory === category.slug ? 'is-active' : ''}" data-category="${escapeHtml(category.slug)}" aria-pressed="${selectedCategory === category.slug}">${escapeHtml(category.ten_danh_muc)}</button>`).join('')}`;
}

function renderResults() {
  if (!products.length) {
    results.innerHTML = '<div class="ms-state"><strong>Chưa có sản phẩm bán chạy</strong>Danh mục này hiện chưa có dữ liệu xếp hạng.</div>';
    return;
  }
  const top = products.slice(0, 3);
  const ranked = products.slice(3);
  results.innerHTML = `${top.length ? `<div class="best-top-grid">${top.map((product, index) =>
    productCard(product, { rank: index + 1, showSold: true })).join('')}</div>` : ''}
    ${ranked.length ? `<div class="best-list" aria-label="Các hạng tiếp theo">${ranked.map((product, index) =>
      productCard(product, { rank: index + 4, showSold: true })).join('')}</div>` : ''}
    ${products.length < total ? '<button id="best-load-more" class="ms-btn ms-btn--ghost best-load-more" type="button">Xem thêm</button>' : ''}`;
  qs('#best-load-more')?.addEventListener('click', loadMore);
}

async function load(page = 1) {
  if (loading) return;
  loading = true;
  if (page === 1) {
    products = [];
    results.innerHTML = '<div class="best-skeleton-grid"><div class="best-skeleton"></div><div class="best-skeleton"></div><div class="best-skeleton"></div></div>';
  }
  try {
    const query = new URLSearchParams({ sort: 'best', page: String(page), per_page: String(pageSize) });
    if (selectedCategory) query.set('category', selectedCategory);
    const data = await api.get(`/products?${query}`);
    products = page === 1 ? data.items : [...products, ...data.items];
    total = Number(data.total) || products.length;
    renderResults();
  } catch {
    results.innerHTML = `<div class="ms-state"><strong>Không tải được bảng xếp hạng</strong>Vui lòng thử lại.<div class="mt-3"><button id="best-retry" class="ms-btn ms-btn--green" type="button">Thử lại</button></div></div>`;
    qs('#best-retry').addEventListener('click', () => load(1));
  } finally { loading = false; }
}

async function loadMore() {
  if (!loading) await load(Math.floor(products.length / pageSize) + 1);
}

categoryRoot.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button || selectedCategory === button.dataset.category) return;
  selectedCategory = button.dataset.category;
  renderCategories();
  load(1);
});

await mountHeader(qs('#site-header'));
mountFooter(qs('#site-footer'));
mountBottomNav(qs('#bottom-nav'));
bindProductCards(document);

try {
  categories = await api.get('/categories');
  renderCategories();
  await load();
} catch {
  categoryRoot.innerHTML = '<p class="ms-state">Không tải được danh mục sản phẩm.</p>';
  results.innerHTML = '<div class="ms-state"><strong>Không tải được bảng xếp hạng</strong>Vui lòng tải lại trang.</div>';
}
