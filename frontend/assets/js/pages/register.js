// register.js - đăng ký 2 bước: thông tin → OTP email
import { CONFIG } from '../core/config.js';
import { api, ApiError } from '../core/api.js';
import { getStoreInfo } from '../core/store-info.js';
import { rules } from '../core/validators.js';
import { maskEmail } from '../core/format.js';
import { setFieldError, attachPasswordToggle, safeRedirect, showAlert, lockButtonForRetry } from '../core/form.js';
import { setBusy, toast, qs, qsa } from '../core/ui.js';
import { mountPasswordMeter } from '../components/password-meter.js';
import { mountOtp } from '../components/otp-input.js';

const storeInfo = qs('#register-store-info');
if (storeInfo) {
  const { name, hours, address } = await getStoreInfo();
  storeInfo.textContent = `${name}${address ? ` · ${address}` : ''} · Giờ mở cửa ${hours}`;
}
const form = qs('#reg-form'), stepInfo = qs('#step-info'), stepOtp = qs('#step-otp'), alertBox = qs('#reg-alert');
const f = Object.fromEntries(['ho_ten', 'so_dien_thoai', 'email', 'mat_khau', 'nhap_lai_mat_khau'].map((k) => [k, qs(`[name=${k}]`)]));
const fieldOf = (input) => input.closest('.field');
attachPasswordToggle(f.mat_khau);
attachPasswordToggle(f.nhap_lai_mat_khau);
mountPasswordMeter(f.mat_khau, qs('#pwm'));

const validators = {
  ...rules,
  nhap_lai_mat_khau: (v) => (!v ? 'Vui lòng nhập lại mật khẩu' : v === f.mat_khau.value ? '' : 'Mật khẩu nhập lại chưa khớp'),
};
const touched = new Set();
Object.entries(f).forEach(([key, input]) => {
  input.addEventListener('blur', () => { touched.add(key); setFieldError(fieldOf(input), validators[key](input.value)); });
  input.addEventListener('input', () => {
    if (touched.has(key)) setFieldError(fieldOf(input), validators[key](input.value));
    if (key === 'mat_khau' && touched.has('nhap_lai_mat_khau')) {
      setFieldError(fieldOf(f.nhap_lai_mat_khau), validators.nhap_lai_mat_khau(f.nhap_lai_mat_khau.value));
    }
  });
});

function showRegistrationErrors(errors) {
  if (!errors || typeof errors !== 'object') return false;
  let shown = false;
  Object.entries(errors).forEach(([key, message]) => {
    if (f[key] && typeof message === 'string') {
      setFieldError(fieldOf(f[key]), message);
      shown = true;
    }
  });
  if (errors.tai_khoan) {
    const message = 'Số điện thoại hoặc email đã được đăng ký';
    setFieldError(fieldOf(f.so_dien_thoai), message);
    setFieldError(fieldOf(f.email), message);
    shown = true;
  }
  return shown;
}

// ---- Bước 1 ----
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  let first = null;
  Object.entries(f).forEach(([key, input]) => {
    const message = validators[key](input.value);
    setFieldError(fieldOf(input), message);
    if (message && !first) first = input;
  });
  const terms = qs('#terms');
  qs('#terms-err').textContent = terms.checked ? '' : 'Vui lòng đồng ý với điều khoản để tiếp tục';
  if (first || !terms.checked) return (first || terms).focus();

  const button = qs('#reg-btn');
  let retryAfter = 0;
  setBusy(button, true);
  try {
    const data = await api.post('/auth/register/start', {
      ho_ten: f.ho_ten.value.trim(),
      so_dien_thoai: f.so_dien_thoai.value.trim(),
      email: f.email.value.trim(),
      mat_khau: f.mat_khau.value,
      nhap_lai_mat_khau: f.nhap_lai_mat_khau.value,
    });
    showAlert(alertBox, '');
    goOtp(data);
  } catch (error) {
    if (error instanceof ApiError) {
      const fieldErrors = showRegistrationErrors(error.errors);
      if (error.status === 409 && !fieldErrors) setFieldError(fieldOf(f.email), error.message);
      if (!fieldErrors || error.status === 409) showAlert(alertBox, error.message);
      if (error.status === 429) retryAfter = error.retryAfterSeconds || CONFIG.OTP_RESEND_SECONDS;
    } else {
      showAlert(alertBox, 'Không thể đăng ký lúc này. Vui lòng thử lại.');
    }
  } finally {
    setBusy(button, false);
    if (retryAfter) lockButtonForRetry(button, retryAfter, 'Thử lại');
  }
});

// ---- Bước 2 ----
let otpTimer, resendTimer, verifying = false;
const otp = mountOtp(qs('#otp'), { onComplete: verify });
const otpErr = qs('#otp-err');

function countdown(element, seconds, onEnd) {
  const end = Date.now() + seconds * 1000;
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    element.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    if (!remaining) { clearInterval(id); onEnd?.(); }
  };
  const id = setInterval(tick, 500);
  tick();
  return () => clearInterval(id);
}

