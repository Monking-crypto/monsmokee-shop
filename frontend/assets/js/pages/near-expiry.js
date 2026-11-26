// near-expiry.js - trang riêng cho sản phẩm cận hạn
import { getProducts } from '../core/catalog.js';
import { escapeHtml, qs } from '../core/ui.js';
import { mountHeader } from '../components/header.js';
import { mountFooter } from '../components/footer.js';
import { mountBottomNav } from '../components/bottom-nav.js';
import { productCard, bindProductCards } from '../components/product-card.js';

const root = qs('#near-expiry-products');
const count = qs('#expiry-count');
let products = [];
let maxDays = 10;

function render() {
  const shown = products.filter((product) => Number(product.near_expiry_days) <= maxDays);
  count.textContent = `${shown.length} sản phẩm`;
  root.innerHTML = shown.length
    ? shown.map((product) => productCard(product, { nearExpiry: true, showHsd: true, showStock: true })).join('')
    : '<div class="ms-state"><strong>Hiện chưa có hàng cận hạn</strong>Vui lòng quay lại sau để xem ưu đãi mới.</div>';
}

async function load() {
  root.innerHTML = '<div class="near-expiry-skeleton" aria-hidden="true"></div>'.repeat(3);
  count.textContent = '';
  try {
    const query = new URLSearchParams({ near_expiry: '1', per_page: '50' });
    let data = await getProducts(query);
    const all = [...data.products];
    while (data.pagination.has_more) {
      query.set('page', String(data.pagination.page + 1));
      data = await getProducts(query);
      all.push(...data.products);
    }
    products = all.map((product) => {
      const expiry = product.han_su_dung || product.hsd;
      const days = expiry ? Math.ceil((new Date(`${expiry}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000) : 0;
      return { ...product, hsd: expiry, near_expiry_days: days };
    }).filter((product) => Number(product.near_expiry_days) >= 1
      && Number(product.near_expiry_days) <= 10
      && Number(product.phan_tram_giam) === 50
      && product.hsd);
    products.sort((a, b) => Number(a.near_expiry_days) - Number(b.near_expiry_days));
    render();
  } catch (error) {
    root.innerHTML = `<div class="ms-state"><strong>Không tải được hàng cận hạn</strong>${escapeHtml(error.message)}<div class="mt-3"><button class="ms-btn ms-btn--green" id="expiry-retry" type="button">Thử lại</button></div></div>`;
    qs('#expiry-retry').addEventListener('click', load);
  }
}

qs('#expiry-filters').addEventListener('click', (event) => {
  const button = event.target.closest('[data-days]');
  if (!button) return;
  maxDays = Number(button.dataset.days);
  qs('#expiry-filters').querySelectorAll('button').forEach((filter) => {
    const active = filter === button;
    filter.classList.toggle('is-active', active);
    filter.setAttribute('aria-pressed', String(active));
  });
  render();
});

await mountHeader(qs('#site-header'));
mountFooter(qs('#site-footer'));
mountBottomNav(qs('#bottom-nav'));
bindProductCards(document);
await load();
