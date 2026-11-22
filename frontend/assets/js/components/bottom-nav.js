// bottom-nav.js - thanh điều hướng dưới cùng trên mobile
import { toggleCategoryMenu } from './category-menu.js';

export function mountBottomNav(host, active = 'home') {
  host.className = 'bottom-nav';
  host.setAttribute('aria-label', 'Điều hướng chính');
  const cls = (k) => (k === active ? ' class="is-active" aria-current="page"' : '');
  host.innerHTML = `
    <a href="index.html"${cls('home')}><i class="bi bi-house-door"></i>Trang chủ</a>
    <button type="button" id="bn-cat"><i class="bi bi-grid"></i>Danh mục</button>
    <a href="gio-hang.html"${cls('cart')}><i class="bi bi-cart3"><span class="ms-count" data-cart-badge hidden>0</span></i>Giỏ hàng</a>
    <a href="${document.documentElement.dataset.auth === 'in' ? 'tai-khoan.html' : 'dang-nhap.html'}"${cls('account')}><i class="bi bi-person"></i>Tài khoản</a>`;
  host.querySelector('#bn-cat').addEventListener('click', toggleCategoryMenu);
}
