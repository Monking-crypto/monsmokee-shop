// home.js - trang chủ tải từng nhóm sản phẩm khi gần tới viewport
import { api } from '../core/api.js';
import { daysUntilExpiry, getCategories, getProducts } from '../core/catalog.js';
import { CONFIG } from '../core/config.js';
import { serverNow } from '../core/api.js';
import { escapeHtml, qs, toast } from '../core/ui.js';
import { mountHeader } from '../components/header.js';
import { mountFooter } from '../components/footer.js';
import { mountBottomNav } from '../components/bottom-nav.js';
import { productCard, productSkeletons, bindProductCards } from '../components/product-card.js';
import { startCountdown } from '../components/countdown.js';

const root = qs('#home-sections');
const loaders = new Map();
let observer;
let stopSaleCountdown;

const currentUrl = new URL(location.href);
if (currentUrl.searchParams.get('access_denied') === '1') {
  toast('Bạn không có quyền truy cập', 'error');
  currentUrl.searchParams.delete('access_denied');
  history.replaceState(null, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
}

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
    section('goi-y', 'Sản phẩm mới', 'Các sản phẩm mới nhất tại cửa hàng.', `<div id="latest-content" data-lazy-section="latest" aria-busy="true">${skeleton()}</div>`),
  ];
  if (CONFIG.FEATURES.bestSellers && !CONFIG.LIVE.catalog) {
    parts.splice(2, 0, section('ban-chay', 'Bán chạy', 'Sản phẩm được khách mua nhiều nhất.', `<div id="best-content" data-lazy-section="best" aria-busy="true">${skeleton()}</div>`, '<a class="ms-section__more" href="ban-chay.html">Xem bảng xếp hạng</a>'));
  }

  categories.forEach((category) => {
    const id = `category-${category.id}`;
    const more = `<a class="ms-section__more" href="san-pham.html?category=${encodeURIComponent(category.slug)}">Xem tất cả ${escapeHtml(category.ten_danh_muc)}</a>`;
    parts.push(section(id, category.ten_danh_muc, '', `<div id="${id}-content" data-lazy-section="category" data-category-id="${Number(category.id)}" data-category-slug="${escapeHtml(category.slug)}" data-category-name="${escapeHtml(category.ten_danh_muc)}" aria-busy="true">${skeleton()}</div>`, more));
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
  const now = serverNow();
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(now).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  const daysUntilFriday = (5 - weekday + 7) % 7 || 7;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day + daysUntilFriday, -7));
}

function currentFridayEnd() {
  const now = serverNow();
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(now).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  const daysUntilFriday = (5 - weekday + 7) % 7;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day + daysUntilFriday + 1, -7) - 1000);
}

function renderSale(data) {
  const promotion = data.promotions?.find((item) => item.loai === 'THU_SAU');
  const target = qs('#sale-thu-6');
  const active = Boolean(promotion);
  const end = active ? currentFridayEnd() : nextFriday();
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
        if (kind === 'best') query.set('sort', 'best');
        if (kind === 'category') query.set('category_id', target.dataset.categoryId);
        const data = await getProducts(query);
        const products = kind === 'expiry'
          ? data.products.map((product) => {
              const expiry = product.han_su_dung;
              return { ...product, hsd: expiry, near_expiry_days: daysUntilExpiry(expiry, serverNow()) };
            }).filter((product) => product.nhan_khuyen_mai === 'CAN_HAN' && product.hsd)
          : data.products;
        target.innerHTML = products.length
          ? rail(products, kind === 'expiry' ? { nearExpiry: true, showHsd: true } : {})
          : state(kind === 'expiry' ? 'Hiện chưa có hàng cận hạn' : 'Chưa có sản phẩm', 'Vui lòng quay lại sau.');
        if (kind === 'best') {
          target.innerHTML = products.length
            ? rail(products)
            : state('Chưa có dữ liệu bán chạy', 'Hiện chưa có sản phẩm trong bảng xếp hạng.');
        }
        if (kind === 'category') {
          const more = target.closest('.ms-section')?.querySelector('.ms-section__more');
          const remaining = Math.max(0, data.pagination.total - data.products.length);
          if (more) {
            more.hidden = remaining === 0;
            more.textContent = `Xem thêm ${remaining} sản phẩm ${target.dataset.categoryName || ''}`.trim();
          }
        }
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
