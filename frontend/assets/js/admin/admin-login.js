// admin-login.js - đăng nhập quản trị hai bước, OTP bắt buộc mỗi lần
import { api, ApiError } from '../core/api.js';
import { CONFIG } from '../core/config.js';
import { mountOtp } from '../components/otp-input.js';
import { safeRedirect, showAlert } from '../core/form.js';
import { qs, setBusy } from '../core/ui.js';

const form = qs('#admin-login-form');
const stepOtp = qs('#admin-otp-step');
const alertBox = qs('#admin-login-alert');
const otpError = qs('#admin-otp-error');
let wrong = 0;
let otpTimer, resendTimer;
const otp = mountOtp(qs('#admin-otp'), { onComplete: verifyOtp });

function countdown(el, seconds, onEnd) {
  const end = Date.now() + seconds * 1000;
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    el.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    if (!remaining) { clearInterval(timer); onEnd?.(); }
  };
  const timer = setInterval(tick, 500);
  tick();
  return () => clearInterval(timer);
}
function startTimers() {
  otpTimer?.(); resendTimer?.();
  const resend = qs('#admin-otp-resend');
  resend.disabled = true;
  otpTimer = countdown(qs('#admin-otp-ttl'), CONFIG.OTP_TTL_SECONDS, () => {
    otpError.textContent = 'Mã OTP đã hết hạn. Hãy gửi lại mã mới.';
    resend.disabled = false;
  });
  resendTimer = countdown(qs('#admin-resend-wait'), CONFIG.OTP_RESEND_SECONDS, () => {
    resend.disabled = false;
    qs('#admin-resend-wait').textContent = '';
  });
}
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = qs('#admin-login-submit');
  setBusy(button, true);
  try {
    const result = await api.post('/admin/auth/login', {
      so_dien_thoai: qs('#admin-phone').value.trim(),
      mat_khau: qs('#admin-password').value,
    });
    qs('#admin-otp-email').textContent = result.email;
    form.hidden = true;
    stepOtp.hidden = false;
    wrong = 0;
    otpError.textContent = '';
    startTimers();
    otp.focus();
  } catch (error) {
    if (error instanceof ApiError && error.status) showAlert(alertBox, error.message);
  } finally { setBusy(button, false); }
});

async function verifyOtp(code) {
  if (wrong >= 5) return;
  try {
    await api.post('/admin/auth/verify-otp', { otp: code });
    otpTimer?.(); resendTimer?.();
    const redirect = safeRedirect(new URLSearchParams(location.search).get('redirect'), 'index.html');
    location.replace(redirect);
  } catch (error) {
    if (!(error instanceof ApiError) || !error.status) return;
    wrong++;
    otp.setInvalid(true);
    otpError.textContent = wrong >= 5 ? 'Bạn đã nhập sai tối đa 5 lần. Hãy đăng nhập lại.' : `${error.message} (${wrong}/5 lần)`;
    otp.clear();
    if (wrong >= 5) {
      qs('#admin-otp-verify').disabled = true;
      qs('#admin-otp-resend').disabled = true;
      qs('#admin-otp').querySelectorAll('input').forEach((input) => { input.disabled = true; });
    }
  }
}

qs('#admin-otp-verify').addEventListener('click', () => {
  if (otp.value().length === 6) verifyOtp(otp.value());
  else otpError.textContent = 'Vui lòng nhập đủ 6 chữ số';
});
qs('#admin-otp-resend').addEventListener('click', async () => {
  try {
    await api.post('/admin/auth/otp/resend');
    otpError.textContent = ''; otp.clear(); startTimers();
  } catch (error) {
    if (error instanceof ApiError && error.status) otpError.textContent = error.message;
  }
});
