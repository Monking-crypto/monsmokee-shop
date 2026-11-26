// config.js - cấu hình duy nhất của frontend
const frontendPath = location.pathname.indexOf('/frontend/');
const projectPath = frontendPath >= 0 ? location.pathname.slice(0, frontendPath) : '';

export const CONFIG = {
  // Backend dev (cùng origin Apache để dùng PHP Session cookie)
  API_BASE: `${projectPath}/backend/public/api`,
  // true: luồng khách hàng dùng dữ liệu mẫu; đăng nhập và CRUD danh mục/sản phẩm Admin vẫn gọi Backend.
  USE_MOCK: true,
  // Auth uses the backend session API while catalog and cart remain mocked.
  USE_AUTH_MOCK: false,
  STORE_INFO: {
    name: 'MON SMOKEE',
    address: '', // ĐIỀN SAU
    hours: '07:00 – 21:30',
    hotline: '', // ĐIỀN SAU
    businessCode: '', // ĐIỀN SAU
    onlinePhone: '', // ĐIỀN SAU
    email: '', // ĐIỀN SAU
  },
  // Phải khớp backend/config/business.php
  FREESHIP_FROM: 150000,
  FREESHIP_MAX_KM: 2.5,
  COD_MIN_ORDER: 50000,
  OTP_TTL_SECONDS: 300,
  OTP_RESEND_SECONDS: 60,
};
