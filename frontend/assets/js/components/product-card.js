// product-card.js - thẻ sản phẩm kiểu tem giá + xử lý nút Thêm / chỉnh số lượng
import { api, ApiError } from '../core/api.js';
import { escapeHtml, toast } from '../core/ui.js';
import { formatVnd, formatDate } from '../core/format.js';

/** @param {object} p sản phẩm  @param {{showHsd?:boolean}} opt */
export function productCard(p, opt = {}) {
  const sale = p.phan_tram_giam > 0;
  const out = p.so_luong_ton <= 0;
  const price = p.gia_hieu_luc ?? p.gia_ban;
  const flag = p.sap_dien_ra ? '<span class="pc__flag pc__flag--soon">Sắp diễn ra</span>' : sale ? `<span class="pc__flag">-${p.phan_tram_giam}%</span>` : '';
  const href = `chi-tiet-san-pham.html?id=${p.id}`;
  return `<article class="pc" data-id="${p.id}">
    <a class="pc__media" href="${href}" tabindex="-1" aria-hidden="true">
      <img src="${escapeHtml(p.hinh_anh)}" alt="" loading="lazy" width="200" height="200">${flag}${out ? '<span class="pc__soldout">Hết hàng</span>' : ''}</a>
    <div class="pc__body">
      <a class="pc__name ms-line-clamp-2" href="${href}">${escapeHtml(p.ten_san_pham)}</a>
      <span class="pc__unit">${escapeHtml(p.don_vi_tinh)}</span>
      ${opt.showHsd && p.hsd ? `<span class="pc__hsd">HSD: ${formatDate(p.hsd)}</span>` : ''}
      <div class="pc__foot">
        <div class="shelf-tag${sale ? ' is-sale' : ''}"><span class="shelf-tag__price">${formatVnd(price)}</span>${sale ? `<s class="shelf-tag__old">${formatVnd(p.gia_ban)}</s>` : ''}</div>
        <div class="pc__action"><button class="pc__add" type="button" data-add ${out ? 'disabled' : ''} aria-label="Thêm ${escapeHtml(p.ten_san_pham)} vào giỏ">${out ? 'Hết' : 'Thêm'}</button></div>
      </div></div></article>`;
}
export const productSkeletons = (n = 5) => Array.from({ length: n }, () => '<div class="ms-skeleton" style="aspect-ratio:3/4" aria-hidden="true"></div>').join('');

/** Gắn xử lý bằng event delegation: gọi một lần cho mỗi trang. */
export function bindProductCards(root = document) {
  root.addEventListener('click', async (e) => {
    const card = e.target.closest('.pc');
    if (!card) return;
    const id = Number(card.dataset.id);
    const act = card.querySelector('.pc__action');
    if (e.target.closest('[data-add]')) {
      if (await add(id)) setQty(act, id, 1);
    } else if (e.target.closest('[data-inc]')) {
      const n = Number(act.querySelector('output').textContent);
      if (await add(id)) setQty(act, id, n + 1);
    } else if (e.target.closest('[data-dec]')) {
      const n = Number(act.querySelector('output').textContent) - 1;
      try { await api.put(`/cart/items/${id}`, { so_luong: n }); } catch { return; }
      if (n <= 0) act.innerHTML = '<button class="pc__add" type="button" data-add>Thêm</button>'; else setQty(act, id, n);
      syncCount();
    }
  });
}
async function add(id) {
  try { await api.post('/cart/items', { san_pham_id: id, so_luong: 1 }); await syncCount(); return true; }
  catch (err) {
    if (err instanceof ApiError && err.status === 501) toast('Tính năng giỏ hàng đang được phát triển', 'info');
    else if (err instanceof ApiError && err.status) toast(err.message, 'error');
    return false;
  }
}
async function syncCount() {
  try { document.dispatchEvent(new CustomEvent('ms:cart', { detail: { count: (await api.get('/cart')).count || 0 } })); } catch { /* bỏ qua */ }
}
function setQty(act, id, n) {
  act.innerHTML = `<div class="qty" role="group" aria-label="Số lượng"><button type="button" data-dec aria-label="Giảm">−</button><output>${n}</output><button type="button" data-inc aria-label="Tăng">+</button></div>`;
}
