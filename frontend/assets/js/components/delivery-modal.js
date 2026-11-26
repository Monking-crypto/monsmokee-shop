import { api } from '../core/api.js';
import { escapeHtml, toast } from '../core/ui.js';

let modal;
let opener;
let deliveryAreas = [];

const addressFromStorage = () => {
  try { return JSON.parse(localStorage.getItem('ms_delivery') || 'null'); } catch { return null; }
};

function updateHeaderAddress() {
  const saved = addressFromStorage();
  const label = document.querySelector('#delivery-label');
  if (label) label.textContent = saved?.short || 'Giao hàng';
}

export function mountDeliveryModal(host) {
  modal = document.createElement('div');
  modal.className = 'delivery-modal';
  modal.hidden = true;
  modal.innerHTML = `<div class="delivery-modal__scrim" data-close></div><section class="delivery-modal__panel" role="dialog" aria-modal="true" aria-labelledby="delivery-title" tabindex="-1">
    <button class="delivery-modal__close" type="button" aria-label="Đóng" data-close>×</button>
    <h2 id="delivery-title">Khu vực giao hàng dự kiến</h2>
    <p class="delivery-modal__note">Chọn khu vực đang được cửa hàng hỗ trợ giao hàng.</p>
    <label class="delivery-modal__toggle"><input id="delivery-geolocation" type="checkbox"> Cho phép hệ thống truy cập địa chỉ từ thiết bị</label>
    <p id="delivery-location-result" class="delivery-modal__feedback" aria-live="polite"></p>
    <p id="delivery-area-status" class="delivery-modal__feedback" role="status" aria-live="polite"></p>
    <form id="delivery-form">
      <label>Tỉnh, thành phố<select id="delivery-province" required><option value="">Đang tải...</option></select></label>
      <label>Quận, huyện<select id="delivery-district" required disabled><option value="">Chọn quận/huyện</option></select></label>
      <label>Phường, xã<select id="delivery-ward" required disabled><option value="">Chọn phường/xã</option></select></label>
      <label>Số nhà và tên đường<input id="delivery-street" type="text" autocomplete="street-address" required maxlength="160" placeholder="Ví dụ: 12 Lê Lợi"></label>
      <p id="delivery-area-warning" class="delivery-modal__warning" hidden>Hiện cửa hàng chỉ giao trong nội thành Đồng Hới. Bạn vẫn có thể chọn nhận tại cửa hàng.</p>
      <button class="ms-btn ms-btn--green ms-btn--block" type="submit">Lưu địa chỉ</button>
    </form>
  </section>`;
  host.append(modal);
  modal.addEventListener('click', (event) => {
    const close = event.target.closest('[data-close]');
    if (close) closeDeliveryModal();
    else if (event.target.closest('[data-retry-areas]')) loadAreas();
  });
  document.addEventListener('keydown', (event) => {
    if (modal.hidden) return;
    if (event.key === 'Escape') closeDeliveryModal();
    if (event.key === 'Tab') trapFocus(event);
  });
  modal.querySelector('#delivery-geolocation').addEventListener('change', locateDevice);
  modal.querySelector('#delivery-province').addEventListener('change', loadDistricts);
  modal.querySelector('#delivery-district').addEventListener('change', loadWards);
  modal.querySelector('#delivery-form').addEventListener('submit', saveAddress);
  loadAreas();
  updateHeaderAddress();
}

export function openDeliveryModal(button) {
  if (!modal) return;
  opener = button;
  modal.hidden = false;
  modal.querySelector('.delivery-modal__panel').focus();
  modal.querySelector('.delivery-modal__close').focus();
}

export function closeDeliveryModal() {
  if (!modal) return;
  modal.hidden = true;
  opener?.focus();
}

