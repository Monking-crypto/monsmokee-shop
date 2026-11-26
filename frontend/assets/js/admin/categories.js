// categories.js - quản lý danh mục theo API quản trị
import { api, ApiError } from '../core/api.js';
import { escapeHtml, qs, toast } from '../core/ui.js';
import { confirmDialog } from '../components/confirm-dialog.js';

const root = qs('#admin-page-content');
let categories = [];
let editingId = null;
let opener = null;
let saving = false;

function render() {
  root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Danh mục</div>
    <div class="admin-toolbar"><p>Quản lý danh mục sản phẩm.</p>
      <button id="category-add" class="ms-btn ms-btn--green" type="button"><i class="bi bi-plus-lg"></i> Thêm danh mục</button></div>
    <div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Thứ tự</th><th>Tên danh mục</th><th>Slug</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
      <tbody>${categories.map((category) => {
    const visible = Number(category.trang_thai) === 1;
    return `<tr>
        <td>${Number(category.thu_tu) || 0}</td>
        <td>${escapeHtml(category.ten_danh_muc)}</td>
        <td>${escapeHtml(category.slug || '')}</td>
        <td><span class="admin-status${visible ? '' : ' is-hidden'}">${visible ? 'Đang hiển thị' : 'Đang ẩn'}</span></td>
        <td class="admin-table-actions"><button class="admin-button" type="button" data-edit="${category.id}">Sửa</button>
          <button class="admin-button" type="button" data-visibility="${category.id}" data-visible="${visible ? '1' : '0'}">${visible ? 'Ẩn' : 'Hiện'}</button></td>
      </tr>`;
  }).join('')}</tbody></table></div>
    ${categories.length ? '' : '<div class="ms-state"><strong>Chưa có danh mục</strong>Thêm danh mục đầu tiên để phân loại sản phẩm.</div>'}
    <div id="category-modal" class="admin-modal" hidden><div class="admin-modal__scrim" data-close></div>
      <section class="admin-modal__panel" role="dialog" aria-modal="true" aria-labelledby="category-title">
        <button class="admin-modal__close" type="button" data-close aria-label="Đóng">×</button>
        <h2 id="category-title">Thêm danh mục</h2>
        <form id="category-form" novalidate><div class="admin-form-grid">
          <label class="admin-field admin-field--wide">Tên danh mục *<input name="ten_danh_muc" required maxlength="100"><small data-error="ten_danh_muc"></small></label>
          <label class="admin-field">Thứ tự<input name="thu_tu" type="number" min="0" step="1" required><small data-error="thu_tu"></small></label>
        </div><div class="admin-modal__actions"><button type="button" class="admin-button" data-close>Hủy</button>
          <button id="category-save" type="submit" class="ms-btn ms-btn--green">Lưu danh mục</button></div></form>
      </section></div>`;
  bind();
}

function bind() {
  qs('#category-add').addEventListener('click', (event) => openForm(null, event.currentTarget));
  root.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () =>
    openForm(categories.find((category) => Number(category.id) === Number(button.dataset.edit)), button)));
  root.querySelectorAll('[data-visibility]').forEach((button) => button.addEventListener('click', () =>
    updateVisibility(categories.find((category) => Number(category.id) === Number(button.dataset.visibility)))));
  const modal = qs('#category-modal');
  const form = qs('#category-form');
  modal.addEventListener('click', (event) => { if (event.target.closest('[data-close]')) closeForm(); });
  form.addEventListener('submit', save);
}

function openForm(category, trigger) {
  editingId = category?.id || null;
  opener = trigger;
  const form = qs('#category-form');
  form.reset();
  form.elements.ten_danh_muc.value = category?.ten_danh_muc || '';
  form.elements.thu_tu.value = category?.thu_tu ?? categories.length + 1;
  qs('#category-title').textContent = category ? 'Sửa danh mục' : 'Thêm danh mục';
  qs('#category-save').textContent = category ? 'Lưu thay đổi' : 'Lưu danh mục';
  form.querySelectorAll('[data-error]').forEach((error) => { error.textContent = ''; });
  qs('#category-modal').hidden = false;
  form.elements.ten_danh_muc.focus();
}

function closeForm() {
  qs('#category-modal').hidden = true;
  opener?.focus();
}

async function save(event) {
  event.preventDefault();
  if (saving) return;
  const form = event.currentTarget;
  const name = form.elements.ten_danh_muc.value.trim();
  const order = Number(form.elements.thu_tu.value);
  form.querySelectorAll('[data-error]').forEach((error) => { error.textContent = ''; });
  if (!name) {
    form.querySelector('[data-error="ten_danh_muc"]').textContent = 'Vui lòng nhập tên danh mục.';
    form.elements.ten_danh_muc.focus();
    return;
  }
  if (!Number.isInteger(order) || order < 0) {
    form.querySelector('[data-error="thu_tu"]').textContent = 'Thứ tự phải là số nguyên không âm.';
    form.elements.thu_tu.focus();
    return;
  }

  const button = qs('#category-save');
  button.disabled = true;
  saving = true;
  try {
    const payload = { ten_danh_muc: name, thu_tu: order };
    await (editingId
      ? api.put(`/admin/categories/${editingId}`, payload)
      : api.post('/admin/categories', payload));
    toast(editingId ? 'Đã lưu danh mục' : 'Đã thêm danh mục');
    closeForm();
    await load();
  } catch (error) {
    toast(error instanceof ApiError ? error.message : 'Không thể lưu danh mục. Vui lòng thử lại.', 'error');
  } finally {
    button.disabled = false;
    saving = false;
  }
}

async function updateVisibility(category) {
  if (!category) return;
  const visible = Number(category.trang_thai) === 1;
  if (visible) {
    const { confirmed } = await confirmDialog({
      title: 'Ẩn danh mục?',
      message: `Ẩn ${category.ten_danh_muc}? Sản phẩm thuộc danh mục này sẽ không xuất hiện công khai.`,
      confirmText: 'Ẩn danh mục',
    });
    if (!confirmed) return;
  }
  try {
    await api.patch(`/admin/categories/${category.id}/visibility`, { trang_thai: visible ? 0 : 1 });
    toast(visible ? 'Đã ẩn danh mục' : 'Đã hiển thị danh mục');
    await load();
  } catch (error) {
    toast(error instanceof ApiError ? error.message : 'Không thể cập nhật danh mục. Vui lòng thử lại.', 'error');
  }
}

async function load() {
  root.innerHTML = '<div class="admin-table-skeleton"></div>';
  try {
    const data = await api.get('/admin/categories');
    if (!Array.isArray(data?.categories)) throw new Error('Dữ liệu danh mục từ máy chủ không hợp lệ.');
    categories = data.categories;
    render();
  } catch (error) {
    root.innerHTML = `<div class="ms-state"><strong>Không tải được danh mục</strong>${escapeHtml(error.message)}</div>`;
  }
}

await load();
