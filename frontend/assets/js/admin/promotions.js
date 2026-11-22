// promotions.js - chọn danh sách tối đa 10 sản phẩm cho Siêu sale Thứ 6
import { api, ApiError } from '../core/api.js';
import { escapeHtml, qs, toast } from '../core/ui.js';
import { formatVnd } from '../core/format.js';

const root = qs('#admin-page-content');
let products = [], promo = { enabled: true, productIds: [] };

function render() {
  const selected = new Set(promo.productIds);
  root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Khuyến mãi</div>
    <section class="admin-promo-card"><div class="admin-promo-head"><div><p class="admin-eyebrow">CHƯƠNG TRÌNH ĐẦU TIÊN</p><h2>Siêu sale Thứ 6 — giảm 10%</h2>
      <p>Chọn tối đa 10 sản phẩm. Khách chỉ nhìn thấy ưu đãi vào Thứ 6 (giờ Việt Nam).</p></div>
      <label class="admin-switch"><input id="promo-enabled" type="checkbox" ${promo.enabled ? 'checked' : ''}><span>Chương trình đang bật</span></label></div>
      <div class="admin-promo-actions"><button id="promo-random" class="admin-button" type="button">Chọn ngẫu nhiên 10</button>
        <button id="promo-save" class="ms-btn ms-btn--green" type="button">Lưu chương trình</button><span id="promo-selected-count">${selected.size}/10 sản phẩm</span></div>
      <div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Chọn</th><th>Sản phẩm</th><th>Danh mục</th><th>Giá bán</th><th>Tồn kho</th></tr></thead>
      <tbody>${products.map((p) => `<tr><td><input type="checkbox" data-promo-product="${p.id}" ${selected.has(p.id) ? 'checked' : ''} aria-label="Chọn ${escapeHtml(p.ten_san_pham)}"></td>
        <td>${escapeHtml(p.ten_san_pham)}</td><td>${escapeHtml(p.category_name || '')}</td><td>${formatVnd(p.gia_ban)}</td><td>${p.so_luong_ton}</td></tr>`).join('')}</tbody></table></div></section>`;
  root.querySelectorAll('[data-promo-product]').forEach((box) => box.addEventListener('change', updateSelection));
  qs('#promo-random').addEventListener('click', chooseRandom);
  qs('#promo-save').addEventListener('click', save);
}
function updateSelection(event) {
  const checked = [...root.querySelectorAll('[data-promo-product]:checked')];
  if (checked.length > 10) {
    event.target.checked = false;
    toast('Chỉ chọn tối đa 10 sản phẩm', 'error');
  }
  promo.productIds = [...root.querySelectorAll('[data-promo-product]:checked')].map((x) => Number(x.dataset.promoProduct));
  qs('#promo-selected-count').textContent = `${promo.productIds.length}/10 sản phẩm`;
}
async function chooseRandom() {
  try { promo = await api.post('/admin/promotions/friday/random'); render(); toast('Đã chọn ngẫu nhiên 10 sản phẩm'); }
  catch (error) { if (error instanceof ApiError && error.status) toast(error.message, 'error'); }
}
async function save() {
  const button = qs('#promo-save'); button.disabled = true;
  promo.enabled = qs('#promo-enabled').checked;
  try { promo = await api.put('/admin/promotions/friday', promo); toast('Đã lưu chương trình'); }
  catch (error) { if (error instanceof ApiError && error.status) toast(error.message, 'error'); }
  finally { button.disabled = false; }
}
try {
  const [inventory, current] = await Promise.all([api.get('/admin/products'), api.get('/admin/promotions/friday')]);
  products = inventory.items.map((p) => ({
    ...p, category_name: inventory.categories.find((c) => c.id === Number(p.danh_muc_id))?.ten_danh_muc || '',
  }));
  promo = current;
  render();
} catch (error) {
  root.innerHTML = `<div class="ms-state"><strong>Không tải được chương trình</strong>${escapeHtml(error.message)}</div>`;
}
