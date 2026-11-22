# Bàn giao frontend cho backend

## Danh mục và sản phẩm

Cập nhật `database/seed.sql` theo thứ tự danh mục:

1. Bánh kẹo: Bánh quy, Kẹo, Snack, Bánh ngọt.
2. Mì gói: Mì ăn liền, Hủ tiếu, Miến, Phở và bún ăn liền, Nui, Mì Ý.
3. Bia: Bia lon, Bia chai, Thùng bia.
4. Sữa: Sữa tươi, Sữa đặc, Sữa chua, Sữa bột.
5. Nước giải khát: Nước suối, Nước ngọt, Trà, Nước trái cây, Nước tăng lực.
6. Vệ sinh gia đình: Giặt giũ, Nước rửa chén, Lau nhà, Giấy vệ sinh.
7. Đồ cúng: Nhang, Đèn cầy, Giấy cúng, Đồ lễ.
8. Chăm sóc cá nhân: Dầu gội, Sữa tắm, Chăm sóc răng miệng, Khử mùi.
9. Gia vị: Dầu ăn, Nước mắm, Nước tương, Muối, Đường.
10. Thuốc lá: Thuốc lá điếu, Thuốc lá bao.
11. Đồ dùng gia đình: Đồ bếp, Đồ nhựa, Pin và đèn, Dụng cụ.
12. Trứng: Trứng gà, Trứng vịt, Trứng cút.
13. Kem: Kem que, Kem hộp, Kem ốc quế.

Thêm các trường sản phẩm `nhom_con`, `huong_vi`, `dong_goi` vào schema/model/validation/API. Giá bán phải là số nguyên dương, tồn kho là số nguyên không âm. Sản phẩm đã được dùng trong đơn hàng nên được ẩn thay vì xóa cứng.

## Mật khẩu và OTP

- Đổi `OTP_TTL_SECONDS` từ 180 thành 300 trong `backend/config/business.php`.
- Sửa `RE_PASSWORD` trong `Validator.php`: tối thiểu 8 ký tự, có ít nhất một chữ thường và một chữ số; không yêu cầu chữ hoa hay ký tự đặc biệt.
- OTP đăng ký chỉ tạo tài khoản sau khi xác thực thành công; giới hạn 5 lần nhập sai và cho gửi lại sau 60 giây.

## Đăng nhập quản trị

- `POST /admin/auth/login`: nhận số điện thoại/mật khẩu; xác thực quyền quản trị, gửi OTP email và trả `otp_required: true` cùng email đã che.
- `POST /admin/auth/verify-otp`: xác thực OTP, chỉ tạo phiên quản trị khi OTP hợp lệ.
- `POST /admin/auth/otp/resend`: gửi lại OTP theo giới hạn thời gian.
- Email OTP lấy từ `ADMIN_OTP_EMAIL` trong `backend/.env`; tuyệt đối không đặt thông tin xác thực thật trong frontend.
- Tạo quản trị viên bằng `seed_admin.php`, băm mật khẩu bằng bcrypt. Tài khoản khách đăng nhập vào luồng admin phải nhận HTTP 403.

## API cần cung cấp

- CRUD quản trị sản phẩm: `GET/POST/PUT/DELETE /admin/products`.
- Tải ảnh sản phẩm: `POST /admin/uploads/product-image` (JPG/PNG/WebP, tối đa 2MB).
- Siêu sale: `/home` trả `friday_sale.products` rỗng ngoài Thứ 6 theo múi giờ `Asia/Ho_Chi_Minh`; cung cấp API quản trị để bật/tắt chương trình và chọn tối đa 10 sản phẩm.
- Địa giới giao hàng: `GET /locations/provinces`, `GET /locations/districts?province=...`, `GET /locations/wards?district=...`. Trả danh sách địa giới cập nhật theo dữ liệu thực tế; khu vực giao hiện tại giới hạn nội thành Đồng Hới.

## YC2 — Trang cận hạn (A5)

- Trang `can-han.html` gọi `GET /products?near_expiry=1&sort=hsd&per_page=20`.
- Chỉ trả sản phẩm đang bán, chưa hết hạn, còn hạn từ 1 đến 10 ngày; mỗi sản phẩm có `near_expiry_days`, `hsd` (ngày `YYYY-MM-DD`), `phan_tram_giam: 50` và `so_luong_ton`.
- Sắp xếp `near_expiry_days` tăng dần. Ngày HSD chỉ được hiển thị tại trang cận hạn và khối cận hạn trên trang chủ.
- Dữ liệu sản phẩm mẫu cận hạn cần ít nhất 8 sản phẩm, hạn tự dịch theo ngày hiện tại.

## YC2 — Giỏ hàng (A7)

- `GET /cart` trả:
  ```json
  {
    "items": [
      {
        "san_pham": {"id": 1, "ten_san_pham": "...", "so_luong_ton": 10},
        "so_luong": 2,
        "don_gia": 12000,
        "thanh_tien": 24000
      }
    ],
    "count": 2,
    "tam_tinh": 24000,
    "giam_gia": 0,
    "phi_ship_tam_tinh": 0,
    "tong": 24000
  }
  ```
