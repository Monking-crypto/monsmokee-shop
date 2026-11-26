// admin-layout.js - khung dùng chung cho toàn bộ trang quản trị
import { requireAdmin } from '../core/guard.js';
import { api } from '../core/api.js';
import { escapeHtml, qs, toast } from '../core/ui.js';

const TITLES = {
  overview: 'Tổng quan', categories: 'Danh mục', products: 'Sản phẩm', promotions: 'Khuyến mãi',
  orders: 'Đơn hàng', 'order-detail': 'Chi tiết đơn hàng', 'stock-in': 'Nhập hàng',
  'stock-history': 'Lịch sử kho', 'stock-alerts': 'Cảnh báo kho', 'delivery-areas': 'Khu vực giao hàng', customers: 'Khách hàng',
  statistics: 'Thống kê', account: 'Tài khoản',
};
const NAV = [
  ['overview', 'Tổng quan', 'index.html', 'speedometer2'],
  ['categories', 'Danh mục', 'danh-muc.html', 'grid'],
  ['products', 'Sản phẩm', 'san-pham.html', 'box-seam'],
  ['promotions', 'Khuyến mãi', 'khuyen-mai.html', 'tags'],
  ['delivery-areas', 'Khu vực giao hàng', 'khu-vuc-giao.html', 'geo-alt'],
  ['orders', 'Đơn hàng', 'don-hang.html', 'receipt'],
  ['stock', 'Kho', '', 'archive'],
  ['customers', 'Khách hàng', 'khach-hang.html', 'people'],
  ['statistics', 'Thống kê', 'thong-ke.html', 'bar-chart'],
  ['account', 'Tài khoản', 'tai-khoan.html', 'person-gear'],
];
const STOCK_NAV = [
  ['stock-in', 'Nhập hàng', 'kho-nhap-hang.html'],
  ['stock-history', 'Lịch sử kho', 'kho-lich-su.html'],
  ['stock-alerts', 'Cảnh báo kho', 'kho-canh-bao.html'],
];
const STEPS = {
  overview: ['Tổng hợp doanh thu, đơn hàng, tồn kho và cảnh báo.', 'Hiển thị biểu đồ thống kê và các đơn mới nhất.'],
  categories: ['Xem danh sách danh mục.', 'Thêm, sửa và ẩn hoặc hiện danh mục.'],
  orders: ['Tìm và lọc đơn hàng.', 'Xem chi tiết, xác nhận hoặc cập nhật trạng thái đơn.', 'Gửi thông tin trạng thái cho khách hàng.'],
  'order-detail': ['Kiểm tra thông tin khách và địa chỉ nhận hàng.', 'Xem các dòng sản phẩm, số lượng, giá và tổng tiền.', 'Cập nhật trạng thái đơn và lịch sử xử lý.'],
  'stock-in': ['Tạo phiếu nhập hàng và chọn nhà cung cấp.', 'Thêm sản phẩm, số lượng, giá nhập và hạn sử dụng.', 'Xác nhận phiếu nhập để cập nhật tồn kho.'],
  'stock-history': ['Lọc phiếu nhập, xuất và điều chỉnh tồn.', 'Xem chi tiết người thao tác và thời gian.', 'Đối chiếu lịch sử với số tồn hiện tại.'],
  'stock-alerts': ['Theo dõi sản phẩm sắp hết hàng.', 'Theo dõi các lô hàng sắp hết hạn.', 'Lập phiếu nhập hoặc xử lý hàng cận hạn.'],
  customers: ['Tìm khách hàng theo tên, số điện thoại hoặc email.', 'Xem hồ sơ, đơn hàng và lịch sử mua.', 'Khóa hoặc mở tài khoản khi cần.'],
  statistics: ['Chọn khoảng thời gian báo cáo.', 'Xem doanh thu, đơn hàng và sản phẩm bán chạy.', 'Xuất hoặc đối chiếu báo cáo.'],
  account: ['Xem thông tin tài khoản quản trị.', 'Đăng xuất an toàn khỏi phiên hiện tại.'],
};
const USE_CASES = {
  overview: 'QT12', categories: 'UC06/QT13', products: 'UC07/QT13', promotions: 'UC12/QT13',
  orders: 'UC08/QT14', 'order-detail': 'UC08/QT14', 'stock-in': 'UC09/QT14-15',
  'stock-history': 'UC09/QT14-15', 'stock-alerts': 'UC09/QT14-15',
  customers: 'UC10', statistics: 'UC11/QT15', account: 'QT12',
};

const page = document.body.dataset.page || 'overview';
const title = TITLES[page] || 'Quản trị';

