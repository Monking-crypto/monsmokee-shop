// product-card.js - thẻ sản phẩm và xác nhận trước khi thêm vào giỏ
import { api, ApiError } from '../core/api.js';
import { escapeHtml, toast } from '../core/ui.js';
import { formatVnd, formatDate } from '../core/format.js';
import { confirmDialog } from './confirm-dialog.js';

const productRecords = new Map();

function normalizeProduct(product) {
  const category = product.danh_muc || {};
  const image = product.anh_thumb || product.hinh_anh || product.anh || '';
  return {
    ...product,
    ten_san_pham: product.ten_san_pham || product.ten || 'Sản phẩm',
    gia_ban: Number(product.gia_goc ?? product.gia_ban ?? product.gia) || 0,
    gia_hieu_luc: Number(product.gia_ban_hieu_luc ?? product.gia_hieu_luc ?? product.gia_ban ?? product.gia) || 0,
    hinh_anh: image,
    don_vi_tinh: product.don_vi_tinh || '',
    hsd: product.hsd || product.han_su_dung || '',
    danh_muc_id: product.danh_muc_id ?? category.id,
    danh_muc_slug: product.danh_muc_slug || category.slug || '',
    con_hang: typeof product.con_hang === 'boolean'
      ? product.con_hang
      : Number(product.so_luong_ton) > 0,
  };
}

function productImageUrl(path) {
  const value = String(path || '');
  if (!value) return 'assets/img/placeholder-product.svg';
  if (/^(https?:|data:|blob:)/i.test(value) || value.startsWith('/')) return value;
  return value.startsWith('uploads/') ? `../backend/${value}` : value;
}

export function productCard(product, options = {}) {
  const item = normalizeProduct(product);
  const recordKey = `${item.id}:${item.gia_hieu_luc}:${item.phan_tram_giam}`;
  productRecords.set(recordKey, item);
  const sale = Number(item.phan_tram_giam) > 0;
  const hasStock = item.so_luong_ton !== undefined && item.so_luong_ton !== null
    && item.so_luong_ton !== '' && Number.isFinite(Number(item.so_luong_ton));
  const out = hasStock ? Number(item.so_luong_ton) <= 0 : item.con_hang === false;
  const price = item.gia_hieu_luc;
  const expiryDays = Number(item.near_expiry_days) || daysUntil(item.hsd);
  const flag = item.sap_dien_ra
    ? '<span class="pc__flag pc__flag--soon">Sắp diễn ra</span>'
    : sale ? `<span class="pc__flag">-${Number(item.phan_tram_giam)}%</span>` : '';
  const urgency = options.nearExpiry
    ? `<span class="expiry-days expiry-days--${expiryDays <= 3 ? 'urgent' : expiryDays <= 7 ? 'soon' : 'later'}">Còn ${expiryDays} ngày</span>`
    : '';
  const stock = options.showStock
    ? `<span class="pc__stock">${out ? 'Hết hàng' : hasStock ? `Còn ${Number(item.so_luong_ton)} sản phẩm` : item.con_hang ? 'Còn hàng' : ''}</span>`
    : '';
  const rank = options.rank
    ? `<span class="best-rank${options.rank <= 3 ? ' best-rank--top' : ''}" aria-label="Hạng ${options.rank}">${options.rank}</span>`
    : '';
  const sold = options.showSold ? `<span class="best-sold">Đã bán ${compactCount(item.luot_ban)}</span>` : '';
  const cls = ['pc', options.nearExpiry && 'pc--near-expiry', options.rank && 'pc--ranked', options.rank <= 3 && 'pc--rank-top', out && 'is-out-of-stock'].filter(Boolean).join(' ');
  const href = `chi-tiet-san-pham.html?id=${encodeURIComponent(item.id)}`;
  const categoryKey = options.categoryKey || item.danh_muc_slug || item.danh_muc_id || '';
  const image = productImageUrl(item.hinh_anh);
  return `<article class="${cls}" data-id="${escapeHtml(item.id)}" data-product-key="${escapeHtml(recordKey)}" data-category-key="${escapeHtml(categoryKey)}">
    ${rank}
    <a class="pc__media" href="${href}" tabindex="-1" aria-hidden="true">
      <img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async" width="200" height="200">${flag}${out ? '<span class="pc__soldout">Hết hàng</span>' : ''}</a>
    <div class="pc__body">
      <a class="pc__name ms-line-clamp-2" href="${href}">${escapeHtml(item.ten_san_pham)}</a>
      ${urgency}
      <span class="pc__unit">${escapeHtml(item.don_vi_tinh)}</span>
      ${options.showHsd && item.hsd ? `<span class="pc__hsd">HSD: ${formatDate(item.hsd)}</span>` : ''}
      ${stock}
      ${sold}
      <div class="pc__foot">
        <div class="shelf-tag${sale ? ' is-sale' : ''}"><span class="shelf-tag__price">${formatVnd(price)}</span>${sale ? `<s class="shelf-tag__old">${formatVnd(item.gia_ban)}</s>` : ''}</div>
        <div class="pc__action"><button class="pc__add" type="button" data-add ${out ? 'disabled' : ''} aria-label="Thêm ${escapeHtml(item.ten_san_pham)} vào giỏ">${out ? 'Hết hàng' : 'Thêm'}</button></div>
      </div></div></article>`;
}

function daysUntil(value) {
  if (!value) return 0;
  const expiry = new Date(`${value}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((expiry.getTime() - today.getTime()) / 86400000));
}

function compactCount(value) {
  const count = Number(value) || 0;
  return count >= 1000 ? `${(count / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}k` : String(count);
}

export const productSkeletons = (count = 5) => Array.from({ length: count }, () =>
  '<div class="ms-skeleton" style="aspect-ratio:3/4" aria-hidden="true"></div>').join('');

export function bindProductCards(root = document) {
  root.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-add]');
    if (!button || button.disabled) return;
    const card = button.closest('.pc');
    const product = productRecords.get(card?.dataset.productKey);
    if (!product) {
      toast('Không tìm thấy thông tin sản phẩm. Vui lòng tải lại trang.', 'error');
      return;
    }
    const { confirmed, quantity } = await confirmDialog({
      title: 'Thêm vào giỏ hàng?',
      message: `Bạn có chắc chắn muốn thêm 1 × ${product.ten_san_pham} vào giỏ hàng?`,
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
