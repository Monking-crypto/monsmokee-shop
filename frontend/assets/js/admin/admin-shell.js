(() => {
  const TITLES = {
    overview: 'Tổng quan',
    categories: 'Danh mục',
    products: 'Sản phẩm',
    promotions: 'Khuyến mãi',
    orders: 'Đơn hàng',
    'order-detail': 'Chi tiết đơn hàng',
    'stock-in': 'Nhập hàng',
    'stock-history': 'Lịch sử kho',
    'stock-alerts': 'Cảnh báo kho',
    'delivery-areas': 'Khu vực giao hàng',
    customers: 'Khách hàng',
    statistics: 'Thống kê',
    account: 'Tài khoản',
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
  const page = document.body.dataset.page || 'overview';
  const title = TITLES[page] || 'Quản trị';
  const active = page === 'order-detail' ? 'orders' : page;
  const stockOpen = page.startsWith('stock-');

  const navigation = NAV.map(([key, label, href, icon]) => {
    if (key === 'stock') {
      return `<li class="admin-nav-group"><button class="admin-nav-group__toggle${active.startsWith('stock-') ? ' is-active' : ''}" type="button" aria-expanded="${stockOpen}" aria-controls="admin-stock-nav"><i class="bi bi-${icon}" aria-hidden="true"></i><span>${label}</span><i class="bi bi-chevron-down admin-nav-group__chevron" aria-hidden="true"></i></button>
        <ul class="admin-subnav" id="admin-stock-nav" ${stockOpen ? '' : 'hidden'}>${STOCK_NAV.map(([childKey, childLabel, childHref]) =>
          `<li><a class="${active === childKey ? 'is-active' : ''}" href="${childHref}">${childLabel}</a></li>`).join('')}</ul></li>`;
    }
    const badge = key === 'orders'
      ? '<span id="admin-pending-count" class="admin-nav-badge" aria-label="Đơn hàng chờ xử lý" hidden></span>'
      : '';
    return `<li><a class="${active === key ? 'is-active' : ''}" href="${href}"><i class="bi bi-${icon}" aria-hidden="true"></i><span>${label}</span>${badge}</a></li>`;
  }).join('');

  const shell = `<div class="admin-shell">
    <div class="admin-scrim" id="admin-scrim"></div>
    <aside class="admin-sidebar" id="admin-sidebar">
      <a class="admin-brand" href="index.html"><img src="../assets/img/logo.svg" alt="MON SMOKEE"><span>QUẢN TRỊ</span></a>
      <nav aria-label="Điều hướng quản trị"><ul>${navigation}</ul></nav>
    </aside>
    <div class="admin-main">
      <header class="admin-topbar">
        <button id="admin-menu-toggle" class="admin-icon-btn" type="button" aria-label="Mở menu" aria-expanded="false"><i class="bi bi-list" aria-hidden="true"></i></button>
        <div><h1>${title}</h1><p>MON SMOKEE / ${title}</p></div>
        <form id="admin-quick-search" class="admin-quick-search" role="search">
          <i class="bi bi-search" aria-hidden="true"></i>
          <input type="search" aria-label="Tìm nhanh sản phẩm" placeholder="Tìm nhanh sản phẩm">
        </form>
        <span class="admin-role" id="admin-role-name">Quản trị tối cao</span>
        <button id="admin-logout" class="admin-logout" type="button"><i class="bi bi-box-arrow-right" aria-hidden="true"></i> Đăng xuất</button>
      </header>
      <main class="admin-content" id="admin-page-content" aria-busy="true">
        <div class="admin-shell-loading" role="status" aria-label="Đang tải nội dung quản trị">
          <span class="admin-shell-loading__title"></span><span class="admin-shell-loading__filter"></span><span class="admin-shell-loading__panel"></span>
        </div>
      </main>
    </div>
  </div>`;
  document.currentScript.insertAdjacentHTML('beforebegin', shell);
  window.MSAdminShell = { page, title };
})();
