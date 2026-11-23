// mock.js - dữ liệu mẫu dùng chung cho giao diện khách và quản trị
import { normalizeKeyword } from './format.js';

const CATS = [
  ['banh-keo', 'Bánh kẹo', 'cookie', ['Bánh quy', 'Kẹo', 'Snack', 'Bánh ngọt']],
  ['mi-goi', 'Mì gói', 'cup-hot', ['Mì ăn liền', 'Hủ tiếu', 'Miến', 'Phở và bún ăn liền', 'Nui', 'Mì Ý']],
  ['bia', 'Bia', 'cup-straw', ['Bia lon', 'Bia chai', 'Thùng bia']],
  ['sua', 'Sữa', 'cup-straw', ['Sữa tươi', 'Sữa đặc', 'Sữa chua', 'Sữa bột']],
  ['nuoc-giai-khat', 'Nước giải khát', 'droplet', ['Nước suối', 'Nước ngọt', 'Trà', 'Nước trái cây', 'Nước tăng lực']],
  ['ve-sinh-gia-dinh', 'Vệ sinh gia đình', 'house', ['Giặt giũ', 'Nước rửa chén', 'Lau nhà', 'Giấy vệ sinh']],
  ['do-cung', 'Đồ cúng', 'flower1', ['Nhang', 'Đèn cầy', 'Giấy cúng', 'Đồ lễ']],
  ['cham-soc-ca-nhan', 'Chăm sóc cá nhân', 'person-heart', ['Dầu gội', 'Sữa tắm', 'Chăm sóc răng miệng', 'Khử mùi']],
  ['gia-vi', 'Gia vị', 'basket', ['Dầu ăn', 'Nước mắm', 'Nước tương', 'Muối', 'Đường']],
  ['thuoc-la', 'Thuốc lá', 'dash-circle', ['Thuốc lá điếu', 'Thuốc lá bao']],
  ['do-dung-gia-dinh', 'Đồ dùng gia đình', 'house-heart', ['Đồ bếp', 'Đồ nhựa', 'Pin và đèn', 'Dụng cụ']],
  ['trung', 'Trứng', 'egg', ['Trứng gà', 'Trứng vịt', 'Trứng cút']],
  ['kem', 'Kem', 'snow', ['Kem que', 'Kem hộp', 'Kem ốc quế']],
].map(([slug, ten_danh_muc, icon, children], i) => ({
  id: i + 1, ten_danh_muc, slug, icon, thu_tu: i + 1,
  children: children.map((ten, j) => ({ ten, slug: `nhom-${i + 1}-${j + 1}` })),
}));

