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
  try {
    const data = await api.get('/admin/me');
    await setMockAdminAuthenticated(true);
    return data?.user || true;
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 0) {
      qs('#admin-page-content').innerHTML = `<div class="ms-state"><strong>Không thể xác thực quyền quản trị</strong>${escapeHtml(error.message)}<div class="mt-3"><button id="admin-auth-retry" class="ms-btn ms-btn--green" type="button">Thử lại</button></div></div>`;
      qs('#admin-page-content').setAttribute('aria-busy', 'false');
      qs('#admin-auth-retry').addEventListener('click', () => location.reload());
      toast(error.message, 'error');
      return false;
    }
    if (error.status !== 401 && error.status !== 403) {
      qs('#admin-page-content').innerHTML = `<div class="ms-state"><strong>Không thể xác thực quyền quản trị</strong>${escapeHtml(error.message)}</div>`;
      qs('#admin-page-content').setAttribute('aria-busy', 'false');
      return false;
    }
    await setMockAdminAuthenticated(false);
    const target = `${location.pathname.split('/').pop()}${location.search}`;
    const params = new URLSearchParams({ redirect: target, auth_required: '1' });
    location.replace(`login.html?${params}`);
    return false;
  }
}