function trapFocus(event) {
  const focusable = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]')];
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function fillSelect(select, items, placeholder, valueKey, labelKey, includeDistance = false) {
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${items.map((item) =>
    `<option value="${escapeHtml(item[valueKey])}"${includeDistance ? ` data-distance-km="${Number(item.khoang_cach_km)}"` : ''}>${escapeHtml(item[labelKey])}</option>`).join('')}`;
  select.disabled = items.length === 0;
}

async function loadAreas() {
  const province = modal.querySelector('#delivery-province');
  const district = modal.querySelector('#delivery-district');
  const ward = modal.querySelector('#delivery-ward');
  const status = modal.querySelector('#delivery-area-status');
  province.disabled = true;
  district.disabled = true;
  ward.disabled = true;
  status.textContent = 'Đang tải khu vực giao hàng…';
  try {
    const data = await api.get('/shipping/areas');
    if (!Array.isArray(data?.areas)) throw new Error('Dữ liệu khu vực giao hàng không hợp lệ.');
    deliveryAreas = data.areas;
    const provinces = [...new Set(deliveryAreas.map((area) => area.tinh))].map((tinh) => ({ tinh }));
    fillSelect(province, provinces, 'Chọn tỉnh, thành phố', 'tinh', 'tinh');
    fillSelect(district, [], 'Chọn quận/huyện', 'quan_huyen', 'quan_huyen');
    fillSelect(ward, [], 'Chọn phường/xã', 'id', 'phuong_xa');
    status.textContent = deliveryAreas.length ? '' : 'Hiện chưa có khu vực giao hàng được hỗ trợ.';
  } catch (error) {
    province.innerHTML = '<option value="">Không tải được danh sách</option>';
    status.innerHTML = `${escapeHtml(error.message)} <button class="link-btn" type="button" data-retry-areas>Thử lại</button>`;
  } finally {
    province.disabled = false;
  }
}
async function loadDistricts() {
  const province = modal.querySelector('#delivery-province').value;
  const district = modal.querySelector('#delivery-district'), ward = modal.querySelector('#delivery-ward');
  district.disabled = true;
  ward.disabled = true;
  fillSelect(ward, [], 'Chọn phường/xã', 'id', 'phuong_xa');
  if (!province) {
    fillSelect(district, [], 'Chọn quận/huyện', 'quan_huyen', 'quan_huyen');
    updateAreaWarning();
    return;
  }
  const districts = [...new Set(deliveryAreas.filter((area) => area.tinh === province)
    .map((area) => area.quan_huyen))].map((quan_huyen) => ({ quan_huyen }));
  fillSelect(district, districts, 'Chọn quận/huyện', 'quan_huyen', 'quan_huyen');
  updateAreaWarning();
}
async function loadWards() {
  const province = modal.querySelector('#delivery-province').value;
  const districtValue = modal.querySelector('#delivery-district').value;
  const ward = modal.querySelector('#delivery-ward');
  ward.disabled = true;
  if (!districtValue) {
    fillSelect(ward, [], 'Chọn phường/xã', 'id', 'phuong_xa');
    updateAreaWarning();
    return;
  }
  const wards = deliveryAreas.filter((area) => area.tinh === province && area.quan_huyen === districtValue);
  fillSelect(ward, wards, 'Chọn phường/xã', 'id', 'phuong_xa', true);
  updateAreaWarning();
}
function updateAreaWarning() {
  const selected = modal.querySelector('#delivery-ward').selectedOptions[0];
  const warning = modal.querySelector('#delivery-area-warning');
  warning.hidden = !selected?.value;
}
function locateDevice(event) {
  const result = modal.querySelector('#delivery-location-result');
  result.textContent = '';
  if (!event.target.checked) return;
  if (!navigator.geolocation) {
    result.textContent = 'Thiết bị hoặc trình duyệt không hỗ trợ lấy vị trí. Bạn vẫn có thể nhập địa chỉ bên dưới.';
    return;
  }
  result.textContent = 'Đang lấy vị trí hiện tại...';
  navigator.geolocation.getCurrentPosition(({ coords }) => {
    const link = `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
    result.innerHTML = `Đã lấy vị trí hiện tại · <a target="_blank" rel="noopener noreferrer" href="${link}">Xem trên Google Maps</a>`;
  }, (error) => {
    result.textContent = error.code === error.PERMISSION_DENIED
      ? 'Bạn đã từ chối quyền truy cập vị trí. Vui lòng nhập địa chỉ thủ công.'
      : 'Không thể lấy vị trí hiện tại. Vui lòng nhập địa chỉ thủ công.';
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
}
function saveAddress(event) {
  event.preventDefault();
  const province = modal.querySelector('#delivery-province');
  const district = modal.querySelector('#delivery-district');
  const ward = modal.querySelector('#delivery-ward');
  const street = modal.querySelector('#delivery-street');
  const short = [street.value.trim(), ward.selectedOptions[0]?.textContent, district.selectedOptions[0]?.textContent].filter(Boolean).join(', ');
  const selectedArea = deliveryAreas.find((area) => String(area.id) === ward.value);
  const value = {
    provinceId: province.value, province: province.selectedOptions[0]?.textContent || '',
    districtId: district.value, district: district.selectedOptions[0]?.textContent || '',
    wardId: ward.value, ward: ward.selectedOptions[0]?.textContent || '',
    khu_vuc_id: Number(ward.value),
    tinh: selectedArea?.tinh || '',
    quan_huyen: selectedArea?.quan_huyen || '',
    phuong_xa: selectedArea?.phuong_xa || '',
    street: street.value.trim(), short,
  };
  const distance = Number(selectedArea?.khoang_cach_km);
  if (Number.isFinite(distance)) value.khoang_cach_km = distance;
  if (!value.provinceId || !value.districtId || !value.wardId || !value.street) {
    toast('Vui lòng nhập đầy đủ địa chỉ giao hàng', 'error');
    return;
  }
  localStorage.setItem('ms_delivery', JSON.stringify(value));
  updateHeaderAddress();
  document.dispatchEvent(new CustomEvent('ms:delivery'));
  closeDeliveryModal();
  toast('Đã lưu địa chỉ giao hàng');
}
