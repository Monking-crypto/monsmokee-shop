// orders.js - danh sách đơn hàng và lọc theo trạng thái
import { api } from '../core/api.js';
import { escapeHtml, qs } from '../core/ui.js';
import { formatDate, formatVnd } from '../core/format.js';

const root = qs('#admin-page-content');
const statuses = [
  ['', 'Tất cả'], ['cho_xu_ly', 'Chờ xử lý'], ['dang_giao', 'Đang giao'],
  ['cho_lay_hang', 'Chờ lấy hàng'], ['thanh_cong', 'Thành công'], ['da_huy', 'Đã hủy'],
];
let status = '';
let query = '';
let page = 1;
let data = { items: [], total: 0 };

function statusName(key) {
  return statuses.find(([value]) => value === key)?.[1] || key;
}

function render() {
  const rows = data.items.map((order) => `<tr>
    <td><a href="chi-tiet-don-hang.html?id=${encodeURIComponent(order.id)}">${escapeHtml(order.ma_don_hang)}</a></td>
    <td>${escapeHtml(order.khach_hang?.ho_ten || '')}<small class="admin-table-sub">${escapeHtml(order.khach_hang?.so_dien_thoai || '')}</small></td>
    <td>${order.hinh_thuc_nhan === 'click_collect' ? 'Nhận tại cửa hàng' : 'COD'}</td>
    <td>${formatVnd(order.tong)}</td>
    <td><span class="admin-status admin-status--${escapeHtml(order.trang_thai)}">${escapeHtml(statusName(order.trang_thai))}</span></td>
    <td>${formatDate(order.created_at, true)}</td>
  </tr>`).join('');
  root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Đơn hàng</div>
    <nav class="admin-tabs" aria-label="Lọc đơn theo trạng thái">${statuses.map(([key, label]) =>
      `<button type="button" class="${status === key ? 'is-active' : ''}" data-status="${key}" aria-pressed="${status === key}">${label}${key === status ? ` (${data.total})` : ''}</button>`).join('')}</nav>
    <form id="order-search" class="admin-toolbar"><div class="admin-filters">
      <input id="order-query" type="search" value="${escapeHtml(query)}" placeholder="Tìm mã đơn hoặc khách hàng" aria-label="Tìm mã đơn hoặc khách hàng">
      <select id="order-method" aria-label="Hình thức nhận"><option value="">Mọi hình thức nhận</option><option value="cod">COD</option><option value="click_collect">Nhận tại cửa hàng</option></select>
    </div><button class="admin-button" type="submit">Tìm kiếm</button></form>
    <div id="order-table-wrap">${rows ? `<div class="admin-table-scroll"><table class="admin-table">
      <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Hình thức nhận</th><th>Tổng tiền</th><th>Trạng thái</th><th>Ngày tạo</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : '<div class="ms-state"><strong>Không có đơn hàng phù hợp</strong>Thử đổi trạng thái hoặc từ khóa tìm kiếm.</div>'}</div>
    <div class="admin-pagination"><span>${data.total} đơn hàng · Trang ${page}/${Math.max(1, Math.ceil(data.total / 20))}</span>
      <div><button class="admin-button" type="button" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Trước</button>
      <button class="admin-button" type="button" data-page="${page + 1}" ${page * 20 >= data.total ? 'disabled' : ''}>Sau</button></div></div>`;
  qs('#order-method').value = method;
  root.querySelector('#order-search').addEventListener('submit', (event) => {
    event.preventDefault();
    query = qs('#order-query').value.trim();
    method = qs('#order-method').value;
    page = 1;
    load();
  });
  root.querySelectorAll('[data-status]').forEach((button) => button.addEventListener('click', () => {
    status = button.dataset.status; page = 1; load();
  }));
  root.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => {
    page = Number(button.dataset.page); load();
  }));
}

let method = '';
async function load() {
  root.innerHTML = '<div class="admin-table-skeleton"></div>';
  const params = new URLSearchParams({ page: String(page), per_page: '20' });
  if (status) params.set('status', status);
  if (query) params.set('q', query);
  if (method) params.set('method', method);
  try { data = await api.get(`/admin/orders?${params}`); render(); }
  catch (error) {
    root.innerHTML = `<div class="ms-state"><strong>Không tải được đơn hàng</strong>${escapeHtml(error.message)}<div class="mt-3"><button id="order-retry" class="admin-button" type="button">Thử lại</button></div></div>`;
    qs('#order-retry').addEventListener('click', load);
  }
}

await load();
