// home.js - trang chủ tải từng nhóm sản phẩm khi gần tới viewport
import { api } from '../core/api.js';
import { getCategories, getProducts } from '../core/catalog.js';
import { escapeHtml, qs } from '../core/ui.js';
import { mountHeader } from '../components/header.js';
import { mountFooter } from '../components/footer.js';
import { mountBottomNav } from '../components/bottom-nav.js';
import { productCard, productSkeletons, bindProductCards } from '../components/product-card.js';
import { startCountdown } from '../components/countdown.js';

const root = qs('#home-sections');
const loaders = new Map();
let observer;
let stopSaleCountdown;

const state = (title, text) => `<div class="ms-state" style="grid-column:1/-1"><strong>${escapeHtml(title)}</strong>${escapeHtml(text)}</div>`;
const rail = (list, options) => `<div class="ms-rail">${list.map((product) => productCard(product, options)).join('')}</div>`;
const skeleton = () => `<div class="ms-rail">${productSkeletons(5)}</div>`;

function section(id, title, sub, content, more = '') {
  return `<section class="ms-section" ${id ? `id="${id}"` : ''}><div class="ms-section__head"><div><h2 class="ms-section__title">${escapeHtml(title)}</h2>${sub ? `<p class="ms-section__sub">${escapeHtml(sub)}</p>` : ''}</div>${more}</div>${content}</section>`;
}

function saleSection() {
  return `<section class="ms-section home-friday" id="sale-thu-6" data-lazy-section="sale" aria-busy="true">
    <div class="home-friday__lead"><span class="home-friday__tag" aria-hidden="true">-10%</span><div>
      <h2>Ưu đãi Thứ 6</h2><p>Đang kiểm tra chương trình khuyến mãi.</p>
    </div></div>
    <div class="home-friday__action"><span class="countdown" id="sale-timer" role="timer" aria-live="off"></span>
      <a class="ms-btn ms-btn--primary" href="sieu-sale-thu-6.html">Xem chương trình</a></div>
    <div id="sale-thu-6-content">${skeleton()}</div>
  </section>`;
}

function createHome(categories) {
  const parts = [
    saleSection(),
    section('can-han', 'Cận hạn, giảm 50%', 'Còn dùng tốt, giá rẻ một nửa. Số lượng có hạn.', `<div id="expiry-content" data-lazy-section="expiry" aria-busy="true">${skeleton()}</div>`, '<a class="ms-section__more" href="can-han.html">Xem tất cả hàng cận hạn</a>'),
    section('ban-chay', 'Bán chạy', 'Xếp hạng sẽ hiển thị khi API cung cấp dữ liệu bán hàng.', state('Chưa có dữ liệu xếp hạng', 'API công khai hiện chưa cung cấp bảng xếp hạng bán chạy.'), '<a class="ms-section__more" href="ban-chay.html">Xem trang bán chạy</a>'),
    section('goi-y', 'Sản phẩm mới', 'Các sản phẩm mới nhất tại cửa hàng.', `<div id="latest-content" data-lazy-section="latest" aria-busy="true">${skeleton()}</div>`),
  ];

  categories.forEach((category) => {
    const id = `category-${category.id}`;
    const more = `<a class="ms-section__more" href="san-pham.html?category=${encodeURIComponent(category.slug)}">Xem tất cả ${escapeHtml(category.ten_danh_muc)}</a>`;
    parts.push(section(id, category.ten_danh_muc, '', `<div id="${id}-content" data-lazy-section="category" data-category-id="${Number(category.id)}" data-category-slug="${escapeHtml(category.slug)}" aria-busy="true">${skeleton()}</div>`, more));
  });
  root.innerHTML = parts.join('');
  root.addEventListener('click', (event) => {
    const retry = event.target.closest('[data-retry-section]');
    if (retry) loadSection(retry.dataset.retrySection);
  });
  observeSections();
}

function observeSections() {
  const targets = root.querySelectorAll('[data-lazy-section]');
  if (!('IntersectionObserver' in window)) {
    targets.forEach((target) => loadSection(target.id));
    return;
  }
  observer?.disconnect();
  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      loadSection(entry.target.id);
    });
  }, { rootMargin: '250px 0px' });
  targets.forEach((target) => observer.observe(target));
}

function nextFriday() {
  const now = new Date();
  const weekday = now.getDay();
  const daysUntilFriday = (5 - weekday + 7) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilFriday);
  next.setHours(0, 0, 0, 0);
  return next;
}

