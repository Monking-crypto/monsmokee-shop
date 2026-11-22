// mock.js - dữ liệu mẫu để xem giao diện khi backend chưa xong (bật bằng CONFIG.USE_MOCK)
import { normalizeKeyword } from './format.js';

const CATS = [
  [1, 'Nước giải khát', 'nuoc-giai-khat', 'droplet'], [2, 'Mì & thực phẩm khô', 'mi-thuc-pham-kho', 'box'],
  [3, 'Bánh kẹo', 'banh-keo', 'cookie'], [4, 'Sữa – Trứng – Đông lạnh', 'sua-trung-dong-lanh', 'egg-fried'],
  [5, 'Gia vị – Dầu ăn', 'gia-vi-dau-an', 'basket'], [6, 'Đồ dùng sinh hoạt', 'do-dung-sinh-hoat', 'house'],
].map(([id, ten_danh_muc, slug, icon]) => ({ id, ten_danh_muc, slug, icon }));

// [danh_muc_id, tên, đơn vị, giá, tồn, lượt bán]
const RAW = [
  [1,'Nước suối 500ml','chai',5000,100,34],[1,'Trà xanh chai','chai',10000,80,28],[1,'Nước ngọt lon','lon',12000,60,26],[1,'Sữa đậu nành 300ml','hộp',9000,45,19],
  [2,'Mì tôm gói','gói',4000,150,90],[2,'Mì trộn gói','gói',6500,90,55],[2,'Bún khô','gói',18000,50,20],[2,'Hủ tiếu khô','gói',19000,30,16],
  [3,'Bánh quy bơ','gói',24000,40,30],[3,'Bánh gạo','gói',18000,35,22],[3,'Kẹo socola','gói',35000,25,18],[3,'Snack khoai tây','gói',15000,55,42],
  [4,'Sữa tươi 1 lít','hộp',32000,48,40],[4,'Trứng gà 10 quả','vỉ',35000,25,38],[4,'Thịt heo đông lạnh','gói',65000,18,15],[4,'Xúc xích','gói',42000,35,25],
  [5,'Dầu ăn 1 lít','chai',55000,60,45],[5,'Nước mắm','chai',38000,40,23],[5,'Muối iốt','gói',8000,100,27],[5,'Tương ớt','chai',28000,45,21],
  [6,'Xà phòng tắm','cái',22000,70,33],[6,'Dầu gội','chai',48000,50,29],[6,'Giấy vệ sinh','cuộn',18000,6,20],[6,'Nước lau nhà','chai',45000,0,12],
];
const PRODUCTS = RAW.map(([danh_muc_id, ten_san_pham, don_vi_tinh, gia_ban, so_luong_ton, luot_ban], i) => ({
  id: i + 1, danh_muc_id, ten_san_pham, don_vi_tinh, gia_ban, gia_hieu_luc: gia_ban, phan_tram_giam: 0, so_luong_ton, luot_ban,
  hinh_anh: 'assets/img/placeholder-product.svg',
}));
const withSale = (p, pct, extra = {}) => ({ ...p, phan_tram_giam: pct, gia_hieu_luc: Math.round(p.gia_ban * (1 - pct / 100) / 500) * 500, ...extra });

const isFriday = () => new Date().getDay() === 5;
function nextFridayStart() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
  return d.toISOString();
}
function endOfToday() { const d = new Date(); d.setHours(23, 59, 59, 0); return d.toISOString(); }

function home() {
  const active = isFriday();
  const fridayBase = PRODUCTS.filter((p) => p.so_luong_ton > 0).slice(0, 10);
  const exp = PRODUCTS.filter((p) => [3, 8, 12, 14].includes(p.id)).map((p, i) => {
    const d = new Date(); d.setDate(d.getDate() + 3 + i * 2);
    return withSale(p, 50, { hsd: d.toISOString().slice(0, 10) });
  });
  return {
    categories: CATS,
    friday_sale: {
      active, next_start: nextFridayStart(), ends_at: endOfToday(),
      products: fridayBase.map((p) => (active ? withSale(p, 10) : { ...p, sap_dien_ra: true })),
    },
    near_expiry: exp,
    best_sellers: [...PRODUCTS].sort((a, b) => b.luot_ban - a.luot_ban).slice(0, 10),
    suggested: PRODUCTS.filter((p) => p.so_luong_ton > 0).slice(10, 20),
    sections: CATS.slice(0, 3).map((c) => ({ category: c, products: PRODUCTS.filter((p) => p.danh_muc_id === c.id) })),
  };
}

