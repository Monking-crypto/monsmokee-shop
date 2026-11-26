import { api } from './api.js';
import { CONFIG } from './config.js';
import { toast } from './ui.js';

let storeInfoPromise;

function fallbackStoreInfo() {
  return { ...CONFIG.STORE_INFO };
}

export async function getStoreInfo() {
  if (!CONFIG.LIVE.store) return fallbackStoreInfo();
  if (!storeInfoPromise) {
    storeInfoPromise = api.get('/store-info').then((data) => {
      const store = data?.store || data;
      if (!store || typeof store !== 'object') throw new Error('Dữ liệu cửa hàng không hợp lệ.');
      const fallback = fallbackStoreInfo();
      const openingHours = [store.gio_mo_cua, store.gio_dong_cua].filter(Boolean).join(' – ');
      return {
        ...fallback,
        name: store.ten_cua_hang || fallback.name,
        address: store.dia_chi || fallback.address,
        hotline: store.hotline || fallback.hotline,
        hours: openingHours || fallback.hours,
      };
    }).catch(() => {
      storeInfoPromise = null;
      toast('Không lấy được thông tin cửa hàng từ máy chủ; đang dùng thông tin cấu hình.', 'error');
      return fallbackStoreInfo();
    });
  }
  return storeInfoPromise;
}
