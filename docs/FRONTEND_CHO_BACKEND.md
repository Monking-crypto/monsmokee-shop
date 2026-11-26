# Bàn giao tích hợp Frontend – Backend

## Phiên bản và môi trường

- Ngày kiểm tra: 2026-11-26.
- Nhánh frontend: `Frontend`, `HEAD` tại `98d8c30`; các thay đổi của đợt bàn giao này chưa commit.
- Backend đối chiếu: `origin/main` tại `22f0ffd`. Không dùng thay đổi backend cục bộ làm hợp đồng.
- URL XAMPP hiện tại: `http://localhost/monsmokee-shop/frontend/`; API được ghép thành `/monsmokee-shop/backend/public/api`.

## Cấu hình kết nối

`frontend/assets/js/core/config.js` đặt `USE_MOCK: true`, `USE_AUTH_MOCK: false`. Các luồng được cấu hình rõ trong `LIVE`:

| Nhóm | Cấu hình | Trạng thái |
|---|---:|---|
| Danh mục, sản phẩm, chi tiết | `catalog: true` | Đã kiểm tra GET thành công |
| Siêu sale công khai | `promotions: true` | Đã kiểm tra GET thành công |
| Thông tin cửa hàng | `store: true` | Đã kiểm tra GET thành công |
| Khu vực và báo phí giao hàng | `shipping: true` | GET và POST quote an toàn đã kiểm tra |
| Nhập kho, lịch sử, lô hàng | `adminInventory: false` | Chưa bật; cần phiên Admin và kiểm thử có kiểm soát |
| Quản lý khuyến mãi Admin | `adminPromotions: false` | Chưa bật; cần phiên Admin và kiểm thử có kiểm soát |
| Khu vực giao hàng Admin | `adminDeliveryAreas: false` | Chưa bật; cần phiên Admin và kiểm thử có kiểm soát |

`frontend/assets/js/core/api.js` gửi `credentials: 'same-origin'` cho mọi request; request ghi dữ liệu lấy CSRF qua `GET /csrf`, gửi `X-CSRF-Token` và thử lại một lần khi nhận `403` với `errors.code = CSRF_INVALID`. API client đọc envelope `{success, message, data, errors}`, xử lý các mã lỗi HTTP và nhận `SESSION_EXPIRED`. API cùng origin để PHP session cookie hoạt động.

## Các luồng đã nối với API thật

| Chức năng | API và dữ liệu chính | Ghi chú |
|---|---|---|
| Danh mục | `GET /categories` → `data.categories` | Icon dự phòng theo slug nếu backend không trả icon. |
| Danh sách sản phẩm | `GET /products?page=&per_page=12&sort=&category_id=&q=` → `products`, `pagination.has_more` | Chỉ gửi các sort backend hỗ trợ: `newest`, `price_asc`, `price_desc`. |
| Chi tiết sản phẩm | `GET /products/{id}` → `data.product` | Dùng `gia_goc`, `gia_ban_hieu_luc`, `phan_tram_giam`, `anh`, `anh_thumb`, `danh_muc`, `con_hang`. |
| Hàng cận hạn | `GET /products?near_expiry=1&per_page=20` | Hiển thị HSD khi API xác định khuyến mãi `CAN_HAN`; frontend tính số ngày theo múi giờ Việt Nam và tự sắp xếp. |
| Siêu sale công khai | `GET /promotions/active` → `promotions[]` | Frontend lọc `loai=THU_SAU`; countdown dùng khung Thứ 6 tại Việt Nam, không dùng ngày hết hạn dài hạn của bản ghi khuyến mãi. |
| Thông tin cửa hàng | `GET /store-info` | Khi API lỗi, hiện thông báo và dùng giá trị cấu hình dự phòng. |
| Khu vực giao hàng | `GET /shipping/areas` → `areas[]` | Chọn khu vực từ `tinh`, `quan_huyen`, `phuong_xa`, `khoang_cach_km`. |
| Báo phí | `POST /shipping/quote` | JSON gồm `khu_vuc_id` và `tien_hang_sau_giam` là số nguyên; đọc `phi_ship_tam_tinh`, `mien_phi`, `ly_do`, `cho_phep_cod`, `giao_duoc`. |

