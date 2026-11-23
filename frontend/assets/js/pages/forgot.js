// forgot.js - đặt lại mật khẩu Customer bằng OTP email
import { CONFIG } from '../core/config.js';
import { api, ApiError } from '../core/api.js';
import { RE_OTP, rules } from '../core/validators.js';
import { maskEmail } from '../core/format.js';
import { attachPasswordToggle, lockButtonForRetry, setFieldError, showAlert } from '../core/form.js';
import { qs, qsa, setBusy } from '../core/ui.js';
import { mountOtp } from '../components/otp-input.js';

const emailInput = qs('#forgot-email');
const startForm = qs('#forgot-start-form');
const resetForm = qs('#forgot-reset-form');
const emailStep = qs('#forgot-email-step');
const resetStep = qs('#forgot-reset-step');
const successStep = qs('#forgot-success-step');
const alertBox = qs('#forgot-alert');
const passwordInput = qs('#forgot-password');
const repeatInput = qs('#forgot-password-repeat');
const otpError = qs('#forgot-otp-error');
const resendButton = qs('#forgot-resend');
let expiryTimer;
let resendTimer;
let verifying = false;

const fieldOf = (input) => input.closest('.field');
const passwordError = (value) => {
  if (!value) return 'Vui lòng nhập mật khẩu mới';
  return rules.mat_khau(value) ? 'Mật khẩu cần ít nhất 8 ký tự, có chữ thường và có số.' : '';
};
const repeatError = (value) => {
  if (!value) return 'Vui lòng nhập lại mật khẩu mới';
  return value === passwordInput.value ? '' : 'Mật khẩu nhập lại chưa khớp';
};

attachPasswordToggle(passwordInput);
attachPasswordToggle(repeatInput);

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

function startResendCountdown(seconds = CONFIG.OTP_RESEND_SECONDS) {
  resendTimer?.();
  resendButton.disabled = true;
  resendTimer = countdown(qs('#forgot-resend-wait'), seconds, () => {
    resendButton.disabled = false;
    qs('#forgot-resend-wait').textContent = '';
  });
}

function startOtpTimers(data = {}) {
  expiryTimer?.();
  resendTimer?.();
  const expiration = Date.parse(data.expires_at || '');
  const expiresIn = Number.isFinite(expiration)
    ? Math.max(0, Math.ceil((expiration - Date.now()) / 1000))
    : Number.isFinite(Number(data.expires_in_seconds))
      ? Math.max(0, Number(data.expires_in_seconds))
      : CONFIG.OTP_TTL_SECONDS;
  const resendAfter = Number.isFinite(Number(data.resend_after_seconds))
    ? Math.max(0, Number(data.resend_after_seconds))
    : CONFIG.OTP_RESEND_SECONDS;

  otp.setDisabled(false);
  expiryTimer = countdown(qs('#forgot-otp-ttl'), expiresIn, () => {
    otp.setDisabled(true);
    otpError.textContent = 'Mã đã hết hạn. Hãy gửi lại mã mới.';
  });
  startResendCountdown(resendAfter);
}

function showFieldErrors(errors) {
  if (!errors || typeof errors !== 'object') return false;
  let shown = false;
  const fields = {
    email: emailInput,
    mat_khau: passwordInput,
    nhap_lai_mat_khau: repeatInput,
  };
  Object.entries(errors).forEach(([key, message]) => {
    if (typeof message !== 'string') return;
    if (key === 'otp') {
      otpError.textContent = message;
      otp.setInvalid(true);
      shown = true;
    } else if (fields[key]) {
      setFieldError(fieldOf(fields[key]), message);
      shown = true;
    }
  });
  return shown;
}

function showResetStep(data) {
  emailStep.hidden = true;
  resetStep.hidden = false;
  qs('#forgot-email-masked').textContent = maskEmail(emailInput.value.trim());
  qs('#step-label').textContent = 'Bước 2/2: Xác thực và tạo mật khẩu mới';
  qsa('.steps span').forEach((step, index) => step.classList.toggle('done', index <= 1));
  showAlert(alertBox, '');
  otpError.textContent = '';
  otp.clear();
  startOtpTimers(data || {});
  otp.focus();
}

function showEmailStep() {
  expiryTimer?.();
  resendTimer?.();
  otp.setDisabled(false);
  otp.clear();
  passwordInput.value = '';
  repeatInput.value = '';
  resetStep.hidden = true;
  emailStep.hidden = false;
  qs('#step-label').textContent = 'Bước 1/2: Xác nhận email';
  qsa('.steps span').forEach((step, index) => step.classList.toggle('done', index === 0));
  showAlert(alertBox, '');
  otpError.textContent = '';
}

const otp = mountOtp(qs('#forgot-otp'));

