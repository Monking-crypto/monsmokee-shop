// products.js - quản lý sản phẩm theo API quản trị
import { api, ApiError } from '../core/api.js';
import { debounce, escapeHtml, qs, toast } from '../core/ui.js';
import { formatVnd } from '../core/format.js';
import { imageUrl } from '../core/catalog.js';
import { confirmDialog } from '../components/confirm-dialog.js';

const root = qs('#admin-page-content');
const PAGE_SIZE = 20;
const initialQuery = new URLSearchParams(location.search).get('q') || '';
let products = [];
let categories = [];
let pagination = { page: 1, total: 0, total_pages: 1 };
let page = 1;
let editingProduct = null;
let imageFile = null;
let previewUrl = '';
let saving = false;
let productLoadSequence = 0;

function renderShell() {
  root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Sản phẩm</div>
    <div class="admin-toolbar"><div class="admin-filters">
      <input id="product-search" type="search" maxlength="100" placeholder="Tìm tên sản phẩm" aria-label="Tìm sản phẩm">
      <select id="category-filter" aria-label="Lọc danh mục"><option value="">Tất cả danh mục</option>${categories.map((category) => `<option value="${category.id}">${escapeHtml(category.ten_danh_muc)}</option>`).join('')}</select>
      <select id="status-filter" aria-label="Lọc trạng thái"><option value="">Mọi trạng thái</option><option value="1">Đang hiển thị</option><option value="0">Đang ẩn</option></select>
    </div><button id="add-product" class="ms-btn ms-btn--green" type="button"><i class="bi bi-plus-lg"></i> Thêm sản phẩm</button></div>
    <div id="product-table-wrap"><div class="admin-table-skeleton"></div></div><div id="product-pagination" class="admin-pagination"></div>
    <div id="product-modal" class="admin-modal" hidden><div class="admin-modal__scrim" data-modal-close></div><section class="admin-modal__panel" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
      <button class="admin-modal__close" type="button" data-modal-close aria-label="Đóng">×</button><h2 id="product-form-title">Thêm sản phẩm</h2>
      <form id="product-form" novalidate>
        <div class="admin-form-grid">
          ${field('ten', 'Tên sản phẩm *', 'text', 'Nhập tên sản phẩm', 'maxlength="200"')}
          <label class="admin-field">Danh mục *<select name="danh_muc_id" required><option value="">Chọn danh mục</option>${categories.map((category) => `<option value="${category.id}">${escapeHtml(category.ten_danh_muc)}</option>`).join('')}</select><small data-error="danh_muc_id"></small></label>
          <label class="admin-field">Giá bán (đồng) *<input name="gia" type="text" inputmode="numeric" autocomplete="off" placeholder="Ví dụ: 25.000" required><small data-error="gia"></small></label>
          ${field('don_vi_tinh', 'Đơn vị tính *', 'text', 'Ví dụ: gói, chai, hộp', 'maxlength="30"')}
          <label class="admin-field admin-field--wide">Mô tả<textarea name="mo_ta" rows="3" maxlength="10000"></textarea><small data-error="mo_ta"></small></label>
          <label class="admin-field admin-field--wide">Ảnh sản phẩm (JPG, PNG, WebP; tối đa 2MB)<input id="product-image" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"><small data-error="image"></small><img id="product-image-preview" class="admin-image-preview" alt="Ảnh xem trước" hidden></label>
        </div><div class="admin-modal__actions"><button type="button" class="admin-button" data-modal-close>Hủy</button><button id="save-product" type="submit" class="ms-btn ms-btn--green">Lưu sản phẩm</button></div>
      </form></section></div>`;
  bindShell();
}

function field(name, label, type, placeholder, extra = '') {
  return `<label class="admin-field">${label}<input name="${name}" type="${type}" placeholder="${placeholder}" ${extra} required><small data-error="${name}"></small></label>`;
}

function bindShell() {
  qs('#product-search').value = initialQuery;
  const search = debounce(() => { page = 1; loadProducts(); }, 250);
  qs('#product-search').addEventListener('input', search);
  ['category-filter', 'status-filter'].forEach((id) =>
    qs(`#${id}`).addEventListener('change', () => { page = 1; loadProducts(); }));
  qs('#add-product').addEventListener('click', () => openForm());
  qs('#product-form').addEventListener('submit', saveProduct);
  qs('#product-form').elements.gia.addEventListener('input', formatPriceInput);
  qs('#product-image').addEventListener('change', previewImage);
  qs('#product-modal').addEventListener('click', (event) => {
    if (event.target.closest('[data-modal-close]')) closeForm();
  });
  root.querySelector('#product-table-wrap').addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit]');
    const visibility = event.target.closest('[data-visibility]');
    const remove = event.target.closest('[data-delete]');
    if (edit) openForm(products.find((product) => Number(product.id) === Number(edit.dataset.edit)));
    if (visibility) updateVisibility(products.find((product) => Number(product.id) === Number(visibility.dataset.visibility)));
    if (remove) deleteProduct(products.find((product) => Number(product.id) === Number(remove.dataset.delete)));
  });
  qs('#product-pagination').addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) return;
    page = Number(button.dataset.page);
    loadProducts();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.target.closest('.confirm-dialog')) closeForm();
  });
}

