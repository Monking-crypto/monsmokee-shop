// config.js - cấu hình duy nhất của frontend
export const CONFIG = {
  // Backend dev (cùng origin Apache để dùng PHP Session cookie)
  API_BASE: '/monsmokee/backend/public/api',
  // true: dùng dữ liệu mẫu trong mock.js (xem giao diện khi backend chưa xong). Đổi thành false khi backend sẵn sàng.
  USE_MOCK: true,
  STORE_INFO: {
    name: 'MON SMOKEE',
    address: '(cập nhật) Đồng Hới, Quảng Bình',
    hours: '07:00 – 21:30',
    hotline: '(cập nhật)',
  },
  // Phải khớp backend/config/business.php
  FREESHIP_FROM: 150000,
  FREESHIP_MAX_KM: 2.5,
  COD_MIN_ORDER: 50000,
  OTP_TTL_SECONDS: 180,
  OTP_RESEND_SECONDS: 60,
};