- Khi địa chỉ giao hàng chưa được chọn/chưa có khoảng cách, `phi_ship_tam_tinh` có thể là `null`; sau khi có khoảng cách hoặc chọn nhận tại cửa hàng, trả phí đã tính.
- Hỗ trợ `POST /cart/items` (body `{san_pham_id, so_luong}`), `PUT /cart/items/{id}` (body `{so_luong}`), `DELETE /cart/items/{id}` và `DELETE /cart`. Trả envelope API chuẩn; PUT/DELETE trả lại dữ liệu giỏ để frontend cập nhật.
- Phí giao hàng: 0đ nếu giá trị hàng sau giảm ≥150.000đ hoặc khoảng cách ≤2,5km; 15.000đ nếu giá trị hàng sau giảm từ 50.000đ đến dưới 150.000đ và xa hơn 2,5km; nhận tại cửa hàng 0đ. Dưới 50.000đ không cho đặt giao hàng.
- Trả `distance_km` cho địa chỉ giao hàng đã chọn (hoặc trả phí giao hàng đã tính trong `GET /cart`). Dữ liệu mẫu hiện dùng khoảng cách ước tính theo phường; backend cần tính khoảng cách thực từ địa chỉ đến cửa hàng.

## YC2 — Bảng xếp hạng bán chạy (A8)

- Trang `ban-chay.html` gọi `GET /products?sort=best&per_page=20&page={n}`; thêm `category={slug}` khi lọc danh mục.
- Sắp xếp theo `luot_ban` giảm dần và trả `total`, `page`, `per_page`; mỗi sản phẩm phải có `luot_ban` là số nguyên.

## YC2 — Admin đăng nhập và quản lý sản phẩm (A9 P1)

- Đăng nhập admin hai bước: `POST /admin/auth/login`, `POST /admin/auth/verify-otp`, `POST /admin/auth/otp/resend`, `GET /admin/auth/me`, `POST /admin/auth/logout`. OTP bắt buộc mỗi lần đăng nhập, hết hạn sau 5 phút, gửi lại sau 60 giây và tối đa 5 lần nhập sai. Tài khoản khách phải nhận 403.
- CRUD sản phẩm: `GET/POST /admin/products`, `PUT/DELETE /admin/products/{id}`; hỗ trợ tìm/lọc/phân trang phía giao diện. Bổ sung `POST /admin/products/bulk-delete` hoặc thống nhất endpoint xóa hàng loạt.
- Upload ảnh: `POST /admin/uploads/product-image`, JPG/PNG/WebP tối đa 2MB. Sản phẩm thuộc đơn hàng không xóa cứng; backend cần ẩn sản phẩm và giữ dữ liệu đơn hàng.
- Tài khoản demo chỉ cấu hình cục bộ trong `frontend/assets/js/core/mock.secrets.js` (đã ignore); tuyệt đối không đưa thông tin xác thực vào file được commit. Backend mới chịu trách nhiệm xác thực quyền admin và gửi email OTP.

## YC2 — Admin dashboard, danh mục và đơn hàng (A9 P2)

- `GET /admin/dashboard` trả `kpi` (doanh thu hôm nay/tháng, đơn chờ xử lý/chờ lấy hàng, số sản phẩm sắp hết/cận hạn), `doanh_thu_7_ngay`, `top_ban_chay`, `don_hang_moi`, `canh_bao_kho` (gồm ngày HSD) và `khuyen_mai`.
- `GET/POST /admin/categories`, `PUT/DELETE /admin/categories/{id}`. Danh mục trả `id`, `ten_danh_muc`, `slug`, `icon`, `thu_tu`, `children: [{ten, slug}]`, `product_count`. Từ chối xóa danh mục còn sản phẩm bằng HTTP 409.
- `GET /admin/orders?status=&method=&q=&page=&per_page=`, `GET /admin/orders/{id}`, `PATCH /admin/orders/{id}/status` body `{trang_thai}`, `POST /admin/orders/{id}/cancel` body `{ly_do}`, `PATCH /admin/orders/{id}/shipping` body `{phi_ship}`.
- Trạng thái đơn: `cho_xu_ly`, `dang_giao`, `cho_lay_hang`, `thanh_cong`, `da_huy`; COD chỉ đi `cho_xu_ly → dang_giao → thanh_cong`, nhận tại cửa hàng chỉ đi `cho_xu_ly → cho_lay_hang → thanh_cong`. Phí giao hàng là số nguyên 0–100.000đ.
- Frontend mock hiện dùng `GET/PUT /admin/promotions/friday` và `POST /admin/promotions/friday/random`. Đề nghị backend xác nhận các route này hay dùng route chuẩn `/admin/promotions` tại mục 7.
