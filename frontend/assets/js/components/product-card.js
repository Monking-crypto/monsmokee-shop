// product-card.js - thẻ sản phẩm và xác nhận trước khi thêm vào giỏ
import { api, ApiError } from '../core/api.js';
import { escapeHtml, toast } from '../core/ui.js';
import { formatVnd, formatDate } from '../core/format.js';
import { confirmDialog } from './confirm-dialog.js';

const productRecords = new Map();

export function productCard(product, options = {}) {
  productRecords.set(Number(product.id), product);
  const sale = Number(product.phan_tram_giam) > 0;
  const out = Number(product.so_luong_ton) <= 0;
  const price = product.gia_hieu_luc ?? product.gia_ban;
  const flag = product.sap_dien_ra
    ? '<span class="pc__flag pc__flag--soon">Sắp diễn ra</span>'
    : sale ? `<span class="pc__flag">-${Number(product.phan_tram_giam)}%</span>` : '';
  const urgency = options.nearExpiry
    ? `<span class="expiry-days expiry-days--${product.near_expiry_days <= 3 ? 'urgent' : product.near_expiry_days <= 7 ? 'soon' : 'later'}">Còn ${Number(product.near_expiry_days)} ngày</span>`
    : '';
  const rank = options.rank
    ? `<span class="best-rank${options.rank <= 3 ? ' best-rank--top' : ''}" aria-label="Hạng ${options.rank}">${options.rank}</span>`
    : '';
  const sold = options.showSold ? `<span class="best-sold">Đã bán ${compactCount(product.luot_ban)}</span>` : '';
  const cls = ['pc', options.nearExpiry && 'pc--near-expiry', options.rank && 'pc--ranked', options.rank <= 3 && 'pc--rank-top', out && 'is-out-of-stock'].filter(Boolean).join(' ');
  const href = `chi-tiet-san-pham.html?id=${encodeURIComponent(product.id)}`;
  return `<article class="${cls}" data-id="${escapeHtml(product.id)}">
    ${rank}
    <a class="pc__media" href="${href}" tabindex="-1" aria-hidden="true">
      <img src="${escapeHtml(product.hinh_anh || 'assets/img/placeholder-product.svg')}" alt="" loading="lazy" width="200" height="200">${flag}${out ? '<span class="pc__soldout">Hết hàng</span>' : ''}</a>
    <div class="pc__body">
      <a class="pc__name ms-line-clamp-2" href="${href}">${escapeHtml(product.ten_san_pham)}</a>
      ${urgency}
      <span class="pc__unit">${escapeHtml(product.don_vi_tinh || '')}</span>
      ${options.showHsd && product.hsd ? `<span class="pc__hsd">HSD: ${formatDate(product.hsd)}</span>` : ''}
      ${sold}
      <div class="pc__foot">
        <div class="shelf-tag${sale ? ' is-sale' : ''}"><span class="shelf-tag__price">${formatVnd(price)}</span>${sale ? `<s class="shelf-tag__old">${formatVnd(product.gia_ban)}</s>` : ''}</div>
        <div class="pc__action"><button class="pc__add" type="button" data-add ${out ? 'disabled' : ''} aria-label="Thêm ${escapeHtml(product.ten_san_pham)} vào giỏ">${out ? 'Hết hàng' : 'Thêm'}</button></div>
      </div></div></article>`;
}

function compactCount(value) {
  const count = Number(value) || 0;
  return count >= 1000 ? `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(count);
}

export const productSkeletons = (count = 5) => Array.from({ length: count }, () =>
  '<div class="ms-skeleton" style="aspect-ratio:3/4" aria-hidden="true"></div>').join('');

export function bindProductCards(root = document) {
  root.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-add]');
    if (!button || button.disabled) return;
    const card = button.closest('.pc');
    const product = productRecords.get(Number(card?.dataset.id));
    if (!product) {
      toast('Không tìm thấy thông tin sản phẩm. Vui lòng tải lại trang.', 'error');
      return;
    }
    const { confirmed, quantity } = await confirmDialog({
      title: 'Thêm vào giỏ hàng?',
      message: quantityPlaceholder(product),
      product,
      quantityMessage: (count) => `Bạn có chắc chắn muốn thêm ${count} × ${product.ten_san_pham} vào giỏ hàng?`,
      confirmText: 'Thêm vào giỏ',
    });
    if (!confirmed) return;
    try {
      const result = await api.post('/cart/items', { san_pham_id: product.id, so_luong: quantity });
      document.dispatchEvent(new CustomEvent('ms:cart', { detail: { count: result.count } }));
      toast('Đã thêm vào giỏ hàng');
    } catch (error) {
      if (error instanceof ApiError && error.status === 501) return;
      if (error instanceof ApiError && error.status) toast(error.message, 'error');
    }
  });
}

function quantityPlaceholder(product) {
  return `1 × ${product.ten_san_pham}`;
}
