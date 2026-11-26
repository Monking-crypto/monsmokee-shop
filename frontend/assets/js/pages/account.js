// account.js - hồ sơ thành viên và các lối tắt tài khoản
import { api, ApiError } from '../core/api.js';
import { escapeHtml, qs, setBusy, toast } from '../core/ui.js';
import { mountHeader } from '../components/header.js';
import { mountFooter } from '../components/footer.js';
import { mountBottomNav } from '../components/bottom-nav.js';
import { confirmDialog } from '../components/confirm-dialog.js';

const root = qs('#account-app');

function renderLoading() {
  root.setAttribute('aria-busy', 'true');
  root.innerHTML = `<div class="account-skeleton" aria-hidden="true">
    <div></div><div></div><div></div>
  </div>`;
}

function renderGuest() {
  root.setAttribute('aria-busy', 'false');
  root.innerHTML = `<section class="account-state">
    <span class="account-state__icon"><i class="bi bi-person-lock" aria-hidden="true"></i></span>
    <h2>Đăng nhập để xem tài khoản</h2>
    <p>Đăng nhập để xem thông tin thành viên và sử dụng các tiện ích mua sắm.</p>
    <div class="account-state__actions">
      <a class="ms-btn ms-btn--green" href="dang-nhap.html?redirect=tai-khoan.html">Đăng nhập</a>
      <a class="ms-btn ms-btn--ghost" href="dang-ky.html">Tạo tài khoản</a>
    </div>
  </section>`;
}

function renderError(message) {
  root.setAttribute('aria-busy', 'false');
  root.innerHTML = `<section class="account-state">
    <span class="account-state__icon account-state__icon--error"><i class="bi bi-exclamation-circle" aria-hidden="true"></i></span>
    <h2>Chưa tải được thông tin tài khoản</h2>
    <p>${escapeHtml(message)}</p>
    <button class="ms-btn ms-btn--green" id="account-retry" type="button">Thử lại</button>
  </section>`;
  qs('#account-retry').addEventListener('click', loadAccount);
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).pop().charAt(0).toLocaleUpperCase('vi');
}

function renderProfile(user) {
  const name = escapeHtml(user.ho_ten || 'Thành viên MON SMOKEE');
  root.setAttribute('aria-busy', 'false');
  root.innerHTML = `<div class="account-layout">
    <section class="account-profile" aria-labelledby="account-welcome">
      <div class="account-profile__banner">
        <div class="account-avatar" aria-hidden="true">${escapeHtml(initials(user.ho_ten))}</div>
        <div class="account-profile__welcome">
          <span>Xin chào,</span>
          <h2 id="account-welcome">${name}</h2>
          <p><i class="bi bi-patch-check-fill" aria-hidden="true"></i> Thành viên MON SMOKEE</p>
        </div>
      </div>
      <div class="account-details">
        <div class="account-details__heading">
          <div><span class="account-card-eyebrow">HỒ SƠ CỦA BẠN</span><h2>Thông tin cá nhân</h2></div>
          <i class="bi bi-person-vcard" aria-hidden="true"></i>
        </div>
        <dl>
          <div><dt>Họ và tên</dt><dd>${name}</dd></div>
          <div><dt>Số điện thoại</dt><dd>${escapeHtml(user.so_dien_thoai || 'Chưa cập nhật')}</dd></div>
          <div><dt>Email</dt><dd>${escapeHtml(user.email || 'Chưa cập nhật')}</dd></div>
        </dl>
        <p class="account-details__note"><i class="bi bi-info-circle" aria-hidden="true"></i> Thông tin này được lấy từ hồ sơ tài khoản của bạn.</p>
      </div>
    </section>
    <aside class="account-shortcuts" aria-label="Tiện ích tài khoản">
      <div class="account-shortcuts__heading"><span class="account-card-eyebrow">TIỆN ÍCH</span><h2>Bạn muốn làm gì?</h2></div>
      <a class="account-shortcut" href="gio-hang.html">
        <span class="account-shortcut__icon"><i class="bi bi-cart3" aria-hidden="true"></i></span>
        <span><strong>Giỏ hàng của tôi</strong><small>Xem sản phẩm và tiếp tục đặt hàng</small></span>
        <i class="bi bi-chevron-right account-shortcut__arrow" aria-hidden="true"></i>
      </a>
      <a class="account-shortcut" href="quen-mat-khau.html">
        <span class="account-shortcut__icon account-shortcut__icon--gold"><i class="bi bi-shield-lock" aria-hidden="true"></i></span>
        <span><strong>Bảo mật tài khoản</strong><small>Đặt lại mật khẩu bằng email</small></span>
        <i class="bi bi-chevron-right account-shortcut__arrow" aria-hidden="true"></i>
      </a>
      <a class="account-shortcut" href="san-pham.html">
        <span class="account-shortcut__icon account-shortcut__icon--orange"><i class="bi bi-basket2" aria-hidden="true"></i></span>
        <span><strong>Tiếp tục mua sắm</strong><small>Khám phá sản phẩm tại cửa hàng</small></span>
        <i class="bi bi-chevron-right account-shortcut__arrow" aria-hidden="true"></i>
      </a>
      <div class="account-logout">
        <p>Kết thúc phiên đăng nhập trên thiết bị này.</p>
        <button id="account-logout" class="ms-btn ms-btn--ghost ms-btn--block" type="button"><i class="bi bi-box-arrow-right" aria-hidden="true"></i> Đăng xuất</button>
      </div>
    </aside>
  </div>`;
  qs('#account-logout').addEventListener('click', logout);
}

async function loadAccount() {
  renderLoading();
  try {
    const data = await api.get('/auth/me');
    if (!data?.user || typeof data.user !== 'object') {
      renderError('Máy chủ chưa trả về hồ sơ thành viên hợp lệ.');
      return;
    }
    renderProfile(data.user);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      renderGuest();
      return;
    }
    renderError(error instanceof ApiError ? error.message : 'Không thể kết nối máy chủ. Vui lòng thử lại.');
  }
}

async function logout(event) {
  const button = event.currentTarget;
  const { confirmed } = await confirmDialog({
    title: 'Đăng xuất tài khoản?',
    message: 'Bạn có chắc chắn muốn kết thúc phiên đăng nhập này?',
    confirmText: 'Đăng xuất',
  });
  if (!confirmed) return;

  setBusy(button, true);
  try {
    await api.post('/auth/logout');
    toast('Đã đăng xuất');
    location.assign('dang-nhap.html');
  } catch (error) {
    setBusy(button, false);
    toast(error instanceof ApiError ? error.message : 'Không thể đăng xuất. Vui lòng thử lại.', 'error');
  }
}

await mountHeader(qs('#site-header'));
mountFooter(qs('#site-footer'));
mountBottomNav(qs('#bottom-nav'), 'account');
await loadAccount();
