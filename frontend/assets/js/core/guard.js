// guard.js - bảo vệ mọi trang quản trị bằng phiên đã xác thực OTP
import { api, ApiError } from './api.js';
import { toast } from './ui.js';

export async function requireAdmin() {
  try {
    await api.get('/admin/auth/me');
    return true;
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 0) {
      document.body.textContent = 'Không thể xác thực quyền quản trị do lỗi kết nối. Vui lòng tải lại trang.';
      toast('Không thể kết nối máy chủ để xác thực quản trị.', 'error');
      return false;
    }
    const target = `${location.pathname.split('/').pop()}${location.search}`;
    location.replace(`login.html?redirect=${encodeURIComponent(target)}`);
    return false;
  }
}
