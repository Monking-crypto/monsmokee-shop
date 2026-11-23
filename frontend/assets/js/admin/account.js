import { notImplemented, qs } from '../core/ui.js';

const root = qs('#admin-page-content');
root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Tài khoản</div>
  <div class="admin-account-grid">
    <section class="admin-panel"><h2>Thông tin tài khoản</h2>
      <form id="account-profile" class="admin-form-grid">
        <label class="admin-field admin-field--wide">Họ tên<input value="Quản trị tối cao" autocomplete="name"></label>
        <label class="admin-field">Email<input type="email" value="admin@monsmokee.local" autocomplete="email"></label>
        <label class="admin-field">Số điện thoại<input type="tel" value="0900000000" autocomplete="tel"></label>
        <div class="admin-form-actions admin-field--wide"><button class="ms-btn ms-btn--green" type="submit">Lưu thông tin</button></div>
      </form>
    </section>
    <section class="admin-panel"><h2>Đổi mật khẩu</h2>
      <form id="account-password" class="admin-account-password">
        <label class="admin-field">Mật khẩu hiện tại<input type="password" autocomplete="current-password"></label>
        <label class="admin-field">Mật khẩu mới<input type="password" autocomplete="new-password"></label>
        <label class="admin-field">Nhập lại mật khẩu mới<input type="password" autocomplete="new-password"></label>
        <div class="admin-form-actions"><button class="admin-button" type="submit">Cập nhật mật khẩu</button></div>
      </form>
      <p class="admin-muted">Các thay đổi tài khoản sẽ được kết nối khi backend hoàn thiện.</p>
    </section>
  </div>`;

root.querySelectorAll('form').forEach((form) => form.addEventListener('submit', (event) => {
  event.preventDefault();
  notImplemented();
}));
