import { api } from '../core/api.js';
import { escapeHtml, notImplemented, qs } from '../core/ui.js';
import { formatDate, formatVnd, normalizeKeyword } from '../core/format.js';

const root = qs('#admin-page-content');
const page = document.body.dataset.page;

function renderStockIn(products) {
  const today = new Date();
  const dateValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Kho <span>/</span> Nhập hàng</div>
    <section class="admin-panel admin-stock-in">
      <div class="admin-panel__head"><div><h2>Tạo phiếu nhập hàng</h2><p class="admin-muted">Phiếu nhập mẫu — thao tác cập nhật kho đang được phát triển.</p></div>
        <span class="admin-status">Bản nháp</span></div>
      <form id="stock-in-form" class="admin-form-grid">
        <label class="admin-field">Nhà cung cấp<select name="supplier"><option>Nhà cung cấp Minh Anh</option><option>Đại lý Hòa Phát</option><option>Công ty Thực phẩm An Nhiên</option></select></label>
        <label class="admin-field">Ngày nhập<input type="date" name="date" value="${dateValue}"></label>
        <label class="admin-field admin-field--wide">Sản phẩm<select name="product">${products.slice(0, 40).map((product) =>
          `<option value="${product.id}">${escapeHtml(product.ten_san_pham)} — tồn ${Number(product.so_luong_ton) || 0}</option>`).join('')}</select></label>
        <label class="admin-field">Số lượng nhập<input name="quantity" type="number" min="1" value="1"></label>
        <label class="admin-field">Giá nhập / đơn vị<input name="cost" type="number" min="0" step="1000" placeholder="Nhập giá dự kiến"></label>
        <label class="admin-field admin-field--wide">Ghi chú<textarea name="note" rows="3" placeholder="Thông tin lô hàng, hạn sử dụng..."></textarea></label>
        <div class="admin-form-actions admin-field--wide"><button class="ms-btn ms-btn--green" type="submit">Xác nhận nhập kho</button></div>
      </form>
    </section>
    <section class="admin-panel admin-stock-summary"><h2>Tồn kho hiện tại</h2>
      <div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>Tồn kho</th><th>Trạng thái</th></tr></thead>
      <tbody>${products.slice(0, 8).map((product) => `<tr><td>${escapeHtml(product.ten_san_pham)}</td><td>${escapeHtml(product.category_name || '—')}</td>
        <td>${Number(product.so_luong_ton) || 0}</td><td><span class="admin-status ${Number(product.so_luong_ton) <= 10 ? 'is-hidden' : ''}">${Number(product.so_luong_ton) <= 10 ? 'Sắp hết' : 'Đủ hàng'}</span></td></tr>`).join('')}</tbody></table></div></section>`;
  qs('#stock-in-form').addEventListener('submit', (event) => {
    event.preventDefault();
    notImplemented();
  });
}

function renderHistory(products) {
  const now = Date.now();
  const events = products.slice(0, 12).map((product, index) => ({
    id: `PN${String(index + 1).padStart(4, '0')}`,
    type: ['Nhập hàng', 'Điều chỉnh', 'Xuất bán'][index % 3],
    product,
    quantity: index % 3 === 1 ? -2 : 5 + index,
    date: new Date(now - index * 86400000).toISOString(),
    actor: ['Nguyễn Minh Anh', 'Trần Hữu Phúc'][index % 2],
  }));
  root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Kho <span>/</span> Lịch sử kho</div>
    <div class="admin-toolbar"><p>Lịch sử nhập, xuất và điều chỉnh tồn kho mẫu.</p><button id="stock-adjust" class="admin-button" type="button">Điều chỉnh tồn</button></div>
    <form id="stock-history-filter" class="admin-toolbar admin-stock-filters">
      <div class="admin-filters"><select name="type" aria-label="Loại giao dịch"><option value="">Tất cả giao dịch</option><option>Nhập hàng</option><option>Xuất bán</option><option>Điều chỉnh</option></select>
        <input name="query" type="search" aria-label="Tìm sản phẩm" placeholder="Tìm sản phẩm"></div><button class="admin-button" type="submit">Lọc</button>
    </form>
    <div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Mã phiếu</th><th>Loại giao dịch</th><th>Sản phẩm</th><th>Thay đổi</th><th>Người thao tác</th><th>Thời gian</th></tr></thead>
      <tbody id="stock-history-rows">${events.map((event) => `<tr data-stock-event data-type="${event.type}" data-name="${escapeHtml(normalizeKeyword(event.product.ten_san_pham))}">
        <td>${event.id}</td><td>${event.type}</td><td>${escapeHtml(event.product.ten_san_pham)}</td><td>${event.quantity > 0 ? '+' : ''}${event.quantity}</td>
        <td>${event.actor}</td><td>${formatDate(event.date, true)}</td></tr>`).join('')}</tbody></table></div>
    <div class="admin-pagination"><span>${events.length} giao dịch mẫu</span></div>`;
  qs('#stock-adjust').addEventListener('click', () => notImplemented());
  qs('#stock-history-filter').addEventListener('submit', (event) => {
    event.preventDefault();
    const type = event.currentTarget.elements.type.value;
    const query = normalizeKeyword(event.currentTarget.elements.query.value);
    root.querySelectorAll('[data-stock-event]').forEach((row) => {
      row.hidden = (type && row.dataset.type !== type) || (query && !row.dataset.name.includes(query));
    });
  });
}

