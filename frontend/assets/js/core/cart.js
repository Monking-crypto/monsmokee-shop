import { api } from './api.js';

export function normalizeCart(data) {
  const items = Array.isArray(data?.items)
    ? data.items.map((item) => {
      if (item?.san_pham) return item;

      const quantity = Number(item.so_luong) || 0;
      const basePrice = Number(item.gia_goc) || 0;
      const effectivePrice = Number(item.gia_ban_hieu_luc) || 0;
      return {
        san_pham: {
          id: Number(item.san_pham_id),
          ten_san_pham: item.ten || '',
          anh_thumb: item.anh_thumb || null,
          hinh_anh: item.anh_thumb || null,
          don_vi_tinh: item.don_vi_tinh || '',
          gia_ban: basePrice,
          gia_hieu_luc: effectivePrice,
          phan_tram_giam: Number(item.phan_tram_giam) || 0,
        },
        so_luong: quantity,
        don_gia: effectivePrice,
        thanh_tien: Number(item.thanh_tien) || effectivePrice * quantity,
        con_hang: item.con_hang === true,
        canh_bao: typeof item.canh_bao === 'string' ? item.canh_bao : '',
      };
    })
    : [];
  const summary = data?.summary || {};
  const count = items.reduce((total, item) => total + (Number(item.so_luong) || 0), 0);

  return {
    ...data,
    items,
    count: Number.isFinite(Number(data?.count)) ? Number(data.count) : count,
    tam_tinh: Number(data?.tam_tinh ?? summary.tam_tinh) || 0,
    giam_gia: Number(data?.giam_gia ?? summary.so_tien_duoc_giam) || 0,
    phi_ship_tam_tinh: data?.phi_ship_tam_tinh ?? null,
    tong: Number(data?.tong ?? summary.tong_tien_hang) || 0,
  };
}

export async function getCart() {
  return normalizeCart(await api.get('/cart'));
}

export async function addCartItem(productId, quantity) {
  await api.post('/cart/items', { san_pham_id: productId, so_luong: quantity });
  return getCart();
}

export async function updateCartItem(productId, quantity) {
  await api.patch(`/cart/items/${productId}`, { so_luong: quantity });
  return getCart();
}

export async function removeCartItem(productId) {
  await api.del(`/cart/items/${productId}`);
  return getCart();
}

export async function clearCart() {
  await api.del('/cart');
  return getCart();
}