// --- giỏ hàng và tài khoản giả lập (lưu localStorage để tải lại trang vẫn giữ) ---
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(`ms_mock_${k}`)) ?? d; } catch { return d; } },
  set: (k, v) => localStorage.setItem(`ms_mock_${k}`, JSON.stringify(v)),
};
const ok = (data = null, message = '') => ({ success: true, message, data, errors: null });
const fail = (status, message, errors = null) => ({ success: false, status, message, data: null, errors });

export const MOCK_OTP = '123456';

export function handle(method, path, body = {}) {
  const [route, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  if (route === '/csrf') return ok({ token: 'mock' });
  if (route === '/home') return ok(home());
  if (route === '/categories') return ok(CATS);
  if (route === '/products') {
    const q = normalizeKeyword(params.get('q') || '');
    const cat = CATS.find((c) => c.slug === params.get('category'));
    let list = PRODUCTS.filter((p) => (!q || normalizeKeyword(p.ten_san_pham).includes(q)) && (!cat || p.danh_muc_id === cat.id));
    const sort = params.get('sort');
    if (sort === 'price_asc') list.sort((a, b) => a.gia_ban - b.gia_ban);
    if (sort === 'price_desc') list.sort((a, b) => b.gia_ban - a.gia_ban);
    if (sort === 'best') list.sort((a, b) => b.luot_ban - a.luot_ban);
    return ok({ items: list, total: list.length, page: 1, per_page: 24 });
  }
  if (route === '/cart') { const c = store.get('cart', {}); return ok({ items: c, count: Object.values(c).reduce((s, n) => s + n, 0) }); }
  if (route === '/cart/items' && method === 'POST') {
    const c = store.get('cart', {}); c[body.san_pham_id] = (c[body.san_pham_id] || 0) + (body.so_luong || 1); store.set('cart', c);
    return ok({ count: Object.values(c).reduce((s, n) => s + n, 0) });
  }
  if (/^\/cart\/items\/\d+$/.test(route) && method === 'PUT') {
    const id = route.split('/').pop(), c = store.get('cart', {});
    if (body.so_luong > 0) c[id] = body.so_luong; else delete c[id];
    store.set('cart', c); return ok({});
  }
  if (route === '/auth/me') return ok({ user: store.get('me', null) });
  if (route === '/auth/logout') { store.set('me', null); return ok(); }
  if (route === '/auth/register/start') {
    store.set('pending', body); return ok({ email: body.email, ttl: 180 }, 'Đã gửi mã OTP');
  }
  if (route === '/auth/register/verify') {
    if (body.otp !== MOCK_OTP) return fail(422, 'Mã OTP chưa đúng', { otp: 'Mã OTP chưa đúng. (Bản demo: dùng 123456)' });
    const p = store.get('pending', null); if (!p) return fail(400, 'Phiên đăng ký đã hết hạn');
    const users = store.get('users', {}); users[p.so_dien_thoai] = { ho_ten: p.ho_ten, mat_khau: p.mat_khau };
    store.set('users', users); store.set('me', { ho_ten: p.ho_ten, so_dien_thoai: p.so_dien_thoai }); return ok({}, 'Đăng ký thành công');
  }
  if (route === '/auth/otp/resend') return ok({}, 'Đã gửi lại mã OTP');
  if (route === '/auth/login') {
    const u = store.get('users', {})[body.so_dien_thoai];
    if (!u || u.mat_khau !== body.mat_khau) return fail(401, 'Số điện thoại hoặc mật khẩu không đúng');
    store.set('me', { ho_ten: u.ho_ten, so_dien_thoai: body.so_dien_thoai }); return ok({}, 'Đăng nhập thành công');
  }
  return fail(501, 'Chưa hỗ trợ trong chế độ mẫu');
}
