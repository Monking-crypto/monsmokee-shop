import { api, ApiError } from '../core/api.js';
import { escapeHtml, qs, toast } from '../core/ui.js';

const root = qs('#admin-page-content');
let areas = [];
let editingId = null;
let saving = false;

function render() {
  root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Khu vực giao hàng</div>
    <div class="admin-toolbar"><p>Quản lý khu vực, khoảng cách và trạng thái hỗ trợ giao hàng.</p>
      <button id="area-create" class="ms-btn ms-btn--green" type="button">Thêm khu vực</button></div>
    <section class="admin-panel" id="area-form-panel" hidden><h2 id="area-form-title">Thêm khu vực</h2>
      <form id="area-form" class="admin-form-grid">
        <label class="admin-field">Tỉnh / thành phố<input name="tinh" maxlength="80" required><small data-error="tinh"></small></label>
        <label class="admin-field">Quận / huyện<input name="quan_huyen" maxlength="80" required><small data-error="quan_huyen"></small></label>
        <label class="admin-field">Phường / xã<input name="phuong_xa" maxlength="80" required><small data-error="phuong_xa"></small></label>
        <label class="admin-field">Khoảng cách (km)<input name="khoang_cach_km" type="number" min="0" max="999.9" step="0.1" required><small data-error="khoang_cach_km"></small></label>
        <label class="admin-field"><span>Hỗ trợ giao hàng</span><select name="ho_tro"><option value="1">Có</option><option value="0">Không</option></select></label>
        <div class="admin-form-actions admin-field--wide"><button id="area-cancel" class="admin-button" type="button">Hủy</button>
          <button id="area-save" class="ms-btn ms-btn--green" type="submit">Lưu khu vực</button></div>
      </form></section>
    <div id="area-table-wrap"></div>`;
  qs('#area-create').addEventListener('click', () => openForm());
  qs('#area-cancel').addEventListener('click', closeForm);
  qs('#area-form').addEventListener('submit', save);
  qs('#area-table-wrap').addEventListener('click', handleTableClick);
  renderTable();
}

function renderTable() {
  const rows = areas.map((area) => `<tr><td>${escapeHtml(area.tinh)}</td><td>${escapeHtml(area.quan_huyen)}</td>
    <td>${escapeHtml(area.phuong_xa)}</td><td>${Number(area.khoang_cach_km).toFixed(1)} km</td>
    <td><span class="admin-status${Number(area.ho_tro) ? '' : ' is-hidden'}">${Number(area.ho_tro) ? 'Đang hỗ trợ' : 'Tạm ngưng'}</span></td>
    <td class="admin-table-actions"><button class="admin-button" type="button" data-edit="${Number(area.id)}">Sửa</button>
      <button class="admin-button" type="button" data-toggle="${Number(area.id)}" data-status="${Number(area.ho_tro) ? 0 : 1}">${Number(area.ho_tro) ? 'Tạm ngưng' : 'Kích hoạt'}</button></td></tr>`).join('');
  qs('#area-table-wrap').innerHTML = rows
    ? `<div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Tỉnh / thành phố</th><th>Quận / huyện</th><th>Phường / xã</th><th>Khoảng cách</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : '<div class="ms-state"><strong>Chưa có khu vực giao hàng</strong>Thêm khu vực để khách hàng có thể chọn giao hàng.</div>';
}

function openForm(area = null) {
  editingId = area ? Number(area.id) : null;
  const form = qs('#area-form');
  form.reset();
  form.querySelectorAll('[data-error]').forEach((node) => { node.textContent = ''; });
  if (area) {
    Object.entries(area).forEach(([key, value]) => {
      if (form.elements[key]) form.elements[key].value = String(value ?? '');
    });
  } else {
    form.elements.ho_tro.value = '1';
  }
  qs('#area-form-title').textContent = editingId ? 'Cập nhật khu vực' : 'Thêm khu vực';
  qs('#area-save').textContent = editingId ? 'Cập nhật' : 'Lưu khu vực';
  qs('#area-form-panel').hidden = false;
  form.elements.tinh.focus();
}

function closeForm() {
  qs('#area-form-panel').hidden = true;
  editingId = null;
}

function handleTableClick(event) {
  const edit = event.target.closest('[data-edit]');
  const toggle = event.target.closest('[data-toggle]');
  if (edit) openForm(areas.find((area) => Number(area.id) === Number(edit.dataset.edit)));
  if (toggle) updateStatus(toggle);
}

async function save(event) {
  event.preventDefault();
  if (saving) return;
  const form = event.currentTarget;
  const data = new FormData(form);
  const payload = {
    tinh: String(data.get('tinh') || '').trim(),
    quan_huyen: String(data.get('quan_huyen') || '').trim(),
    phuong_xa: String(data.get('phuong_xa') || '').trim(),
    khoang_cach_km: Number(data.get('khoang_cach_km')),
    ho_tro: Number(data.get('ho_tro')),
  };
  form.querySelectorAll('[data-error]').forEach((node) => { node.textContent = ''; });
  saving = true;
  qs('#area-save').disabled = true;
  try {
    await (editingId
      ? api.put(`/admin/delivery-areas/${editingId}`, payload)
      : api.post('/admin/delivery-areas', payload));
    toast(editingId ? 'Đã cập nhật khu vực giao hàng' : 'Đã thêm khu vực giao hàng');
    closeForm();
    await load();
  } catch (error) {
    if (error instanceof ApiError && error.errors) {
      Object.entries(error.errors).forEach(([field, message]) => {
        const target = form.querySelector(`[data-error="${field}"]`);
        if (target && typeof message === 'string') target.textContent = message;
      });
    }
    toast(error.message || 'Không thể lưu khu vực giao hàng.', 'error');
  } finally {
    saving = false;
    const button = qs('#area-save');
    if (button) button.disabled = false;
  }
}

async function updateStatus(button) {
  const id = Number(button.dataset.toggle);
  button.disabled = true;
  try {
    await api.patch(`/admin/delivery-areas/${id}/status`, {
      ho_tro: Number(button.dataset.status),
    });
    toast('Đã cập nhật trạng thái khu vực');
    await load();
  } catch (error) {
    toast(error.message || 'Không thể cập nhật trạng thái.', 'error');
  } finally {
    const current = root.querySelector(`[data-toggle="${id}"]`);
    if (current) current.disabled = false;
  }
}

async function load() {
  const data = await api.get('/admin/delivery-areas');
  if (!Array.isArray(data.areas)) throw new Error('Dữ liệu khu vực giao hàng không hợp lệ.');
  areas = data.areas;
  if (!qs('#area-table-wrap')) render();
  else renderTable();
}

root.innerHTML = '<div class="admin-table-skeleton"></div>';
load().catch((error) => {
  root.innerHTML = `<div class="ms-state"><strong>Không tải được khu vực giao hàng</strong>${escapeHtml(error.message)}</div>`;
});
