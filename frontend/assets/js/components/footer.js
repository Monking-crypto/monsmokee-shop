// footer.js
import { CONFIG } from '../core/config.js';
import { escapeHtml } from '../core/ui.js';
import { formatVnd } from '../core/format.js';

export function mountFooter(host) {
  const S = CONFIG.STORE_INFO;
  host.className = 'site-footer';
  host.innerHTML = `<div class="ms-container">
    <div><h3>${escapeHtml(S.name)}</h3><p>Cửa hàng tạp hóa tại TP. Đồng Hới.</p>
      <ul class="mt-2"><li>Địa chỉ: ${escapeHtml(S.address)}</li><li>Giờ mở cửa: ${escapeHtml(S.hours)}</li><li>Hotline: ${escapeHtml(S.hotline)}</li></ul></div>
    <div><h3>Chính sách</h3><ul>
      <li>Giao hàng nội thành Đồng Hới, đơn từ ${formatVnd(CONFIG.COD_MIN_ORDER)}</li>
      <li>Miễn phí giao đơn từ ${formatVnd(CONFIG.FREESHIP_FROM)} hoặc trong ${String(CONFIG.FREESHIP_MAX_KM).replace('.', ',')} km</li>
      <li>Nhận tại cửa hàng (Click &amp; Collect)</li><li>Thanh toán khi nhận hàng</li></ul></div>
    <div><h3>Liên kết</h3><ul><li><a href="san-pham.html">Tất cả sản phẩm</a></li><li><a href="don-hang.html">Đơn hàng của tôi</a></li><li><a href="tai-khoan.html">Tài khoản</a></li></ul></div>
    <p class="site-footer__copy">© ${new Date().getFullYear()} ${escapeHtml(S.name)}. Giao diện tham khảo bố cục siêu thị trực tuyến, không dùng tài sản của thương hiệu khác.</p></div>`;
}
