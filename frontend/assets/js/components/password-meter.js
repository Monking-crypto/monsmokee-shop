// password-meter.js - thanh đo độ mạnh + checklist tiêu chí, cập nhật realtime
import { passwordChecks } from '../core/validators.js';

const LABELS = [['len', 'Ít nhất 8 ký tự'], ['upper', 'Chữ hoa'], ['lower', 'Chữ thường'], ['digit', 'Chữ số'], ['special', 'Ký tự đặc biệt']];

export function mountPasswordMeter(input, host) {
  host.className = 'pwm';
  host.innerHTML = `<div class="pwm__bar" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
    <ul class="pwm__list" aria-label="Tiêu chí mật khẩu">${LABELS.map(([k, t]) => `<li data-k="${k}">${t}</li>`).join('')}</ul>`;
  const update = () => {
    const c = passwordChecks(input.value);
    let met = 0;
    host.querySelectorAll('li').forEach((li) => { const ok = c[li.dataset.k]; li.classList.toggle('ok', ok); if (ok) met++; });
    host.dataset.level = input.value ? Math.max(1, Math.ceil((met / 5) * 4)) : 0;
  };
  input.addEventListener('input', update);
  update();
}
