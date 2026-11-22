// order-detail.js - chi tiết và thao tác chuyển trạng thái đơn hàng
import { api, ApiError } from '../core/api.js';
import { escapeHtml, qs, toast } from '../core/ui.js';
import { formatDate, formatVnd } from '../core/format.js';
import { confirmDialog } from '../components/confirm-dialog.js';

const root = qs('#admin-page-content');
const id = new URLSearchParams(location.search).get('id');
const labels = {
  cho_xu_ly: 'Chờ xử lý', dang_giao: 'Đang giao', cho_lay_hang: 'Chờ lấy hàng',
  thanh_cong: 'Thành công', da_huy: 'Đã hủy',
};
let order = null;
let busy = false;

function nextStatus() {
  if (order.hinh_thuc_nhan === 'click_collect') {
    return { cho_xu_ly: 'cho_lay_hang', cho_lay_hang: 'thanh_cong' }[order.trang_thai] || '';
  }
  return { cho_xu_ly: 'dang_giao', dang_giao: 'thanh_cong' }[order.trang_thai] || '';
}

function render() {
  const next = nextStatus();
  root.innerHTML = `<div class="admin-breadcrumb"><a href="don-hang.html">Đơn hàng</a> <span>/</span> ${escapeHtml(order.ma_don_hang)}</div>
    <div class="admin-detail-toolbar"><div><h2>${escapeHtml(order.ma_don_hang)}</h2>
      <span class="admin-status admin-status--${escapeHtml(order.trang_thai)}">${escapeHtml(labels[order.trang_thai] || order.trang_thai)}</span></div>
      <a class="admin-button" href="don-hang.html">Quay lại danh sách</a></div>
    <div class="admin-order-grid">
      <section class="admin-panel"><h3>Thông tin đơn hàng</h3>
        <dl class="admin-definition"><dt>Khách hàng</dt><dd>${escapeHtml(order.khach_hang?.ho_ten || '')}</dd>
          <dt>Số điện thoại</dt><dd>${escapeHtml(order.khach_hang?.so_dien_thoai || '')}</dd>
          <dt>Hình thức nhận</dt><dd>${order.hinh_thuc_nhan === 'click_collect' ? 'Nhận tại cửa hàng' : 'COD'}</dd>
          <dt>Địa chỉ / nơi nhận</dt><dd>${escapeHtml(order.dia_chi || '')}</dd>
          <dt>Giờ hẹn lấy hàng</dt><dd>${order.gio_hen_lay ? formatDate(order.gio_hen_lay, true) : '—'}</dd>
          <dt>Ngày tạo</dt><dd>${formatDate(order.created_at, true)}</dd>
          ${order.ly_do_huy ? `<dt>Lý do hủy</dt><dd>${escapeHtml(order.ly_do_huy)}</dd>` : ''}</dl>
        <div class="admin-order-actions">
          ${next ? `<button id="order-status" class="ms-btn ms-btn--green" type="button" ${busy ? 'disabled' : ''}>${order.trang_thai === 'dang_giao' || order.trang_thai === 'cho_lay_hang' ? 'Hoàn tất đơn hàng' : order.hinh_thuc_nhan === 'cod' ? 'Bắt đầu giao hàng' : 'Chuyển sang chờ lấy hàng'}</button>` : ''}
          ${!['thanh_cong', 'da_huy'].includes(order.trang_thai) ? '<button id="order-cancel" class="admin-button admin-button--danger" type="button">Hủy đơn hàng</button>' : ''}
        </div>
      </section>
      <section class="admin-panel"><h3>Sản phẩm trong đơn</h3>
        <div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Sản phẩm</th><th>Đơn giá</th><th>Số lượng</th><th>Thành tiền</th></tr></thead>
          <tbody>${order.items.map((item) => `<tr><td>${escapeHtml(item.san_pham.ten_san_pham)}</td><td>${formatVnd(item.don_gia)}</td><td>${item.so_luong}</td><td>${formatVnd(item.thanh_tien)}</td></tr>`).join('')}</tbody></table></div>
        <dl class="admin-order-totals"><dt>Tạm tính</dt><dd>${formatVnd(order.tam_tinh)}</dd>
          <dt>Giảm giá</dt><dd>−${formatVnd(order.giam_gia)}</dd>
          <dt>Phí giao hàng</dt><dd>${formatVnd(order.phi_ship)}</dd>
          <dt>Tổng cộng</dt><dd>${formatVnd(order.tong)}</dd></dl>
      </section>
      ${order.hinh_thuc_nhan === 'cod' ? `<form id="shipping-form" class="admin-panel admin-shipping-form">
        <h3>Điều chỉnh phí giao hàng</h3><label class="admin-field">Phí giao hàng (tối đa 100.000đ)
          <input name="phi_ship" type="number" min="0" max="100000" step="1" value="${Number(order.phi_ship) || 0}" required></label>
        <button class="admin-button" type="submit" ${busy ? 'disabled' : ''}>Lưu phí giao hàng</button>
      </form>` : ''}
    </div>`;
  qs('#order-status')?.addEventListener('click', updateStatus);
  qs('#order-cancel')?.addEventListener('click', cancelOrder);
  qs('#shipping-form')?.addEventListener('submit', updateShipping);
}

