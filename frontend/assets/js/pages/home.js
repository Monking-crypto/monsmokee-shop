// home.js - trang chủ khách hàng
import { api } from '../core/api.js';
import { escapeHtml, qs } from '../core/ui.js';
import { mountHeader } from '../components/header.js';
import { mountFooter } from '../components/footer.js';
import { mountBottomNav } from '../components/bottom-nav.js';
import { productCard, productSkeletons, bindProductCards } from '../components/product-card.js';
import { startCountdown } from '../components/countdown.js';

const state = (title, text) => `<div class="ms-state" style="grid-column:1/-1"><strong>${title}</strong>${text}</div>`;

function section(id, title, sub, inner, more = '') {
  return `<section class="ms-section" ${id ? `id="${id}"` : ''}><div class="ms-section__head"><div><h2 class="ms-section__title">${title}</h2>${sub ? `<p class="ms-section__sub">${sub}</p>` : ''}</div>${more}</div>${inner}</section>`;
}
const rail = (list, opt) => `<div class="ms-rail">${list.map((p) => productCard(p, opt)).join('')}</div>`;

function renderHome(d) {
  const root = qs('#home-sections');
  const sale = d.friday_sale;
  const parts = [];

  const saleProducts = (sale.products || []).slice(0, 5);
  parts.push(`<section class="ms-section home-friday" id="sale-thu-6">
      <div class="home-friday__lead"><span class="home-friday__tag" aria-hidden="true">-${Number(sale.discount_percent) || 10}%</span><div>
        <h2>${sale.active ? 'Siêu sale Thứ 6 đang mở bán' : 'Thứ 6 này giảm 10% cho 10 sản phẩm'}</h2>
        <p>${sale.active ? 'Giá ưu đãi chỉ áp dụng trong hôm nay.' : 'Danh sách được mở bán vào Thứ 6 hằng tuần.'}</p>
      </div></div>
      <div class="home-friday__action"><span class="countdown" id="sale-timer" role="timer" aria-live="off" aria-label="${sale.active ? 'Thời gian còn lại của đợt sale' : 'Thời gian tới đợt sale'}"></span>
        <a class="ms-btn ms-btn--primary" href="sieu-sale-thu-6.html">${sale.active ? 'Xem tất cả' : 'Xem trang Siêu sale'}</a></div>
      ${sale.active && saleProducts.length ? `<div class="home-friday__products">${rail(saleProducts)}</div>`
        : sale.active ? '<p class="home-friday__empty">Hôm nay cửa hàng chưa công bố danh sách sản phẩm.</p>' : ''}
    </section>`);

  const near = d.near_expiry.slice(0, 5);
  parts.push(`<section class="ms-section promo promo--expiry" id="can-han"><div class="ms-section__head"><div><h2 class="ms-section__title">Cận hạn, giảm 50%</h2>
      <p class="ms-section__sub">Còn dùng tốt, giá rẻ một nửa. Số lượng có hạn.</p></div></div>${near.length ? rail(near, { showHsd: true }) : state('Hiện chưa có hàng cận hạn', 'Quay lại sau nhé.')}<a class="ms-section__more" href="can-han.html">Xem tất cả hàng cận hạn</a></section>`);

  parts.push(section('ban-chay', 'Bán chạy', 'Được khách mua nhiều nhất', rail(d.best_sellers), '<a class="ms-section__more" href="ban-chay.html">Xem tất cả</a>'));
  parts.push(section('goi-y', 'Gợi ý cho bạn', '', rail(d.suggested)));
  d.sections.forEach((s) => {
    const shown = s.products.slice(0, 5);
    const remaining = Math.max(0, (s.total ?? s.products.length) - shown.length);
    const more = remaining
      ? `<a class="ms-more-products" aria-label="Xem thêm ${remaining} sản phẩm ${escapeHtml(s.category.ten_danh_muc)}" href="san-pham.html?category=${encodeURIComponent(s.category.slug)}">Xem thêm ${remaining} sản phẩm ${escapeHtml(s.category.ten_danh_muc)} <span aria-hidden="true">⌄</span></a>`
      : '';
    parts.push(section('', escapeHtml(s.category.ten_danh_muc), '', rail(shown), more));
  });

  root.innerHTML = parts.join('');
  startCountdown(qs('#sale-timer'), sale.active ? sale.ends_at : sale.next_start, { onEnd: () => location.reload() });
}

async function load() {
  const root = qs('#home-sections');
  root.innerHTML = `<div class="ms-grid mt-4">${productSkeletons(5)}</div>`;
  try { renderHome(await api.get('/home')); }
  catch {
    root.innerHTML = `<div class="ms-state mt-4"><strong>Không tải được trang chủ</strong>Kiểm tra kết nối rồi thử lại.<div class="mt-3"><button class="ms-btn ms-btn--green" id="retry">Thử lại</button></div></div>`;
    qs('#retry').addEventListener('click', load);
  }
}

(async () => {
  await mountHeader(qs('#site-header'));
  mountFooter(qs('#site-footer'));
  mountBottomNav(qs('#bottom-nav'), 'home');
  bindProductCards(document);
  load();
})();

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.addEventListener('load', () => window.bootstrap?.Carousel.getOrCreateInstance('#hero-carousel').pause());
}
