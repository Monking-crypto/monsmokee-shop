// account.js - hiển thị thông tin Admin từ phiên hiện tại
import { api, ApiError } from '../core/api.js';
import { escapeHtml, qs, setBusy, toast } from '../core/ui.js';

const root = qs('#admin-page-content');

function showFormErrors(form, errors) {
  form.querySelectorAll('.admin-field small').forEach((small) => { small.textContent = ''; });
  if (!errors) return;
  Object.entries(errors).forEach(([field, message]) => {
    const input = form.elements[field];
    if (!input) return;
    const small = input.closest('.admin-field')?.querySelector('small');
    if (small) small.textContent = String(message);
  });
}

function bindProfileForm() {
  const form = qs('#account-profile-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showFormErrors(form, null);
    const submit = qs('#account-profile-submit');
    setBusy(submit, true);
    try {
      const data = await api.put('/admin/me', {
        ho_ten: form.elements.ho_ten.value.trim(),
        email: form.elements.email.value.trim(),
        so_dien_thoai: form.elements.so_dien_thoai.value.trim(),
      });
      if (data?.user) {
        form.elements.ho_ten.value = data.user.ho_ten || '';
        form.elements.email.value = data.user.email || '';
        form.elements.so_dien_thoai.value = data.user.so_dien_thoai || '';
        window.dispatchEvent(new CustomEvent('ms:admin-profile-updated', {
          detail: { ho_ten: data.user.ho_ten || '' },
        }));
      }
      toast('Đã lưu thông tin tài khoản');
    } catch (error) {
      if (error instanceof ApiError && [404, 405].includes(error.status)) {
        toast('Tính năng này chưa được backend hỗ trợ.', 'info');
        return;
      }
      showFormErrors(form, error instanceof ApiError ? error.errors : null);
      toast(error?.message || 'Không thể lưu thông tin tài khoản', 'error');
    } finally {
      setBusy(submit, false);
    }
  });
}

function bindPasswordForm() {
  const form = qs('#account-password-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showFormErrors(form, null);
    const submit = qs('#account-password-submit');
    const newPassword = form.elements.mat_khau_moi.value;
    if (!/^(?=.*[a-z])(?=.*\d).{8,}$/.test(newPassword)) {
      showFormErrors(form, { mat_khau_moi: 'Mật khẩu mới cần ít nhất 8 ký tự, gồm chữ thường và số.' });
      form.elements.mat_khau_moi.focus();
      return;
    }
    if (newPassword !== form.elements.nhap_lai_mat_khau.value) {
      showFormErrors(form, { nhap_lai_mat_khau: 'Mật khẩu nhập lại không khớp.' });
      form.elements.nhap_lai_mat_khau.focus();
      return;
    }
    setBusy(submit, true);
    try {
      await api.patch('/admin/me/password', {
        mat_khau_cu: form.elements.mat_khau_cu.value,
        mat_khau_moi: form.elements.mat_khau_moi.value,
        nhap_lai_mat_khau: form.elements.nhap_lai_mat_khau.value,
      });
      form.reset();
      toast('Đã đổi mật khẩu thành công');
    } catch (error) {
      if (error instanceof ApiError && [404, 405].includes(error.status)) {
        toast('Tính năng này chưa được backend hỗ trợ.', 'info');
        return;
      }
      showFormErrors(form, error instanceof ApiError ? error.errors : null);
      toast(error?.message || 'Không thể đổi mật khẩu', 'error');
    } finally {
      setBusy(submit, false);
    }
  });
}

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
        <section class="admin-panel">
          <h2>Thông tin tài khoản</h2>
          <form id="account-profile-form" class="admin-account-password">
            <label class="admin-field" for="account-name">Họ tên
              <input id="account-name" name="ho_ten" value="${escapeHtml(user.ho_ten || '')}" autocomplete="name" required maxlength="100">
              <small></small>
            </label>
            <label class="admin-field" for="account-email">Email
              <input id="account-email" name="email" type="email" value="${escapeHtml(user.email || '')}" autocomplete="email" required maxlength="254">
              <small></small>
            </label>
            <label class="admin-field" for="account-phone">Số điện thoại
              <input id="account-phone" name="so_dien_thoai" value="${escapeHtml(user.so_dien_thoai || '')}" autocomplete="tel" required>
              <small></small>
            </label>
            <div class="admin-field"><span>Vai trò</span><strong>${escapeHtml(user.vai_tro || '')}</strong></div>
            <button id="account-profile-submit" class="ms-btn ms-btn--green" type="submit">Lưu thông tin</button>
          </form>
        </section>
        <section class="admin-panel">
          <h2>Đổi mật khẩu</h2>
          <form id="account-password-form" class="admin-account-password">
            <label class="admin-field" for="account-old-password">Mật khẩu hiện tại
              <input id="account-old-password" name="mat_khau_cu" type="password" autocomplete="current-password">
              <small></small>
            </label>
            <label class="admin-field" for="account-new-password">Mật khẩu mới
              <input id="account-new-password" name="mat_khau_moi" type="password" autocomplete="new-password" minlength="8" required>
              <small></small>
            </label>
            <label class="admin-field" for="account-confirm-password">Nhập lại mật khẩu mới
              <input id="account-confirm-password" name="nhap_lai_mat_khau" type="password" autocomplete="new-password" required>
              <small></small>
            </label>
            <p class="admin-muted">Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ thường và chữ số.</p>
            <button id="account-password-submit" class="ms-btn ms-btn--green" type="submit">Cập nhật mật khẩu</button>
          </form>
        </section>
      </div>`;
    bindProfileForm();
    bindPasswordForm();
  } catch (error) {
    root.innerHTML = `<div class="ms-state"><strong>Không tải được thông tin tài khoản</strong>${escapeHtml(error.message)}<div class="mt-3"><button id="account-retry" class="ms-btn ms-btn--green" type="button">Thử lại</button></div></div>`;
    qs('#account-retry').addEventListener('click', loadAccount);
  }
}

await loadAccount();
