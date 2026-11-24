// forgot.js - đặt lại mật khẩu Customer bằng OTP và reset ticket
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
const otpStep = qs('#forgot-otp-step');
const passwordFields = qs('#forgot-password-fields');
const editActions = qs('#forgot-edit-actions');
const successStep = qs('#forgot-success-step');
const alertBox = qs('#forgot-alert');
const passwordInput = qs('#forgot-password');
const repeatInput = qs('#forgot-password-repeat');
const otpError = qs('#forgot-otp-error');
const otpStatus = qs('#forgot-otp-status');
const resendButton = qs('#forgot-resend');
const resetButton = qs('#forgot-reset-btn');
let otpExpiryTimer;
let resendTimer;
let ticketExpiryTimer;
let verifyCooldownTimer;
let resetTicket = null;
let otpExpired = false;
let verifyingOtp = false;
let resetting = false;

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

function setOtpStatus(message, state = '') {
  otpStatus.textContent = message;
  otpStatus.className = `otp-status${state ? ` otp-status--${state}` : ''}`;
}

function setResetFieldsEnabled(enabled) {
  passwordFields.hidden = !enabled;
  passwordInput.disabled = !enabled;
  repeatInput.disabled = !enabled;
  resetButton.disabled = !enabled;
  passwordFields.querySelectorAll('.field__toggle').forEach((button) => {
    button.disabled = !enabled;
  });
  if (!enabled) {
    [passwordInput, repeatInput].forEach((input) => {
      input.value = '';
      input.closest('.field').classList.remove('is-invalid', 'is-valid');
      input.setAttribute('aria-invalid', 'false');
      input.closest('.field').querySelector('.field__error').textContent = '';
    });
  }
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
  otpExpiryTimer?.();
  const expiration = Date.parse(data.expires_at || '');
  const expiresIn = Number.isFinite(expiration)
    ? Math.max(0, Math.ceil((expiration - Date.now()) / 1000))
    : Number.isFinite(Number(data.expires_in_seconds))
      ? Math.max(0, Number(data.expires_in_seconds))
      : CONFIG.OTP_TTL_SECONDS;
  const resendAfter = Number.isFinite(Number(data.resend_after_seconds))
    ? Math.max(0, Number(data.resend_after_seconds))
    : CONFIG.OTP_RESEND_SECONDS;

  otpExpired = expiresIn <= 0;
  otp.setDisabled(otpExpired);
  otpExpiryTimer = countdown(qs('#forgot-otp-ttl'), expiresIn, () => {
    otpExpired = true;
    otp.setDisabled(true);
    setOtpStatus('Mã OTP đã hết hạn. Hãy gửi lại mã mới.', 'error');
  });
  startResendCountdown(resendAfter);
}

function startTicketTimer(seconds) {
  ticketExpiryTimer?.();
  ticketExpiryTimer = countdown(qs('#reset-ticket-ttl'), seconds, () => {
    resetTicket = null;
    otpExpired = true;
    setResetFieldsEnabled(false);
    otpStep.hidden = false;
    editActions.hidden = false;
    otp.setDisabled(true);
    resendButton.disabled = false;
    qs('#forgot-otp-ttl').textContent = 'Hết hạn';
    otpError.textContent = '';
    setOtpStatus('Phiên xác thực đã hết hạn. Hãy gửi mã mới để tiếp tục.', 'error');
  });
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
  otpStep.hidden = false;
  editActions.hidden = false;
  qs('#forgot-email-masked').textContent = maskEmail(emailInput.value.trim());
  qs('#step-label').textContent = 'Bước 2/2: Xác thực email';
  qsa('.steps span').forEach((step, index) => step.classList.toggle('done', index <= 1));
  showAlert(alertBox, '');
  setResetFieldsEnabled(false);
  setOtpStatus('Nhập mã 6 số để xác thực và tiếp tục.', '');
  otpError.textContent = '';
  otp.setInvalid(false);
  otp.clear();
  startOtpTimers(data || {});
  otp.focus();
}