const SEEDS = [
  ['Bánh quy bơ', 'Bánh quy', 'Bơ', 'Gói', 24000], ['Kẹo trái cây', 'Kẹo', 'Trái cây', 'Gói', 12000],
  ['Snack khoai tây', 'Snack', 'Phô mai', 'Gói', 15000], ['Bánh xốp socola', 'Bánh ngọt', 'Socola', 'Hộp', 22000],
  ['Bánh quy yến mạch', 'Bánh quy', 'Yến mạch', 'Hộp', 32000], ['Kẹo bạc hà', 'Kẹo', 'Bạc hà', 'Gói', 9000],
  ['Snack rong biển', 'Snack', 'Rong biển', 'Gói', 18000], ['Bánh bông lan', 'Bánh ngọt', 'Vani', 'Hộp', 28000],
  ['Mì tôm gói', 'Mì ăn liền', 'Tôm', 'Gói', 4000], ['Hủ tiếu khô', 'Hủ tiếu', 'Nam vang', 'Gói', 19000],
  ['Miến dong', 'Miến', 'Dong riềng', 'Gói', 22000], ['Phở bò ăn liền', 'Phở và bún ăn liền', 'Bò', 'Ly', 12000],
  ['Thùng mì tôm', 'Mì ăn liền', 'Tôm', 'Thùng', 96000],
  ['Nui xoắn', 'Nui', 'Lúa mì', 'Gói', 16000], ['Mì Ý spaghetti', 'Mì Ý', 'Lúa mì', 'Gói', 25000],
  ['Mì trộn cay', 'Mì ăn liền', 'Cay', 'Gói', 6500], ['Bún riêu ăn liền', 'Phở và bún ăn liền', 'Cua', 'Ly', 14000],
  ['Bia lon lager', 'Bia lon', 'Lager', 'Lon', 18000], ['Bia chai vàng', 'Bia chai', 'Lager', 'Chai', 22000],
  ['Thùng bia lon', 'Thùng bia', 'Lager', 'Thùng', 390000], ['Bia lon nhẹ', 'Bia lon', 'Nhẹ', 'Lon', 16000],
  ['Bia chai đen', 'Bia chai', 'Đậm', 'Chai', 26000], ['Thùng bia chai', 'Thùng bia', 'Lager', 'Thùng', 420000],
  ['Bia lon bạc', 'Bia lon', 'Bạc', 'Lon', 19000], ['Bia chai lúa mì', 'Bia chai', 'Lúa mì', 'Chai', 28000],
  ['Sữa tươi có đường', 'Sữa tươi', 'Có đường', 'Hộp', 32000], ['Sữa đặc', 'Sữa đặc', 'Ngọt', 'Lon', 28000],
  ['Sữa chua uống', 'Sữa chua', 'Dâu', 'Lốc', 26000], ['Sữa bột dinh dưỡng', 'Sữa bột', 'Vani', 'Hộp', 125000],
  ['Sữa tươi không đường', 'Sữa tươi', 'Không đường', 'Hộp', 34000], ['Sữa chua nha đam', 'Sữa chua', 'Nha đam', 'Hũ', 8000],
  ['Thùng sữa tươi', 'Sữa tươi', 'Có đường', 'Thùng', 360000],
  ['Sữa tiệt trùng', 'Sữa tươi', 'Ít đường', 'Lốc', 36000], ['Sữa đặc nhỏ', 'Sữa đặc', 'Ngọt', 'Lon', 18000],
  ['Nước suối 500ml', 'Nước suối', 'Tinh khiết', 'Chai', 5000], ['Nước ngọt cola', 'Nước ngọt', 'Cola', 'Lon', 12000],
  ['Trà xanh chai', 'Trà', 'Trà xanh', 'Chai', 10000], ['Nước cam', 'Nước trái cây', 'Cam', 'Hộp', 11000],
  ['Nước tăng lực', 'Nước tăng lực', 'Vị nguyên bản', 'Lon', 13000], ['Nước suối 1.5L', 'Nước suối', 'Tinh khiết', 'Chai', 10000],
  ['Trà đào', 'Trà', 'Đào', 'Chai', 15000], ['Nước chanh', 'Nước trái cây', 'Chanh', 'Lon', 12000],
  ['Nước giặt', 'Giặt giũ', 'Hương hoa', 'Chai', 68000], ['Nước rửa chén', 'Nước rửa chén', 'Chanh', 'Chai', 32000],
  ['Nước lau sàn', 'Lau nhà', 'Hương sả', 'Chai', 45000], ['Giấy vệ sinh', 'Giấy vệ sinh', 'Không mùi', 'Lốc', 38000],
  ['Bột giặt', 'Giặt giũ', 'Hương hoa', 'Gói', 52000], ['Nước xả vải', 'Giặt giũ', 'Hương nắng', 'Chai', 59000],
  ['Nước lau kính', 'Lau nhà', 'Sạch bóng', 'Chai', 28000], ['Nước rửa chén túi', 'Nước rửa chén', 'Trà xanh', 'Túi', 24000],
  ['Nhang trầm', 'Nhang', 'Trầm hương', 'Bó', 30000], ['Đèn cầy đỏ', 'Đèn cầy', 'Đỏ', 'Cặp', 12000],
  ['Giấy cúng vàng mã', 'Giấy cúng', 'Truyền thống', 'Xấp', 18000], ['Bộ đồ lễ', 'Đồ lễ', 'Cơ bản', 'Bộ', 45000],
  ['Nhang vòng', 'Nhang', 'Trầm', 'Hộp', 35000], ['Đèn cầy trắng', 'Đèn cầy', 'Trắng', 'Cặp', 10000],
  ['Giấy tiền vàng', 'Giấy cúng', 'Vàng mã', 'Xấp', 15000], ['Nhang sạch', 'Nhang', 'Thảo mộc', 'Bó', 25000],
  ['Dầu gội dưỡng tóc', 'Dầu gội', 'Thảo mộc', 'Chai', 78000], ['Sữa tắm', 'Sữa tắm', 'Hương hoa', 'Chai', 65000],
  ['Kem đánh răng', 'Chăm sóc răng miệng', 'Bạc hà', 'Tuýp', 32000], ['Lăn khử mùi', 'Khử mùi', 'Tươi mát', 'Chai', 49000],
  ['Dầu gội bạc hà', 'Dầu gội', 'Bạc hà', 'Chai', 72000], ['Sữa tắm dịu nhẹ', 'Sữa tắm', 'Hoa cỏ', 'Chai', 58000],
  ['Bàn chải đánh răng', 'Chăm sóc răng miệng', 'Mềm', 'Cái', 18000], ['Nước súc miệng', 'Chăm sóc răng miệng', 'Bạc hà', 'Chai', 42000],
  ['Dầu ăn thực vật', 'Dầu ăn', 'Đậu nành', 'Chai', 55000], ['Nước mắm cá cơm', 'Nước mắm', 'Cá cơm', 'Chai', 38000],
  ['Nước tương', 'Nước tương', 'Đậu nành', 'Chai', 22000], ['Muối iốt', 'Muối', 'Iốt', 'Gói', 8000],
  ['Đường tinh luyện', 'Đường', 'Tinh luyện', 'Gói', 24000], ['Dầu mè', 'Dầu ăn', 'Mè', 'Chai', 49000],
  ['Nước mắm nhĩ', 'Nước mắm', 'Đậm đà', 'Chai', 52000], ['Tiêu xay', 'Muối', 'Tiêu đen', 'Lọ', 16000],
  ['Thuốc lá điếu phổ thông', 'Thuốc lá điếu', 'Nguyên bản', 'Bao', 25000], ['Thuốc lá bạc hà', 'Thuốc lá bao', 'Bạc hà', 'Bao', 32000],
  ['Thuốc lá nhẹ', 'Thuốc lá điếu', 'Nhẹ', 'Bao', 28000], ['Thuốc lá truyền thống', 'Thuốc lá bao', 'Nguyên bản', 'Bao', 30000],
  ['Thuốc lá bao mềm', 'Thuốc lá bao', 'Nguyên bản', 'Bao', 26000], ['Thuốc lá vị bạc hà', 'Thuốc lá điếu', 'Bạc hà', 'Bao', 35000],
  ['Thuốc lá slim', 'Thuốc lá bao', 'Nhẹ', 'Bao', 33000], ['Thuốc lá cổ điển', 'Thuốc lá điếu', 'Nguyên bản', 'Bao', 24000],
  ['Hộp đựng thực phẩm', 'Đồ nhựa', 'Trong suốt', 'Bộ', 35000], ['Chảo chống dính', 'Đồ bếp', 'Cơ bản', 'Cái', 135000],
  ['Pin AA', 'Pin và đèn', 'Alkaline', 'Vỉ', 26000], ['Muỗng inox', 'Dụng cụ', 'Inox', 'Cái', 12000],
  ['Rổ nhựa', 'Đồ nhựa', 'Nhiều màu', 'Cái', 28000], ['Thớt nhựa', 'Đồ bếp', 'Nhựa an toàn', 'Cái', 42000],
  ['Pin AAA', 'Pin và đèn', 'Alkaline', 'Vỉ', 24000], ['Kéo gia dụng', 'Dụng cụ', 'Thép', 'Cái', 32000],
  ['Trứng gà 10 quả', 'Trứng gà', 'Tươi', 'Vỉ', 35000], ['Trứng vịt 10 quả', 'Trứng vịt', 'Tươi', 'Vỉ', 38000],
  ['Trứng cút 30 quả', 'Trứng cút', 'Tươi', 'Hộp', 22000], ['Trứng gà ta', 'Trứng gà', 'Gà ta', 'Vỉ', 48000],
  ['Trứng gà 6 quả', 'Trứng gà', 'Tươi', 'Hộp', 22000], ['Trứng vịt lộn', 'Trứng vịt', 'Tươi', 'Quả', 9000],
  ['Trứng cút lộn', 'Trứng cút', 'Tươi', 'Hộp', 25000], ['Trứng gà hữu cơ', 'Trứng gà', 'Hữu cơ', 'Hộp', 55000],
  ['Kem que vani', 'Kem que', 'Vani', 'Cây', 10000], ['Kem hộp socola', 'Kem hộp', 'Socola', 'Hộp', 45000],
  ['Kem ốc quế dâu', 'Kem ốc quế', 'Dâu', 'Cây', 16000], ['Kem que đậu xanh', 'Kem que', 'Đậu xanh', 'Cây', 9000],
  ['Kem hộp vani', 'Kem hộp', 'Vani', 'Hộp', 42000], ['Kem ốc quế socola', 'Kem ốc quế', 'Socola', 'Cây', 18000],
  ['Kem que sữa dừa', 'Kem que', 'Dừa', 'Cây', 11000], ['Kem hộp dâu', 'Kem hộp', 'Dâu', 'Hộp', 46000],
];

