// guard.js - bảo vệ mọi trang quản trị bằng phiên đã xác thực OTP
import { api, ApiError } from './api.js';
import { CONFIG } from './config.js';
import { toast } from './ui.js';

async function setMockAdminAuthenticated(authenticated) {
  if (!CONFIG.USE_MOCK || CONFIG.USE_AUTH_MOCK) return;
  const mock = await import('./mock.js');
  mock.setMockAdminAuthenticated(authenticated);
}

export async function requireAdmin() {
  try {
    await api.get('/admin/me');
    await setMockAdminAuthenticated(true);
    return true;
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 0) {
      document.body.textContent = 'Không thể xác thực quyền quản trị do lỗi kết nối. Vui lòng tải lại trang.';
      toast(error.message, 'error');
      return false;
    }
    if (error.status !== 401 && error.status !== 403) {
      document.body.textContent = error.message;
      return false;
    }
    await setMockAdminAuthenticated(false);
    const target = `${location.pathname.split('/').pop()}${location.search}`;
    const params = new URLSearchParams({ redirect: target, auth_required: '1' });
    location.replace(`login.html?${params}`);
    return false;
  }
}