function formatPriceInput(event) {
  const input = event.currentTarget;
  const digits = input.value.replace(/\D/g, '');
  input.value = digits ? Number(digits).toLocaleString('vi-VN') : '';
}

function renderTable() {
  const rows = products.map((product) => {
    const visible = Number(product.trang_thai) === 1;
    return `<tr><td><img class="admin-product-thumb" src="${escapeHtml(imageUrl(product.anh_thumb || product.anh))}" alt="" loading="lazy" decoding="async"></td>
      <td>${escapeHtml(product.ten)}</td><td>${escapeHtml(product.ten_danh_muc || categories.find((category) => Number(category.id) === Number(product.danh_muc_id))?.ten_danh_muc || '')}</td>
      <td>${formatVnd(product.gia)}</td><td>${Number(product.so_luong_ton) || 0}</td>
      <td><span class="admin-status${visible ? '' : ' is-hidden'}">${visible ? 'Đang hiển thị' : 'Đang ẩn'}</span></td>
      <td class="admin-table-actions"><button type="button" class="admin-button" data-edit="${product.id}">Sửa</button>
        <button type="button" class="admin-button" data-visibility="${product.id}">${visible ? 'Ẩn' : 'Hiện'}</button>
        <button type="button" class="admin-button admin-button--danger" data-delete="${product.id}">Xóa</button></td></tr>`;
  }).join('');
  qs('#product-table-wrap').innerHTML = rows
    ? `<div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Ảnh</th><th>Tên sản phẩm</th><th>Danh mục</th><th>Giá</th><th>Tồn kho</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : '<div class="ms-state"><strong>Không có sản phẩm phù hợp</strong>Thử thay đổi bộ lọc hoặc thêm sản phẩm mới.</div>';
  const totalPages = Math.max(1, Number(pagination.total_pages) || 1);
  qs('#product-pagination').innerHTML = pagination.total
    ? `<span>${pagination.total} sản phẩm · Trang ${page}/${totalPages}</span><div><button class="admin-button" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Trước</button> <button class="admin-button" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Sau</button></div>`
    : '';
}

function clearErrors() {
  qs('#product-form').querySelectorAll('[data-error]').forEach((element) => { element.textContent = ''; });
}

function setError(key, message) {
  const element = qs(`#product-form [data-error="${key}"]`);
  if (element) element.textContent = message;
}

function showApiErrors(errors) {
  const messages = [];
  Object.entries(errors || {}).forEach(([key, message]) => {
    if (key === 'code' || typeof message !== 'string') return;
    setError(key === 'anh' ? 'image' : key, message);
    messages.push(message);
  });
  return [...new Set(messages)].join(' ');
}

