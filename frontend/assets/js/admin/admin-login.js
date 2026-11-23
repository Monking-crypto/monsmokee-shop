// admin-login.js - đăng nhập quản trị hai bước, OTP bắt buộc mỗi lần
import { api, ApiError } from '../core/api.js';
import { CONFIG } from '../core/config.js';
import { mountOtp } from '../components/otp-input.js';
import { safeRedirect, showAlert, lockButtonForRetry } from '../core/form.js';
import { qs, setBusy } from '../core/ui.js';

const form = qs('#admin-login-form');
const stepOtp = qs('#admin-otp-step');
const alertBox = qs('#admin-login-alert');
const otpError = qs('#admin-otp-error');
let otpTimer, resendTimer, verifying = false;
const otp = mountOtp(qs('#admin-otp'), { onComplete: verifyOtp });

['admin-phone', 'admin-password'].forEach((id) => {
  const input = qs(`#${id}`);
  input.addEventListener('input', () => {
    qs(`#${id}-error`).textContent = '';
    input.removeAttribute('aria-invalid');
  });
});

if (new URLSearchParams(location.search).get('auth_required') === '1') {
  showAlert(alertBox, 'Vui lòng đăng nhập bằng tài khoản quản trị để tiếp tục.');
}

function countdown(element, seconds, onEnd) {
  const end = Date.now() + seconds * 1000;
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    element.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    if (!remaining) { clearInterval(timer); onEnd?.(); }
  };
  const timer = setInterval(tick, 500);
  tick();
  return () => clearInterval(timer);
}

function showLoginForm(message) {
  otpTimer?.();
  resendTimer?.();
  form.hidden = false;
  stepOtp.hidden = true;
  qs('#admin-password').value = '';
  otp.setDisabled(false);
  otp.clear();
  showAlert(alertBox, message);
}

function startTimers(data = {}) {
  otpTimer?.();
  resendTimer?.();
  const resend = qs('#admin-otp-resend');
  resend.disabled = true;
  otp.setDisabled(false);

  const serverExpiresIn = Number(data.expires_in_seconds);
  const expiresIn = Number.isFinite(serverExpiresIn)
    ? Math.max(0, serverExpiresIn)
    : CONFIG.OTP_TTL_SECONDS;
  const resendValue = Number(data.resend_after_seconds);
  const resendAfter = Number.isFinite(resendValue) ? Math.max(0, resendValue) : CONFIG.OTP_RESEND_SECONDS;
  otpTimer = countdown(qs('#admin-otp-ttl'), expiresIn, () => {
    showLoginForm('Mã OTP đã hết hạn. Vui lòng đăng nhập lại để nhận mã mới.');
  });
  resendTimer = countdown(qs('#admin-resend-wait'), resendAfter, () => {
    resend.disabled = false;
    qs('#admin-resend-wait').textContent = '';
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = qs('#admin-login-submit');
  let retryAfter = 0;
  setBusy(button, true);
  try {
    const result = await api.post('/admin/auth/login', {
      so_dien_thoai: qs('#admin-phone').value.trim(),
      mat_khau: qs('#admin-password').value,
    });
    if (!result.requires_otp) {
      showAlert(alertBox, 'Máy chủ chưa xác nhận bước OTP. Vui lòng thử lại.');
      return;
    }
    qs('#admin-otp-email').textContent = result.email_masked;
    form.hidden = true;
    stepOtp.hidden = false;
    qs('#admin-password').value = '';
    otpError.textContent = '';
    showAlert(alertBox, '');
    otp.clear();
    startTimers(result);
    otp.focus();
  } catch (error) {
    if (error instanceof ApiError) {
      let shownFieldError = false;
      Object.entries(error.errors || {}).forEach(([key, message]) => {
        const input = key === 'so_dien_thoai' ? qs('#admin-phone')
          : key === 'mat_khau' ? qs('#admin-password') : null;
        const errorElement = input ? qs(`#${input.id}-error`) : null;
        if (errorElement && typeof message === 'string') {
          errorElement.textContent = message;
          input.setAttribute('aria-invalid', 'true');
          shownFieldError = true;
        }
      });
      if (!shownFieldError || error.status !== 422) showAlert(alertBox, error.message);
      if (error.status === 429) retryAfter = error.retryAfterSeconds || 60;
    } else {
      showAlert(alertBox, 'Không thể đăng nhập quản trị lúc này. Vui lòng thử lại.');
    }
  } finally {
    setBusy(button, false);
    if (retryAfter) lockButtonForRetry(button, retryAfter, 'Thử lại');
  }
});

async function verifyOtp(code) {
  if (verifying || otp.value().length !== 6) return;
  verifying = true;
  try {
    await api.post('/admin/auth/verify-otp', { otp: code });
    otpTimer?.();
    resendTimer?.();
    const redirect = safeRedirect(new URLSearchParams(location.search).get('redirect'), 'index.html');
    location.replace(redirect);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      otpError.textContent = 'Không thể xác thực mã lúc này. Vui lòng thử lại.';
      return;
    }
    otp.setInvalid(error.status === 422);
    const remaining = Number(error.errors?.remaining_attempts);
    if (error.status === 401 || (error.status === 422 && Number.isFinite(remaining) && remaining <= 0)
      || (error.status === 422 && /hết hạn|hết hiệu lực/i.test(error.message))) {
      showLoginForm(error.message);
    } else {
      otpError.textContent = error.status === 422 && Number.isFinite(remaining)
        ? `${error.message} (còn ${remaining} lần thử)`
        : error.message;
      otp.clear();
    }
  } finally {
    verifying = false;
  }
}

qs('#admin-otp-verify').addEventListener('click', () => {
  if (otp.value().length === 6) verifyOtp(otp.value());
  else otpError.textContent = 'Vui lòng nhập đủ 6 chữ số';
});

qs('#admin-otp-resend').addEventListener('click', async () => {
  const button = qs('#admin-otp-resend');
  let retryAfter = 0;
  button.disabled = true;
  try {
    const result = await api.post('/admin/auth/otp/resend');
    qs('#admin-otp-email').textContent = result.email_masked;
    otpError.textContent = '';
    otp.clear();
    startTimers(result);
  } catch (error) {
    if (error instanceof ApiError) {
      otpError.textContent = error.message;
      if (error.status === 401) showLoginForm(error.message);
      if (error.status === 429) retryAfter = error.retryAfterSeconds || CONFIG.OTP_RESEND_SECONDS;
    } else {
      otpError.textContent = 'Không thể gửi lại mã OTP. Vui lòng thử lại.';
    }
    button.disabled = false;
  } finally {
    if (retryAfter) lockButtonForRetry(button, retryAfter, 'Gửi lại');
  }
});
