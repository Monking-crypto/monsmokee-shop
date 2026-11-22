# Thiết kế giao diện MON SMOKEE

## Ý tưởng chính: tem giá kệ hàng
Giá sản phẩm hiển thị như nhãn giá trên kệ tạp hóa (`.shelf-tag`). Hàng giảm giá có tem vàng, giá đỏ, giá gốc gạch ngang.
Phần còn lại giữ phẳng: viền mảnh thay cho bóng đổ, 3 cấp bo góc (12px thẻ, 8px nút/ô nhập, pill cho nhãn).

## Màu và chữ
- Xanh lá `--ms-green` là màu thương hiệu. Cam `--ms-orange` chỉ dùng cho nút hành động chính. Đỏ cho nhãn giảm giá và "Hết hàng". Vàng cho tem giá.
- Chữ: Be Vietnam Pro (400/600/700/800). Mọi giá trị nằm trong `assets/css/variables.css`.

## Cấu trúc
| Lớp | File |
|---|---|
| Token, nền tảng | `variables.css`, `base.css` |
| Thành phần chung (nút, thẻ sản phẩm, toast, skeleton) | `components.css` |
| Trang khách (header, hero, danh mục, footer, bottom nav) | `customer.css` |
| Đăng nhập, đăng ký | `auth.css` |
| Component JS | `assets/js/components/*` |
| Lõi JS (API, định dạng, validate, form) | `assets/js/core/*` |

## Chế độ dữ liệu mẫu
`assets/js/core/config.js` có `USE_MOCK: true`. Khi đó mọi lệnh gọi API được trả bởi `core/mock.js`
(OTP demo là `123456`). Khi backend sẵn sàng, đổi thành `false`.

## Hợp đồng dữ liệu sản phẩm mà giao diện đang đọc
`id, ten_san_pham, hinh_anh, don_vi_tinh, gia_ban, gia_hieu_luc, phan_tram_giam, so_luong_ton`,
tùy chọn `hsd` (chỉ hiện ở mục Cận hạn) và `sap_dien_ra` (Thứ 6 chưa bắt đầu).
`GET /home` trả `categories, friday_sale{active,next_start,ends_at,products}, near_expiry, best_sellers, suggested, sections[{category,products}]`.
`GET /cart` trả `{items, count}`. Backend cần trả đúng các trường này.

## Đã làm / còn lại
Đã làm: trang chủ, đăng nhập, đăng ký 2 bước OTP, header/footer/bottom nav/menu danh mục/tìm kiếm gợi ý.
Còn lại: quen-mat-khau, san-pham, các trang STUB khách (giỏ hàng, thanh toán, đơn hàng...), toàn bộ khu Admin.
