// guard.js - bảo vệ mọi trang quản trị bằng phiên đã xác thực OTP
import { api, ApiError } from './api.js';
import { toast } from './ui.js';

export async function requireAdmin() {
  try {
    await api.get('/admin/me');
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
    const target = `${location.pathname.split('/').pop()}${location.search}`;
    const params = new URLSearchParams({ redirect: target, auth_required: '1' });
    location.replace(`login.html?${params}`);
    return false;
  }
}
