// header.js - topbar + header sticky + thanh danh mục. Dùng: mountHeader(document.getElementById('site-header'))
import { CONFIG } from '../core/config.js';
import { api, ApiError } from '../core/api.js';
import { escapeHtml, debounce, toast } from '../core/ui.js';
import { formatVnd } from '../core/format.js';
import { initCategoryMenu, toggleCategoryMenu } from './category-menu.js';
import { mountDeliveryModal, openDeliveryModal } from './delivery-modal.js';

const S = CONFIG.STORE_INFO;

export async function mountHeader(host) {
  host.className = 'site-header-wrap';
  host.innerHTML = `
  <div class="topbar"><div class="ms-container">
    <span>Giao hàng nội thành Đồng Hới. Miễn phí đơn từ ${formatVnd(CONFIG.FREESHIP_FROM)}</span>
    <span>Mở cửa ${escapeHtml(S.hours)}${S.hotline ? ` · Hotline ${escapeHtml(S.hotline)}` : ''}</span>
  </div></div>
  <header class="site-header">
    <div class="ms-container site-header__main">
      <a class="site-header__logo" href="index.html" aria-label="MON SMOKEE, về trang chủ"><img src="assets/img/logo.svg" alt="MON SMOKEE" width="165" height="36"></a>
      <a class="hdr-home" href="index.html"><i class="bi bi-house-door" aria-hidden="true"></i><span>Trang chủ</span></a>
      <form class="search" role="search" action="san-pham.html" autocomplete="off">
        <i class="bi bi-search" aria-hidden="true"></i>
        <input type="search" name="q" placeholder="Tìm sản phẩm… (gõ không dấu cũng được)" aria-label="Tìm sản phẩm" aria-controls="search-list" aria-expanded="false">
        <ul class="search__list" id="search-list" hidden></ul>
      </form>
      <button class="hdr-delivery" id="delivery-open" type="button"><i class="bi bi-geo-alt" aria-hidden="true"></i><span id="delivery-label">Giao hàng</span></button>
      <div class="hdr-actions">
        <a class="hdr-link" href="gio-hang.html" aria-label="Giỏ hàng">
          <i class="bi bi-cart3" aria-hidden="true"><span class="ms-count" id="cart-count" hidden>0</span></i><span class="hdr-text">Giỏ hàng</span>
        </a>
        <div class="hdr-auth-desktop" id="hdr-auth"></div>
      </div>
    </div>
    <div class="catbar"><div class="ms-container">
      <button class="catbar__btn" id="cat-btn" type="button" aria-controls="catmenu-dialog" aria-expanded="false"><i class="bi bi-list" aria-hidden="true"></i>Danh mục sản phẩm</button>
      <a class="catbar__link catbar__link--sale" href="sieu-sale-thu-6.html">Siêu sale Thứ 6</a>
      <a class="catbar__link catbar__link--exp" href="can-han.html">Cận hạn giảm 50%</a>
      <a class="catbar__link" href="ban-chay.html">Bán chạy</a>
    </div></div>
  </header>`;
  initCategoryMenu(host.querySelector('.site-header'));
  host.querySelector('#cat-btn').addEventListener('click', toggleCategoryMenu);
  mountDeliveryModal(host);
  host.querySelector('#delivery-open').addEventListener('click', (event) => openDeliveryModal(event.currentTarget));
  setupSearch(host.querySelector('.search'));
  document.addEventListener('ms:cart', (e) => setCartCount(e.detail.count));
  await Promise.all([renderAuth(host.querySelector('#hdr-auth')), refreshCartCount()]);
}

export function setCartCount(n) {
  const el = document.getElementById('cart-count');
  if (!el) return;
  el.textContent = n > 99 ? '99+' : n;
  el.hidden = !n;
  document.querySelectorAll('[data-cart-badge]').forEach((b) => { b.textContent = n > 99 ? '99+' : n; b.hidden = !n; });
}
export async function refreshCartCount() {
  try { setCartCount((await api.get('/cart')).count || 0); } catch { /* giữ nguyên */ }
}

async function renderAuth(el) {
  let user = null;
  try {
    user = (await api.get('/auth/me')).user;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) toast(error.message || 'Không thể kiểm tra phiên đăng nhập.', 'error');
  }
  document.documentElement.dataset.auth = user ? 'in' : 'out';
  if (!user) {
    el.innerHTML = '<a class="ms-btn ms-btn--ghost" href="dang-nhap.html">Đăng nhập</a><a class="ms-btn ms-btn--green" href="dang-ky.html">Đăng ký</a>';
    return;
  }
  const isAdmin = String(user.vai_tro || '').toLowerCase() === 'admin';
  const menuLinks = isAdmin
    ? '<a href="admin/index.html">Trang quản trị</a><a href="admin/tai-khoan.html">Tài khoản quản trị</a>'
    : '<a href="tai-khoan.html">Tài khoản</a><a href="don-hang.html">Đơn hàng của tôi</a>';
  const initial = escapeHtml((user.ho_ten || '?').trim().split(/\s+/).pop().charAt(0).toUpperCase());
  el.innerHTML = `<div class="user-menu"><button class="hdr-link" type="button" aria-haspopup="true" aria-expanded="false">
      <span class="avatar" aria-hidden="true">${initial}</span><span class="hdr-text">${escapeHtml(user.ho_ten)}</span></button>
    <div class="user-menu__panel" hidden>${menuLinks}
    <button type="button" data-logout>Đăng xuất</button></div></div>`;
  const btn = el.querySelector('.hdr-link'), pnl = el.querySelector('.user-menu__panel');
  btn.addEventListener('click', () => { pnl.hidden = !pnl.hidden; btn.setAttribute('aria-expanded', String(!pnl.hidden)); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.user-menu')) pnl.hidden = true; });
  el.querySelector('[data-logout]').addEventListener('click', async () => {
    try {
      await api.post('/auth/logout');
      toast('Đã đăng xuất');
      setTimeout(() => location.assign('index.html'), 500);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'Không thể đăng xuất. Vui lòng thử lại.', 'error');
    }
  });
}

function setupSearch(form) {
  const input = form.querySelector('input'), list = form.querySelector('.search__list');
  const hide = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); };
  const suggest = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 1) return hide();
    try {
      const { items } = await api.get(`/products?q=${encodeURIComponent(q)}&per_page=6`);
      list.innerHTML = items.length
        ? items.slice(0, 6).map((p) => `<li><a href="chi-tiet-san-pham.html?id=${p.id}"><span>${escapeHtml(p.ten_san_pham)}</span><b>${formatVnd(p.gia_hieu_luc ?? p.gia_ban)}</b></a></li>`).join('')
        : '<li class="search__empty">Không tìm thấy sản phẩm phù hợp</li>';
      list.hidden = false; input.setAttribute('aria-expanded', 'true');
    } catch { hide(); }
  }, 300);
  input.addEventListener('input', suggest);
  document.addEventListener('click', (e) => { if (!form.contains(e.target)) hide(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
}
