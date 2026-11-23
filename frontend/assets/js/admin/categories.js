// categories.js - quản lý danh mục và nhóm con trong chế độ mẫu
import { api, ApiError } from '../core/api.js';
import { escapeHtml, qs, toast } from '../core/ui.js';
import { confirmDialog } from '../components/confirm-dialog.js';

const root = qs('#admin-page-content');
const icons = ['basket', 'box-seam', 'cookie', 'cup-hot', 'cup-straw', 'droplet', 'house', 'flower1', 'person-heart', 'egg', 'snow', 'grid'];
let categories = [];
let editingId = null;
let opener = null;

const slugify = (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function render() {
  root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Danh mục</div>
    <div class="admin-toolbar"><p>Quản lý danh mục và nhóm sản phẩm con.</p>
      <button id="category-add" class="ms-btn ms-btn--green" type="button"><i class="bi bi-plus-lg"></i> Thêm danh mục</button></div>
    <div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Thứ tự</th><th>Tên danh mục</th><th>Slug</th><th>Icon</th><th>Nhóm con</th><th>Sản phẩm</th><th>Thao tác</th></tr></thead>
      <tbody>${categories.map((category) => `<tr>
        <td>${Number(category.thu_tu) || category.id}</td>
        <td>${escapeHtml(category.ten_danh_muc)}</td><td>${escapeHtml(category.slug)}</td>
        <td><i class="bi bi-${escapeHtml(category.icon)}" aria-hidden="true"></i> ${escapeHtml(category.icon)}</td>
        <td>${(category.children || []).map((child) => escapeHtml(child.ten)).join(', ') || '—'}</td>
        <td>${Number(category.product_count) || 0}${category.product_count ? '<small class="admin-table-sub">Không thể xóa khi còn sản phẩm</small>' : ''}</td>
        <td class="admin-table-actions"><button class="admin-button" type="button" data-edit="${category.id}">Sửa</button>
          <button class="admin-button admin-button--danger" type="button" data-delete="${category.id}" ${category.product_count ? 'disabled title="Không thể xóa danh mục còn sản phẩm"' : ''}>Xóa</button></td>
      </tr>`).join('')}</tbody></table></div>
    ${categories.length ? '' : '<div class="ms-state"><strong>Chưa có danh mục</strong>Thêm danh mục đầu tiên để phân loại sản phẩm.</div>'}
    <div id="category-modal" class="admin-modal" hidden><div class="admin-modal__scrim" data-close></div>
      <section class="admin-modal__panel" role="dialog" aria-modal="true" aria-labelledby="category-title">
        <button class="admin-modal__close" type="button" data-close aria-label="Đóng">×</button>
        <h2 id="category-title">Thêm danh mục</h2>
        <form id="category-form" novalidate><div class="admin-form-grid">
          <label class="admin-field admin-field--wide">Tên danh mục *<input name="ten_danh_muc" required maxlength="80"><small data-error="ten_danh_muc"></small></label>
          <label class="admin-field">Slug tự sinh<input name="slug" required readonly><small data-error="slug"></small></label>
          <label class="admin-field">Icon<select name="icon">${icons.map((icon) => `<option value="${icon}">${icon}</option>`).join('')}</select></label>
          <label class="admin-field">Thứ tự<input name="thu_tu" type="number" min="1" step="1" required><small data-error="thu_tu"></small></label>
          <label class="admin-field admin-field--wide">Danh mục con (mỗi dòng một tên)
            <textarea name="children" rows="5" placeholder="Ví dụ: Bánh quy&#10;Kẹo&#10;Snack"></textarea></label>
        </div><div class="admin-modal__actions"><button type="button" class="admin-button" data-close>Hủy</button>
          <button id="category-save" type="submit" class="ms-btn ms-btn--green">Lưu danh mục</button></div></form>
      </section></div>`;
  bind();
}

function bind() {
  qs('#category-add').addEventListener('click', (event) => openForm(null, event.currentTarget));
  root.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () =>
    openForm(categories.find((category) => category.id === Number(button.dataset.edit)), button)));
  root.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () =>
    deleteCategory(categories.find((category) => category.id === Number(button.dataset.delete)))));
  const modal = qs('#category-modal'), form = qs('#category-form');
  modal.addEventListener('click', (event) => { if (event.target.closest('[data-close]')) closeForm(); });
  form.elements.ten_danh_muc.addEventListener('input', () => { form.elements.slug.value = slugify(form.elements.ten_danh_muc.value); });
  form.addEventListener('submit', save);
}

function openForm(category, trigger) {
  editingId = category?.id || null;
  opener = trigger;
  const form = qs('#category-form');
  form.reset();
  form.elements.ten_danh_muc.value = category?.ten_danh_muc || '';
  form.elements.slug.value = category?.slug || '';
  form.elements.icon.value = category?.icon || icons[0];
  form.elements.thu_tu.value = category?.thu_tu || categories.length + 1;
  form.elements.namedItem('children').value = (category?.children || []).map((child) => child.ten).join('\n');
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
  const form = event.currentTarget;
  const name = form.elements.ten_danh_muc.value.trim();
  const order = Number(form.elements.thu_tu.value);
  form.querySelectorAll('[data-error]').forEach((error) => { error.textContent = ''; });
  if (!name) return (form.querySelector('[data-error="ten_danh_muc"]').textContent = 'Vui lòng nhập tên danh mục.');
  if (!Number.isInteger(order) || order < 1) return (form.querySelector('[data-error="thu_tu"]').textContent = 'Thứ tự phải là số nguyên từ 1 trở lên.');
  const slug = slugify(name);
  if (!slug) return (form.querySelector('[data-error="slug"]').textContent = 'Không tạo được slug từ tên danh mục.');
  const children = [...new Set(form.elements.namedItem('children').value.split('\n').map((name) => name.trim()).filter(Boolean))]
    .map((ten) => ({ ten, slug: slugify(ten) }));
  const payload = { ten_danh_muc: name, slug, icon: form.elements.icon.value, thu_tu: order, children };
  const button = qs('#category-save');
  button.disabled = true;
  try {
    await (editingId ? api.put(`/admin/categories/${editingId}`, payload) : api.post('/admin/categories', payload));
    toast(editingId ? 'Đã lưu danh mục' : 'Đã thêm danh mục');
    closeForm();
    await load();
  } catch (error) {
    if (error instanceof ApiError && error.status) toast(error.message, 'error');
  } finally { button.disabled = false; }
}

async function deleteCategory(category) {
  if (!category) return;
  if (category.product_count) {
    toast(`Không thể xóa vì danh mục còn ${category.product_count} sản phẩm.`, 'error');
    return;
  }
  const { confirmed } = await confirmDialog({
    title: 'Xóa danh mục?',
    message: `Xóa danh mục ${category.ten_danh_muc}? Không thể hoàn tác.`,
    confirmText: 'Xóa danh mục',
  });
  if (!confirmed) return;
  try { await api.del(`/admin/categories/${category.id}`); toast('Đã xóa danh mục'); await load(); }
  catch (error) { if (error instanceof ApiError && error.status) toast(error.message, 'error'); }
}

async function load() {
  root.innerHTML = '<div class="admin-table-skeleton"></div>';
  try { categories = await api.get('/admin/categories'); render(); }
  catch (error) { root.innerHTML = `<div class="ms-state"><strong>Không tải được danh mục</strong>${escapeHtml(error.message)}</div>`; }
}

await load();
