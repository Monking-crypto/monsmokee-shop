import { api } from '../core/api.js';
import { escapeHtml, notImplemented, qs } from '../core/ui.js';
import { formatDate, formatVnd } from '../core/format.js';

const root = qs('#admin-page-content');
let report;
let charts = [];

function render(days = 7) {
  const revenue = days === 30 ? report.doanh_thu_30_ngay : report.doanh_thu_7_ngay;
  const completed = report.don_hang_moi.filter((order) => order.trang_thai === 'thanh_cong');
  root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Thống kê</div>
    <div class="admin-toolbar admin-report-toolbar"><div><p>Báo cáo doanh thu và hoạt động bán hàng mẫu.</p>
      <label class="admin-field">Khoảng thời gian<select id="report-range"><option value="7" ${days === 7 ? 'selected' : ''}>7 ngày gần nhất</option><option value="30" ${days === 30 ? 'selected' : ''}>30 ngày gần nhất</option></select></label></div>
      <button id="report-export" class="admin-button" type="button">Xuất báo cáo</button></div>
    <section class="admin-kpis admin-report-kpis">
      <article class="admin-kpi"><div><span>Doanh thu hôm nay</span><strong>${formatVnd(report.kpi.doanh_thu_hom_nay)}</strong></div></article>
      <article class="admin-kpi"><div><span>Doanh thu tháng</span><strong>${formatVnd(report.kpi.doanh_thu_thang)}</strong></div></article>
      <article class="admin-kpi"><div><span>Đơn chờ xử lý</span><strong>${Number(report.kpi.don_cho_xu_ly) || 0}</strong></div></article>
      <article class="admin-kpi"><div><span>Đơn hoàn thành mẫu</span><strong>${completed.length}</strong></div></article>
    </section>
    <div class="admin-dashboard-grid">
      <section class="admin-panel admin-chart-panel"><h2>Doanh thu theo ngày</h2><canvas id="report-revenue" aria-label="Biểu đồ doanh thu theo ngày"></canvas></section>
      <section class="admin-panel admin-chart-panel"><h2>Top 5 sản phẩm bán chạy</h2><canvas id="report-products" aria-label="Biểu đồ sản phẩm bán chạy"></canvas></section>
      <section class="admin-panel admin-panel--wide"><div class="admin-panel__head"><h2>Chi tiết doanh thu</h2><span>${revenue.length} ngày</span></div>
        <div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Ngày</th><th>Doanh thu</th></tr></thead>
          <tbody>${[...revenue].reverse().map((entry) => `<tr><td>${formatDate(entry.ngay)}</td><td>${formatVnd(entry.doanh_thu)}</td></tr>`).join('')}</tbody></table></div></section>
    </div>`;
  qs('#report-range').addEventListener('change', (event) => render(Number(event.currentTarget.value)));
  qs('#report-export').addEventListener('click', () => notImplemented());
  charts.forEach((chart) => chart.destroy());
  charts = [];
  if (!window.Chart) {
    root.querySelectorAll('.admin-chart-panel').forEach((panel) => panel.insertAdjacentHTML('beforeend', '<p class="admin-empty">Không tải được thư viện biểu đồ.</p>'));
    return;
  }
  charts.push(new window.Chart(qs('#report-revenue'), {
    type: 'line',
    data: { labels: revenue.map((entry) => formatDate(entry.ngay)), datasets: [{ label: 'Doanh thu', data: revenue.map((entry) => entry.doanh_thu), borderColor: '#1e9e4a', backgroundColor: 'rgba(30,158,74,.12)', fill: true, tension: .3 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  }));
  charts.push(new window.Chart(qs('#report-products'), {
    type: 'bar',
    data: { labels: report.top_ban_chay.map((entry) => entry.ten_san_pham), datasets: [{ label: 'Đã bán', data: report.top_ban_chay.map((entry) => entry.luot_ban), backgroundColor: '#2fbf6a', borderRadius: 6 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } },
  }));
}

root.innerHTML = '<div class="admin-table-skeleton"></div>';
try {
  report = await api.get('/admin/dashboard');
  render();
} catch (error) {
  root.innerHTML = `<div class="ms-state"><strong>Không tải được báo cáo</strong>${escapeHtml(error.message)}</div>`;
}
