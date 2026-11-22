// form.js - tiện ích form dùng chung: hiển thị lỗi từng ô, nút hiện/ẩn mật khẩu
export function setFieldError(field, message) {
  const input = field.querySelector('input');
  field.classList.toggle('is-invalid', Boolean(message));
  field.classList.toggle('is-valid', !message && Boolean(input.value));
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  field.querySelector('.field__error').textContent = message || '';
}
export function attachPasswordToggle(input) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'field__toggle';
  btn.setAttribute('aria-label', 'Hiện mật khẩu');
  btn.innerHTML = '<i class="bi bi-eye" aria-hidden="true"></i>';
  btn.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    btn.firstElementChild.className = `bi bi-eye${show ? '-slash' : ''}`;
  });
  input.closest('.field__box').append(btn);
  input.style.paddingRight = '44px';
}
/** Chỉ cho phép chuyển hướng tới trang nội bộ. */
export function safeRedirect(value, fallback = 'index.html') {
  return value && /^[\w\-./]+(\?[\w\-=&%.]*)?$/.test(value) && !value.startsWith('//') ? value : fallback;
}
export const showAlert = (el, message, type = 'error') => {
  el.className = `auth__alert${type === 'error' ? ' auth__alert--error' : ''}`;
  el.textContent = message;
  el.hidden = !message;
};