emailInput.addEventListener('blur', () => setFieldError(fieldOf(emailInput), rules.email(emailInput.value)));
passwordInput.addEventListener('blur', () => setFieldError(fieldOf(passwordInput), passwordError(passwordInput.value)));
repeatInput.addEventListener('blur', () => setFieldError(fieldOf(repeatInput), repeatError(repeatInput.value)));
passwordInput.addEventListener('input', () => {
  if (repeatInput.value) setFieldError(fieldOf(repeatInput), repeatError(repeatInput.value));
});

startForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const emailError = rules.email(emailInput.value);
  setFieldError(fieldOf(emailInput), emailError);
  if (emailError) return emailInput.focus();

  const button = qs('#forgot-start-btn');
  let retryAfter = 0;
  setBusy(button, true);
  try {
    const data = await api.post('/auth/forgot-password/start', { email: emailInput.value.trim() });
    showResetStep(data);
  } catch (error) {
    if (error instanceof ApiError) {
      const fieldErrors = showFieldErrors(error.errors);
      if (!fieldErrors) showAlert(alertBox, error.message);
      if (error.status === 429) retryAfter = error.retryAfterSeconds || CONFIG.OTP_RESEND_SECONDS;
    } else {
      showAlert(alertBox, 'Không thể gửi yêu cầu lúc này. Vui lòng thử lại.');
    }
  } finally {
    setBusy(button, false);
    if (retryAfter) lockButtonForRetry(button, retryAfter, 'Thử lại');
  }
});

resetForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (verifying) return;

  const invalid = [];
  const otpValue = otp.value();
  otpError.textContent = '';
  otp.setInvalid(false);
  if (!RE_OTP.test(otpValue)) {
    otpError.textContent = 'Vui lòng nhập đủ 6 chữ số của mã xác thực.';
    otp.setInvalid(true);
    invalid.push(qs('#forgot-otp input'));
  }
  const errors = [
    [passwordInput, passwordError(passwordInput.value)],
    [repeatInput, repeatError(repeatInput.value)],
  ];
  errors.forEach(([input, message]) => {
    setFieldError(fieldOf(input), message);
    if (message) invalid.push(input);
  });
  if (invalid.length) return invalid[0].focus();

  const button = qs('#forgot-reset-btn');
  setBusy(button, true);
  verifying = true;
  try {
    await api.post('/auth/forgot-password/verify', {
      email: emailInput.value.trim(),
      otp: otpValue,
      mat_khau: passwordInput.value,
      nhap_lai_mat_khau: repeatInput.value,
    });
    expiryTimer?.();
    resendTimer?.();
    otp.clear();
    passwordInput.value = '';
    repeatInput.value = '';
    resetStep.hidden = true;
    successStep.hidden = false;
    qs('#step-label').textContent = 'Hoàn tất đặt lại mật khẩu';
    qsa('.steps span').forEach((step) => step.classList.add('done'));
    showAlert(alertBox, '');
  } catch (error) {
    if (!(error instanceof ApiError)) {
      otpError.textContent = 'Không thể xác thực mã lúc này. Vui lòng thử lại.';
      return;
    }
    const fieldErrors = showFieldErrors(error.errors);
    const remaining = Number(error.errors?.remaining_attempts);
    if (error.status === 422) {
      const otpFailure = typeof error.errors?.otp === 'string'
        || Number.isFinite(remaining)
        || !fieldErrors;
      if (otpFailure) {
        otpError.textContent = Number.isFinite(remaining)
          ? `${error.message} (còn ${remaining} lần thử)`
          : error.message;
        otp.setInvalid(true);
        otp.clear();
        if (Number.isFinite(remaining) && remaining <= 0) otp.setDisabled(true);
        if (/hết hạn|hết hiệu lực/i.test(error.message)) otp.setDisabled(true);
      }
    } else if (!fieldErrors) {
      showAlert(alertBox, error.message);
    }
  } finally {
    verifying = false;
    setBusy(button, false);
  }
});

resendButton.addEventListener('click', async () => {
  resendButton.disabled = true;
  otpError.textContent = '';
  try {
    const data = await api.post('/auth/forgot-password/resend', { email: emailInput.value.trim() });
    otp.clear();
    otp.setInvalid(false);
    startOtpTimers(data || {});
    otp.focus();
  } catch (error) {
    if (error instanceof ApiError) {
      otpError.textContent = error.message;
      if (error.status === 429) {
        startResendCountdown(error.retryAfterSeconds || CONFIG.OTP_RESEND_SECONDS);
      } else {
        resendButton.disabled = false;
      }
    } else {
      otpError.textContent = 'Không thể gửi lại mã xác thực. Vui lòng thử lại.';
      resendButton.disabled = false;
    }
  }
});

qs('#forgot-edit-email').addEventListener('click', showEmailStep);
window.addEventListener('pagehide', () => {
  expiryTimer?.();
  resendTimer?.();
}, { once: true });
