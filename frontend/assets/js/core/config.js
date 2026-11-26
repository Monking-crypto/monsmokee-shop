// config.js - cấu hình duy nhất của frontend
const frontendPath = location.pathname.indexOf('/frontend/');
const projectPath = frontendPath >= 0 ? location.pathname.slice(0, frontendPath) : '';

export const CONFIG = {
  // Backend dev (cùng origin Apache để dùng PHP Session cookie)
  API_BASE: `${location.origin}${projectPath}/backend/public/api`,
  // Routes without an explicit LIVE feature mapping use the local mock when this is true.
  USE_MOCK: true,
  // Customer and Admin sessions use PHP session endpoints.
  USE_AUTH_MOCK: false,
  LIVE: {
    catalog: true,
    promotions: true,
    store: true,
    shipping: true,
    adminInventory: true,
    adminPromotions: true,
    adminDeliveryAreas: true,
  },
  FEATURES: {
    bestSellers: true,
  },
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
