import { escapeHtml } from '../core/ui.js';
import { formatVnd } from '../core/format.js';

let activeDialog;

export function confirmDialog({
  title = 'Xác nhận thao tác',
  message = '',
  confirmText = 'Đồng ý',
  cancelText = 'Hủy',
  product = null,
  quantityMessage = null,
} = {}) {
  if (activeDialog) activeDialog(false);

  const returnFocus = document.activeElement;
  const maxQuantity = product ? Math.max(1, Math.min(99, Number(product.so_luong_ton) || 1)) : 1;
  const dialog = document.createElement('div');
  dialog.className = 'confirm-dialog';
  dialog.innerHTML = `<div class="confirm-dialog__scrim" data-cancel></div>
    <section class="confirm-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" tabindex="-1">
      <h2 id="confirm-title">${escapeHtml(title)}</h2>
      <p id="confirm-message">${escapeHtml(message)}</p>
      ${product ? `<div class="confirm-dialog__product">
        <img src="${escapeHtml(product.hinh_anh || 'assets/img/placeholder-product.svg')}" alt="">
        <div><strong>${escapeHtml(product.ten_san_pham)}</strong><span>${formatVnd(product.gia_hieu_luc ?? product.gia_ban)} / ${escapeHtml(product.don_vi_tinh || '')}</span></div>
      </div>
      <label class="confirm-dialog__quantity">Số lượng
        <span class="qty"><button type="button" data-quantity-step="-1" aria-label="Giảm số lượng">−</button>
          <input type="number" min="1" max="${maxQuantity}" value="1" aria-label="Số lượng sản phẩm">
          <button type="button" data-quantity-step="1" aria-label="Tăng số lượng">+</button></span>
      </label>` : ''}
      <div class="confirm-dialog__actions">
        <button type="button" class="ms-btn ms-btn--ghost" data-cancel>${escapeHtml(cancelText)}</button>
        <button type="button" class="ms-btn ms-btn--green" data-confirm>${escapeHtml(confirmText)}</button>
      </div>
    </section>`;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (confirmed) => {
      if (settled) return;
      settled = true;
      activeDialog = null;
      const quantity = Number(dialog.querySelector('input[type="number"]')?.value) || 1;
      dialog.remove();
      returnFocus?.focus?.();
      resolve({ confirmed, quantity });
    };
    activeDialog = finish;
    const panel = dialog.querySelector('.confirm-dialog__panel');
    const quantityInput = dialog.querySelector('input[type="number"]');
    dialog.addEventListener('click', (event) => {
      if (event.target.closest('[data-cancel]')) finish(false);
      if (event.target.closest('[data-confirm]')) finish(true);
      const step = event.target.closest('[data-quantity-step]');
      if (step && quantityInput) {
        const next = Number(quantityInput.value) + Number(step.dataset.quantityStep);
        quantityInput.value = String(Math.max(1, Math.min(maxQuantity, next)));
        updateQuantityMessage();
      }
    });
    quantityInput?.addEventListener('input', updateQuantityMessage);
    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      } else if (event.key === 'Tab') {
        const focusable = [...panel.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      } else if (event.key === 'Enter' && !event.target.matches('[data-cancel]')) {
        event.preventDefault();
        finish(true);
      }
    });
    document.body.append(dialog);
    panel.focus();
    (quantityInput || panel.querySelector('[data-confirm]')).focus();

    function updateQuantityMessage() {
      if (quantityMessage && quantityInput) {
        dialog.querySelector('#confirm-message').textContent = quantityMessage(Number(quantityInput.value) || 1);
      }
    }
  });
}
