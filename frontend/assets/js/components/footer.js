// footer.js
import { CONFIG } from '../core/config.js';
import { escapeHtml } from '../core/ui.js';

export function mountFooter(host) {
  const store = CONFIG.STORE_INFO;
  host.className = 'site-footer';
  host.innerHTML = `<div class="ms-container">
    <div class="site-footer__columns">
      <section><a href="index.html" aria-label="MON SMOKEE - Trang chủ"><img class="site-footer__logo" src="assets/img/logo.svg" alt="MON SMOKEE"></a>
        <h3>Hộ kinh doanh ${escapeHtml(store.name)}</h3><p>Mã số hộ kinh doanh: <span>${escapeHtml(store.businessCode)}</span></p></section>
      <section><h3>Về chúng tôi</h3><ul>
        <li><a href="#ve-chung-toi">Giới thiệu</a></li><li><a href="#chinh-sach-bao-mat">Chính sách bảo mật</a></li>
        <li><a href="#dieu-khoan">Điều khoản và điều kiện giao dịch</a></li></ul></section>
      <section><h3>Hỗ trợ khách hàng</h3><ul>
        <li><a href="#ho-tro">Trung tâm hỗ trợ</a></li><li><a href="#giao-hang">Chính sách giao hàng</a></li>
        <li><a href="#thanh-toan">Chính sách thanh toán</a></li><li><a href="#doi-tra">Chính sách đổi trả</a></li>
        <li><a href="#gop-y">Đánh giá góp ý</a></li></ul></section>
      <section><h3>Chăm sóc khách hàng</h3><ul>
        <li>Mua online: <span>${escapeHtml(store.onlinePhone)}</span></li><li>Email: <span>${escapeHtml(store.email)}</span></li></ul>
        <h4>Kết nối với chúng tôi</h4><div class="site-footer__social">
          <a href="#" aria-label="Facebook"><i class="bi bi-facebook"></i></a><a href="#" aria-label="YouTube"><i class="bi bi-youtube"></i></a><a href="#" aria-label="Zalo">Z</a>
        </div></section>
    </div>
    <div class="site-footer__address"><strong>Địa chỉ cửa hàng:</strong><span>${escapeHtml(store.address)}</span></div>
    <p class="site-footer__copy">© ${new Date().getFullYear()} ${escapeHtml(store.name)}</p>
  </div>`;
}
