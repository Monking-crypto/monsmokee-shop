// register.js - đăng ký 2 bước: thông tin → OTP email
import { CONFIG } from '../core/config.js';
import { api, ApiError } from '../core/api.js';
import { rules } from '../core/validators.js';
import { maskEmail } from '../core/format.js';
import { setFieldError, attachPasswordToggle, safeRedirect, showAlert } from '../core/form.js';
import { setBusy, toast, qs, qsa } from '../core/ui.js';
import { mountPasswordMeter } from '../components/password-meter.js';
import { mountOtp } from '../components/otp-input.js';

const MAX_WRONG = 5;
const form = qs('#reg-form'), stepInfo = qs('#step-info'), stepOtp = qs('#step-otp'), alertBox = qs('#reg-alert');
const f = Object.fromEntries(['ho_ten', 'so_dien_thoai', 'email', 'mat_khau', 'nhap_lai'].map((k) => [k, qs(`[name=${k}]`)]));
const fieldOf = (input) => input.closest('.field');
attachPasswordToggle(f.mat_khau);
attachPasswordToggle(f.nhap_lai);
mountPasswordMeter(f.mat_khau, qs('#pwm'));

const validators = {
  ...rules,
  nhap_lai: (v) => (!v ? 'Vui lòng nhập lại mật khẩu' : v === f.mat_khau.value ? '' : 'Mật khẩu nhập lại chưa khớp'),
};
const touched = new Set();
Object.entries(f).forEach(([k, input]) => {
  input.addEventListener('blur', () => { touched.add(k); setFieldError(fieldOf(input), validators[k](input.value)); });
  input.addEventListener('input', () => {
    if (touched.has(k)) setFieldError(fieldOf(input), validators[k](input.value));
    if (k === 'mat_khau' && touched.has('nhap_lai')) setFieldError(fieldOf(f.nhap_lai), validators.nhap_lai(f.nhap_lai.value));
  });
});

// ---- Bước 1 ----
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  let first = null;
  Object.entries(f).forEach(([k, input]) => { const m = validators[k](input.value); setFieldError(fieldOf(input), m); if (m && !first) first = input; });
  const terms = qs('#terms');
  qs('#terms-err').textContent = terms.checked ? '' : 'Vui lòng đồng ý với điều khoản để tiếp tục';
  if (first || !terms.checked) return (first || terms).focus();
  const btn = qs('#reg-btn');
  setBusy(btn, true);
  try {
    await api.post('/auth/register/start', Object.fromEntries(Object.entries(f).map(([k, i]) => [k, i.value])));
    goOtp();
  } catch (err) {
    if (err instanceof ApiError && err.errors) Object.entries(err.errors).forEach(([k, m]) => f[k] && setFieldError(fieldOf(f[k]), m));
    else if (err instanceof ApiError && err.status) showAlert(alertBox, err.message);
  } finally { setBusy(btn, false); }
});

// ---- Bước 2 ----
let wrong = 0, otpTimer, resendTimer;
const otp = mountOtp(qs('#otp'), { onComplete: verify });
const otpErr = qs('#otp-err');

function countdown(el, seconds, onEnd) {
  const end = Date.now() + seconds * 1000;
  const tick = () => {
    const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    el.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    if (!s) { clearInterval(id); onEnd?.(); }
  };
  const id = setInterval(tick, 500); tick();
  return () => clearInterval(id);
}
function startTimers() {
  otpTimer?.(); resendTimer?.();
  const resend = qs('#resend');
  resend.disabled = true;
  otpTimer = countdown(qs('#otp-ttl'), CONFIG.OTP_TTL_SECONDS, () => { otpErr.textContent = 'Mã đã hết hạn. Hãy gửi lại mã mới.'; });
  resendTimer = countdown(qs('#resend-wait'), CONFIG.OTP_RESEND_SECONDS, () => { resend.disabled = false; qs('#resend-wait').textContent = ''; });
}
function goOtp() {
  stepInfo.hidden = true; stepOtp.hidden = false;
  qs('#otp-email').textContent = maskEmail(f.email.value);
  qsa('.steps span').forEach((s, i) => s.classList.toggle('done', i <= 1));
  qs('#step-label').textContent = 'Bước 2/2: Xác thực email';
  wrong = 0; otpErr.textContent = ''; otp.clear(); startTimers();
}
async function verify(code) {
  if (wrong >= MAX_WRONG) return;
  try {
    await api.post('/auth/register/verify', { email: f.email.value.trim(), otp: code });
    otpTimer?.(); resendTimer?.();
    toast('Đăng ký thành công');
    setTimeout(() => location.assign(safeRedirect(new URLSearchParams(location.search).get('redirect'))), 700);
  } catch (err) {
    if (!(err instanceof ApiError) || !err.status) return;
    wrong++; otp.setInvalid(true);
    otpErr.textContent = wrong >= MAX_WRONG ? 'Bạn đã nhập sai quá nhiều lần. Hãy gửi lại mã mới.' : `${err.errors?.otp || 'Mã OTP chưa đúng'} (sai ${wrong}/${MAX_WRONG} lần)`;
    otp.clear();
  }
}
qs('#resend').addEventListener('click', async () => {
  try { await api.post('/auth/otp/resend', { email: f.email.value.trim(), muc_dich: 'DANG_KY' }); toast('Đã gửi lại mã OTP'); wrong = 0; otpErr.textContent = ''; otp.clear(); startTimers(); } catch { /* đã báo lỗi */ }
});
qs('#edit-info').addEventListener('click', () => {
  otpTimer?.(); resendTimer?.();
  stepOtp.hidden = true; stepInfo.hidden = false;
  qsa('.steps span').forEach((s, i) => s.classList.toggle('done', i === 0));
  qs('#step-label').textContent = 'Bước 1/2: Thông tin tài khoản';
});
qs('#verify-btn').addEventListener('click', () => (otp.value().length === 6 ? verify(otp.value()) : (otpErr.textContent = 'Vui lòng nhập đủ 6 chữ số')));
