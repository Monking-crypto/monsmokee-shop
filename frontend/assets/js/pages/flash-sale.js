import { api } from '../core/api.js';
import { escapeHtml, qs } from '../core/ui.js';
import { formatVnd } from '../core/format.js';
import { mountHeader } from '../components/header.js';
import { mountFooter } from '../components/footer.js';
import { mountBottomNav } from '../components/bottom-nav.js';
import { bindProductCards, productCard, productSkeletons } from '../components/product-card.js';

const root = qs('#flash-sale-root');
let clockTimer;
let serverOffset = 0;
let endedStateShown = false;
let loading = false;
let bestProductsLoaded = false;

const vietnamParts = (date = new Date()) => Object.fromEntries(new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: 'numeric', day: 'numeric',
}).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));

function nextFridayTimestamp(now = Date.now()) {
  const { year, month, day } = vietnamParts(new Date(now));
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysUntilFriday = (5 - weekday + 7) % 7 || 7;
  return Date.UTC(year, month - 1, day + daysUntilFriday, -7);
}

function resolveTimes(data) {
  const now = Date.now() + serverOffset;
  const start = Date.parse(data.starts_at);
  const end = Date.parse(data.ends_at);
  const next = Date.parse(data.next_start);
  return {
    now,
    start: Number.isFinite(start) ? start : nextFridayTimestamp(now),
    end: Number.isFinite(end) ? end : nextFridayTimestamp(now) + 86400000 - 1000,
    next: Number.isFinite(next) ? next : nextFridayTimestamp(now),
  };
}

function getState(data, times) {
  if (data.active && times.now >= times.start && times.now <= times.end) {
    return data.products?.length ? 'active' : 'empty';
  }
  if (!endedStateShown && (data.ended || (times.end < times.now && times.now - times.end <= 60000))) {
    endedStateShown = true;
    return 'ended';
  }
  return 'upcoming';
}

function clockMarkup() {
  return `<div class="flash-clock" data-flash-clock role="timer" aria-live="off" aria-label="Đồng hồ đếm ngược">
    ${[['days', 'Ngày'], ['hours', 'Giờ'], ['minutes', 'Phút'], ['seconds', 'Giây']].map(([key, label]) =>
    `<span class="flash-clock__unit"><span class="flash-clock__value" data-clock="${key}">00</span><span class="flash-clock__label">${label}</span></span>`).join('')}
    <span class="flash-clock__sr" data-clock-readable></span>
  </div>`;
}

function renderHero(state, data) {
  const active = state === 'active' || state === 'empty';
  const headline = active ? 'Đang sale, kết thúc sau' : state === 'ended'
    ? 'Siêu sale tuần này đã kết thúc' : 'Siêu sale Thứ 6 mở bán sau';
  const sub = active
    ? '10 sản phẩm được chọn, giảm giá trong khung giờ Thứ 6.'
    : state === 'ended'
      ? 'Hẹn gặp bạn ở đợt Siêu sale Thứ 6 tuần tới.'
      : 'Mỗi Thứ 6: tối đa 10 sản phẩm, giảm 10%.';
  const badge = active ? '<p class="flash-hero__live">ĐANG MỞ BÁN</p>' : '';
  return `<section class="flash-hero" aria-labelledby="flash-title">
    <div class="flash-hero__copy">${badge}<p class="flash-hero__eyebrow"><i class="bi bi-shop-window" aria-hidden="true"></i> MON SMOKEE · ƯU ĐÃI THỨ 6</p>
      <h1 id="flash-title">${headline}</h1><p class="flash-hero__sub">${sub}</p>${clockMarkup()}</div>
    <div class="flash-hero__ticket" aria-label="Giảm tối đa ${Number(data.discount_percent) || 10} phần trăm">
      <span>Tem giá thứ 6</span><strong>-${Number(data.discount_percent) || 10}%</strong><i class="bi bi-tag-fill" aria-hidden="true"></i>
    </div>
  </section>`;
}

function renderPerks() {
  return `<section class="flash-perks" aria-label="Thông tin Siêu sale">
    <div class="flash-perk"><i class="bi bi-clock" aria-hidden="true"></i><span><strong>Mở cửa đúng 00:00</strong>Thứ 6 hằng tuần, giờ Việt Nam</span></div>
    <div class="flash-perk"><i class="bi bi-basket2" aria-hidden="true"></i><span><strong>Tối đa 10 sản phẩm</strong>Được cửa hàng chọn mỗi tuần</span></div>
    <div class="flash-perk"><i class="bi bi-tags" aria-hidden="true"></i><span><strong>Giảm 10% tự động</strong>Giá ưu đãi áp dụng trong đợt sale</span></div>
  </section>`;
}

