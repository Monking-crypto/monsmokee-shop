import { api, ApiError, serverNow } from '../core/api.js';
import { escapeHtml, qs, toast } from '../core/ui.js';
import { formatPromotionDate, formatVnd, normalizeKeyword } from '../core/format.js';
import { displayDateFromIso, formatDateInput, isoDateFromDisplay } from '../core/date-input.js';
import { confirmDialog } from '../components/confirm-dialog.js';

const root = qs('#admin-page-content');
let products = [];
let promotion = null;
let selectedIds = [];
let saving = false;

function localDate(offsetDays = 0) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(serverNow()).filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]));
  const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + offsetDays));
  return date.toISOString().slice(0, 10);
}

function nextFriday() {
  const today = localDate();
  const [year, month, day] = today.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return localDate((5 - weekday + 7) % 7);
}

function productName(product) {
  return product.ten_san_pham || product.ten || '';
}

function productPrice(product) {
  return Number(product.gia_ban ?? product.gia) || 0;
}

function promotionInputDate(value, fallback) {
  const formatted = formatPromotionDate(value);
  return formatted ? formatted.split(' ')[0] : displayDateFromIso(fallback);
}

function payloadFromForm(startDate, endDate) {
  const data = new FormData(qs('#promotion-form'));
  return {
    ma_khuyen_mai: String(data.get('ma_khuyen_mai') || '').trim(),
    ten_chuong_trinh: String(data.get('ten_chuong_trinh') || '').trim(),
    loai: 'THU_SAU',
    phan_tram_giam: 10,
    so_san_pham: 10,
    so_tien_giam_toi_da: null,
    ngay_bat_dau: startDate,
    ngay_ket_thuc: endDate,
    trang_thai: qs('#promotion-enabled').checked ? 1 : 0,
    san_pham_ids: selectedIds,
  };
}