function showEmailStep() {
  otpExpiryTimer?.();
  resendTimer?.();
  ticketExpiryTimer?.();
  verifyCooldownTimer?.();
  resetTicket = null;
  otpExpired = false;
  otp.setDisabled(false);
  otp.clear();
  setResetFieldsEnabled(false);
  resetStep.hidden = true;
  emailStep.hidden = false;
  qs('#step-label').textContent = 'Bước 1/2: Xác nhận email';
  qsa('.steps span').forEach((step, index) => step.classList.toggle('done', index === 0));
  showAlert(alertBox, '');
  otpError.textContent = '';
}

const otp = mountOtp(qs('#forgot-otp'), { onComplete: verifyOtp });
setResetFieldsEnabled(false);

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

async function verifyOtp(code) {
  if (verifyingOtp || otpExpired || !RE_OTP.test(code)) return;
  verifyingOtp = true;
  otp.setDisabled(true);
  otpError.textContent = '';
  setOtpStatus('Đang xác thực mã OTP…');
  try {
    const data = await api.post('/auth/forgot-password/verify-otp', {
      email: emailInput.value.trim(),
      otp: code,
    });
    if (typeof data?.reset_ticket !== 'string' || !data.reset_ticket) {
      throw new Error('Phản hồi xác thực OTP không hợp lệ.');
    }
    resetTicket = data.reset_ticket;
    const ticketTtl = Number(data.expires_in_seconds);
    const expiresIn = Number.isFinite(ticketTtl) && ticketTtl > 0 ? ticketTtl : 600;
    otpExpiryTimer?.();
    resendTimer?.();
    otp.clear();
    otpStep.hidden = true;
    editActions.hidden = true;
    qs('#step-label').textContent = 'Bước 2/2: Tạo mật khẩu mới';
    setResetFieldsEnabled(true);
    startTicketTimer(expiresIn);
    passwordInput.focus();
  } catch (error) {
    const remaining = Number(error.errors?.remaining_attempts);
    otp.clear();
    otp.setInvalid(true);
    if (error instanceof ApiError && error.status === 422) {
      const expired = /hết hạn|đã hết hiệu lực/i.test(error.message);
      if (expired || (Number.isFinite(remaining) && remaining <= 0)) {
        otpExpired = true;
        otp.setDisabled(true);
        setOtpStatus(
          expired ? 'Mã OTP đã hết hạn hoặc hết hiệu lực. Hãy gửi mã mới.' : 'Bạn đã hết lượt nhập mã. Hãy gửi lại mã mới.',
          'error',
        );
      } else {
        otp.setDisabled(false);
        setOtpStatus(
          Number.isFinite(remaining)
            ? `Mã OTP không chính xác (còn ${remaining} lần thử).`
            : 'Mã OTP không chính xác hoặc đã hết hạn.',
          'error',
        );
      }
    } else if (error instanceof ApiError && error.status === 429) {
      const retryAfter = error.retryAfterSeconds || 60;
      otp.setDisabled(true);
      setOtpStatus(`Đã thử quá nhiều lần. Vui lòng chờ ${retryAfter} giây rồi thử lại.`, 'error');
      clearInterval(verifyCooldownTimer);
      let remainingSeconds = retryAfter;
      verifyCooldownTimer = setInterval(() => {
        if (otpExpired || otpStep.hidden) {
          clearInterval(verifyCooldownTimer);
          return;
        }
        remainingSeconds -= 1;
        if (remainingSeconds <= 0) {
          clearInterval(verifyCooldownTimer);
          otp.setDisabled(false);
          setOtpStatus('Bạn có thể nhập lại mã OTP.');
        } else {
          setOtpStatus(`Đã thử quá nhiều lần. Vui lòng chờ ${remainingSeconds} giây rồi thử lại.`, 'error');
        }
      }, 1000);
    } else {
      otp.setDisabled(false);
      setOtpStatus(error instanceof ApiError ? error.message : 'Không thể xác thực mã. Vui lòng thử lại.', 'error');
    }
  } finally {
    verifyingOtp = false;
  }
}

resetForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (resetting || !resetTicket) return;

  const errors = [
    [passwordInput, passwordError(passwordInput.value)],
    [repeatInput, repeatError(repeatInput.value)],
  ];
  const invalid = [];
  errors.forEach(([input, message]) => {
    setFieldError(fieldOf(input), message);
    if (message) invalid.push(input);
  });
  if (invalid.length) return invalid[0].focus();

  let retryAfter = 0;
  resetting = true;
  setBusy(resetButton, true);
  try {
    await api.post('/auth/forgot-password/reset', {
      email: emailInput.value.trim(),
      reset_ticket: resetTicket,
      mat_khau: passwordInput.value,
      nhap_lai_mat_khau: repeatInput.value,
    });
    resetTicket = null;
    ticketExpiryTimer?.();
    passwordInput.value = '';
    repeatInput.value = '';
    resetStep.hidden = true;
    successStep.hidden = false;
    qs('#step-label').textContent = 'Hoàn tất đặt lại mật khẩu';
    qsa('.steps span').forEach((step) => step.classList.add('done'));
    showAlert(alertBox, '');
  } catch (error) {
    if (!(error instanceof ApiError)) {
      showAlert(alertBox, 'Không thể đặt lại mật khẩu lúc này. Vui lòng thử lại.');
    } else {
      const fieldErrors = showFieldErrors(error.errors);
      const passwordErrors = typeof error.errors?.mat_khau === 'string'
        || typeof error.errors?.nhap_lai_mat_khau === 'string';
      if (error.status === 422 && !passwordErrors) {
        resetTicket = null;
        ticketExpiryTimer?.();
        setResetFieldsEnabled(false);
        otpStep.hidden = false;
        editActions.hidden = false;
        otpExpired = true;
        otp.setDisabled(true);
        resendButton.disabled = false;
        setOtpStatus('Phiên xác thực không hợp lệ hoặc đã hết hạn. Hãy gửi mã mới.', 'error');
      } else if (!fieldErrors) {
        showAlert(alertBox, error.message);
      }
      if (error.status === 429) retryAfter = error.retryAfterSeconds || 60;
    }
  } finally {
    resetting = false;
    setBusy(resetButton, false);
    resetButton.disabled = !resetTicket;
    if (retryAfter && resetTicket) lockButtonForRetry(resetButton, retryAfter, 'Đặt lại mật khẩu');
  }
});

resendButton.addEventListener('click', async () => {
  resendButton.disabled = true;
  otpError.textContent = '';
  try {
    const data = await api.post('/auth/forgot-password/resend', { email: emailInput.value.trim() });
    resetTicket = null;
    ticketExpiryTimer?.();
    setResetFieldsEnabled(false);
    otpStep.hidden = false;
    editActions.hidden = false;
    otpExpired = false;
    otp.clear();
    otp.setInvalid(false);
    setOtpStatus('Đã gửi mã mới. Nhập mã 6 số để xác thực.');
    startOtpTimers(data || {});
    otp.focus();
  } catch (error) {
    if (error instanceof ApiError) {
      setOtpStatus(error.message, 'error');
      if (error.status === 429) {
        startResendCountdown(error.retryAfterSeconds || CONFIG.OTP_RESEND_SECONDS);
      } else {
        resendButton.disabled = false;
      }
    } else {
      setOtpStatus('Không thể gửi lại mã xác thực. Vui lòng thử lại.', 'error');
      resendButton.disabled = false;
    }
  }
});

qs('#forgot-edit-email').addEventListener('click', showEmailStep);
window.addEventListener('pagehide', () => {
  otpExpiryTimer?.();
  resendTimer?.();
  ticketExpiryTimer?.();
  clearInterval(verifyCooldownTimer);
}, { once: true });