Ảnh backend có dạng `uploads/products/...`; `frontend/assets/js/core/catalog.js` ghép thành URL dưới `backend/public`. Ảnh placeholder dùng tài nguyên frontend.

## Admin đã chuẩn bị nhưng đang để mock

- **Kho:** `GET /admin/products`, `GET /admin/categories`, `POST /admin/stock-receipts` với `ngay_nhap`, `nha_cung_cap`, `ghi_chu`, `chi_tiet[{san_pham_id, so_luong, gia_nhap, han_su_dung, so_lo}]`; lịch sử dùng `GET /admin/stock-history`, cảnh báo lô dùng `GET /admin/batches?expiring_within_days=10`.
- **Khuyến mãi:** dùng `GET/POST /admin/promotions`, `GET/PUT /admin/promotions/{id}`, `POST /admin/promotions/{id}/random-products`; chọn sản phẩm gửi trong `san_pham_ids`, bật/tắt bằng `trang_thai`.
- **Khu vực giao hàng:** có trang Admin mới; dùng `GET/POST /admin/delivery-areas`, `PUT /admin/delivery-areas/{id}`, `PATCH /admin/delivery-areas/{id}/status` với các trường đúng validator (`tinh`, `quan_huyen`, `phuong_xa`, `khoang_cach_km`, `ho_tro`).

Các nhóm này chưa bật live vì chưa thể xác minh thao tác với phiên Admin thật; không tự gửi request ghi dữ liệu để kiểm thử. Hãy bật từng cờ `LIVE` sau khi kiểm thử thủ công trên dữ liệu thử nghiệm.

## Chưa nối hoặc còn phụ thuộc backend

- Giỏ hàng, đặt hàng và phần lớn dữ liệu Admin khác vẫn theo chế độ mock; không kết luận các chức năng này đã nối API thật.
- Backend `origin/main` không hỗ trợ `sort=best`; trang Bán chạy được ẩn khi catalog live.
- Backend `origin/main` hiện chỉ có `GET /admin/me`, chưa có route cập nhật hồ sơ/mật khẩu. Frontend có thông báo khi endpoint cập nhật trả `404/405`, nhưng **đổi tên Admin chưa thể hoạt động với bản backend này**; cần backend công bố và triển khai route cập nhật.
- Không dựa vào `/api/home`; trang chủ tải các nhóm dữ liệu riêng từ API.
- Đăng nhập khách và Admin tiếp tục là hai luồng/trang riêng. Backend dùng endpoint, rate limit và kiểm tra quyền riêng; tài khoản khách không được đổi sang Admin chỉ bằng giao diện.
- `/admin/dashboard` trong `origin/main` còn là stub; dữ liệu dashboard không được coi là nối thật.

## Kiểm tra API và giao diện

Đã nhận HTTP 200 và `success=true` cho các GET: `/csrf`, `/products`, `/products?near_expiry=1`, `/categories`, `/store-info`, `/promotions/active`, `/shipping/areas`, `/products/{id}`. Đã gửi một `POST /shipping/quote` có CSRF; trả 200 và đủ trường quote, không ghi dữ liệu.

Đã mở trang chủ, trang cận hạn và Siêu sale. Kiểm tra ảnh thẻ cận hạn tại viewport 360/768/1280px: khung ảnh lần lượt 88×88, 112×112, 112×112. Mô phỏng ngày `2026-11-27` trên localhost cho thấy trang sale có 10 sản phẩm và countdown dưới 1 ngày.

Một `401` trên `GET /auth/me` khi mở website chưa đăng nhập là kết quả dự kiến. Chưa thử đăng nhập, OTP/email, các endpoint ghi dữ liệu khác, hoặc Admin thật.

### Kiểm thử Siêu sale cục bộ

Chỉ trên `localhost` hoặc `127.0.0.1`, đặt `localStorage.ms_dev_friday` thành một ngày Thứ 6 hợp lệ dạng `YYYY-MM-DD`; frontend sẽ thêm `now` vào GET sản phẩm/khuyến mãi để kiểm thử. Xóa giá trị sau khi thử. Backend chỉ chấp nhận tham số `now` trong môi trường development.