const adminUser = await requireAdmin();
if (adminUser) {
  let redirectingToLogin = false;
  const redirectToLogin = () => {
    if (redirectingToLogin) return;
    redirectingToLogin = true;
    const target = `${location.pathname.split('/').pop()}${location.search}`;
    location.replace(`login.html?${new URLSearchParams({ redirect: target, auth_required: '1' })}`);
  };
  window.addEventListener('ms:admin-session-expired', redirectToLogin, { once: true });
  document.title = `${title} - MON SMOKEE`;
  const active = page === 'order-detail' ? 'orders' : page;
  document.body.innerHTML = `<div class="admin-shell">
    <div class="admin-scrim" id="admin-scrim"></div>
    <aside class="admin-sidebar" id="admin-sidebar">
      <a class="admin-brand" href="index.html"><img src="../assets/img/logo.svg" alt="MON SMOKEE"><span>QUẢN TRỊ</span></a>
      <nav aria-label="Điều hướng quản trị"><ul>${NAV.map(([key, label, href, icon]) => key === 'stock'
        ? `<li class="admin-nav-group"><button class="admin-nav-group__toggle${active.startsWith('stock-') ? ' is-active' : ''}" type="button" aria-expanded="${active.startsWith('stock-')}"><i class="bi bi-${icon}" aria-hidden="true"></i><span>${label}</span><i class="bi bi-chevron-down admin-nav-group__chevron" aria-hidden="true"></i></button>
          <ul class="admin-subnav" ${active.startsWith('stock-') ? '' : 'hidden'}>${STOCK_NAV.map(([childKey, childLabel, childHref]) =>
            `<li><a class="${active === childKey ? 'is-active' : ''}" href="${childHref}">${childLabel}</a></li>`).join('')}</ul></li>`
        : `<li><a class="${active === key ? 'is-active' : ''}" href="${href}"><i class="bi bi-${icon}" aria-hidden="true"></i><span>${label}</span>${key === 'orders' ? '<span id="admin-pending-count" class="admin-nav-badge" hidden></span>' : ''}</a></li>`).join('')}</ul></nav>
    </aside>
    <div class="admin-main">
      <header class="admin-topbar"><button id="admin-menu-toggle" class="admin-icon-btn" type="button" aria-label="Mở menu"><i class="bi bi-list"></i></button>
        <div><h1>${escapeHtml(title)}</h1><p>MON SMOKEE / ${escapeHtml(title)}</p></div>
        <form id="admin-quick-search" class="admin-quick-search" role="search">
          <i class="bi bi-search" aria-hidden="true"></i>
          <input type="search" aria-label="Tìm nhanh sản phẩm" placeholder="Tìm nhanh sản phẩm">
        </form>
        <span class="admin-role" id="admin-role-name">${escapeHtml(typeof adminUser === 'object' ? (adminUser.ho_ten || 'Quản trị tối cao') : 'Quản trị tối cao')}</span>
        <button id="admin-logout" class="admin-logout" type="button"><i class="bi bi-box-arrow-right"></i> Đăng xuất</button></header>
      <main class="admin-content" id="admin-page-content"></main>
    </div>
  </div>`;
  const content = qs('#admin-page-content');
  if (page === 'overview') await import('./dashboard.js');
  else if (page === 'categories') await import('./categories.js');
  else if (page === 'products') await import('./products.js');
  else if (page === 'promotions') await import('./promotions.js');
  else if (page === 'delivery-areas') await import('./delivery-areas.js');
  else if (page === 'orders') await import('./orders.js');
  else if (page === 'order-detail') await import('./order-detail.js');
  else if (page.startsWith('stock-')) await import('./inventory.js');
  else if (page === 'customers') await import('./customers.js');
  else if (page === 'statistics') await import('./statistics.js');
  else if (page === 'account') await import('./account.js');
  else {
    const steps = STEPS[page] || STEPS.overview;
    content.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> ${escapeHtml(title)}</div>
      <section class="admin-placeholder"><i class="bi bi-cone-striped" aria-hidden="true"></i><h2>Đang phát triển</h2>
        <p>${escapeHtml(USE_CASES[page] || '')} · Các bước dự kiến:</p><ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol></section>`;
  }
  window.addEventListener('ms:admin-profile-updated', (event) => {
    const name = event.detail?.ho_ten?.trim();
    if (name) qs('#admin-role-name').textContent = name;
  });
  const shell = qs('.admin-shell'), sidebar = qs('#admin-sidebar'), scrim = qs('#admin-scrim');
  qs('.admin-nav-group__toggle').addEventListener('click', (event) => {
    const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
    event.currentTarget.setAttribute('aria-expanded', String(!expanded));
    event.currentTarget.nextElementSibling.hidden = expanded;
  });
  const toggle = () => {
    if (window.matchMedia('(min-width: 901px)').matches) {
      sidebar.classList.toggle('is-collapsed');
      shell.classList.toggle('is-collapsed');
    } else {
      sidebar.classList.toggle('is-open');
      scrim.classList.toggle('is-visible');
    }
  };
  qs('#admin-menu-toggle').addEventListener('click', toggle);
  scrim.addEventListener('click', toggle);
  qs('#admin-quick-search').addEventListener('submit', (event) => {
    event.preventDefault();
    const query = event.currentTarget.querySelector('input').value.trim();
    location.assign(`san-pham.html${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  });
  try {
    const pending = await api.get('/admin/orders?status=cho_xu_ly&page=1&per_page=1');
    const badge = qs('#admin-pending-count');
    if (pending.total) { badge.textContent = pending.total > 99 ? '99+' : pending.total; badge.hidden = false; }
  } catch (error) {
    if (error?.status === 0) toast('Không tải được số đơn chờ xử lý.', 'error');
  }
  qs('#admin-logout').addEventListener('click', async () => {
    const button = qs('#admin-logout');
    button.disabled = true;
    try {
      await api.post('/admin/auth/logout');
      toast('Đã đăng xuất');
      redirectToLogin();
    } catch (error) {
      if (error?.status === 401) {
        redirectToLogin();
        return;
      }
      toast(error?.message || 'Không thể đăng xuất. Vui lòng thử lại.', 'error');
      button.disabled = false;
    }
  });
}