const PRODUCTS = SEEDS.map(([ten_san_pham, nhom_con, huong_vi, dong_goi, gia_ban], i) => {
  const danh_muc_id = CATS.findIndex((c) => c.children.some((x) => x.ten === nhom_con)) + 1;
  const phan_tram_giam = i % 19 === 0 ? 5 : 0;
  return {
    id: i + 1, danh_muc_id, ten_san_pham, nhom_con, huong_vi, dong_goi,
    don_vi_tinh: dong_goi.toLowerCase(), gia_ban, gia_hieu_luc: phan_tram_giam ? Math.round(gia_ban * .95 / 500) * 500 : gia_ban,
    phan_tram_giam, so_luong_ton: i % 13 === 4 ? 0 : 12 + (i * 7) % 70, luot_ban: 120 + (i * 37) % 1880,
    hinh_anh: 'assets/img/placeholder-product.svg', trang_thai: 'dang_ban',
  };
});

const withSale = (p, pct, extra = {}) => ({ ...p, phan_tram_giam: pct, gia_hieu_luc: Math.round(p.gia_ban * (1 - pct / 100) / 500) * 500, ...extra });
const isoDateAfterDays = (days) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
function nearExpiryProducts() {
  return allProducts().filter((p) => p.trang_thai !== 'an').slice(0, 8).map((p, index) => {
    const days = index + 1;
    return withSale(p, 50, { near_expiry_days: days, hsd: isoDateAfterDays(days) });
  });
}
const vietnamParts = (date = new Date()) => Object.fromEntries(new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: 'numeric', day: 'numeric',
}).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
const vietnamIso = (timestamp) => new Date(timestamp + 7 * 60 * 60 * 1000).toISOString().replace('Z', '+07:00');
function fridayDates(now = new Date()) {
  const { year, month, day } = vietnamParts(now);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysSinceFriday = (weekday - 5 + 7) % 7;
  const currentFriday = Date.UTC(year, month - 1, day - daysSinceFriday, -7);
  const activeFriday = weekday === 5;
  const startsAt = activeFriday ? currentFriday : currentFriday + 7 * 86400000;
  const endsAt = startsAt + 86400000 - 1000;
  return {
    activeFriday,
    startsAt,
    endsAt,
    nextStart: activeFriday ? startsAt + 7 * 86400000 : startsAt,
    lastFridayEnd: currentFriday + 86400000 - 1000,
  };
}
function fridaySaleWindow(now = new Date()) {
  const dates = fridayDates(now);
  const override = localStorage.getItem('ms_dev_friday');
  if (override === 'ended') {
    return { active: false, ended: true, ...dates };
  }
  if (override === '1' || override === 'empty') {
    let schedule;
    try { schedule = JSON.parse(localStorage.getItem('ms_mock_friday_window') || 'null'); } catch { schedule = null; }
    if (!schedule || schedule.mode !== override || !Number.isFinite(schedule.endsAt)) {
      schedule = { mode: override, startsAt: now.getTime() - 60000, endsAt: now.getTime() + 15 * 60000 };
      localStorage.setItem('ms_mock_friday_window', JSON.stringify(schedule));
    }
    if (now.getTime() < schedule.endsAt) {
      return {
        active: true,
        ended: false,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        nextStart: dates.nextStart,
      };
    }
    return { active: false, ended: true, ...dates };
  }
  const inSaleWindow = dates.activeFriday && now.getTime() <= dates.endsAt;
  return {
    active: inSaleWindow,
    ended: !dates.activeFriday && now.getTime() >= dates.lastFridayEnd
      && now.getTime() - dates.lastFridayEnd <= 60000,
    ...dates,
  };
}
const getFridayActive = () => fridaySaleWindow().active;
function fridaySaleData() {
  const window = fridaySaleWindow();
  const products = allProducts().filter((product) => product.trang_thai !== 'an');
  const promo = fridayProgram() || { id: 'friday-sale', enabled: true, productIds: [] };
  if (!promo.productIds.length) {
    promo.productIds = [...products].filter((product) => product.so_luong_ton > 0)
      .sort(() => Math.random() - .5).slice(0, 10).map((product) => product.id);
    saveFridayProgram(promo);
  }
  const nearExpiryIds = new Set(nearExpiryProducts().map((product) => Number(product.id)));
  const saleProducts = window.active && promo.enabled && localStorage.getItem('ms_dev_friday') !== 'empty'
    ? products.filter((product) => promo.productIds.includes(product.id)).slice(0, 10)
      .map((product) => {
        const category = allCategories().find((item) => Number(item.id) === Number(product.danh_muc_id));
        return withSale(product, nearExpiryIds.has(Number(product.id)) ? 50 : 10, {
          danh_muc: category ? { id: category.id, ten_danh_muc: category.ten_danh_muc, slug: category.slug } : null,
        });
      })
    : [];
  return {
    active: window.active,
    ended: window.ended,
    server_time: vietnamIso(Date.now()),
    starts_at: vietnamIso(window.startsAt),
    ends_at: vietnamIso(window.endsAt),
    next_start: vietnamIso(window.nextStart),
    discount_percent: 10,
    max_products: 10,
    products: saleProducts,
  };
}
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(`ms_mock_${k}`)) ?? d; } catch { return d; } },
  set: (k, v) => localStorage.setItem(`ms_mock_${k}`, JSON.stringify(v)),
};
export function setMockAdminAuthenticated(authenticated) {
  store.set('adminAuth', Boolean(authenticated));
}
const allProducts = () => store.get('products', PRODUCTS);
const allCategories = () => store.get('categories', CATS).slice().sort((a, b) => (a.thu_tu || a.id) - (b.thu_tu || b.id));
function cartData() {
  const quantities = store.get('cart', {});
  const saleProducts = new Map(fridaySaleData().products.map((product) => [Number(product.id), product]));
  const products = allProducts().map((product) => saleProducts.get(Number(product.id)) || product);
  const items = Object.entries(quantities).flatMap(([id, amount]) => {
    const product = products.find((entry) => entry.id === Number(id));
    const so_luong = Number(amount) || 0;
    if (!product || so_luong <= 0) return [];
    const don_gia = product.gia_hieu_luc ?? product.gia_ban;
    return [{ san_pham: product, so_luong, don_gia, thanh_tien: don_gia * so_luong }];
  });
  const tam_tinh = items.reduce((sum, item) => sum + item.san_pham.gia_ban * item.so_luong, 0);
  const tongSauGiam = items.reduce((sum, item) => sum + item.thanh_tien, 0);
  const giam_gia = tam_tinh - tongSauGiam;
  let delivery = null;
  try { delivery = JSON.parse(localStorage.getItem('ms_delivery') || 'null'); } catch { delivery = null; }
  const fulfillment = localStorage.getItem('ms_fulfillment') || 'delivery';
  const distance = Number(delivery?.distance_km);
  let phi_ship_tam_tinh = null;
  if (fulfillment === 'pickup' || tam_tinh - giam_gia >= 150000) phi_ship_tam_tinh = 0;
  else if (Number.isFinite(distance)) {
    phi_ship_tam_tinh = distance <= 2.5 ? 0 : tam_tinh - giam_gia >= 50000 ? 15000 : 0;
  }
  return {
    items, count: items.reduce((sum, item) => sum + item.so_luong, 0),
    tam_tinh, giam_gia, phi_ship_tam_tinh, tong: tongSauGiam + (phi_ship_tam_tinh ?? 0),
  };
}
const fridayProgram = () => {
  const programs = store.get('promotions', null);
  if (Array.isArray(programs)) return programs.find((program) => program.id === 'friday-sale') || null;
  const legacy = store.get('fridayPromo', null);
  const initial = { id: 'friday-sale', name: 'Siêu sale Thứ 6', enabled: true, productIds: [], ...legacy };
  store.set('promotions', [initial]);
  return initial;
};
const saveFridayProgram = (updated) => {
  const programs = store.get('promotions', [fridayProgram()]);
  const current = programs.findIndex((program) => program.id === 'friday-sale');
  if (current < 0) programs.push(updated); else programs[current] = updated;
  store.set('promotions', programs);
  return updated;
};
function adminCategories() {
  const products = allProducts();
  return allCategories().map((category) => ({
    ...category,
    product_count: products.filter((product) => Number(product.danh_muc_id) === Number(category.id)).length,
  }));
}
function sampleOrders() {
  const products = allProducts();
  const statuses = ['cho_xu_ly', 'dang_giao', 'cho_lay_hang', 'thanh_cong', 'thanh_cong', 'da_huy', 'cho_xu_ly', 'dang_giao', 'cho_lay_hang', 'thanh_cong'];
  return statuses.map((status, index) => {
    const first = products[index % products.length], second = products[(index + 9) % products.length];
    const method = index % 2 ? 'cod' : 'click_collect';
    const items = [first, second].map((product, row) => {
      const so_luong = 1 + ((index + row) % 3);
      const don_gia = product.gia_hieu_luc ?? product.gia_ban;
      return { san_pham: product, so_luong, don_gia, thanh_tien: so_luong * don_gia };
    });
    const subtotal = items.reduce((sum, item) => sum + item.san_pham.gia_ban * item.so_luong, 0);
    const discount = items.reduce((sum, item) => sum + (item.san_pham.gia_ban - item.don_gia) * item.so_luong, 0);
    const shipping_fee = method === 'click_collect' ? 0 : (index % 3 ? 15000 : 0);
    return {
      id: 1001 + index, ma_don_hang: `MS${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(index + 1).padStart(3, '0')}`,
      khach_hang: { ho_ten: `Khách mẫu ${String(index + 1).padStart(2, '0')}`, so_dien_thoai: `09000000${String(index + 1).padStart(2, '0')}` },
      hinh_thuc_nhan: method, trang_thai: status, items, tam_tinh: subtotal, giam_gia: discount,
      phi_ship: shipping_fee, tong: subtotal - discount + shipping_fee,
      dia_chi: method === 'click_collect' ? 'Nhận tại cửa hàng' : '12 Lê Lợi, TP. Đồng Hới',
      gio_hen_lay: method === 'click_collect' ? new Date(Date.now() + (index + 1) * 3600000).toISOString() : null,
      ly_do_huy: status === 'da_huy' ? 'Khách yêu cầu hủy' : '',
      created_at: new Date(Date.now() - index * 2 * 3600000).toISOString(),
    };
  });
}
function allOrders() {
  const saved = store.get('orders', null);
  if (Array.isArray(saved)) return saved;
  const orders = sampleOrders();
  store.set('orders', orders);
  return orders;
}
function dashboardData() {
  const orders = allOrders(), products = allProducts(), today = new Date();
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const sameDate = (value, date) => {
    const current = new Date(value);
    return current.getFullYear() === date.getFullYear() && current.getMonth() === date.getMonth() && current.getDate() === date.getDate();
  };
  const completed = orders.filter((order) => order.trang_thai === 'thanh_cong');
  const lowStockAll = products.filter((product) => Number(product.so_luong_ton) <= 10);
  const lowStock = lowStockAll.slice(0, 8);
  const expiring = nearExpiryProducts().slice(0, 8);
  const revenueForDays = (days) => Array.from({ length: days }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() - (days - 1 - index));
    const matching = completed.filter((order) => sameDate(order.created_at, date));
    return { ngay: dateKey(date), doanh_thu: matching.reduce((sum, order) => sum + order.tong, 0) };
  });
  const promo = fridayProgram();
  return {
    kpi: {
      doanh_thu_hom_nay: completed.filter((order) => sameDate(order.created_at, today)).reduce((sum, order) => sum + order.tong, 0),
      doanh_thu_thang: completed.filter((order) => {
        const date = new Date(order.created_at);
        return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
      }).reduce((sum, order) => sum + order.tong, 0),
      don_cho_xu_ly: orders.filter((order) => order.trang_thai === 'cho_xu_ly').length,
      don_cho_lay_hang: orders.filter((order) => order.trang_thai === 'cho_lay_hang').length,
      san_pham_sap_het: lowStockAll.length,
      san_pham_can_han: expiring.length,
    },
    doanh_thu_7_ngay: revenueForDays(7),
    doanh_thu_30_ngay: revenueForDays(30),
    top_ban_chay: [...products].sort((a, b) => b.luot_ban - a.luot_ban).slice(0, 5)
      .map((product) => ({ ten_san_pham: product.ten_san_pham, luot_ban: product.luot_ban })),
    don_hang_moi: [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10),
    canh_bao_kho: { sap_het: lowStock, can_han: expiring },
    khuyen_mai: { ten: 'Siêu sale Thứ 6', dang_chay: getFridayActive() && promo.enabled, enabled: promo.enabled },
  };
}
const ok = (data = null, message = '') => ({ success: true, message, data, errors: null });
const fail = (status, message, errors = null) => ({ success: false, status, message, data: null, errors });

