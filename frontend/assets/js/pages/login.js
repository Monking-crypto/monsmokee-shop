// login.js - trang đăng nhập
import { api, ApiError } from '../core/api.js';
import { rules } from '../core/validators.js';
import { setFieldError, attachPasswordToggle, safeRedirect, showAlert, lockButtonForRetry } from '../core/form.js';
import { setBusy, toast, qs } from '../core/ui.js';

const form = qs('#login-form'), alertBox = qs('#login-alert');
const phone = qs('#phone'), pass = qs('#password');
const redirect = new URLSearchParams(location.search).get('redirect');
attachPasswordToggle(pass);

if (redirect) { alertBox.hidden = false; alertBox.className = 'auth__alert'; alertBox.textContent = 'Vui lòng đăng nhập để tiếp tục thanh toán.'; }

api.get('/auth/me').then((data) => {
  if (data.user) location.replace('index.html');
}).catch((error) => {
  if (error instanceof ApiError && error.status !== 401) showAlert(alertBox, error.message);
});

phone.addEventListener('blur', () => setFieldError(phone.closest('.field'), rules.so_dien_thoai(phone.value)));
pass.addEventListener('blur', () => setFieldError(pass.closest('.field'), pass.value ? '' : 'Vui lòng nhập mật khẩu'));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const e1 = rules.so_dien_thoai(phone.value), e2 = pass.value ? '' : 'Vui lòng nhập mật khẩu';
  setFieldError(phone.closest('.field'), e1);
  setFieldError(pass.closest('.field'), e2);
  if (e1 || e2) return (e1 ? phone : pass).focus();
  const btn = qs('#login-btn');
  let retryAfter = 0;
  setBusy(btn, true);
  try {
    await api.post('/auth/login', { so_dien_thoai: phone.value.trim(), mat_khau: pass.value });
    toast('Đăng nhập thành công');
    setTimeout(() => location.assign(safeRedirect(redirect)), 400);
  } catch (error) {
    if (error instanceof ApiError) {
      let shownFieldError = false;
      Object.entries(error.errors || {}).forEach(([key, message]) => {
        const input = key === 'so_dien_thoai' ? phone : key === 'mat_khau' ? pass : null;
        if (input && typeof message === 'string') {
          setFieldError(input.closest('.field'), message);
          shownFieldError = true;
        }
      });
      if (!shownFieldError || error.status !== 422) showAlert(alertBox, error.message);
      if (error.status === 429) retryAfter = error.retryAfterSeconds || 60;
    } else {
      showAlert(alertBox, 'Không thể đăng nhập lúc này. Vui lòng thử lại.');
    }
  } finally {
    setBusy(btn, false);
    if (retryAfter) lockButtonForRetry(btn, retryAfter, 'Thử lại');
  }
});
