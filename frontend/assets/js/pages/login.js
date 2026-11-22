// login.js - trang đăng nhập
import { api, ApiError } from '../core/api.js';
import { rules } from '../core/validators.js';
import { setFieldError, attachPasswordToggle, safeRedirect, showAlert } from '../core/form.js';
import { setBusy, toast, qs } from '../core/ui.js';

const form = qs('#login-form'), alertBox = qs('#login-alert');
const phone = qs('#phone'), pass = qs('#password');
const redirect = new URLSearchParams(location.search).get('redirect');
attachPasswordToggle(pass);

if (redirect) { alertBox.hidden = false; alertBox.className = 'auth__alert'; alertBox.textContent = 'Vui lòng đăng nhập để tiếp tục thanh toán.'; }

api.get('/auth/me').then((d) => { if (d.user) location.replace('index.html'); }).catch(() => {});

phone.addEventListener('blur', () => setFieldError(phone.closest('.field'), rules.so_dien_thoai(phone.value)));
pass.addEventListener('blur', () => setFieldError(pass.closest('.field'), pass.value ? '' : 'Vui lòng nhập mật khẩu'));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const e1 = rules.so_dien_thoai(phone.value), e2 = pass.value ? '' : 'Vui lòng nhập mật khẩu';
  setFieldError(phone.closest('.field'), e1);
  setFieldError(pass.closest('.field'), e2);
  if (e1 || e2) return (e1 ? phone : pass).focus();
  const btn = qs('#login-btn');
  setBusy(btn, true);
  try {
    await api.post('/auth/login', { so_dien_thoai: phone.value.trim(), mat_khau: pass.value, redirect });
    toast('Đăng nhập thành công');
    setTimeout(() => location.assign(safeRedirect(redirect)), 400);
  } catch (err) {
    setBusy(btn, false);
    if (!(err instanceof ApiError)) return;
    // 3 loại lỗi theo mục 5.2: sai thông tin chung / tài khoản bị khóa / quá nhiều lần thử
    if (err.status === 423 || err.status === 403) showAlert(alertBox, err.message || 'Tài khoản đang bị khóa. Vui lòng liên hệ cửa hàng.');
    else if (err.status === 429) showAlert(alertBox, err.message || 'Bạn đã thử quá nhiều lần. Vui lòng chờ ít phút rồi đăng nhập lại.');
    else if (err.status) showAlert(alertBox, 'Số điện thoại hoặc mật khẩu chưa đúng.');
  }
});