function home() {
  const products = allProducts().filter((p) => p.trang_thai !== 'an');
  const categories = allCategories();
  const fridaySale = fridaySaleData();
  const near = nearExpiryProducts();
  return {
    categories,
    friday_sale: fridaySale,
    near_expiry: near,
    best_sellers: [...products].sort((a, b) => b.luot_ban - a.luot_ban).slice(0, 10),
    suggested: products.filter((p) => p.so_luong_ton > 0).slice(10, 20),
    sections: categories.map((c) => ({ category: c, products: products.filter((p) => p.danh_muc_id === c.id).slice(0, 8), total: products.filter((p) => p.danh_muc_id === c.id).length })),
  };
}

function listProducts(params) {
  const q = normalizeKeyword(params.get('q') || '');
  const categories = allCategories();
  const cat = categories.find((c) => c.slug === params.get('category'));
  const sub = params.get('sub') || '';
  let list = (params.get('near_expiry') === '1' ? nearExpiryProducts() : allProducts()).filter((p) => p.trang_thai !== 'an'
    && (!q || normalizeKeyword(p.ten_san_pham).includes(q))
    && (!cat || p.danh_muc_id === cat.id)
    && (!sub || normalizeKeyword(p.nhom_con) === normalizeKeyword(cat?.children.find((x) => x.slug === sub)?.ten || sub))
    && (!params.get('in_stock') || p.so_luong_ton > 0)
    && (!params.get('discount') || p.phan_tram_giam > 0)
    && (!params.get('flavor') || p.huong_vi === params.get('flavor'))
    && (!params.get('pack') || p.dong_goi === params.get('pack')));
  const sort = params.get('sort');
  if (sort === 'price_asc') list.sort((a, b) => a.gia_ban - b.gia_ban);
  else if (sort === 'price_desc') list.sort((a, b) => b.gia_ban - a.gia_ban);
  else if (sort === 'best') list.sort((a, b) => b.luot_ban - a.luot_ban);
  else if (sort === 'hsd') list.sort((a, b) => a.near_expiry_days - b.near_expiry_days);
  else if (sort === 'newest') list.sort((a, b) => b.id - a.id);
  const page = Math.max(1, Number(params.get('page')) || 1);
  const perPage = Math.min(20, Math.max(1, Number(params.get('per_page')) || 24));
  return { items: list.slice((page - 1) * perPage, page * perPage), total: list.length, page, per_page: perPage };
}