function openForm(product = null) {
  if (saving) return;
  editingProduct = product || null;
  imageFile = null;
  const form = qs('#product-form');
  form.reset();
  form.elements.ten.value = product?.ten || '';
  form.elements.danh_muc_id.value = product?.danh_muc_id || '';
  form.elements.gia.value = product?.gia ? Number(product.gia).toLocaleString('vi-VN') : '';
  form.elements.don_vi_tinh.value = product?.don_vi_tinh || '';
  form.elements.mo_ta.value = product?.mo_ta || '';
  qs('#product-form-title').textContent = product ? 'Sửa sản phẩm' : 'Thêm sản phẩm';
  qs('#save-product').textContent = product ? 'Lưu thay đổi' : 'Lưu sản phẩm';
  const preview = qs('#product-image-preview');
  preview.hidden = !(product?.anh_thumb || product?.anh);
  if (!preview.hidden) preview.src = imageUrl(product.anh_thumb || product.anh);
  clearErrors();
  qs('#product-modal').hidden = false;
  form.elements.ten.focus();
}

function closeForm() {
  if (saving) return;
  const modal = qs('#product-modal');
  if (modal && !modal.hidden) modal.hidden = true;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = '';
  imageFile = null;
  editingProduct = null;
}

function previewImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type) || file.size < 1 || file.size > 2 * 1024 * 1024) {
    event.target.value = '';
    imageFile = null;
    setError('image', 'Ảnh phải là JPG, PNG hoặc WebP và không quá 2MB.');
    return;
  }
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  imageFile = file;
  previewUrl = URL.createObjectURL(file);
  const preview = qs('#product-image-preview');
  preview.src = previewUrl;
  preview.hidden = false;
  setError('image', '');
}

function readForm() {
  const form = qs('#product-form');
  const name = form.elements.ten.value.trim();
  const categoryId = Number(form.elements.danh_muc_id.value);
  const priceDigits = form.elements.gia.value.replace(/\D/g, '');
  const price = Number(priceDigits);
  const unit = form.elements.don_vi_tinh.value.trim();
  const description = form.elements.mo_ta.value.trim();
  const errors = {};
  if (!name) errors.ten = 'Vui lòng nhập tên sản phẩm.';
  if (!Number.isInteger(categoryId) || categoryId < 1) errors.danh_muc_id = 'Vui lòng chọn danh mục.';
  if (!Number.isSafeInteger(price) || price < 1 || price > 999999999) errors.gia = 'Giá bán phải từ 1 đến 999.999.999 đồng.';
  if (!unit) errors.don_vi_tinh = 'Vui lòng nhập đơn vị tính.';
  if (unit.length > 30) errors.don_vi_tinh = 'Đơn vị tính không được vượt quá 30 ký tự.';
  if (description.length > 10000) errors.mo_ta = 'Mô tả không được vượt quá 10.000 ký tự.';
  return { values: { ten: name, danh_muc_id: categoryId, gia: price, don_vi_tinh: unit, mo_ta: description || null }, errors };
}

async function saveProduct(event) {
  event.preventDefault();
  if (saving) return;
  clearErrors();
  const { values, errors } = readForm();
  Object.entries(errors).forEach(([key, message]) => setError(key, message));
  const firstError = Object.keys(errors)[0];
  if (firstError) {
    qs(`#product-form [name="${firstError}"]`)?.focus();
    return;
  }

  const button = qs('#save-product');
  button.disabled = true;
  saving = true;
  let productId = editingProduct?.id;
  const createdNew = !editingProduct;
  let productSaved = false;
  let uploadWarning = '';
  try {
    const payload = { ...values };
    if (editingProduct) {
      await api.put(`/admin/products/${productId}`, payload);
    } else {
      const created = await api.post('/admin/products', payload);
      productId = created?.id;
      if (!Number.isInteger(Number(productId)) || Number(productId) < 1) {
        throw new Error('Máy chủ không trả về mã sản phẩm mới.');
      }
      editingProduct = { ...values, id: Number(productId), anh: null };
    }
    productSaved = true;

    if (imageFile) {
      const upload = new FormData();
      upload.append('image', imageFile);
      const uploaded = await api.post(`/admin/products/${productId}/image`, upload);
      uploadWarning = uploaded?.warning || '';
    }
    toast(uploadWarning
      ? `${createdNew ? 'Đã thêm sản phẩm' : 'Đã lưu sản phẩm'}; ${uploadWarning}`
      : createdNew ? 'Đã thêm sản phẩm' : 'Đã lưu sản phẩm');
    qs('#product-modal').hidden = true;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    imageFile = null;
    editingProduct = null;
    await loadProducts();
  } catch (error) {
    if (productSaved) {
      if (createdNew) {
        qs('#product-form-title').textContent = 'Sửa sản phẩm';
        qs('#save-product').textContent = 'Lưu thay đổi';
      }
      toast(`Thông tin sản phẩm đã lưu nhưng ảnh chưa tải lên được: ${error.message}`, 'error');
      await loadProducts();
    } else {
      const details = error instanceof ApiError ? showApiErrors(error.errors) : '';
      const message = error instanceof ApiError
        ? error.message
        : 'Không thể lưu sản phẩm. Vui lòng thử lại.';
      toast(details || message, 'error');
    }
  } finally {
    button.disabled = false;
    saving = false;
  }
}

