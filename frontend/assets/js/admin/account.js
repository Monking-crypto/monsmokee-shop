// account.js - hiển thị thông tin Admin từ phiên hiện tại
import { api } from '../core/api.js';
import { escapeHtml, qs } from '../core/ui.js';

const root = qs('#admin-page-content');

async function loadAccount() {
  root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Tài khoản</div>
    <div class="admin-account-grid"><section class="admin-panel"><h2>Thông tin tài khoản</h2>
      <div class="admin-table-skeleton" aria-label="Đang tải thông tin tài khoản"></div>
    </section></div>`;
  try {
    const data = await api.get('/admin/me');
    const user = data?.user;
    if (!user || typeof user !== 'object') throw new Error('Máy chủ không trả về thông tin tài khoản hợp lệ.');
    root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Tài khoản</div>
      <div class="admin-account-grid">
        <section class="admin-panel"><h2>Thông tin tài khoản</h2>
          <dl class="admin-definition">
            <dt>Họ tên</dt><dd>${escapeHtml(user.ho_ten || '')}</dd>
            <dt>Email</dt><dd>${escapeHtml(user.email || '')}</dd>
            <dt>Số điện thoại</dt><dd>${escapeHtml(user.so_dien_thoai || '')}</dd>
            <dt>Vai trò</dt><dd>${escapeHtml(user.vai_tro || '')}</dd>
          </dl>
          <p class="admin-muted">API hiện tại chỉ hỗ trợ xem hồ sơ Admin; chưa có API cập nhật tên, thông tin liên hệ hoặc mật khẩu.</p>
        </section>
      </div>`;
  } catch (error) {
    root.innerHTML = `<div class="ms-state"><strong>Không tải được thông tin tài khoản</strong>${escapeHtml(error.message)}<div class="mt-3"><button id="account-retry" class="ms-btn ms-btn--green" type="button">Thử lại</button></div></div>`;
    qs('#account-retry').addEventListener('click', loadAccount);
  }
}

await loadAccount();
