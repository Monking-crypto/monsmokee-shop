import { api } from '../core/api.js';
import { escapeHtml, toast } from '../core/ui.js';

let modal;
let opener;

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
    <p class="delivery-modal__note">Dữ liệu địa giới mẫu — CẬP NHẬT THEO THỰC TẾ.</p>
    <label class="delivery-modal__toggle"><input id="delivery-geolocation" type="checkbox"> Cho phép hệ thống truy cập địa chỉ từ thiết bị</label>
    <p id="delivery-location-result" class="delivery-modal__feedback" aria-live="polite"></p>
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
  loadProvinces();
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

async function fillSelect(select, items, placeholder) {
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${items.map((item) =>
    `<option value="${escapeHtml(item.id)}">${escapeHtml(item.ten)}</option>`).join('')}`;
  select.disabled = false;
}

async function loadProvinces() {
  const select = modal.querySelector('#delivery-province');
  try { await fillSelect(select, await api.get('/locations/provinces'), 'Chọn tỉnh, thành phố'); }
  catch { select.innerHTML = '<option value="">Không tải được danh sách</option>'; }
}
async function loadDistricts() {
  const province = modal.querySelector('#delivery-province').value;
  const district = modal.querySelector('#delivery-district'), ward = modal.querySelector('#delivery-ward');
  district.disabled = true; ward.disabled = true; ward.innerHTML = '<option value="">Chọn phường/xã</option>';
  if (!province) { district.innerHTML = '<option value="">Chọn quận/huyện</option>'; updateAreaWarning(); return; }
  try { await fillSelect(district, await api.get(`/locations/districts?province=${encodeURIComponent(province)}`), 'Chọn quận/huyện'); }
  catch { district.innerHTML = '<option value="">Không tải được danh sách</option>'; }
  updateAreaWarning();
}
async function loadWards() {
  const district = modal.querySelector('#delivery-district').value;
  const ward = modal.querySelector('#delivery-ward');
  ward.disabled = true;
  if (!district) { ward.innerHTML = '<option value="">Chọn phường/xã</option>'; updateAreaWarning(); return; }
  try { await fillSelect(ward, await api.get(`/locations/wards?district=${encodeURIComponent(district)}`), 'Chọn phường/xã'); }
  catch { ward.innerHTML = '<option value="">Không tải được danh sách</option>'; }
  updateAreaWarning();
}
function updateAreaWarning() {
  const province = modal.querySelector('#delivery-province');
  const district = modal.querySelector('#delivery-district');
  const outsideProvince = province.value && province.value !== 'quang-binh';
  const outsideDistrict = district.value && district.value !== 'dong-hoi';
  modal.querySelector('#delivery-area-warning').hidden = !(outsideProvince || outsideDistrict);
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
  const value = {
    provinceId: province.value, province: province.selectedOptions[0]?.textContent || '',
    districtId: district.value, district: district.selectedOptions[0]?.textContent || '',
    wardId: ward.value, ward: ward.selectedOptions[0]?.textContent || '',
    street: street.value.trim(), short,
  };
  if (!value.provinceId || !value.districtId || !value.wardId || !value.street) {
    toast('Vui lòng nhập đầy đủ địa chỉ giao hàng', 'error');
    return;
  }
  localStorage.setItem('ms_delivery', JSON.stringify(value));
  updateHeaderAddress();
  closeDeliveryModal();
  toast('Đã lưu địa chỉ giao hàng');
}
