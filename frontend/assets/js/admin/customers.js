import { api } from '../core/api.js';
import { escapeHtml, notImplemented, qs } from '../core/ui.js';
import { formatDate, formatVnd, normalizeKeyword } from '../core/format.js';

const root = qs('#admin-page-content');
let customers = [];

function render() {
  const query = qs('#customer-search')?.value.trim().toLocaleLowerCase('vi') || '';
  const filtered = customers.filter((customer) =>
    normalizeKeyword(`${customer.ho_ten} ${customer.so_dien_thoai}`).includes(normalizeKeyword(query)));
  root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Khách hàng</div>
    <section class="admin-kpis admin-customer-kpis">
      <article class="admin-kpi"><div><span>Tổng khách hàng mẫu</span><strong>${customers.length}</strong></div></article>
      <article class="admin-kpi"><div><span>Đã mua hàng</span><strong>${customers.filter((customer) => customer.so_don > 0).length}</strong></div></article>
      <article class="admin-kpi"><div><span>Tổng doanh thu mẫu</span><strong>${formatVnd(customers.reduce((sum, customer) => sum + customer.tong_chi, 0))}</strong></div></article>
    </section>
    <div class="admin-toolbar"><p>Danh sách khách hàng được tổng hợp từ các đơn hàng mẫu.</p>
      <button id="customer-export" class="admin-button" type="button">Xuất danh sách</button></div>
    <div class="admin-toolbar"><input id="customer-search" type="search" value="${escapeHtml(query)}" placeholder="Tìm theo tên hoặc số điện thoại" aria-label="Tìm khách hàng">
      <span>${filtered.length} khách hàng</span></div>
    ${filtered.length ? `<div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Khách hàng</th><th>Số điện thoại</th><th>Số đơn</th><th>Tổng mua</th><th>Đơn gần nhất</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
      <tbody>${filtered.map((customer) => `<tr><td>${escapeHtml(customer.ho_ten)}</td><td>${escapeHtml(customer.so_dien_thoai)}</td>
        <td>${customer.so_don}</td><td>${formatVnd(customer.tong_chi)}</td><td>${customer.last_order ? formatDate(customer.last_order, true) : '—'}</td>
        <td><span class="admin-status">${customer.so_don ? 'Đang hoạt động' : 'Chưa mua hàng'}</span></td>
        <td class="admin-table-actions"><button class="admin-button" type="button" data-customer-action>Hồ sơ</button><button class="admin-button" type="button" data-customer-action>Khóa</button></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="ms-state"><strong>Không tìm thấy khách hàng</strong>Thử tìm theo tên hoặc số điện thoại khác.</div>'}`;
  qs('#customer-search').addEventListener('input', (event) => {
    const value = event.currentTarget.value;
    const selection = event.currentTarget.selectionStart;
    render();
    const input = qs('#customer-search');
    input.focus();
    input.setSelectionRange(selection, selection);
  });
  qs('#customer-export').addEventListener('click', () => notImplemented());
  root.querySelectorAll('[data-customer-action]').forEach((button) => button.addEventListener('click', () => notImplemented()));
}

async function load() {
  root.innerHTML = '<div class="admin-table-skeleton"></div>';
  try {
    const result = await api.get('/admin/orders?page=1&per_page=20');
    const grouped = new Map();
    result.items.forEach((order) => {
      const key = order.khach_hang.so_dien_thoai;
      const customer = grouped.get(key) || { ...order.khach_hang, so_don: 0, tong_chi: 0, last_order: null };
      customer.so_don += 1;
      customer.tong_chi += Number(order.tong) || 0;
      if (!customer.last_order || order.created_at > customer.last_order) customer.last_order = order.created_at;
      grouped.set(key, customer);
    });
    customers = [...grouped.values()].sort((a, b) => b.tong_chi - a.tong_chi);
    render();
  } catch (error) {
    root.innerHTML = `<div class="ms-state"><strong>Không tải được khách hàng</strong>${escapeHtml(error.message)}</div>`;
  }
}

await load();