async function updateStatus() {
  const target = nextStatus();
  const { confirmed } = await confirmDialog({
    title: 'Cập nhật trạng thái đơn hàng?',
    message: `Chuyển đơn ${order.ma_don_hang} từ "${labels[order.trang_thai]}" sang "${labels[target]}"?`,
    confirmText: 'Cập nhật trạng thái',
  });
  if (!confirmed) return;
  busy = true;
  render();
  try { order = await api.patch(`/admin/orders/${id}/status`, { trang_thai: target }); toast('Đã cập nhật trạng thái đơn hàng'); }
  catch (error) { if (error instanceof ApiError && error.status) toast(error.message, 'error'); }
  finally { busy = false; await load(); }
}

async function cancelOrder() {
  const { confirmed, inputValue } = await confirmDialog({
    title: 'Hủy đơn hàng?',
    message: `Nhập lý do hủy đơn ${order.ma_don_hang}.`,
    input: { label: 'Lý do hủy', placeholder: 'Nhập lý do', required: true, maxLength: 240 },
    confirmText: 'Hủy đơn hàng',
  });
  if (!confirmed) return;
  busy = true;
  render();
  try { order = await api.post(`/admin/orders/${id}/cancel`, { ly_do: inputValue.trim() }); toast('Đã hủy đơn hàng'); }
  catch (error) { if (error instanceof ApiError && error.status) toast(error.message, 'error'); }
  finally { busy = false; await load(); }
}

async function updateShipping(event) {
  event.preventDefault();
  const input = event.currentTarget.elements.phi_ship;
  const fee = Number(input.value);
  if (!Number.isInteger(fee) || fee < 0 || fee > 100000) {
    toast('Phí giao hàng phải là số nguyên từ 0 đến 100.000đ.', 'error');
    input.focus();
    return;
  }
  const { confirmed } = await confirmDialog({
    title: 'Điều chỉnh phí giao hàng?',
    message: `Đặt phí giao hàng của đơn ${order.ma_don_hang} thành ${formatVnd(fee)}?`,
    confirmText: 'Lưu phí giao hàng',
  });
  if (!confirmed) return;
  busy = true;
  render();
  try { order = await api.patch(`/admin/orders/${id}/shipping`, { phi_ship: fee }); toast('Đã cập nhật phí giao hàng'); }
  catch (error) { if (error instanceof ApiError && error.status) toast(error.message, 'error'); }
  finally { busy = false; await load(); }
}

async function load() {
  if (!id) {
    root.innerHTML = '<div class="ms-state"><strong>Thiếu mã đơn hàng</strong>Hãy quay lại danh sách đơn hàng.</div>';
    return;
  }
  root.innerHTML = '<div class="admin-table-skeleton"></div>';
  try { order = await api.get(`/admin/orders/${encodeURIComponent(id)}`); render(); }
  catch (error) { root.innerHTML = `<div class="ms-state"><strong>Không tải được đơn hàng</strong>${escapeHtml(error.message)}<div class="mt-3"><a class="admin-button" href="don-hang.html">Quay lại danh sách</a></div></div>`; }
}

await load();
