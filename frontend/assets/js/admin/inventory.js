import { api, ApiError } from '../core/api.js';
import { escapeHtml, qs, toast } from '../core/ui.js';
import { formatDate, formatVnd, normalizeKeyword } from '../core/format.js';

const root = qs('#admin-page-content');
const page = document.body.dataset.page;
const PAGE_SIZE = 50;

function productName(product) {
  return product.ten_san_pham || product.ten || '';
}

function todayValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function loadProducts() {
  const [inventory, categoryData] = await Promise.all([
    api.get(`/admin/products?page=1&per_page=${PAGE_SIZE}`),
    api.get('/admin/categories'),
  ]);
  if (!Array.isArray(inventory.products) || !Array.isArray(categoryData.categories)) {
    throw new Error('Dữ liệu sản phẩm hoặc danh mục kho không hợp lệ.');
  }
  const categories = new Map(categoryData.categories.map((category) => [
    Number(category.id), category.ten_danh_muc,
  ]));
  return inventory.products.map((product) => ({
    ...product,
    category_name: categories.get(Number(product.danh_muc_id)) || '',
  }));
}

function renderStockIn(products) {
  const today = todayValue();
  root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Kho <span>/</span> Nhập hàng</div>
    <section class="admin-panel admin-stock-in">
      <div class="admin-panel__head"><div><h2>Tạo phiếu nhập hàng</h2><p class="admin-muted">Phiếu nhập sẽ cập nhật tồn kho và lưu thông tin lô hàng.</p></div></div>
      <form id="stock-in-form" class="admin-form-grid">
        <label class="admin-field">Nhà cung cấp<input name="nha_cung_cap" type="text" maxlength="150"></label>
        <label class="admin-field">Ngày nhập<input type="date" name="ngay_nhap" value="${today}" max="${today}" required></label>
        <label class="admin-field admin-field--wide">Sản phẩm<select name="san_pham_id" required><option value="">Chọn sản phẩm</option>${products.map((product) =>
          `<option value="${Number(product.id)}">${escapeHtml(productName(product))} — tồn ${Number(product.so_luong_ton) || 0}</option>`).join('')}</select><small data-error="san_pham_id"></small></label>
        <label class="admin-field">Số lượng nhập<input name="so_luong" type="number" min="1" step="1" value="1" required><small data-error="so_luong"></small></label>
        <label class="admin-field">Giá nhập / đơn vị<input name="gia_nhap" type="number" min="0" step="1" value="0" required><small data-error="gia_nhap"></small></label>
        <label class="admin-field">Ngày hết hạn<input type="date" name="han_su_dung" min="${today}" required><small data-error="han_su_dung"></small></label>
        <label class="admin-field">Số lô<input name="so_lo" type="text" maxlength="100" required><small data-error="so_lo"></small></label>
        <label class="admin-field admin-field--wide">Ghi chú<textarea name="ghi_chu" rows="3" maxlength="255"></textarea></label>
        <div class="admin-form-actions admin-field--wide"><button id="stock-in-submit" class="ms-btn ms-btn--green" type="submit">Xác nhận nhập kho</button></div>
      </form>
    </section>
    <section class="admin-panel admin-stock-summary"><h2>Tồn kho hiện tại</h2>
      <div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>Tồn kho</th><th>Trạng thái</th></tr></thead>
      <tbody>${products.slice(0, 20).map((product) => `<tr><td>${escapeHtml(productName(product))}</td><td>${escapeHtml(product.category_name || '—')}</td>
        <td>${Number(product.so_luong_ton) || 0}</td><td><span class="admin-status ${Number(product.so_luong_ton) <= 10 ? 'is-hidden' : ''}">${Number(product.so_luong_ton) <= 10 ? 'Sắp hết' : 'Đủ hàng'}</span></td></tr>`).join('')}</tbody></table></div></section>`;
  const form = qs('#stock-in-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const line = {
      san_pham_id: Number(data.get('san_pham_id')),
      so_luong: Number(data.get('so_luong')),
      gia_nhap: Number(data.get('gia_nhap')),
      han_su_dung: String(data.get('han_su_dung') || ''),
      so_lo: String(data.get('so_lo') || '').trim(),
    };
    const button = qs('#stock-in-submit');
    button.disabled = true;
    form.querySelectorAll('[data-error]').forEach((element) => { element.textContent = ''; });
    try {
      await api.post('/admin/stock-receipts', {
        ngay_nhap: String(data.get('ngay_nhap') || ''),
        nha_cung_cap: String(data.get('nha_cung_cap') || '').trim() || null,
        ghi_chu: String(data.get('ghi_chu') || '').trim() || null,
        chi_tiet: [line],
      });
      toast('Đã tạo phiếu nhập kho');
      await load();
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        Object.entries(error.errors).forEach(([key, message]) => {
          const field = key.match(/chi_tiet(?:\[\d+\])?\.(san_pham_id|so_luong|gia_nhap|han_su_dung|so_lo)$/)?.[1] || key;
          const target = form.querySelector(`[data-error="${field}"]`);
          if (target && typeof message === 'string') target.textContent = message;
        });
      }
      toast(error.message || 'Không thể tạo phiếu nhập kho.', 'error');
    } finally {
      const currentButton = qs('#stock-in-submit');
      if (currentButton) currentButton.disabled = false;
    }
  });
}

async function renderHistory() {
  const data = await api.get(`/admin/stock-history?page=1&per_page=${PAGE_SIZE}`);
  if (!Array.isArray(data.history)) throw new Error('Dữ liệu lịch sử kho không hợp lệ.');
  const events = data.history;
  const labels = {
    NHAP_KHO: 'Nhập hàng',
    XUAT_BAN: 'Xuất bán',
    DIEU_CHINH: 'Điều chỉnh',
    HUY_PHIEU_NHAP: 'Hủy phiếu nhập',
  };
  root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Kho <span>/</span> Lịch sử kho</div>
    <form id="stock-history-filter" class="admin-toolbar admin-stock-filters">
      <div class="admin-filters"><select name="type" aria-label="Loại giao dịch"><option value="">Tất cả giao dịch</option>${Object.entries(labels).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select>
        <input name="query" type="search" aria-label="Tìm sản phẩm" placeholder="Tìm sản phẩm"></div><button class="admin-button" type="submit">Lọc</button>
    </form>
    ${events.length ? `<div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Mã phiếu</th><th>Loại giao dịch</th><th>Sản phẩm</th><th>Thay đổi</th><th>Tồn sau giao dịch</th><th>Thời gian</th></tr></thead>
      <tbody id="stock-history-rows">${events.map((event) => `<tr data-stock-event data-type="${escapeHtml(event.loai_giao_dich)}" data-name="${escapeHtml(normalizeKeyword(event.ten_san_pham))}">
        <td>${escapeHtml(event.tham_chieu_id ? String(event.tham_chieu_id) : '—')}</td><td>${labels[event.loai_giao_dich] || escapeHtml(event.loai_giao_dich)}</td>
        <td>${escapeHtml(event.ten_san_pham)}</td><td>${Number(event.so_luong_thay_doi) > 0 ? '+' : ''}${Number(event.so_luong_thay_doi) || 0}</td>
        <td>${Number(event.ton_sau_giao_dich) || 0}</td><td>${formatDate(event.ngay_tao, true)}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="ms-state"><strong>Chưa có biến động kho</strong>Lịch sử sẽ xuất hiện khi có giao dịch nhập hoặc xuất.</div>'}
    <div class="admin-pagination"><span>${Number(data.pagination?.total) || events.length} giao dịch</span></div>`;
  qs('#stock-history-filter').addEventListener('submit', (event) => {
    event.preventDefault();
    const type = event.currentTarget.elements.type.value;
    const query = normalizeKeyword(event.currentTarget.elements.query.value);
    root.querySelectorAll('[data-stock-event]').forEach((row) => {
      row.hidden = (type && row.dataset.type !== type) || (query && !row.dataset.name.includes(query));
    });
  });
}

async function renderAlerts() {
  const [products, batchesData] = await Promise.all([
    loadProducts(),
    api.get('/admin/batches?expiring_within_days=10'),
  ]);
  if (!Array.isArray(batchesData.batches)) throw new Error('Dữ liệu lô hàng không hợp lệ.');
  const low = products.filter((product) => Number(product.so_luong_ton) <= 10);
  const rows = (items, type) => items.map((item) => `<tr><td>${escapeHtml(item.ten_san_pham || productName(item))}</td>
    <td>${type === 'stock' ? `Còn ${Number(item.so_luong_ton) || 0}` : `Còn ${Number(item.so_luong_con) || 0}`}</td>
    <td>${type === 'stock' ? '—' : formatDate(item.han_su_dung)}</td></tr>`).join('');
  root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Kho <span>/</span> Cảnh báo kho</div>
    <section class="admin-panel admin-stock-alerts"><div class="admin-panel__head"><div><h2>Sản phẩm sắp hết hàng</h2><p class="admin-muted">Ngưỡng cảnh báo: còn tối đa 10 sản phẩm.</p></div><strong>${low.length} mặt hàng</strong></div>
      ${low.length ? `<div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Sản phẩm</th><th>Tồn kho</th><th>Hạn sử dụng</th></tr></thead><tbody>${rows(low, 'stock')}</tbody></table></div>` : '<p class="admin-empty">Không có sản phẩm sắp hết.</p>'}</section>
    <section class="admin-panel admin-stock-alerts"><div class="admin-panel__head"><div><h2>Lô hàng cận hạn</h2><p class="admin-muted">Hàng còn hạn sử dụng không quá 10 ngày.</p></div><strong>${batchesData.batches.length} lô hàng</strong></div>
      ${batchesData.batches.length ? `<div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Sản phẩm</th><th>Số lượng còn</th><th>Hạn sử dụng</th></tr></thead><tbody>${rows(batchesData.batches, 'expiry')}</tbody></table></div>` : '<p class="admin-empty">Không có lô hàng cận hạn.</p>'}</section>`;
}

async function load() {
  root.innerHTML = '<div class="admin-table-skeleton"></div>';
  try {
    if (page === 'stock-alerts') await renderAlerts();
    else if (page === 'stock-history') await renderHistory();
    else renderStockIn(await loadProducts());
  } catch (error) {
    root.innerHTML = `<div class="ms-state"><strong>Không tải được dữ liệu kho</strong>${escapeHtml(error.message)}</div>`;
  }
}

await load();