async function updateVisibility(product) {
  if (!product) return;
  const visible = Number(product.trang_thai) === 1;
  try {
    await api.patch(`/admin/products/${product.id}/visibility`, { trang_thai: visible ? 0 : 1 });
    toast(visible ? 'Đã ẩn sản phẩm' : 'Đã hiển thị sản phẩm');
    await loadProducts();
  } catch (error) {
    toast(error instanceof ApiError ? error.message : 'Không thể cập nhật sản phẩm. Vui lòng thử lại.', 'error');
  }
}

async function deleteProduct(product) {
  if (!product) return;
  const { confirmed } = await confirmDialog({
    title: 'Xóa sản phẩm?',
    message: `Xóa sản phẩm ${product.ten}? Nếu sản phẩm đã có giao dịch, hệ thống sẽ ẩn thay vì xóa.`,
    confirmText: 'Xóa sản phẩm',
  });
  if (!confirmed) return;
  try {
    const result = await api.del(`/admin/products/${product.id}`);
    toast(result?.deleted === false ? 'Sản phẩm đã có giao dịch nên được ẩn thay vì xóa.' : 'Đã xóa sản phẩm');
    await loadProducts();
  } catch (error) {
    toast(error instanceof ApiError ? error.message : 'Không thể xóa sản phẩm. Vui lòng thử lại.', 'error');
  }
}

async function loadProducts() {
  const sequence = ++productLoadSequence;
  qs('#product-table-wrap').innerHTML = '<div class="admin-table-skeleton"></div>';
  const query = new URLSearchParams({ page: String(page), per_page: String(PAGE_SIZE) });
  const search = qs('#product-search').value.trim();
  const categoryId = qs('#category-filter').value;
  const status = qs('#status-filter').value;
  if (search) query.set('q', search);
  if (categoryId) query.set('category_id', categoryId);
  if (status !== '') query.set('trang_thai', status);
  try {
    const data = await api.get(`/admin/products?${query}`);
    if (sequence !== productLoadSequence) return;
    if (!Array.isArray(data?.products) || !data?.pagination) {
      throw new Error('Dữ liệu sản phẩm từ máy chủ không hợp lệ.');
    }
    const totalPages = Math.max(1, Number(data.pagination.total_pages) || 1);
    if (page > totalPages) {
      page = totalPages;
      await loadProducts();
      return;
    }
    products = data.products;
    pagination = data.pagination;
    page = Number(pagination.page) || page;
    renderTable();
  } catch (error) {
    if (sequence !== productLoadSequence) return;
    qs('#product-table-wrap').innerHTML = `<div class="ms-state"><strong>Không tải được sản phẩm</strong>${escapeHtml(error.message)}</div>`;
    qs('#product-pagination').innerHTML = '';
  }
}

async function init() {
  try {
    const [categoryData] = await Promise.all([
      api.get('/admin/categories'),
    ]);
    if (!Array.isArray(categoryData?.categories)) throw new Error('Dữ liệu danh mục từ máy chủ không hợp lệ.');
    categories = categoryData.categories;
    renderShell();
    await loadProducts();
  } catch (error) {
    root.innerHTML = `<div class="ms-state"><strong>Không tải được dữ liệu</strong>${escapeHtml(error.message)}</div>`;
  }
}

await init();