function startTimers(data = {}) {
  otpTimer?.();
  resendTimer?.();
  const resend = qs('#resend');
  resend.disabled = true;
  otp.setDisabled(false);

  const expiresAt = Date.parse(data.expires_at || '');
  const serverExpiresIn = Number(data.expires_in_seconds);
  const expiresIn = Number.isFinite(expiresAt)
    ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
    : Number.isFinite(serverExpiresIn) ? Math.max(0, serverExpiresIn) : CONFIG.OTP_TTL_SECONDS;
  const resendValue = Number(data.resend_after_seconds);
  const resendAfter = Number.isFinite(resendValue) ? Math.max(0, resendValue) : CONFIG.OTP_RESEND_SECONDS;

  otpTimer = countdown(qs('#otp-ttl'), expiresIn, () => {
    otp.setDisabled(true);
    otpErr.textContent = 'Mã đã hết hạn. Hãy gửi lại mã mới.';
  });
  resendTimer = countdown(qs('#resend-wait'), resendAfter, () => {
    resend.disabled = false;
    qs('#resend-wait').textContent = '';
  });
}

function goOtp(data) {
  stepInfo.hidden = true;
  stepOtp.hidden = false;
  qs('#otp-email').textContent = data.email_masked || maskEmail(f.email.value);
  qsa('.steps span').forEach((step, index) => step.classList.toggle('done', index <= 1));
  qs('#step-label').textContent = 'Bước 2/2: Xác thực email';
  otpErr.textContent = '';
  otp.clear();
  startTimers(data);
}

function returnToRegistration(message) {
  otpTimer?.();
  resendTimer?.();
  stepOtp.hidden = true;
  stepInfo.hidden = false;
  qsa('.steps span').forEach((step, index) => step.classList.toggle('done', index === 0));
  qs('#step-label').textContent = 'Bước 1/2: Thông tin tài khoản';
  showAlert(alertBox, message);
}

async function verify(code) {
  if (verifying || otp.value().length !== 6) return;
  verifying = true;
  try {
    await api.post('/auth/register/verify', { email: f.email.value.trim(), otp: code });
    otpTimer?.();
    resendTimer?.();
    toast('Đăng ký thành công');
    setTimeout(() => location.assign(safeRedirect(new URLSearchParams(location.search).get('redirect'))), 700);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      otpErr.textContent = 'Không thể xác thực mã lúc này. Vui lòng thử lại.';
      return;
    }
    otp.setInvalid(error.status === 422);
    const remaining = Number(error.errors?.remaining_attempts);
    if (error.status === 409 || (error.status === 422 && (
      (Number.isFinite(remaining) && remaining <= 0)
      || /hết hiệu lực|nhập sai quá số lần/i.test(error.message)
    ))) {
      returnToRegistration(error.message);
    } else if (error.status === 422 && /hết hạn/i.test(error.message)) {
      otp.setDisabled(true);
      otpErr.textContent = error.message;
    } else {
      otpErr.textContent = error.status === 422 && Number.isFinite(remaining)
        ? `${error.message} (còn ${remaining} lần thử)`
        : error.status === 429
          ? `${error.message} Vui lòng chờ ${error.retryAfterSeconds || CONFIG.OTP_RESEND_SECONDS} giây rồi thử lại.`
          : error.message;
      otp.clear();
    }
  } finally {
    verifying = false;
  }
}

qs('#resend').addEventListener('click', async () => {
  const button = qs('#resend');
  let retryAfter = 0;
  button.disabled = true;
  try {
    const data = await api.post('/auth/otp/resend', { email: f.email.value.trim() });
    otpErr.textContent = '';
    otp.clear();
    startTimers(data);
    toast('Đã gửi lại mã OTP');
  } catch (error) {
    button.disabled = false;
    if (error instanceof ApiError) {
      otpErr.textContent = error.message;
      if (error.status === 429) retryAfter = error.retryAfterSeconds || CONFIG.OTP_RESEND_SECONDS;
    } else {
      otpErr.textContent = 'Không thể gửi lại mã OTP. Vui lòng thử lại.';
    }
  } finally {
    if (retryAfter) lockButtonForRetry(button, retryAfter, 'Gửi lại mã');
  }
});

qs('#edit-info').addEventListener('click', () => {
  otpTimer?.();
  resendTimer?.();
  stepOtp.hidden = true;
  stepInfo.hidden = false;
  qsa('.steps span').forEach((step, index) => step.classList.toggle('done', index === 0));
  qs('#step-label').textContent = 'Bước 1/2: Thông tin tài khoản';
  showAlert(alertBox, '');
});
qs('#verify-btn').addEventListener('click', () => (
  otp.value().length === 6 ? verify(otp.value()) : (otpErr.textContent = 'Vui lòng nhập đủ 6 chữ số')
));