let adminSecrets;
async function getSecrets() {
  if (adminSecrets !== undefined) return adminSecrets;
  try { adminSecrets = await import('./mock.secrets.js'); } catch { adminSecrets = null; }
  return adminSecrets;
}

export async function handle(method, path, body = {}) {
  const [route, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  if (route === '/csrf') return ok({ token: 'mock' });
  if (route === '/home') return ok(home());
  if (route === '/promotions/friday-sale' && method === 'GET') return ok(fridaySaleData());
  if (route === '/categories') return ok(allCategories());
  if (route === '/products' && method === 'GET') return ok(listProducts(params));
  if (route === '/locations/provinces') return ok([{ id: 'quang-binh', ten: 'Quảng Bình' }, { id: 'quang-tri', ten: 'Quảng Trị' }]);
  if (route === '/locations/districts') return ok(params.get('province') === 'quang-binh' ? [{ id: 'dong-hoi', ten: 'TP. Đồng Hới' }, { id: 'bo-trach', ten: 'Huyện Bố Trạch' }] : [{ id: 'dong-ha', ten: 'TP. Đông Hà' }]);
  if (route === '/locations/wards') {
    const wards = params.get('district') === 'dong-hoi'
      ? [['Nam Lý', 2.1], ['Đồng Phú', 1.4], ['Hải Thành', 2.4], ['Bắc Lý', 3.2]]
      : [['Phú Hải', null], ['Lộc Ninh', null], ['Bảo Ninh', null]];
    return ok(wards.map(([ten, distance_km]) => ({
      id: ten.toLowerCase().replace(/\s/g, '-'), ten, distance_km,
    })));
  }
  if (route === '/cart' && method === 'GET') return ok(cartData());
  if (route === '/cart/items' && method === 'POST') {
    const all = allProducts(), product = all.find((item) => item.id === Number(body.san_pham_id));
    const quantity = Number(body.so_luong);
    if (!product) return fail(404, 'Không tìm thấy sản phẩm');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return fail(422, 'Số lượng phải từ 1 đến 99');
    const c = store.get('cart', {}), next = (Number(c[product.id]) || 0) + quantity;
    if (product.so_luong_ton <= 0 || next > product.so_luong_ton) return fail(422, 'Số lượng vượt quá tồn kho hiện có');
    c[product.id] = next; store.set('cart', c);
    return ok({ count: cartData().count });
  }
  if (/^\/cart\/items\/\d+$/.test(route) && method === 'PUT') {
    const id = Number(route.split('/').pop()), c = store.get('cart', {});
    const product = allProducts().find((item) => item.id === id), quantity = Number(body.so_luong);
    if (!product || !c[id]) return fail(404, 'Không tìm thấy sản phẩm trong giỏ hàng');
    if (!Number.isInteger(quantity) || quantity < 1) return fail(422, 'Số lượng tối thiểu là 1');
    if (quantity > product.so_luong_ton) return fail(422, `Chỉ còn ${product.so_luong_ton} sản phẩm trong kho`);
    c[id] = quantity;
    store.set('cart', c); return ok(cartData());
  }
  if (/^\/cart\/items\/\d+$/.test(route) && method === 'DELETE') {
    const id = Number(route.split('/').pop()), c = store.get('cart', {});
    delete c[id]; store.set('cart', c); return ok(cartData());
  }
  if (route === '/cart' && method === 'DELETE') {
    store.set('cart', {}); return ok(cartData());
  }
  if (route === '/auth/me') return ok({ user: store.get('me', null) });
  if (route === '/auth/logout') { store.set('me', null); return ok(); }
  if (route === '/auth/register/start') {
    store.set('pending', body); store.set('pendingAt', Date.now()); store.set('pendingResendAt', Date.now() + 60000); store.set('pendingWrong', 0);
    return ok({ email: body.email, ttl: 300 }, 'Đã gửi mã OTP');
  }
  if (route === '/auth/register/verify') {
    const wrong = store.get('pendingWrong', 0);
    if (wrong >= 5) return fail(429, 'Bạn đã nhập sai tối đa 5 lần. Hãy gửi lại mã mới.');
    if (Date.now() - store.get('pendingAt', 0) > 300000) return fail(422, 'Mã OTP đã hết hạn. Hãy gửi lại mã mới.');
    if (body.otp !== '123456') {
      store.set('pendingWrong', wrong + 1);
      return fail(422, 'Mã OTP chưa đúng', { otp: 'Mã OTP chưa đúng.' });
    }
    const p = store.get('pending', null); if (!p) return fail(400, 'Phiên đăng ký đã hết hạn');
    const users = store.get('users', {}); users[p.so_dien_thoai] = { ho_ten: p.ho_ten, mat_khau: p.mat_khau };
    store.set('users', users); store.set('pending', null);
    store.set('me', { ho_ten: p.ho_ten, so_dien_thoai: p.so_dien_thoai }); return ok({}, 'Đăng ký thành công');
  }
  if (route === '/auth/otp/resend') {
    if (!store.get('pending', null)) return fail(400, 'Phiên đăng ký đã hết hạn');
    if (Date.now() < store.get('pendingResendAt', 0)) return fail(429, 'Vui lòng đợi đủ 60 giây trước khi gửi lại mã.');
    store.set('pendingWrong', 0); store.set('pendingAt', Date.now()); store.set('pendingResendAt', Date.now() + 60000);
    return ok({}, 'Đã gửi lại mã OTP');
  }
  if (route === '/auth/login') {
    const u = store.get('users', {})[body.so_dien_thoai];
    if (!u || u.mat_khau !== body.mat_khau) return fail(401, 'Số điện thoại hoặc mật khẩu không đúng');
    store.set('me', { ho_ten: u.ho_ten, so_dien_thoai: body.so_dien_thoai }); return ok({}, 'Đăng nhập thành công');
  }
  if (route === '/admin/auth/login' && method === 'POST') {
    const users = store.get('users', {});
    if (users[body.so_dien_thoai]?.mat_khau === body.mat_khau) return fail(403, 'Tài khoản này không có quyền quản trị');
    const secrets = await getSecrets();
    if (!secrets?.ADMIN_DEMO) return fail(503, 'Chưa cấu hình tài khoản demo');
    if (body.so_dien_thoai !== secrets.ADMIN_DEMO.phone || body.mat_khau !== secrets.ADMIN_DEMO.password) return fail(401, 'Số điện thoại hoặc mật khẩu không đúng');
    store.set('adminPending', true); store.set('adminPendingAt', Date.now()); store.set('adminResendAt', Date.now() + 60000); store.set('adminWrong', 0);
    return ok({ email: secrets.ADMIN_DEMO.email.replace(/^(.{2}).*(@.*)$/, '$1***$2'), ttl: 300 }, 'Đã gửi mã OTP');
  }
  if (route === '/admin/auth/verify-otp' && method === 'POST') {
    if (!store.get('adminPending', false)) return fail(401, 'Phiên đăng nhập đã hết hạn');
    if (Date.now() - store.get('adminPendingAt', 0) > 300000) return fail(422, 'Mã OTP đã hết hạn. Hãy gửi lại mã mới.');
    const attempts = store.get('adminWrong', 0);
    if (attempts >= 5) return fail(429, 'Bạn đã nhập sai tối đa 5 lần. Hãy đăng nhập lại.');
    if (body.otp !== '123456') { store.set('adminWrong', attempts + 1); return fail(422, 'Mã OTP chưa đúng'); }
    store.set('adminPending', false); store.set('adminWrong', 0); store.set('adminAuth', true);
    return ok({}, 'Đăng nhập thành công');
  }
  if (route === '/admin/auth/otp/resend' && method === 'POST') {
    if (!store.get('adminPending', false)) return fail(401, 'Phiên đăng nhập đã hết hạn');
    if (store.get('adminWrong', 0) >= 5) return fail(429, 'Bạn đã nhập sai tối đa 5 lần. Hãy đăng nhập lại.');
    if (Date.now() < store.get('adminResendAt', 0)) return fail(429, 'Vui lòng đợi đủ 60 giây trước khi gửi lại mã.');
    store.set('adminPendingAt', Date.now()); store.set('adminResendAt', Date.now() + 60000);
    return ok({}, 'Đã gửi lại mã OTP');
  }
  if (route === '/admin/auth/me') return store.get('adminAuth', false) ? ok({ admin: true }) : fail(401, 'Chưa đăng nhập quản trị');
  if (route === '/admin/auth/logout') {
    store.set('adminAuth', false); store.set('adminPending', false); return ok({}, 'Đã đăng xuất');
  }
  if (route.startsWith('/admin/') && !store.get('adminAuth', false)) return fail(401, 'Chưa đăng nhập quản trị');
  if (route === '/admin/dashboard' && method === 'GET') return ok(dashboardData());
  if (route === '/admin/categories' && method === 'GET') return ok(adminCategories());
  if (route === '/admin/categories' && method === 'POST') {
    const categories = allCategories();
    if (!String(body.ten_danh_muc || '').trim() || !String(body.slug || '').trim()
      || categories.some((category) => category.slug === body.slug)) {
      return fail(422, 'Tên và đường dẫn danh mục là bắt buộc và phải duy nhất');
    }
    const category = {
      id: Math.max(0, ...categories.map((entry) => Number(entry.id))) + 1,
      ten_danh_muc: String(body.ten_danh_muc).trim(), slug: body.slug, icon: body.icon || 'box',
      thu_tu: Number(body.thu_tu) || categories.length + 1, children: Array.isArray(body.children) ? body.children : [],
    };
    store.set('categories', [...categories, category]);
    return ok(category, 'Đã thêm danh mục');
  }
  if (/^\/admin\/categories\/\d+$/.test(route) && method === 'PUT') {
    const id = Number(route.split('/').pop()), categories = allCategories();
    const index = categories.findIndex((category) => Number(category.id) === id);
    if (index < 0) return fail(404, 'Không tìm thấy danh mục');
    if (!String(body.ten_danh_muc || '').trim() || !String(body.slug || '').trim()
      || categories.some((category) => Number(category.id) !== id && category.slug === body.slug)) {
      return fail(422, 'Tên và đường dẫn danh mục là bắt buộc và phải duy nhất');
    }
    categories[index] = {
      ...categories[index], ...body, id, ten_danh_muc: String(body.ten_danh_muc).trim(),
      thu_tu: Number(body.thu_tu) || categories[index].thu_tu,
      children: Array.isArray(body.children) ? body.children : categories[index].children,
    };
    store.set('categories', categories);
    return ok(categories[index], 'Đã lưu danh mục');
  }
  if (/^\/admin\/categories\/\d+$/.test(route) && method === 'DELETE') {
    const id = Number(route.split('/').pop()), category = adminCategories().find((entry) => Number(entry.id) === id);
    if (!category) return fail(404, 'Không tìm thấy danh mục');
    if (category.product_count > 0) return fail(409, `Không thể xóa vì danh mục còn ${category.product_count} sản phẩm`);
    store.set('categories', allCategories().filter((entry) => Number(entry.id) !== id));
    return ok({}, 'Đã xóa danh mục');
  }
  if (route === '/admin/orders' && method === 'GET') {
    const q = normalizeKeyword(params.get('q') || ''), status = params.get('status') || '', methodFilter = params.get('method') || '';
    const list = allOrders().filter((order) => (!status || order.trang_thai === status)
      && (!methodFilter || order.hinh_thuc_nhan === methodFilter)
      && (!q || normalizeKeyword(`${order.ma_don_hang} ${order.khach_hang.ho_ten} ${order.khach_hang.so_dien_thoai}`).includes(q)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const page = Math.max(1, Number(params.get('page')) || 1), perPage = Math.min(20, Math.max(1, Number(params.get('per_page')) || 20));
    return ok({ items: list.slice((page - 1) * perPage, page * perPage), total: list.length, page, per_page: perPage });
  }
  if (/^\/admin\/orders\/\d+$/.test(route) && method === 'GET') {
    const order = allOrders().find((entry) => Number(entry.id) === Number(route.split('/').pop()));
    return order ? ok(order) : fail(404, 'Không tìm thấy đơn hàng');
  }
  if (/^\/admin\/orders\/\d+\/status$/.test(route) && method === 'PATCH') {
    const id = Number(route.split('/')[3]), orders = allOrders(), order = orders.find((entry) => Number(entry.id) === id);
    if (!order) return fail(404, 'Không tìm thấy đơn hàng');
    const next = order.hinh_thuc_nhan === 'cod'
      ? { cho_xu_ly: 'dang_giao', dang_giao: 'thanh_cong' }
      : { cho_xu_ly: 'cho_lay_hang', cho_lay_hang: 'thanh_cong' };
    if (next[order.trang_thai] !== body.trang_thai) return fail(422, 'Trạng thái đơn hàng không thể chuyển theo quy tắc hiện tại');
    order.trang_thai = body.trang_thai;
    order.updated_at = new Date().toISOString();
    store.set('orders', orders);
    return ok(order, 'Đã cập nhật trạng thái đơn hàng');
  }
  if (/^\/admin\/orders\/\d+\/cancel$/.test(route) && method === 'POST') {
    const id = Number(route.split('/')[3]), orders = allOrders(), order = orders.find((entry) => Number(entry.id) === id);
    if (!order) return fail(404, 'Không tìm thấy đơn hàng');
    if (['thanh_cong', 'da_huy'].includes(order.trang_thai)) return fail(422, 'Không thể hủy đơn hàng ở trạng thái này');
    if (!String(body.ly_do || '').trim()) return fail(422, 'Vui lòng nhập lý do hủy đơn hàng');
    order.trang_thai = 'da_huy'; order.ly_do_huy = String(body.ly_do).trim(); order.updated_at = new Date().toISOString();
    store.set('orders', orders);
    return ok(order, 'Đã hủy đơn hàng');
  }
  if (/^\/admin\/orders\/\d+\/shipping$/.test(route) && method === 'PATCH') {
    const id = Number(route.split('/')[3]), orders = allOrders(), order = orders.find((entry) => Number(entry.id) === id);
    const shipping = Number(body.phi_ship);
    if (!order) return fail(404, 'Không tìm thấy đơn hàng');
    if (!Number.isInteger(shipping) || shipping < 0 || shipping > 100000) return fail(422, 'Phí giao hàng phải từ 0 đến 100.000đ');
    order.phi_ship = shipping; order.tong = order.tam_tinh - order.giam_gia + shipping; order.updated_at = new Date().toISOString();
    store.set('orders', orders);
    return ok(order, 'Đã cập nhật phí giao hàng');
  }
  if (route === '/admin/products' && method === 'GET') {
    const all = allProducts();
    return ok({ items: all, categories: allCategories() });
  }
  if (route === '/admin/products' && method === 'POST') {
    const all = allProducts();
    const product = { ...body, id: Math.max(0, ...all.map((p) => p.id)) + 1, gia_hieu_luc: body.gia_ban, phan_tram_giam: 0, luot_ban: 0 };
    store.set('products', [...all, product]);
    return ok(product, 'Đã thêm sản phẩm');
  }
  if (/^\/admin\/products\/\d+$/.test(route) && method === 'PUT') {
    const id = Number(route.split('/').pop()), all = allProducts();
    const index = all.findIndex((p) => p.id === id);
    if (index < 0) return fail(404, 'Không tìm thấy sản phẩm');
    all[index] = { ...all[index], ...body, id, gia_hieu_luc: body.gia_ban };
    store.set('products', all); return ok(all[index], 'Đã lưu thay đổi');
  }
  if (/^\/admin\/products\/\d+$/.test(route) && method === 'DELETE') {
    const id = Number(route.split('/').pop()), all = allProducts();
    store.set('products', all.filter((p) => p.id !== id)); return ok({}, 'Đã xóa sản phẩm');
  }
  if (route === '/admin/products/bulk-delete' && method === 'POST') {
    const ids = new Set(body.ids || []);
    store.set('products', allProducts().filter((p) => !ids.has(p.id))); return ok({});
  }
  if (route === '/admin/products/reset' && method === 'POST') { store.set('products', PRODUCTS); return ok({}); }
  if (route === '/admin/promotions/friday' && method === 'GET') return ok(fridayProgram() || { id: 'friday-sale', enabled: true, productIds: [] });
  if (route === '/admin/promotions/friday' && method === 'PUT') {
    const promo = saveFridayProgram({ id: 'friday-sale', name: 'Siêu sale Thứ 6', enabled: Boolean(body.enabled), productIds: [...new Set(body.productIds || [])].slice(0, 10) });
    return ok(promo, 'Đã lưu chương trình');
  }
  if (route === '/admin/promotions/friday/random' && method === 'POST') {
    const products = allProducts().filter((p) => p.so_luong_ton > 0 && p.trang_thai !== 'an').sort(() => Math.random() - .5).slice(0, 10);
    const promo = saveFridayProgram({ ...(fridayProgram() || { id: 'friday-sale', name: 'Siêu sale Thứ 6', enabled: true }), productIds: products.map((p) => p.id) });
    return ok(promo, 'Đã chọn ngẫu nhiên 10 sản phẩm');
  }
  return fail(501, 'Chưa hỗ trợ trong chế độ mẫu');
}
