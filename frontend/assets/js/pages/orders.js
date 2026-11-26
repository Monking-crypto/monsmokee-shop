// orders.js - trang lịch sử đơn hàng thành viên
import { api, ApiError } from '../core/api.js';
import { escapeHtml, qs } from '../core/ui.js';
import { mountHeader } from '../components/header.js';
import { mountFooter } from '../components/footer.js';
import { mountBottomNav } from '../components/bottom-nav.js';

const root = qs('#orders-app');

function renderGuest() {
  root.setAttribute('aria-busy', 'false');
  root.innerHTML = `<section class="orders-panel">
    <span class="orders-panel__icon"><i class="bi bi-person-lock" aria-hidden="true"></i></span>
    <h2>Đăng nhập để xem đơn hàng</h2>
    <p>Đăng nhập tài khoản để sử dụng các tiện ích dành cho thành viên.</p>
    <div class="orders-panel__actions">
      <a class="ms-btn ms-btn--green" href="dang-nhap.html?redirect=don-hang.html">Đăng nhập</a>
      <a class="ms-btn ms-btn--ghost" href="san-pham.html">Tiếp tục mua sắm</a>
    </div>
  </section>`;
}

function renderHistoryNotice() {
  root.setAttribute('aria-busy', 'false');
  root.innerHTML = `<section class="orders-panel">
    <span class="orders-panel__icon"><i class="bi bi-receipt" aria-hidden="true"></i></span>
    <h2>Lịch sử đơn hàng đang được hoàn thiện</h2>
    <p>Khu vực này sẽ hiển thị trạng thái và thông tin các đơn hàng của bạn khi chức năng lịch sử đơn hàng được kết nối.</p>
    <div class="orders-panel__note">
      <i class="bi bi-info-circle-fill" aria-hidden="true"></i>
      <span>Khi chức năng tra cứu đơn hàng được kết nối, thông tin đơn hàng của bạn sẽ hiển thị tại đây.</span>
    </div>
    <div class="orders-panel__actions">
      <a class="ms-btn ms-btn--green" href="san-pham.html"><i class="bi bi-bag" aria-hidden="true"></i> Tiếp tục mua sắm</a>
      <a class="ms-btn ms-btn--ghost" href="tai-khoan.html">Về tài khoản</a>
    </div>
  </section>`;
}

function renderError(message) {
  root.setAttribute('aria-busy', 'false');
  root.innerHTML = `<section class="orders-panel orders-panel--error">
    <span class="orders-panel__icon"><i class="bi bi-exclamation-circle" aria-hidden="true"></i></span>
    <h2>Chưa tải được trạng thái tài khoản</h2>
    <p>${escapeHtml(message)}</p>
    <div class="orders-panel__actions">
      <button class="ms-btn ms-btn--green" id="orders-retry" type="button">Thử lại</button>
      <a class="ms-btn ms-btn--ghost" href="tai-khoan.html">Về tài khoản</a>
    </div>
  </section>`;
  qs('#orders-retry').addEventListener('click', loadOrdersPage);
}

async function loadOrdersPage() {
  root.setAttribute('aria-busy', 'true');
  try {
    const data = await api.get('/auth/me');
    if (!data?.user || typeof data.user !== 'object') {
      renderError('Máy chủ chưa trả về thông tin tài khoản hợp lệ.');
      return;
    }
    renderHistoryNotice();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      renderGuest();
      return;
    }
    renderError(error instanceof ApiError ? error.message : 'Không thể kết nối máy chủ. Vui lòng thử lại.');
  }
}

await mountHeader(qs('#site-header'));
mountFooter(qs('#site-footer'));
mountBottomNav(qs('#bottom-nav'));
await loadOrdersPage();
