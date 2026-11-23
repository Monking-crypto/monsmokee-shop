// dashboard.js - tổng quan doanh thu, đơn hàng và cảnh báo kho
import { api } from '../core/api.js';
import { escapeHtml, qs } from '../core/ui.js';
import { formatDate, formatVnd } from '../core/format.js';

const root = qs('#admin-page-content');
const orderLabels = {
  cho_xu_ly: 'Chờ xử lý', dang_giao: 'Đang giao', cho_lay_hang: 'Chờ lấy hàng',
  thanh_cong: 'Thành công', da_huy: 'Đã hủy',
};

function renderSkeleton() {
  root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Tổng quan</div>
    <div class="admin-kpis">${Array.from({ length: 6 }, () => '<div class="admin-kpi admin-kpi--skeleton"></div>').join('')}</div>
    <div class="admin-dashboard-grid"><div class="admin-panel admin-chart-skeleton"></div><div class="admin-panel admin-chart-skeleton"></div>
      <div class="admin-panel admin-chart-skeleton"></div><div class="admin-panel admin-chart-skeleton"></div></div>`;
}

function render(data) {
  const kpi = data.kpi || {};
  const metrics = [
    ['Doanh thu hôm nay', formatVnd(kpi.doanh_thu_hom_nay), 'bi-currency-exchange'],
    ['Doanh thu tháng', formatVnd(kpi.doanh_thu_thang), 'bi-calendar-month'],
    ['Đơn chờ xử lý', Number(kpi.don_cho_xu_ly) || 0, 'bi-receipt'],
    ['Đơn chờ lấy hàng', Number(kpi.don_cho_lay_hang) || 0, 'bi-shop'],
    ['Sản phẩm sắp hết', Number(kpi.san_pham_sap_het) || 0, 'bi-exclamation-triangle'],
    ['Sản phẩm cận hạn', Number(kpi.san_pham_can_han) || 0, 'bi-hourglass-split'],
  ];
  const orders = data.don_hang_moi || [];
  const low = data.canh_bao_kho?.sap_het || [];
  const expiring = data.canh_bao_kho?.can_han || [];
  const promo = data.khuyen_mai || {};
  root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Tổng quan</div>
    <section class="admin-kpis">${metrics.map(([label, value, icon]) => `<article class="admin-kpi">
      <span class="admin-kpi__icon"><i class="bi ${icon}" aria-hidden="true"></i></span><div><span>${label}</span><strong>${value}</strong></div>
    </article>`).join('')}</section>
    <div class="admin-dashboard-grid">
      <section class="admin-panel admin-chart-panel"><h2>Doanh thu 7 ngày</h2>
        ${data.doanh_thu_7_ngay?.length ? '<canvas id="revenue-chart" aria-label="Biểu đồ doanh thu 7 ngày"></canvas>' : '<div class="admin-empty">Chưa có dữ liệu doanh thu.</div>'}</section>
      <section class="admin-panel admin-chart-panel"><h2>Top 5 bán chạy</h2>
        ${data.top_ban_chay?.length ? '<canvas id="top-products-chart" aria-label="Biểu đồ top 5 sản phẩm"></canvas>' : '<div class="admin-empty">Chưa có dữ liệu sản phẩm bán chạy.</div>'}</section>
      <section class="admin-panel admin-panel--wide"><div class="admin-panel__head"><h2>10 đơn hàng mới nhất</h2><a href="don-hang.html">Xem tất cả</a></div>
        ${orders.length ? `<div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Hình thức</th><th>Tổng</th><th>Trạng thái</th><th>Ngày tạo</th></tr></thead><tbody>
          ${orders.map((order) => `<tr><td><a href="chi-tiet-don-hang.html?id=${encodeURIComponent(order.id)}">${escapeHtml(order.ma_don_hang)}</a></td>
            <td>${escapeHtml(order.khach_hang?.ho_ten || '')}</td><td>${order.hinh_thuc_nhan === 'click_collect' ? 'Nhận tại cửa hàng' : 'COD'}</td>
            <td>${formatVnd(order.tong)}</td><td><span class="admin-status admin-status--${escapeHtml(order.trang_thai)}">${escapeHtml(orderLabels[order.trang_thai] || order.trang_thai)}</span></td><td>${formatDate(order.created_at, true)}</td></tr>`).join('')}
        </tbody></table></div>` : '<div class="admin-empty">Chưa có đơn hàng.</div>'}</section>
      <section class="admin-panel"><h2>Cảnh báo kho</h2>
        <h3>Sắp hết hàng</h3>${low.length ? `<ul class="admin-alert-list">${low.map((product) => `<li><span>${escapeHtml(product.ten_san_pham)}</span><strong>Còn ${Number(product.so_luong_ton) || 0}</strong></li>`).join('')}</ul>` : '<p class="admin-empty">Không có sản phẩm sắp hết.</p>'}
        <h3>Cận hạn (≤10 ngày)</h3>${expiring.length ? `<ul class="admin-alert-list">${expiring.map((product) => `<li><span>${escapeHtml(product.ten_san_pham)} <small>HSD ${formatDate(product.hsd)}</small></span><strong>${Number(product.near_expiry_days)} ngày</strong></li>`).join('')}</ul>` : '<p class="admin-empty">Không có hàng cận hạn.</p>'}</section>
      <section class="admin-panel"><h2>Khuyến mãi</h2><div class="admin-promo-status">
        <strong>${escapeHtml(promo.ten || 'Siêu sale Thứ 6')}</strong>
        <span class="${promo.dang_chay ? 'is-running' : ''}">${promo.dang_chay ? 'Đang chạy hôm nay' : 'Chưa tới Thứ 6'}</span>
      </div><a class="admin-button" href="khuyen-mai.html">Quản lý khuyến mãi</a></section>
    </div>`;
  drawCharts(data);
}

function drawCharts(data) {
  const Chart = window.Chart;
  if (!Chart) {
    root.querySelectorAll('.admin-chart-panel').forEach((panel) => {
      panel.querySelector('canvas')?.remove();
      panel.insertAdjacentHTML('beforeend', '<p class="admin-empty">Không tải được thư viện biểu đồ.</p>');
    });
    return;
  }
  const revenue = data.doanh_thu_7_ngay || [];
  if (revenue.length) new Chart(qs('#revenue-chart'), {
    type: 'line',
    data: { labels: revenue.map((item) => formatDate(item.ngay)), datasets: [{ label: 'Doanh thu', data: revenue.map((item) => item.doanh_thu), borderColor: '#1e9e4a', backgroundColor: 'rgba(30,158,74,.12)', fill: true, tension: .3 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: (value) => `${Number(value).toLocaleString('vi-VN')}đ` } } } },
  });
  const best = data.top_ban_chay || [];
  if (best.length) new Chart(qs('#top-products-chart'), {
    type: 'bar',
    data: { labels: best.map((item) => item.ten_san_pham), datasets: [{ label: 'Đã bán', data: best.map((item) => item.luot_ban), backgroundColor: '#2fbf6a', borderRadius: 6 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } },
  });
}

async function load() {
  renderSkeleton();
  try { render(await api.get('/admin/dashboard')); }
  catch (error) {
    root.innerHTML = `<div class="ms-state"><strong>Không tải được tổng quan</strong>${escapeHtml(error.message)}<div class="mt-3"><button id="dashboard-retry" class="admin-button" type="button">Thử lại</button></div></div>`;
    qs('#dashboard-retry').addEventListener('click', load);
  }
}

await load();