function renderSale(data) {
  const promotion = data.promotions?.find((item) => item.loai === 'THU_SAU');
  const target = qs('#sale-thu-6');
  const active = Boolean(promotion);
  const end = promotion?.ngay_ket_thuc || nextFriday();
  target.querySelector('.home-friday__tag').textContent = `-${Number(promotion?.phan_tram_giam) || 10}%`;
  target.querySelector('h2').textContent = active ? 'Siêu sale Thứ 6 đang mở bán' : 'Thứ 6 này có ưu đãi mới';
  target.querySelector('.home-friday__lead p').textContent = active
    ? 'Giá ưu đãi áp dụng trong thời gian chương trình.'
    : 'Danh sách sản phẩm sẽ xuất hiện khi chương trình bắt đầu.';
  target.querySelector('.home-friday__action .ms-btn').textContent = active ? 'Xem sản phẩm sale' : 'Xem chương trình';
  target.querySelector('.home-friday__action .countdown').setAttribute('aria-label', active ? 'Thời gian còn lại của đợt sale' : 'Thời gian tới đợt sale');
  stopSaleCountdown?.();
  stopSaleCountdown = startCountdown(qs('#sale-timer'), end);
  const content = qs('#sale-thu-6-content');
  content.innerHTML = active && promotion.products?.length
    ? rail(promotion.products.slice(0, 5))
    : active
      ? state('Chưa có sản phẩm khả dụng', 'Hiện chưa có sản phẩm còn hàng trong chương trình.')
      : state('Chưa tới thời gian ưu đãi', 'Ưu đãi Thứ 6 sẽ xuất hiện khi chương trình được kích hoạt.');
  target.setAttribute('aria-busy', 'false');
}

async function loadSection(id) {
  if (!id || loaders.has(id)) return;
  const target = document.getElementById(id);
  if (!target) return;
  const kind = target.dataset.lazySection;
  const task = (async () => {
    try {
      if (kind === 'sale') {
        renderSale(await api.get('/promotions/active'));
      } else {
        const query = new URLSearchParams({ per_page: '5' });
        if (kind === 'expiry') query.set('near_expiry', '1');
        if (kind === 'latest') query.set('sort', 'newest');
        if (kind === 'category') query.set('category_id', target.dataset.categoryId);
        const data = await getProducts(query);
        const products = kind === 'expiry'
          ? data.products.map((product) => {
            const expiry = product.han_su_dung || product.hsd;
            const expiryTime = expiry ? new Date(`${expiry}T00:00:00`).getTime() : NaN;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const days = Number.isFinite(expiryTime)
              ? Math.ceil((expiryTime - today.getTime()) / 86400000)
              : 0;
            return { ...product, hsd: expiry, near_expiry_days: Number(product.near_expiry_days) || days };
          }).filter((product) => Number(product.phan_tram_giam) === 50 && product.hsd)
          : data.products;
        target.innerHTML = products.length
          ? rail(products, kind === 'expiry' ? { nearExpiry: true, showHsd: true } : {})
          : state(kind === 'expiry' ? 'Hiện chưa có hàng cận hạn' : 'Chưa có sản phẩm', 'Vui lòng quay lại sau.');
        target.setAttribute('aria-busy', 'false');
      }
    } catch (error) {
      const content = kind === 'sale' ? qs('#sale-thu-6-content') : target;
      content.innerHTML = `<div class="ms-state"><strong>Không tải được sản phẩm</strong>${escapeHtml(error.message)}<div class="mt-3"><button class="ms-btn ms-btn--green" type="button" data-retry-section="${escapeHtml(id)}">Thử lại</button></div></div>`;
      target.setAttribute('aria-busy', 'false');
    } finally {
      loaders.delete(id);
    }
  })();
  loaders.set(id, task);
  await task;
}

async function load() {
  root.innerHTML = `<div class="ms-grid mt-4">${productSkeletons(5)}</div>`;
  try {
    createHome(await getCategories());
  } catch (error) {
    root.innerHTML = `<div class="ms-state mt-4"><strong>Không tải được trang chủ</strong>${escapeHtml(error.message)}<div class="mt-3"><button class="ms-btn ms-btn--green" id="home-retry" type="button">Thử lại</button></div></div>`;
    qs('#home-retry').addEventListener('click', load);
  }
}

(async () => {
  await mountHeader(qs('#site-header'));
  mountFooter(qs('#site-footer'));
  mountBottomNav(qs('#bottom-nav'), 'home');
  bindProductCards(document);
  await load();
})();

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.addEventListener('load', () => window.bootstrap?.Carousel.getOrCreateInstance('#hero-carousel').pause());
}
