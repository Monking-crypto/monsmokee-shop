// otp-input.js - 6 ô nhập OTP: tự nhảy ô, dán được cả mã, bàn phím số trên mobile
export function mountOtp(host, { length = 6, onComplete } = {}) {
  host.classList.add('otp');
  host.setAttribute('role', 'group');
  host.setAttribute('aria-label', 'Mã OTP gồm 6 chữ số');
  host.innerHTML = Array.from({ length }, (_, i) =>
    `<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" aria-label="Chữ số ${i + 1}" ${i === 0 ? 'autocomplete="one-time-code"' : 'autocomplete="off"'}>`).join('');
  const boxes = [...host.querySelectorAll('input')];
  const value = () => boxes.map((b) => b.value).join('');
  const done = () => { if (value().length === length) onComplete?.(value()); };
  boxes.forEach((b, i) => {
    b.addEventListener('input', () => {
      b.value = b.value.replace(/\D/g, '').slice(-1);
      host.classList.remove('is-invalid');
      if (b.value && boxes[i + 1]) boxes[i + 1].focus();
      done();
    });
    b.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !b.value && boxes[i - 1]) { boxes[i - 1].focus(); boxes[i - 1].value = ''; }
      if (e.key === 'ArrowLeft' && boxes[i - 1]) boxes[i - 1].focus();
      if (e.key === 'ArrowRight' && boxes[i + 1]) boxes[i + 1].focus();
    });
    b.addEventListener('paste', (e) => {
      e.preventDefault();
      const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, length);
      digits.split('').forEach((d, k) => { boxes[k].value = d; });
      boxes[Math.min(digits.length, length - 1)].focus();
      done();
    });
    b.addEventListener('focus', () => b.select());
  });
  return {
    value,
    clear() { boxes.forEach((b) => { b.value = ''; }); boxes[0].focus(); },
    setInvalid(v) { host.classList.toggle('is-invalid', v); },
    setDisabled(disabled) { boxes.forEach((box) => { box.disabled = disabled; }); },
    focus() { boxes[0].focus(); },
  };
}