function waitingPanel(state) {
  const heading = state === 'ended' ? 'Danh sách đợt tiếp theo chưa mở' : 'Danh sách sản phẩm sẽ được công bố khi sale mở';
  const text = state === 'ended'
    ? 'Siêu sale tuần này đã khép lại. Bạn có thể xem các ưu đãi khác trong lúc chờ.'
    : state === 'empty'
      ? 'Ưu đãi đang mở bán; danh sách sản phẩm sẽ xuất hiện khi cửa hàng công bố.'
      : 'Chưa tới giờ mở bán nên hiện chưa có sản phẩm nào được hiển thị.';
  return `<section class="flash-empty${state === 'empty' ? ' flash-empty--compact' : ''}" aria-labelledby="flash-empty-title">
    <div class="flash-empty__art" aria-hidden="true"><span class="flash-empty__tag"><strong>-10%</strong></span><i class="bi bi-basket2"></i></div>
    <h2 id="flash-empty-title">${state === 'empty' ? 'Hôm nay cửa hàng chưa công bố danh sách Siêu sale' : heading}</h2>
    <p>${state === 'empty' ? 'Ưu đãi đang mở bán; danh sách sản phẩm sẽ xuất hiện khi cửa hàng công bố.' : text}</p>
    ${state === 'empty' ? '' : '<button class="flash-locked" type="button" disabled aria-disabled="true">Chưa mở bán</button>'}
  </section>`;
}

function renderExplore() {
  return `<section class="flash-section" aria-labelledby="flash-explore-title">
    <div class="flash-section__head"><div><h2 id="flash-explore-title">Trong lúc chờ, bạn có thể xem</h2></div></div>
    <div class="flash-explore">
      <a class="flash-explore__link" href="can-han.html"><span><strong>Cận hạn giảm 50%</strong><span>Ưu đãi hàng còn dùng tốt</span></span><i class="bi bi-arrow-up-right" aria-hidden="true"></i></a>
      <a class="flash-explore__link" href="ban-chay.html"><span><strong>Sản phẩm bán chạy</strong><span>Được khách mua nhiều nhất</span></span><i class="bi bi-arrow-up-right" aria-hidden="true"></i></a>
    </div>
    <div id="flash-best-content" class="flash-best-grid" aria-live="polite">
      ${productSkeletons(5)}
    </div>
  </section>`;
}

function categoryInfo(product) {
  const category = product.danh_muc || product.category || {};
  const key = product.danh_muc_id ?? product.category_id ?? category.id ?? category.slug ?? '';
  const name = product.category_name || product.ten_danh_muc || category.ten_danh_muc || category.name || category.ten || '';
  return { key: String(key), name: String(name) };
}

function normalizeSaleProduct(product) {
  const normalized = {
    ...product,
    ten_san_pham: product.ten_san_pham || product.ten || 'Sản phẩm',
    hinh_anh: product.hinh_anh || product.anh || '',
    gia_ban: Number(product.gia_ban ?? product.gia_goc) || 0,
    gia_hieu_luc: Number(product.gia_hieu_luc ?? product.gia_ban_hieu_luc ?? product.gia_goc) || 0,
    phan_tram_giam: Number(product.phan_tram_giam) || 10,
  };
  if (Number.isFinite(Number(product.so_luong_ton))) normalized.so_luong_ton = Number(product.so_luong_ton);
  else if (typeof product.con_hang === 'boolean') normalized.con_hang = product.con_hang;
  return normalized;
}

function renderSaleProducts(products, data) {
  const normalized = products.slice(0, Math.min(10, Number(data.max_products) || 10)).map(normalizeSaleProduct);
  const categories = new Map(normalized.map(categoryInfo).filter(({ key, name }) => key && name).map(({ key, name }) => [key, name]));
  const filters = categories.size >= 3
    ? `<div class="flash-category-filter" role="group" aria-label="Lọc sản phẩm theo danh mục">
        <button type="button" data-sale-filter="all" aria-pressed="true">Tất cả</button>
        ${[...categories].map(([key, name]) => `<button type="button" data-sale-filter="${escapeHtml(key)}" aria-pressed="false">${escapeHtml(name)}</button>`).join('')}
      </div>`
    : '';
  return `<section class="flash-section" aria-labelledby="flash-products-title">
    <div class="flash-section__head"><div><h2 id="flash-products-title">Ưu đãi đang mở bán</h2><p>Tối đa ${Number(data.max_products) || 10} sản phẩm · Không cộng dồn với ưu đãi khác</p></div></div>
    ${filters}<div class="flash-sale-grid">${normalized.map((product) => {
      const { key } = categoryInfo(product);
      return productCard(product, { showStock: true, categoryKey: key });
    }).join('')}</div>
  </section>`;
}

