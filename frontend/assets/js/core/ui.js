// ui.js - toast, escape HTML, tiện ích giao diện
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export function toast(message, type = 'success', ms = 3200) {
  let box = document.querySelector('.ms-toasts');
  if (!box) {
    box = document.createElement('div');
    box.className = 'ms-toasts';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  const t = document.createElement('div');
  t.className = `ms-toast ms-toast--${type}`;
  t.textContent = message;
  box.append(t);
  setTimeout(() => t.remove(), ms);
}
export const notImplemented = (what = 'Tính năng') => toast(`${what} đang được phát triển`, 'info');

/** Khóa nút + hiện spinner khi đang gửi (chống bấm đúp). */
export function setBusy(btn, busy) {
  if (!btn) return;
  if (busy) {
    btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="ms-spinner" aria-hidden="true"></span><span class="visually-hidden">Đang xử lý</span>';
  } else {
    btn.disabled = false;
    if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
  }
}
export const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const qs = (s, r = document) => r.querySelector(s);
export const qsa = (s, r = document) => [...r.querySelectorAll(s)];