function renderAlerts(data) {
  const low = data.canh_bao_kho?.sap_het || [];
  const expiring = data.canh_bao_kho?.can_han || [];
  const rows = (items, type) => items.map((product) => `<tr><td>${escapeHtml(product.ten_san_pham)}</td>
    <td>${type === 'stock' ? `Còn ${Number(product.so_luong_ton) || 0}` : `Còn ${Number(product.near_expiry_days) || 0} ngày`}</td>
    <td>${type === 'stock' ? '—' : formatDate(product.hsd)}</td>
    <td><button class="admin-button" type="button" data-alert-action>Khắc phục</button></td></tr>`).join('');
  root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Kho <span>/</span> Cảnh báo kho</div>
    <section class="admin-panel admin-stock-alerts"><div class="admin-panel__head"><div><h2>Sản phẩm sắp hết hàng</h2><p class="admin-muted">Ngưỡng cảnh báo: còn tối đa 10 sản phẩm.</p></div><strong>${low.length} mặt hàng</strong></div>
      ${low.length ? `<div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Sản phẩm</th><th>Tồn kho</th><th>Hạn sử dụng</th><th>Thao tác</th></tr></thead><tbody>${rows(low, 'stock')}</tbody></table></div>` : '<p class="admin-empty">Không có sản phẩm sắp hết.</p>'}</section>
    <section class="admin-panel admin-stock-alerts"><div class="admin-panel__head"><div><h2>Lô hàng cận hạn</h2><p class="admin-muted">Hàng còn hạn sử dụng không quá 10 ngày.</p></div><strong>${expiring.length} mặt hàng</strong></div>
      ${expiring.length ? `<div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Sản phẩm</th><th>Còn hạn</th><th>Hạn sử dụng</th><th>Thao tác</th></tr></thead><tbody>${rows(expiring, 'expiry')}</tbody></table></div>` : '<p class="admin-empty">Không có lô hàng cận hạn.</p>'}</section>`;
  root.querySelectorAll('[data-alert-action]').forEach((button) => button.addEventListener('click', () => notImplemented()));
}

async function load() {
  root.innerHTML = '<div class="admin-table-skeleton"></div>';
  try {
    if (page === 'stock-alerts') renderAlerts(await api.get('/admin/dashboard'));
    else {
      const inventory = await api.get('/admin/products');
      const products = inventory.items.map((product) => ({
        ...product,
        category_name: inventory.categories.find((category) => Number(category.id) === Number(product.danh_muc_id))?.ten_danh_muc,
      }));
      if (page === 'stock-in') renderStockIn(products);
      else renderHistory(products);
    }
  } catch (error) {
    root.innerHTML = `<div class="ms-state"><strong>Không tải được dữ liệu kho</strong>${escapeHtml(error.message)}</div>`;
  }
}

await load();
