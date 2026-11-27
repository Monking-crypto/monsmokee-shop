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

function displayDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

function apiDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return '';
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() + 1 === Number(month)
    && date.getUTCDate() === Number(day)
    ? iso
    : '';
}

function validIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() + 1 === Number(match[2])
    && date.getUTCDate() === Number(match[3]);
}

function formatDateInput(event) {
  const input = event.currentTarget;
  const oldValue = input.value;
  const oldCaret = input.selectionStart ?? oldValue.length;
  const digitsBeforeCaret = oldValue.slice(0, oldCaret).replace(/\D/g, '').length;
  const digits = oldValue.replace(/\D/g, '').slice(0, 8);
  let value = digits;
  if (digits.length > 2) value = `${digits.slice(0, 2)}/${digits.slice(2)}`;
  if (digits.length > 4) value = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  input.value = value;

  let caret = 0;
  let counted = 0;
  while (caret < value.length && counted < digitsBeforeCaret) {
    if (/\d/.test(value[caret])) counted += 1;
    caret += 1;
  }
  if (value[caret] === '/' && (digitsBeforeCaret === 2 || digitsBeforeCaret === 4)) caret += 1;
  input.setSelectionRange(caret, caret);
}

function formatMoneyInput(event) {
  const input = event.currentTarget;
  const digits = input.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  input.value = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
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
  const todayDisplay = displayDate(today);
  root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Kho <span>/</span> Nhập hàng</div>
    <section class="admin-panel admin-stock-in">
      <div class="admin-panel__head"><div><h2>Tạo phiếu nhập hàng</h2><p class="admin-muted">Phiếu nhập sẽ cập nhật tồn kho và lưu thông tin lô hàng.</p></div></div>
      <form id="stock-in-form" class="admin-form-grid" novalidate>
        <label class="admin-field">Nhà cung cấp<input name="nha_cung_cap" type="text" maxlength="150"></label>
        <label class="admin-field">Ngày nhập<div class="admin-date-input"><input name="ngay_nhap" type="text" inputmode="numeric" autocomplete="off" placeholder="dd/mm/yyyy" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" maxlength="10" value="${todayDisplay}" required><span class="admin-date-input__icon" aria-hidden="true"><i class="bi bi-calendar3"></i></span><input class="admin-date-input__picker" type="date" data-date-picker="ngay_nhap" max="${today}" aria-label="Chọn ngày nhập" tabindex="-1"></div><small data-error="ngay_nhap"></small></label>
        <label class="admin-field admin-field--wide">Sản phẩm<select name="san_pham_id" required><option value="">Chọn sản phẩm</option>${products.map((product) =>
          `<option value="${Number(product.id)}">${escapeHtml(productName(product))} — tồn ${Number(product.so_luong_ton) || 0}</option>`).join('')}</select><small data-error="san_pham_id"></small></label>
        <label class="admin-field">Số lượng nhập<input name="so_luong" type="number" min="1" step="1" value="1" required><small data-error="so_luong"></small></label>
        <label class="admin-field">Giá nhập / đơn vị<div class="admin-money-input"><input name="gia_nhap" type="text" inputmode="numeric" autocomplete="off" placeholder="0" required><span aria-hidden="true">đ</span></div><small data-error="gia_nhap"></small></label>
        <label class="admin-field">Ngày sản xuất<input name="ngay_san_xuat" type="date" max="${today}" required><small data-error="ngay_san_xuat"></small></label>
        <label class="admin-field">Ngày hết hạn<div class="admin-date-input"><input name="han_su_dung" type="text" inputmode="numeric" autocomplete="off" placeholder="dd/mm/yyyy" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" maxlength="10" required><span class="admin-date-input__icon" aria-hidden="true"><i class="bi bi-calendar3"></i></span><input class="admin-date-input__picker" type="date" min="${today}" data-date-picker="han_su_dung" aria-label="Chọn ngày hết hạn" tabindex="-1"></div><small data-error="han_su_dung"></small></label>
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
  ['ngay_nhap', 'han_su_dung'].forEach((name) => {
    const input = form.elements[name];
    const picker = form.querySelector(`[data-date-picker="${name}"]`);
    input.addEventListener('input', (event) => {
      formatDateInput(event);
      picker.value = apiDate(input.value);
      if (name === 'ngay_nhap') {
        const receiptDate = apiDate(input.value);
        form.elements.ngay_san_xuat.max = receiptDate && receiptDate < today ? receiptDate : today;
      }
    });
    picker.addEventListener('change', () => {
      input.value = displayDate(picker.value);
      if (name === 'ngay_nhap') {
        form.elements.ngay_san_xuat.max = picker.value && picker.value < today ? picker.value : today;
      }
    });
  });
  form.elements.gia_nhap.addEventListener('input', formatMoneyInput);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const receiptDate = apiDate(String(data.get('ngay_nhap') || ''));
    const expiryDate = apiDate(String(data.get('han_su_dung') || ''));
    const manufactureDate = String(data.get('ngay_san_xuat') || '');
    const productId = Number(data.get('san_pham_id'));
    const quantity = Number(data.get('so_luong'));
    const rawCost = String(data.get('gia_nhap') || '').replace(/\D/g, '');
    const cost = rawCost ? Number(rawCost) : null;
    const lotNumber = String(data.get('so_lo') || '').trim();
    form.querySelectorAll('[data-error]').forEach((element) => { element.textContent = ''; });
    const showFieldError = (name, message) => {
      form.querySelector(`[data-error="${name}"]`).textContent = message;
      form.elements[name].focus();
      toast(message, 'error');
    };
    if (!receiptDate || receiptDate > today) {
      showFieldError('ngay_nhap', receiptDate
        ? 'Ngày nhập không được sau hôm nay.'
        : 'Nhập ngày hợp lệ theo dd/mm/yyyy.');
      return;
    }
    if (!Number.isInteger(productId) || productId <= 0) {
      showFieldError('san_pham_id', 'Vui lòng chọn sản phẩm.');
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 2147483647) {
      showFieldError('so_luong', 'Số lượng phải là số nguyên dương hợp lệ.');
      return;
    }
    if (cost === null || !Number.isSafeInteger(cost) || cost > 999999999999) {
      showFieldError('gia_nhap', 'Giá nhập phải là số nguyên không âm hợp lệ.');
      return;
    }
    if (!validIsoDate(manufactureDate)) {
      showFieldError('ngay_san_xuat', 'Vui lòng chọn ngày sản xuất hợp lệ.');
      return;
    }
    if (manufactureDate > today) {
      showFieldError('ngay_san_xuat', 'Ngày sản xuất không được ở tương lai.');
      return;
    }
    if (manufactureDate > receiptDate) {
      showFieldError('ngay_san_xuat', 'Ngày sản xuất không được sau ngày nhập.');
      return;
    }
    if (!expiryDate) {
      showFieldError('han_su_dung', 'Nhập ngày hợp lệ theo dd/mm/yyyy.');
      return;
    }
    if (expiryDate <= manufactureDate) {
      showFieldError('han_su_dung', 'Hạn sử dụng phải sau ngày sản xuất.');
      return;
    }
    if (expiryDate <= today || expiryDate <= receiptDate) {
      showFieldError('han_su_dung', 'Hạn sử dụng phải sau ngày nhập và chưa hết hạn.');
      return;
    }
    if (!lotNumber || lotNumber.length > 100) {
      showFieldError('so_lo', 'Số lô là bắt buộc và tối đa 100 ký tự.');
      return;
    }
    const line = {
      san_pham_id: productId,
      so_luong: quantity,
      gia_nhap: cost,
      ngay_san_xuat: manufactureDate,
      han_su_dung: expiryDate,
      so_lo: lotNumber,
    };
    const button = qs('#stock-in-submit');
    button.disabled = true;
    form.querySelectorAll('[data-error]').forEach((element) => { element.textContent = ''; });
    try {
      await api.post('/admin/stock-receipts', {
        ngay_nhap: receiptDate,
        nha_cung_cap: String(data.get('nha_cung_cap') || '').trim() || null,
        ghi_chu: String(data.get('ghi_chu') || '').trim() || null,
        chi_tiet: [line],
      });
      toast('Đã tạo phiếu nhập kho');
      await load();
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        Object.entries(error.errors).forEach(([key, message]) => {
          const field = key.match(/chi_tiet(?:\[\d+\])?\.(san_pham_id|so_luong|gia_nhap|ngay_san_xuat|han_su_dung|so_lo)$/)?.[1] || key;
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