function renderPage(data) {
  const times = resolveTimes(data);
  const state = getState(data, times);
  const target = state === 'active' || state === 'empty' ? times.end : times.next;
  root.innerHTML = `${renderHero(state, data)}${renderPerks()}
    <p class="flash-clock__sr" id="flash-state-announcement" aria-live="polite">${state === 'active' ? 'Siêu sale đã bắt đầu.' : state === 'empty' ? 'Siêu sale đang mở nhưng cửa hàng chưa công bố sản phẩm.' : state === 'ended' ? 'Siêu sale tuần này đã kết thúc.' : 'Siêu sale chưa mở bán.'}</p>
    ${state === 'active' ? renderSaleProducts(data.products || [], data) : `${waitingPanel(state)}${renderExplore()}`}`;
  root.setAttribute('aria-busy', 'false');
  if (!bestProductsLoaded && state !== 'active') loadBestSellers();
  startClock(target, times, state);
}

function startClock(target, times, state) {
  clearInterval(clockTimer);
  const targetTime = state === 'ended' ? Math.min(target, times.now + 4000) : target;
  const clock = qs('[data-flash-clock]', root);
  const update = () => {
    const seconds = Math.max(0, Math.ceil((targetTime - (Date.now() + serverOffset)) / 1000));
    const values = {
      days: Math.floor(seconds / 86400),
      hours: Math.floor((seconds % 86400) / 3600),
      minutes: Math.floor((seconds % 3600) / 60),
      seconds: seconds % 60,
    };
    Object.entries(values).forEach(([key, value]) => {
      const element = clock?.querySelector(`[data-clock="${key}"]`);
      if (element) element.textContent = String(value).padStart(2, '0');
    });
    if (clock) {
      clock.setAttribute('aria-label', `Còn ${values.days} ngày ${values.hours} giờ ${values.minutes} phút ${values.seconds} giây`);
      const readable = clock.querySelector('[data-clock-readable]');
      if (readable) readable.textContent = `Còn ${values.days} ngày ${values.hours} giờ ${values.minutes} phút ${values.seconds} giây`;
    }
    if (seconds === 0) {
      clearInterval(clockTimer);
      load();
    }
  };
  update();
  clockTimer = setInterval(update, 1000);
}

async function loadBestSellers() {
  try {
    const data = await api.get('/products?sort=best&per_page=5&page=1');
    const products = (data.items || []).slice(0, 5);
    const content = qs('#flash-best-content', root);
    if (!content) return;
    content.innerHTML = products.length
      ? products.map((product) => productCard(product)).join('')
      : '<p class="ms-state">Chưa có sản phẩm bán chạy.</p>';
    bestProductsLoaded = true;
  } catch {
    const content = qs('#flash-best-content', root);
    if (!content) return;
    content.innerHTML = `<div class="flash-error"><strong>Không tải được sản phẩm bán chạy</strong><p>Thử tải lại danh sách.</p><button class="ms-btn ms-btn--ghost" type="button" data-best-retry>Thử lại</button></div>`;
    content.querySelector('[data-best-retry]').addEventListener('click', loadBestSellers);
  }
}

async function load() {
  if (loading) return;
  loading = true;
  root.setAttribute('aria-busy', 'true');
  try {
    const data = await api.get('/promotions/friday-sale');
    const serverTime = Date.parse(data.server_time);
    serverOffset = Number.isFinite(serverTime) ? serverTime - Date.now() : 0;
    renderPage(data);
  } catch {
    clearInterval(clockTimer);
    root.innerHTML = `<section class="flash-error"><strong>Không tải được chương trình Siêu sale</strong><p>Kiểm tra kết nối rồi thử lại.</p><button class="ms-btn ms-btn--green" id="flash-retry" type="button">Thử lại</button></section>`;
    root.setAttribute('aria-busy', 'false');
    qs('#flash-retry').addEventListener('click', load);
  } finally {
    loading = false;
  }
}

root.addEventListener('click', (event) => {
  const filter = event.target.closest('[data-sale-filter]');
  if (!filter) return;
  const grid = qs('.flash-sale-grid', root);
  root.querySelectorAll('[data-sale-filter]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button === filter));
  });
  grid?.querySelectorAll('.pc').forEach((card) => {
    card.hidden = filter.dataset.saleFilter !== 'all' && card.dataset.categoryKey !== filter.dataset.saleFilter;
  });
});
bindProductCards(root);
window.addEventListener('pagehide', () => clearInterval(clockTimer), { once: true });

await mountHeader(qs('#site-header'));
mountFooter(qs('#site-footer'));
mountBottomNav(qs('#bottom-nav'));
await load();
