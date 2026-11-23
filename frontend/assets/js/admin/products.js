// products.js - quản lý danh mục sản phẩm trong chế độ mẫu
import { api, ApiError } from '../core/api.js';
import { escapeHtml, qs, toast } from '../core/ui.js';
import { normalizeKeyword, formatVnd } from '../core/format.js';
import { confirmDialog } from '../components/confirm-dialog.js';

const root = qs('#admin-page-content');
let products = [], categories = [], page = 1, editingId = null, imageData = '', saving = false;
const PAGE_SIZE = 10;
const initialQuery = new URLSearchParams(location.search).get('q') || '';

function renderShell() {
  root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Sản phẩm</div>
    <div class="admin-toolbar"><div class="admin-filters">
      <input id="product-search" type="search" placeholder="Tìm tên sản phẩm" aria-label="Tìm sản phẩm">
      <select id="category-filter" aria-label="Lọc danh mục"><option value="">Tất cả danh mục</option>${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.ten_danh_muc)}</option>`).join('')}</select>
      <select id="status-filter" aria-label="Lọc trạng thái"><option value="">Mọi trạng thái</option><option value="dang_ban">Đang hiển thị</option><option value="an">Đang ẩn</option></select>
      <select id="product-sort" aria-label="Sắp xếp"><option value="name">Tên A–Z</option><option value="price-low">Giá tăng</option><option value="price-high">Giá giảm</option><option value="stock">Tồn kho</option></select>
    </div><button id="add-product" class="ms-btn ms-btn--green" type="button"><i class="bi bi-plus-lg"></i> Thêm sản phẩm</button></div>
    <div class="admin-bulkbar"><label><input id="select-all-products" type="checkbox"> Chọn tất cả trang</label><button id="bulk-delete" class="admin-button admin-button--danger" type="button" disabled>Xóa đã chọn</button>
      <button id="reset-products" class="admin-button" type="button">Khôi phục dữ liệu mẫu</button></div>
    <div id="product-table-wrap"><div class="admin-table-skeleton"></div></div><div id="product-pagination" class="admin-pagination"></div>
    <div id="product-modal" class="admin-modal" hidden><div class="admin-modal__scrim" data-modal-close></div><section class="admin-modal__panel" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
      <button class="admin-modal__close" type="button" data-modal-close aria-label="Đóng">×</button><h2 id="product-form-title">Thêm sản phẩm</h2>
      <form id="product-form" novalidate>
        <div class="admin-form-grid">
          ${field('ten_san_pham', 'Tên sản phẩm *', 'text', 'Nhập tên sản phẩm')}
          <label class="admin-field">Danh mục *<select name="danh_muc_id" required><option value="">Chọn danh mục</option>${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.ten_danh_muc)}</option>`).join('')}</select><small data-error="danh_muc_id"></small></label>
          <label class="admin-field">Nhóm con<input name="nhom_con" list="product-subcategories"><datalist id="product-subcategories"></datalist><small data-error="nhom_con"></small></label>
          ${field('gia_ban', 'Giá bán (đồng) *', 'number', 'Số nguyên dương', 'min="1" step="1"')}
          ${field('don_vi_tinh', 'Đơn vị tính *', 'text', 'Ví dụ: gói, chai, hộp')}
          ${field('so_luong_ton', 'Tồn kho *', 'number', 'Số lượng', 'min="0" step="1"')}
          ${field('huong_vi', 'Hương vị', 'text', 'Không bắt buộc')}
          ${field('dong_goi', 'Đóng gói', 'text', 'Ví dụ: Gói, Hộp, Chai')}
          <label class="admin-field admin-field--wide">Mô tả<textarea name="mo_ta" rows="3" maxlength="1000"></textarea><small data-error="mo_ta"></small></label>
          <label class="admin-field admin-field--wide">Ảnh sản phẩm (JPG, PNG, WebP; tối đa 2MB)<input id="product-image" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"><small data-error="hinh_anh"></small><img id="product-image-preview" class="admin-image-preview" alt="Ảnh xem trước" hidden></label>
          <label class="admin-field admin-field--toggle"><input name="visible" type="checkbox" checked> Hiển thị sản phẩm</label>
        </div><div class="admin-modal__actions"><button type="button" class="admin-button" data-modal-close>Hủy</button><button id="save-product" type="submit" class="ms-btn ms-btn--green">Lưu sản phẩm</button></div>
      </form></section></div>`;
  bindShell();
}

function field(name, label, type, placeholder, extra = '') {
  return `<label class="admin-field">${label}<input name="${name}" type="${type}" placeholder="${placeholder}" ${extra} required><small data-error="${name}"></small></label>`;
}
function bindShell() {
  qs('#product-search').value = initialQuery;
  ['product-search', 'category-filter', 'status-filter', 'product-sort'].forEach((id) => qs(`#${id}`).addEventListener(id === 'product-search' ? 'input' : 'change', () => { page = 1; renderTable(); }));
  qs('#add-product').addEventListener('click', () => openForm());
  qs('#product-form').addEventListener('submit', saveProduct);
  qs('#product-image').addEventListener('change', previewImage);
  qs('#product-form [name=danh_muc_id]').addEventListener('change', updateSubcategories);
  qs('#product-modal').addEventListener('click', (e) => { if (e.target.closest('[data-modal-close]')) closeForm(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !e.target.closest('.confirm-dialog')) closeForm(); });
  qs('#select-all-products').addEventListener('change', (e) => {
    qs('#product-table-wrap').querySelectorAll('[data-product-select]').forEach((box) => { box.checked = e.target.checked; });
    updateBulkButton();
  });
  qs('#product-table-wrap').addEventListener('change', (e) => { if (e.target.matches('[data-product-select]')) updateBulkButton(); });
  qs('#product-table-wrap').addEventListener('click', (e) => {
    const edit = e.target.closest('[data-edit]'), remove = e.target.closest('[data-delete]');
    if (edit) openForm(products.find((p) => p.id === Number(edit.dataset.edit)));
    if (remove) deleteProduct(products.find((p) => p.id === Number(remove.dataset.delete)));
  });
  qs('#bulk-delete').addEventListener('click', bulkDelete);
  qs('#reset-products').addEventListener('click', resetProducts);
}
function filteredProducts() {
  const search = normalizeKeyword(qs('#product-search').value);
  const cat = qs('#category-filter').value, status = qs('#status-filter').value, sort = qs('#product-sort').value;
  const list = products.filter((p) => (!search || normalizeKeyword(p.ten_san_pham).includes(search))
    && (!cat || Number(p.danh_muc_id) === Number(cat)) && (!status || p.trang_thai === status));
  if (sort === 'price-low') list.sort((a, b) => a.gia_ban - b.gia_ban);
  else if (sort === 'price-high') list.sort((a, b) => b.gia_ban - a.gia_ban);
  else if (sort === 'stock') list.sort((a, b) => a.so_luong_ton - b.so_luong_ton);
  else list.sort((a, b) => a.ten_san_pham.localeCompare(b.ten_san_pham, 'vi'));
  return list;
}
function renderTable() {
  const list = filteredProducts(), totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  page = Math.min(page, totalPages);
  const rows = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  qs('#product-table-wrap').innerHTML = rows.length ? `<div class="admin-table-scroll"><table class="admin-table">
    <thead><tr><th><span class="visually-hidden">Chọn</span></th><th>Ảnh</th><th>Tên sản phẩm</th><th>Danh mục</th><th>Giá</th><th>Tồn kho</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
    <tbody>${rows.map((p) => `<tr><td><input data-product-select type="checkbox" value="${p.id}" aria-label="Chọn ${escapeHtml(p.ten_san_pham)}"></td>
      <td><img class="admin-product-thumb" src="${escapeHtml(adminImageSrc(p.hinh_anh))}" alt=""></td>
      <td>${escapeHtml(p.ten_san_pham)}</td><td>${escapeHtml(categories.find((c) => c.id === Number(p.danh_muc_id))?.ten_danh_muc || '')}</td>
      <td>${formatVnd(p.gia_ban)}</td><td>${Number(p.so_luong_ton) || 0}</td><td><span class="admin-status ${p.trang_thai === 'an' ? 'is-hidden' : ''}">${p.trang_thai === 'an' ? 'Đang ẩn' : 'Đang hiển thị'}</span></td>
      <td class="admin-table-actions"><button type="button" class="admin-button" data-edit="${p.id}">Sửa</button><button type="button" class="admin-button admin-button--danger" data-delete="${p.id}">Xóa</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="ms-state"><strong>Không có sản phẩm phù hợp</strong>Thử thay đổi bộ lọc hoặc thêm sản phẩm mới.</div>';
  qs('#product-pagination').innerHTML = list.length ? `<span>${list.length} sản phẩm · Trang ${page}/${totalPages}</span><div><button class="admin-button" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Trước</button> <button class="admin-button" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Sau</button></div>` : '';
  qs('#product-pagination').querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => { page = Number(button.dataset.page); renderTable(); }));
  qs('#select-all-products').checked = false;
  updateBulkButton();
}
function adminImageSrc(path) {
  const value = path || 'assets/img/placeholder-product.svg';
  return value.startsWith('assets/') ? `../${value}` : value;
}
function updateBulkButton() {
  const checked = qs('#product-table-wrap').querySelectorAll('[data-product-select]:checked').length;
  qs('#bulk-delete').disabled = !checked;
}
function openForm(product = null) {
  editingId = product?.id || null;
  imageData = product?.hinh_anh || '';
  const form = qs('#product-form');
  form.reset();
  form.querySelector('[name=visible]').checked = product?.trang_thai !== 'an';
  Object.entries({
    ten_san_pham: product?.ten_san_pham, danh_muc_id: product?.danh_muc_id, nhom_con: product?.nhom_con,
    gia_ban: product?.gia_ban, don_vi_tinh: product?.don_vi_tinh, so_luong_ton: product?.so_luong_ton,
    huong_vi: product?.huong_vi, dong_goi: product?.dong_goi, mo_ta: product?.mo_ta,
  }).forEach(([key, value]) => { if (value !== undefined) form.elements[key].value = value; });
  qs('#product-form-title').textContent = product ? 'Sửa sản phẩm' : 'Thêm sản phẩm';
  qs('#save-product').textContent = product ? 'Lưu thay đổi' : 'Lưu sản phẩm';
  qs('#product-image-preview').src = adminImageSrc(imageData);
  qs('#product-image-preview').hidden = !imageData;
  updateSubcategories();
  clearErrors();
  qs('#product-modal').hidden = false;
  qs('#product-form').querySelector('[name=ten_san_pham]').focus();
}
function closeForm() { const modal = qs('#product-modal'); if (modal && !modal.hidden) modal.hidden = true; }
function clearErrors() {
  qs('#product-form').querySelectorAll('[data-error]').forEach((el) => { el.textContent = ''; });
}
function setError(key, message) {
  const error = qs(`#product-form [data-error="${key}"]`);
  if (error) error.textContent = message;
}
function updateSubcategories() {
  const id = Number(qs('#product-form').elements.danh_muc_id.value);
  const category = categories.find((c) => c.id === id);
  qs('#product-subcategories').innerHTML = (category?.children || []).map((child) => `<option value="${escapeHtml(child.ten)}"></option>`).join('');
}
async function previewImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  const valid = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 2 * 1024 * 1024;
  if (!valid) {
    event.target.value = '';
    imageData = '';
    qs('#product-image-preview').hidden = true;
    setError('hinh_anh', 'Ảnh phải là JPG, PNG hoặc WebP và không quá 2MB.');
    return;
  }
  imageData = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
    reader.readAsDataURL(file);
  }).catch(() => {
    setError('hinh_anh', 'Không đọc được ảnh đã chọn.');
    return '';
  });
  qs('#product-image-preview').src = adminImageSrc(imageData);
  qs('#product-image-preview').hidden = !imageData;
  setError('hinh_anh', '');
}
async function saveProduct(event) {
  event.preventDefault();
  if (saving) return;
  const form = event.currentTarget, values = Object.fromEntries(new FormData(form));
  clearErrors();
  const errors = {};
  if (!String(values.ten_san_pham || '').trim()) errors.ten_san_pham = 'Vui lòng nhập tên sản phẩm.';
  if (!values.danh_muc_id) errors.danh_muc_id = 'Vui lòng chọn danh mục.';
  if (!String(values.gia_ban || '').trim() || !Number.isInteger(Number(values.gia_ban)) || Number(values.gia_ban) <= 0) errors.gia_ban = 'Giá bán phải là số nguyên dương.';
  if (!String(values.don_vi_tinh || '').trim()) errors.don_vi_tinh = 'Vui lòng nhập đơn vị tính.';
  if (!String(values.so_luong_ton || '').trim() || !Number.isInteger(Number(values.so_luong_ton)) || Number(values.so_luong_ton) < 0) errors.so_luong_ton = 'Tồn kho phải là số nguyên từ 0 trở lên.';
  Object.entries(errors).forEach(([key, message]) => setError(key, message));
  const firstError = Object.keys(errors)[0];
  if (firstError) { form.elements[firstError].focus(); return; }
  const payload = {
    ten_san_pham: String(values.ten_san_pham).trim(), danh_muc_id: Number(values.danh_muc_id),
    nhom_con: String(values.nhom_con || '').trim(), gia_ban: Number(values.gia_ban),
    don_vi_tinh: String(values.don_vi_tinh).trim(), so_luong_ton: Number(values.so_luong_ton),
    huong_vi: String(values.huong_vi || '').trim(), dong_goi: String(values.dong_goi || '').trim(),
    mo_ta: String(values.mo_ta || '').trim(), hinh_anh: imageData || 'assets/img/placeholder-product.svg',
    trang_thai: form.elements.visible.checked ? 'dang_ban' : 'an',
  };
  const button = qs('#save-product'); button.disabled = true; saving = true;
  try {
    await (editingId ? api.put(`/admin/products/${editingId}`, payload) : api.post('/admin/products', payload));
    toast(editingId ? 'Đã lưu thay đổi' : 'Đã thêm sản phẩm');
    closeForm(); await loadProducts();
  } catch (error) {
    if (error instanceof ApiError && error.status) toast(error.message, 'error');
  } finally { button.disabled = false; saving = false; }
}
async function deleteProduct(product) {
  if (!product) return;
  const { confirmed } = await confirmDialog({
    title: 'Xóa sản phẩm?',
    message: `Xóa sản phẩm ${product.ten_san_pham}? Không thể hoàn tác.`,
    confirmText: 'Xóa sản phẩm',
  });
  if (!confirmed) return;
  try { await api.del(`/admin/products/${product.id}`); toast('Đã xóa sản phẩm'); await loadProducts(); }
  catch (error) { if (error instanceof ApiError && error.status) toast(error.message, 'error'); }
}
async function bulkDelete() {
  const ids = [...qs('#product-table-wrap').querySelectorAll('[data-product-select]:checked')].map((x) => Number(x.value));
  if (!ids.length) return;
  const names = products.filter((product) => ids.includes(product.id)).map((product) => product.ten_san_pham);
  const { confirmed } = await confirmDialog({
    title: 'Xóa sản phẩm đã chọn?',
    message: `Xóa ${names.join(', ')}? Không thể hoàn tác.`,
    confirmText: 'Xóa sản phẩm',
  });
  if (!confirmed) return;
  try { await api.post('/admin/products/bulk-delete', { ids }); toast('Đã xóa sản phẩm'); await loadProducts(); }
  catch (error) { if (error instanceof ApiError && error.status) toast(error.message, 'error'); }
}
async function resetProducts() {
  const { confirmed } = await confirmDialog({
    title: 'Khôi phục dữ liệu mẫu?',
    message: 'Các thay đổi sản phẩm hiện tại sẽ bị xóa.',
    confirmText: 'Khôi phục dữ liệu mẫu',
  });
  if (!confirmed) return;
  try { await api.post('/admin/products/reset'); toast('Đã khôi phục dữ liệu mẫu'); await loadProducts(); }
  catch (error) { if (error instanceof ApiError && error.status) toast(error.message, 'error'); }
}
async function loadProducts() {
  qs('#product-table-wrap').innerHTML = '<div class="admin-table-skeleton"></div>';
  try {
    const data = await api.get('/admin/products');
    products = data.items; renderTable();
  } catch (error) {
    qs('#product-table-wrap').innerHTML = `<div class="ms-state"><strong>Không tải được sản phẩm</strong>${escapeHtml(error.message)}</div>`;
  }
}

try {
  const data = await api.get('/admin/products');
  products = data.items; categories = data.categories;
  renderShell(); renderTable();
} catch (error) {
  root.innerHTML = `<div class="ms-state"><strong>Không tải được dữ liệu</strong>${escapeHtml(error.message)}</div>`;
}
