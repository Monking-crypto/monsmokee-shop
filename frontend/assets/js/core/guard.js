// guard.js - bảo vệ mọi trang quản trị bằng phiên đã xác thực OTP
import { api, ApiError } from './api.js';
import { CONFIG } from './config.js';
import { escapeHtml, qs, toast } from './ui.js';

async function setMockAdminAuthenticated(authenticated) {
  if (!CONFIG.USE_MOCK || CONFIG.USE_AUTH_MOCK) return;
  const mock = await import('./mock.js');
  mock.setMockAdminAuthenticated(authenticated);
}

export async function requireAdmin() {
  const target = `admin/${location.pathname.split('/').pop()}${location.search}`;
  const loginParams = new URLSearchParams({ redirect: target, auth_required: '1' });
  const redirectToLogin = () => {
    location.replace(`../dang-nhap.html?${loginParams.toString()}`);
    return false;
  };
  const showError = (message) => {
    qs('#admin-page-content').innerHTML = `<div class="ms-state"><strong>Không thể xác thực quyền quản trị</strong>${escapeHtml(message)}<div class="mt-3"><button id="admin-auth-retry" class="ms-btn ms-btn--green" type="button">Thử lại</button></div></div>`;
    qs('#admin-page-content').setAttribute('aria-busy', 'false');
    qs('#admin-auth-retry').addEventListener('click', () => location.reload());
    toast(message, 'error');
    return false;
  };

  try {
    const data = await api.get('/admin/me');
    if (String(data?.user?.vai_tro || '').toLowerCase() !== 'admin') {
      return showError('Máy chủ chưa xác nhận đúng quyền quản trị.');
    }
    await setMockAdminAuthenticated(true);
    return data.user;
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 401) {
      await setMockAdminAuthenticated(false);
      return redirectToLogin();
    }
    if (error.status === 403) {
      await setMockAdminAuthenticated(false);
      location.replace('../index.html?access_denied=1&logged_out=1');
      return false;
    }
    return showError(error.message);
  }
}
