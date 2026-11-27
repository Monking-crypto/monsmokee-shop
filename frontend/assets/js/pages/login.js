// login.js - trang đăng nhập
import { CONFIG } from '../core/config.js';
import { api, ApiError } from '../core/api.js';
import { rules } from '../core/validators.js';
import { setFieldError, attachPasswordToggle, safeRedirect, showAlert, lockButtonForRetry } from '../core/form.js';
import { setBusy, toast, qs } from '../core/ui.js';
import { mountOtp } from '../components/otp-input.js';

const form = qs('#login-form'), alertBox = qs('#login-alert');
const phone = qs('#phone'), pass = qs('#password');
const otpStep = qs('#login-otp-step');
const requestedRedirect = safeRedirect(new URLSearchParams(location.search).get('redirect'));
const redirectPath = requestedRedirect.split('?')[0];
const redirect = requestedRedirect.startsWith('/')
  || redirectPath.split('/').some((part) => part === '.' || part === '..')
  ? 'index.html'
  : requestedRedirect;
const adminRedirect = redirect === 'admin' || redirect.startsWith('admin/');
let otpExpiryTimer, resendTimer, otpRetryTimer, verifying = false;
attachPasswordToggle(pass);

if (new URLSearchParams(location.search).get('auth_required') === '1') {
  showAlert(alertBox, adminRedirect
    ? 'Vui lòng đăng nhập để truy cập khu vực quản trị.'
    : 'Vui lòng đăng nhập để tiếp tục.');
} else if (redirect !== 'index.html') {
  showAlert(alertBox, 'Vui lòng đăng nhập để tiếp tục.');
}

function isAdmin(user) {
  return String(user?.vai_tro || '').toLowerCase() === 'admin';
}

function isCustomer(user) {
  return String(user?.vai_tro || '').toLowerCase() === 'customer';
}

function goToCustomerPage() {
  location.replace(adminRedirect ? 'index.html?access_denied=1' : redirect);
}

function goToAdminPage() {
  location.replace(adminRedirect ? redirect : 'admin/index.html');
}

async function redirectIfAuthenticated() {
  try {
    const { user } = await api.get('/auth/me');
    if (!user) return;
    if (isCustomer(user)) {
      goToCustomerPage();
      return;
    }
    if (!isAdmin(user)) {
      showAlert(alertBox, 'Máy chủ trả về vai trò tài khoản không hợp lệ.');
      return;
    }

    await api.get('/admin/me');
    goToAdminPage();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return;
    showAlert(alertBox, error instanceof ApiError
      ? error.message
      : 'Không thể kiểm tra phiên đăng nhập. Vui lòng thử lại.');
  }
}

function countdown(element, seconds, onEnd) {
  const end = Date.now() + seconds * 1000;
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    element.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    if (!remaining) {
      clearInterval(timer);
      onEnd?.();
    }
  };
  const timer = setInterval(tick, 500);
  tick();
  return () => clearInterval(timer);
}

const otp = mountOtp(qs('#login-otp'), { onComplete: verifyAdminOtp });

function stopTimers() {
  otpExpiryTimer?.();
  resendTimer?.();
  clearTimeout(otpRetryTimer);
  otpExpiryTimer = null;
  resendTimer = null;
  otpRetryTimer = null;
}

function startTimers(data = {}) {
  stopTimers();
  const resendButton = qs('#login-otp-resend');
  resendButton.disabled = true;
  otp.setDisabled(false);

  const ttl = Number(data.expires_in_seconds);
  const expiresIn = Number.isFinite(ttl) ? Math.max(0, ttl) : CONFIG.OTP_TTL_SECONDS;
  const cooldown = Number(data.resend_after_seconds);
  const resendAfter = Number.isFinite(cooldown) ? Math.max(0, cooldown) : CONFIG.OTP_RESEND_SECONDS;
  otpExpiryTimer = countdown(qs('#login-otp-ttl'), expiresIn, () => {
    otp.setDisabled(true);
    qs('#login-otp-error').textContent = 'Mã OTP đã hết hạn. Hãy gửi lại mã mới.';
  });
  resendTimer = countdown(qs('#login-resend-wait'), resendAfter, () => {
    resendButton.disabled = false;
    qs('#login-resend-wait').textContent = '';
  });
}

function showOtpStep(data) {
  form.hidden = true;
  otpStep.hidden = false;
  pass.value = '';
  const emails = Array.isArray(data.emails_masked) ? data.emails_masked.filter(Boolean) : [];
  qs('#login-otp-email').textContent = emails.join(', ') || data.email_masked || '';
  qs('#login-otp-error').textContent = '';
  otp.setInvalid(false);
  otp.clear();
  startTimers(data);
  otp.focus();
}