function render() {
  const date = nextFriday();
  const current = promotion || {
    ma_khuyen_mai: `THU-SAU-${date.replace(/-/g, '')}`,
    ten_chuong_trinh: 'Siêu sale Thứ 6',
    loai: 'THU_SAU',
    phan_tram_giam: 10,
    so_san_pham: 10,
    ngay_bat_dau: date,
    ngay_ket_thuc: date,
    trang_thai: 0,
  };
  const startDisplay = promotionInputDate(current.ngay_bat_dau, date);
  const endDisplay = promotionInputDate(current.ngay_ket_thuc, date);
  const selected = new Set(selectedIds);
  root.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> Khuyến mãi</div>
    <section class="admin-promo-card"><div class="admin-promo-head"><div><p class="admin-eyebrow">CHƯƠNG TRÌNH THỨ SÁU</p>
      <h2>Siêu sale Thứ 6 — giảm 10%</h2><p>Chọn tối đa 10 sản phẩm; chương trình chạy theo lịch giờ Việt Nam.</p>
      <a href="../sieu-sale-thu-6.html" target="_blank" rel="noopener">Xem trang khách</a>
      <span class="admin-status">${promotion ? `Đã chọn ${Number(promotion.so_san_pham_da_chon) || 0}/${Number(promotion.so_san_pham) || 10}` : 'Chưa tạo chương trình'}</span></div>
      <label class="admin-switch"><input id="promotion-enabled" type="checkbox" ${Number(current.trang_thai) === 1 ? 'checked' : ''}><span>Chương trình đang bật</span></label></div>
      <form id="promotion-form" class="admin-form-grid">
        <label class="admin-field">Mã khuyến mãi<input name="ma_khuyen_mai" maxlength="30" value="${escapeHtml(current.ma_khuyen_mai || '')}" required></label>
        <label class="admin-field">Tên chương trình<input name="ten_chuong_trinh" maxlength="150" value="${escapeHtml(current.ten_chuong_trinh || '')}" required></label>
        <label class="admin-field">Ngày bắt đầu<div class="admin-date-input"><input name="ngay_bat_dau" type="text" inputmode="numeric" autocomplete="off" placeholder="dd/mm/yyyy" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" maxlength="10" value="${escapeHtml(startDisplay)}" required><span class="admin-date-input__icon" aria-hidden="true"><i class="bi bi-calendar3"></i></span><input class="admin-date-input__picker" type="date" data-date-picker="ngay_bat_dau" aria-label="Chọn ngày bắt đầu" tabindex="-1"></div><small data-error="ngay_bat_dau"></small></label>
        <label class="admin-field">Ngày kết thúc<div class="admin-date-input"><input name="ngay_ket_thuc" type="text" inputmode="numeric" autocomplete="off" placeholder="dd/mm/yyyy" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" maxlength="10" value="${escapeHtml(endDisplay)}" required><span class="admin-date-input__icon" aria-hidden="true"><i class="bi bi-calendar3"></i></span><input class="admin-date-input__picker" type="date" data-date-picker="ngay_ket_thuc" aria-label="Chọn ngày kết thúc" tabindex="-1"></div><small data-error="ngay_ket_thuc"></small></label>
        <div class="admin-promo-actions admin-field--wide"><button id="promotion-random" class="admin-button" type="button">Chọn ngẫu nhiên 10</button>
          <button id="promotion-save" class="ms-btn ms-btn--green" type="submit">Lưu chương trình</button>
          <span id="promotion-selected-count">${selected.size}/10 sản phẩm ghim</span>
          <input id="promotion-search" type="search" placeholder="Tìm sản phẩm" aria-label="Tìm sản phẩm khuyến mãi"></div>
      </form>
      <div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Chọn</th><th>Sản phẩm</th><th>Danh mục</th><th>Giá bán</th><th>Tồn kho</th></tr></thead>
      <tbody>${products.map((product) => `<tr data-promotion-row><td><input type="checkbox" data-promotion-product="${Number(product.id)}" ${selected.has(Number(product.id)) ? 'checked' : ''} aria-label="Chọn ${escapeHtml(productName(product))}"></td>
        <td>${escapeHtml(productName(product))}</td><td>${escapeHtml(product.ten_danh_muc || '')}</td><td>${formatVnd(productPrice(product))}</td><td>${Number(product.so_luong_ton) || 0}</td></tr>`).join('')}</tbody></table></div>
    </section>`;
  root.querySelectorAll('[data-promotion-product]').forEach((box) => box.addEventListener('change', updateSelection));
  bindPromotionDateInputs();
  qs('#promotion-random').addEventListener('click', chooseRandom);
  qs('#promotion-save').form.addEventListener('submit', save);
  qs('#promotion-search').addEventListener('input', (event) => {
    const query = normalizeKeyword(event.target.value);
    root.querySelectorAll('[data-promotion-row]').forEach((row) => {
      row.hidden = !normalizeKeyword(row.textContent).includes(query);
    });
  });
}

function bindPromotionDateInputs() {
  const form = qs('#promotion-form');
  const names = ['ngay_bat_dau', 'ngay_ket_thuc'];
  const clearError = (name) => {
    form.querySelector(`[data-error="${name}"]`).textContent = '';
    form.elements[name].removeAttribute('aria-invalid');
  };

  names.forEach((name) => {
    const input = form.elements[name];
    const picker = form.querySelector(`[data-date-picker="${name}"]`);
    input.addEventListener('input', (event) => {
      formatDateInput(event);
      picker.value = isoDateFromDisplay(input.value);
      clearError(name);
    });
    picker.addEventListener('change', () => {
      input.value = displayDateFromIso(picker.value);
      clearError(name);
    });
  });
}

function showDateError(name, message) {
  const form = qs('#promotion-form');
  const input = form.elements[name];
  form.querySelector(`[data-error="${name}"]`).textContent = message;
  input.setAttribute('aria-invalid', 'true');
  input.focus();
}

function updateSelection(event) {
  const checked = [...root.querySelectorAll('[data-promotion-product]:checked')];
  if (checked.length > 10) {
    event.target.checked = false;
    toast('Chỉ được ghim tối đa 10 sản phẩm', 'error');
  }
  selectedIds = [...root.querySelectorAll('[data-promotion-product]:checked')]
    .map((input) => Number(input.dataset.promotionProduct));
  qs('#promotion-selected-count').textContent = `${selectedIds.length}/10 sản phẩm ghim`;
}

async function load() {
  const [productData, promotionData] = await Promise.all([
    api.get('/admin/products?page=1&per_page=50'),
    api.get('/admin/promotions?loai=THU_SAU&per_page=50'),
  ]);
  if (!Array.isArray(productData.products) || !Array.isArray(promotionData.promotions)) {
    throw new Error('Dữ liệu sản phẩm hoặc khuyến mãi không hợp lệ.');
  }
  products = productData.products;
  promotion = promotionData.promotions[0] || null;
  selectedIds = [];
  if (promotion) {
    const details = await api.get(`/admin/promotions/${Number(promotion.id)}`);
    if (!Array.isArray(details.products)) throw new Error('Danh sách sản phẩm khuyến mãi không hợp lệ.');
    selectedIds = details.products.map((product) => Number(product.id));
  }
  render();
}

async function chooseRandom() {
  if (!promotion) {
    const candidates = products.filter((product) => Number(product.so_luong_ton) > 0
      && Number(product.trang_thai) === 1);
    selectedIds = candidates.sort(() => Math.random() - 0.5).slice(0, 10)
      .map((product) => Number(product.id));
    render();
    return;
  }
  const button = qs('#promotion-random');
  button.disabled = true;
  try {
    await api.post(`/admin/promotions/${Number(promotion.id)}/random-products`);
    toast('Đã chọn lại sản phẩm ngẫu nhiên');
    await load();
  } catch (error) {
    toast(error.message || 'Không thể chọn sản phẩm ngẫu nhiên.', 'error');
  } finally {
    const currentButton = qs('#promotion-random');
    if (currentButton) currentButton.disabled = false;
  }
}

async function save(event) {
  event.preventDefault();
  if (saving) return;
  const form = qs('#promotion-form');
  form.querySelectorAll('[data-error]').forEach((node) => { node.textContent = ''; });
  ['ngay_bat_dau', 'ngay_ket_thuc'].forEach((name) => {
    form.elements[name].removeAttribute('aria-invalid');
  });
  const startDate = isoDateFromDisplay(form.elements.ngay_bat_dau.value);
  const endDate = isoDateFromDisplay(form.elements.ngay_ket_thuc.value);
  if (!startDate) {
    showDateError('ngay_bat_dau', 'Vui lòng nhập ngày bắt đầu hợp lệ theo dd/mm/yyyy.');
    return;
  }
  if (!endDate) {
    showDateError('ngay_ket_thuc', 'Vui lòng nhập ngày kết thúc hợp lệ theo dd/mm/yyyy.');
    return;
  }
  if (endDate < startDate) {
    showDateError('ngay_ket_thuc', 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.');
    return;
  }
  const button = qs('#promotion-save');
  const payload = payloadFromForm(startDate, endDate);
  const enabling = payload.trang_thai === 1 && Number(promotion?.trang_thai) !== 1;
  if (enabling) {
    const { confirmed } = await confirmDialog({
      title: 'Bật Siêu sale Thứ 6?',
      message: 'Chương trình sẽ được hiển thị theo lịch đã chọn khi đủ sản phẩm hợp lệ.',
      confirmText: 'Bật chương trình',
    });
    if (!confirmed) {
      qs('#promotion-enabled').checked = false;
      return;
    }
  }
  saving = true;
  button.disabled = true;
  try {
    if (promotion) {
      await api.put(`/admin/promotions/${Number(promotion.id)}`, payload);
    } else {
      const created = await api.post('/admin/promotions', payload);
      if (!Number(created?.id)) throw new Error('Máy chủ chưa trả mã khuyến mãi hợp lệ.');
    }
    toast('Đã lưu chương trình khuyến mãi');
    await load();
  } catch (error) {
    if (error instanceof ApiError && error.errors) {
      ['ngay_bat_dau', 'ngay_ket_thuc'].forEach((field) => {
        if (typeof error.errors[field] === 'string') showDateError(field, error.errors[field]);
      });
      const messages = Object.values(error.errors).filter((value) => typeof value === 'string');
      if (messages.length) toast(messages.join(' '), 'error');
      else toast(error.message, 'error');
    } else {
      toast(error.message || 'Không thể lưu chương trình khuyến mãi.', 'error');
    }
  } finally {
    saving = false;
    const currentButton = qs('#promotion-save');
    if (currentButton) currentButton.disabled = false;
  }
}

load().catch((error) => {
  root.innerHTML = `<div class="ms-state"><strong>Không tải được chương trình</strong>${escapeHtml(error.message)}</div>`;
});