function showLoginStep(message = '') {
  stopTimers();
  otp.clear();
  otpStep.hidden = true;
  form.hidden = false;
  pass.value = '';
  otp.setDisabled(false);
  phone.focus();
  qs('#login-otp-error').textContent = '';
  qs('#login-otp-resend').disabled = true;
  showAlert(alertBox, message);
}

function attemptsExhausted(error) {
  const remaining = Number(error.errors?.remaining_attempts);
  return (Number.isFinite(remaining) && remaining <= 0)
    || /tối đa\s*5 lần|đăng nhập lại/i.test(error.message);
}

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
    const data = await api.post('/auth/login', {
      so_dien_thoai: phone.value.trim(),
      mat_khau: pass.value,
    });
    if (data?.otp_required === true || data?.requires_otp === true) {
      showAlert(alertBox, '');
      showOtpStep(data);
      return;
    }
    if (!data?.user || !isCustomer(data.user)) {
      showAlert(alertBox, 'Máy chủ chưa xác nhận đúng trạng thái đăng nhập. Vui lòng thử lại.');
      return;
    }
    toast('Đăng nhập thành công');
    goToCustomerPage();
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
      if (error.status === 401) {
        showAlert(alertBox, 'Số điện thoại hoặc mật khẩu không đúng');
      } else if (!shownFieldError || error.status !== 422) {
        showAlert(alertBox, error.message);
      }
      if (error.status === 429) retryAfter = error.retryAfterSeconds || 60;
    } else {
      showAlert(alertBox, 'Không thể đăng nhập lúc này. Vui lòng thử lại.');
    }
  } finally {
    setBusy(btn, false);
    if (retryAfter) lockButtonForRetry(btn, retryAfter, 'Thử lại');
  }
});

async function verifyAdminOtp(code) {
  if (verifying || code.length !== 6) return;
  verifying = true;
  otp.setDisabled(true);
  const errorElement = qs('#login-otp-error');
  errorElement.textContent = '';
  try {
    await api.post('/admin/auth/verify-otp', { otp: code });
    const data = await api.get('/admin/me');
    if (!isAdmin(data?.user)) {
      throw new Error('Phiên đã xác thực nhưng máy chủ chưa xác nhận quyền Admin.');
    }
    stopTimers();
    toast('Đăng nhập quản trị thành công');
    goToAdminPage();
  } catch (error) {
    if (!(error instanceof ApiError)) {
      errorElement.textContent = error.message || 'Không thể xác thực mã OTP. Vui lòng thử lại.';
      otp.setDisabled(false);
      return;
    }
    const remaining = Number(error.errors?.remaining_attempts);
    const expired = /hết hạn|hết hiệu lực/i.test(error.message);
    otp.setInvalid(error.status === 422);
    if (error.status === 401 || (error.status === 422 && expired) || attemptsExhausted(error)) {
      showLoginStep(error.message);
    } else {
      errorElement.textContent = error.status === 422 && Number.isFinite(remaining)
        ? `${error.message} (còn ${remaining} lần thử)`
        : error.message;
      otp.setDisabled(error.status === 429);
      otp.clear();
      if (error.status === 429) {
        const wait = error.retryAfterSeconds || 60;
        errorElement.textContent = `${error.message} Vui lòng chờ ${wait} giây rồi thử lại.`;
        otpRetryTimer = setTimeout(() => {
          if (!otpStep.hidden) otp.setDisabled(false);
        }, wait * 1000);
      }
    }
  } finally {
    verifying = false;
  }
}

qs('#login-otp-verify').addEventListener('click', () => {
  if (otp.value().length === 6) verifyAdminOtp(otp.value());
  else qs('#login-otp-error').textContent = 'Vui lòng nhập đủ 6 chữ số.';
});

qs('#login-otp-resend').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const data = await api.post('/admin/auth/otp/resend');
    const emails = Array.isArray(data.emails_masked) ? data.emails_masked.filter(Boolean) : [];
    qs('#login-otp-email').textContent = emails.join(', ') || data.email_masked || '';
    qs('#login-otp-error').textContent = '';
    otp.clear();
    startTimers(data);
  } catch (error) {
    if (error instanceof ApiError) {
      qs('#login-otp-error').textContent = error.message;
      if (error.status === 401 || attemptsExhausted(error)) {
        showLoginStep(error.message);
      } else if (error.status === 429) {
        lockButtonForRetry(button, error.retryAfterSeconds || CONFIG.OTP_RESEND_SECONDS, 'Gửi lại');
      } else {
        button.disabled = false;
      }
    } else {
      qs('#login-otp-error').textContent = 'Không thể gửi lại mã OTP. Vui lòng thử lại.';
      button.disabled = false;
    }
  }
});

qs('#login-otp-back').addEventListener('click', () => showLoginStep(''));
void redirectIfAuthenticated();

window.addEventListener('pagehide', stopTimers, { once: true });
