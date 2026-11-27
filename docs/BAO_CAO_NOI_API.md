# Báo cáo kiểm thử tích hợp Frontend – Backend

**Thời điểm kiểm tra:** 2026-11-26 10:51 (+07:00)  
**Phạm vi:** Đọc mã nguồn, tài liệu và chỉ gọi GET công khai; không đăng nhập, gửi OTP/email, ghi dữ liệu, sửa mã nguồn hay commit.

## 1. Kết luận

1. **Đã nối một phần.** Đăng ký/đăng nhập và một số màn hình Admin gọi API thật; danh mục/sản phẩm công khai, giỏ hàng và nhiều màn hình khác vẫn chạy mock.
2. Theo **23 nhóm chức năng** trong ma trận: **NỐI ĐƯỢC 6 · LỆCH 2 · CHƯA NỐI 7 · BACKEND CHƯA CÓ 8**.
3. Chặn lớn nhất: `USE_MOCK=true`; đồng thời backend chưa đăng ký route cho giỏ hàng/đơn hàng/dashboard. Tính năng đổi thông tin Admin chỉ có trong thay đổi cục bộ chưa commit; `origin/main` chưa có API ghi hồ sơ.

## 2. Phiên bản và trạng thái Git

- Backend kiểm tra từ `origin/main`: **`22f0ffd`**, `2026-11-25 14:21:30 +07:00` — “Buoc 14D: chan file nhay cam, chuan hoa anh, phan trang, gzip”.
- Frontend commit hiện tại: **`98d8c30`**, `2026-11-26 10:18:03 +07:00`; nhánh làm việc `Frontend`, theo dõi `origin/Frontend`.
- `git status` ghi nhận 6 file sửa cục bộ, chưa commit: `backend/app/Controllers/Admin/AdminAuthController.php`, `backend/routes/admin.php`, `frontend/assets/js/admin/account.js`, `frontend/assets/js/admin/admin-layout.js`, `frontend/assets/js/core/api.js`, `frontend/assets/js/core/guard.js`.
- Đối chiếu `HEAD` với `origin/main`: backend đã commit trùng; các route/API hồ sơ Admin thêm trong working tree **không có trong `origin/main`**. Bản đã commit của [account.js](../frontend/assets/js/admin/account.js) chỉ đọc hồ sơ.
- README hướng dẫn đặt dự án tại `C:\xampp\htdocs\monsmokee`; working tree hiện ở `C:\xampp\htdocs\monsmokee-shop`. Vì `API_BASE` lấy tiền tố từ URL trang frontend, tên thư mục hiện tại vẫn được ghép đúng. GET thật tại `/monsmokee-shop/backend/public/api/...` trả phản hồi thành công.

## 3. Cơ chế kết nối

| Hạng mục | Kết quả | Bằng chứng |
|---|---|---|
| API base, `/api`, thư mục dự án | **Đúng khi mở qua Apache tại `/monsmokee-shop/frontend/`.** Ghép thành `/monsmokee-shop/backend/public/api`; GET thật xác nhận đường dẫn hoạt động. | [config.js](../frontend/assets/js/core/config.js#L3), [README.md](../README.md#L13) |
| Mock | **Có.** `USE_MOCK=true`; chỉ auth, `/admin/me`, Admin categories/products được ép gọi backend. Các API khách khác và Admin khác mặc định mock. | [config.js](../frontend/assets/js/core/config.js#L5), [api.js](../frontend/assets/js/core/api.js#L15) |
| Cùng origin/session | **Có nếu frontend và backend cùng host/port.** Cả GET CSRF lẫn request API đều đặt `credentials: 'same-origin'`. | [api.js](../frontend/assets/js/core/api.js#L67), [api.js](../frontend/assets/js/core/api.js#L88) |
| CSRF | Request ghi dữ liệu lấy `GET /csrf`, gửi `X-CSRF-Token`; khi gặp 403 nhận diện CSRF thì lấy token mới và thử lại một lần. Backend trả `errors.code=CSRF_INVALID` và message có chữ CSRF nên hiện được nhận diện qua message; frontend **chưa đọc trực tiếp `errors.code`**, hơi mong manh. | [api.js](../frontend/assets/js/core/api.js#L42), [api.js](../frontend/assets/js/core/api.js#L111), [CsrfMiddleware.php](../backend/app/Middleware/CsrfMiddleware.php#L8) |
| Envelope/lỗi | **Khớp phần lõi:** backend `{success,message,data,errors}`, client chỉ trả `data` khi success và đưa `errors` vào `ApiError`. 401 Admin phát sự kiện hết phiên; 403/409/422/429 dùng message backend; 429 đọc `errors.retry_after` hoặc header. Hiển thị lỗi theo field chỉ có ở một số form, không đồng nhất mọi màn hình. | [Response.php](../backend/core/Response.php#L10), [api.js](../frontend/assets/js/core/api.js#L35), [api.js](../frontend/assets/js/core/api.js#L121) |
| Rewrite/chặn file | **Đúng với URL đã thử.** `backend/public/.htaccess` rewrite route về `index.php`; `.htaccess` gốc chặn file/thư mục ẩn, `.env`, mã backend nội bộ, `database`, `docs` và tắt liệt kê thư mục. Lưu ý báo cáo nằm trong `docs/` nên rule hiện tại chặn đọc trực tiếp qua Apache. | [.htaccess](../.htaccess), [backend/public/.htaccess](../backend/public/.htaccess), [Request.php](../backend/core/Request.php#L11) |
| Giá sản phẩm Admin | **Đúng kiểu.** Form xóa ký tự phân cách, kiểm tra số nguyên an toàn rồi gửi `gia` kiểu JSON number; backend chỉ nhận số nguyên dương JSON, không nhận chuỗi/số thập phân. | [products.js](../frontend/assets/js/admin/products.js#L160), [ProductAdminController.php](../backend/app/Controllers/Admin/ProductAdminController.php#L521) |

### GET đã chạy (không gọi POST/PUT/PATCH/DELETE)

Các kết quả sau lấy từ `http://localhost/monsmokee-shop/backend/public/api`; không in giá trị token hay dữ liệu cá nhân.

| GET | Kết quả |
|---|---|
| `/csrf` | HTTP 200, `success=true`, data có `csrf_token` |
| `/products` | HTTP 200, `success=true`, data có `products,pagination`; item có `gia_goc`, `phan_tram_giam`, `gia_ban_hieu_luc`, `nhan_khuyen_mai`, `anh_thumb` |
| `/categories` | HTTP 200, `success=true`, data có `categories` |
| `/store-info` | HTTP 200, `success=true`, data có `ten_cua_hang,dia_chi,hotline,gio_mo_cua,gio_dong_cua` |
| `/promotions/active` | HTTP 200, `success=true`, data có `promotions` |
| `/products?near_expiry=1&per_page=50` | HTTP 200, `success=true`, có `products,pagination` |
| `/products?sort=best&per_page=20&page=1` | **HTTP 422** |
| `/locations/provinces`, `/home`, `/cart` | **HTTP 404** |

## 4. API backend theo `origin/main`

Nguồn route là `origin/main:backend/routes/customer.php` (L48–L115) và `origin/main:backend/routes/admin.php` (L54–L207); các phương thức/field được đối chiếu controller và [API.md](./API.md). Mọi response thành công dùng envelope chuẩn. CSRF áp dụng cho POST/PUT/PATCH/DELETE theo route; Admin API còn cần session Admin đã xác thực OTP. Các POST/PUT/PATCH/DELETE Admin thường trả 401/403/404/409/422/500 tùy lỗi cụ thể.

### Customer/public

| Endpoint | Quyền / CSRF | Request | Response / lỗi chính |
|---|---|---|---|
| `GET /api/csrf` | Public, không cần CSRF | Không có | `data.csrf_token`; 500 |
| `GET /api/categories` | Public | Không có | `data.categories[]`: `id,ten_danh_muc,slug,icon,thu_tu`; 500 |
| `GET /api/products` | Public | Query `page,per_page,q,category_id,sort,near_expiry,now`; `sort` chỉ `newest,price_asc,price_desc` | `data.products[]`, `data.pagination` gồm `page,per_page,total,has_more`; item có giá hiệu lực/ảnh thumbnail; 422, 500 |
| `GET /api/products/{id}` | Public | ID trên path | `data.product`; 404, 422/500 tùy ID/query |
| `GET /api/promotions/active` | Public | Query `now` chỉ dùng development | `data.promotions[]`, sản phẩm có giá hiệu lực và `anh_thumb`; 422/500 |
| `GET /api/shipping/areas` | Public | Query lọc `tinh`, `quan_huyen` | `data.areas[]`: khu vực và khoảng cách |
| `POST /api/shipping/quote` | Public, CSRF | `khu_vuc_id` integer, `tien_hang_sau_giam` integer | `phi_ship_tam_tinh,mien_phi,ly_do,cho_phep_cod,khoang_cach_km,giao_duoc`; 403, 422, 500 |
| `GET /api/store-info` | Public | Không có | `ten_cua_hang,dia_chi,hotline,gio_mo_cua,gio_dong_cua`; 500 |
| `POST /api/auth/register/start` | CSRF | `ho_ten,so_dien_thoai,email,mat_khau,nhap_lai_mat_khau` | email che, thời hạn/cooldown; 403, 409, 422, 429, 500 |
| `POST /api/auth/register/verify` | CSRF | `email,otp` | `data.user` (`id,ho_ten,so_dien_thoai,email,vai_tro`); 201, 403, 409, 422 |
| `POST /api/auth/otp/resend` | CSRF | `email` | email che, thời hạn/cooldown; 403, 404, 409, 422, 429, 500 |
| `POST /api/auth/login` | CSRF | `so_dien_thoai,mat_khau` | `data.user`; 401, 403, 422, 429. Admin bị từ chối |
| `GET /api/auth/me` | Customer session | Không có | `data.user`; 401 |
| `POST /api/auth/logout` | CSRF | Không có | data null; 403 |
| `POST /api/auth/forgot-password/start` | CSRF | `email` | data null, thông báo chung; 403/500 |
| `POST /api/auth/forgot-password/verify-otp` | CSRF | `email,otp` | `reset_ticket,expires_in_seconds`; 403, 422, 429 |
| `POST /api/auth/forgot-password/reset` | CSRF | `email,reset_ticket,mat_khau,nhap_lai_mat_khau` | data null; 403, 422, 429 |
| `POST /api/auth/forgot-password/resend` | CSRF | `email` | data null, thông báo chung; 403, 429, 500 |
| `POST /api/auth/forgot-password/verify` | CSRF; endpoint cũ deprecated | `email,otp,mat_khau,nhap_lai_mat_khau` | data null; 403, 422, 429 |

### Admin

| Endpoint | Quyền / CSRF | Request | Response / lỗi chính |
|---|---|---|---|
| `POST /api/admin/auth/login` | CSRF | `so_dien_thoai,mat_khau` | `requires_otp,email_masked,expires_in_seconds,resend_after_seconds`; 401, 403, 422, 429, 500 |
| `POST /api/admin/auth/verify-otp` | Pending Admin + CSRF | `otp` | `data.user`; 401, 403, 422 |
| `POST /api/admin/auth/otp/resend` | Pending Admin + CSRF | `{}`/không cần email | email che và cooldown; 401, 403, 429, 500 |
| `POST /api/admin/auth/logout` | CSRF; logout xử lý session hết hạn | Không có | data null; 401 `SESSION_EXPIRED`, 403 CSRF |
| `GET /api/admin/me` | Admin đã OTP | Không có | `data.user`; 401, 403 |
| `GET /api/admin/categories` | Admin | Không có | `data.categories[]` |
| `POST, PUT /api/admin/categories[/{id}]` | Admin + CSRF | `ten_danh_muc` bắt buộc, `thu_tu` tùy chọn; không gửi `slug/icon/nhom_con` | `id`; POST 201, PUT 200; 404/409/422 |
| `PATCH /api/admin/categories/{id}/visibility` | Admin + CSRF | `trang_thai` 0/1 | `id,trang_thai`; 404/422 |
| `GET /api/admin/products` | Admin | `page,per_page,q,category_id,trang_thai` | `data.products[],pagination`; item gồm `ten,gia,anh,anh_thumb,so_luong_ton,...` |
| `GET /api/admin/products/{id}` | Admin | ID trên path | `data.product`, lô và tồn kho; 404 |
| `POST, PUT /api/admin/products[/{id}]` | Admin + CSRF | `ten,danh_muc_id,gia` (JSON integer), `don_vi_tinh,mo_ta,anh`; không nhận tồn kho/HSD/trạng thái hay field cũ | `id`; POST 201, PUT 200; 404/409/422 |
| `PATCH /api/admin/products/{id}/visibility` | Admin + CSRF | `trang_thai` 0/1 | `id,trang_thai`; 404/422 |
| `DELETE /api/admin/products/{id}` | Admin + CSRF | ID trên path | `id,deleted`; sản phẩm có giao dịch được ẩn; 404/409 |
| `POST /api/admin/products/{id}/image` | Admin + CSRF | multipart `image`, JPG/PNG/WebP ≤2MB | `id,anh,anh_thumb,url,thumb_url`; 404/413/422 |
| `POST /api/admin/stock-receipts` | Admin + CSRF | `nha_cung_cap,ngay_nhap,ghi_chu,chi_tiet[]`; từng dòng `san_pham_id,so_luong,gia_nhap,han_su_dung,so_lo` | `id,ma_phieu,tong_tien_nhap`; 201/422 |
| `GET /api/admin/stock-receipts`, `GET /api/admin/stock-receipts/{id}` | Admin | Query phân trang/ngày; hoặc ID | Danh sách hoặc `receipt`; 404/422 |
| `POST /api/admin/stock-receipts/{id}/cancel` | Admin + CSRF | ID trên path | Thông tin phiếu hủy; 404/409/422 |
| `GET /api/admin/batches`, `GET /api/admin/stock-history` | Admin | Batches: `product_id`, `expiring_within_days` hoặc `expired=1`; history: `product_id,page,per_page` | `batches[]` hoặc lịch sử; 422 |
| `GET /api/admin/promotions`, `GET /api/admin/promotions/{id}` | Admin | Query lọc/phân trang hoặc ID | `promotions[]` hoặc chi tiết |
| `POST /api/admin/promotions`, `PUT /api/admin/promotions/{id}` | Admin + CSRF | `ma_khuyen_mai,ten_chuong_trinh,loai,phan_tram_giam,so_san_pham,san_pham_ids,ngay_bat_dau,ngay_ket_thuc,trang_thai` | `id`; 201/200; 404/409/422 |
| `PATCH /api/admin/promotions/{id}/status` | Admin + CSRF | `trang_thai` | Kết quả kích hoạt/tạm dừng; 404/422 |
| `POST /api/admin/promotions/{id}/random-products` | Admin + CSRF | ID trên path | Danh sách sản phẩm được chọn; 404/422 |
| `DELETE /api/admin/promotions/{id}` | Admin + CSRF | ID trên path | data null; 404/409 |
| `GET /api/admin/delivery-areas` | Admin | Không có | `data.areas[]` |
| `POST, PUT /api/admin/delivery-areas[/{id}]` | Admin + CSRF | `tinh,quan_huyen,phuong_xa,khoang_cach_km,ho_tro` | `id`; 201/200; 404/409/422 |
| `PATCH /api/admin/delivery-areas/{id}/status` | Admin + CSRF | `ho_tro` 0/1 | `id,ho_tro`; 404/422 |

**Không thấy route trong `origin/main`:** `/api/home`, `/api/cart*`, `/api/checkout*`, `/api/orders*`, `/api/admin/dashboard`, `/api/admin/orders*`, `/api/admin/customers*`, `/api/admin/reports*`, `/api/locations/*`, hay cập nhật hồ sơ Admin (`PUT /api/admin/me`, `PATCH /api/admin/me/password`). Một số controller tồn tại nhưng route chưa đăng ký.

## 5. Ma trận chức năng frontend/backend

`api.js` trả `json.data` cho module gọi. Vì vậy các trường dưới đây là đường dẫn trường dùng sau khi đã bỏ envelope.

| Chức năng | API backend | Frontend gọi / dữ liệu dùng | Trạng thái | Bên cần sửa / việc cần làm |
|---|---|---|---|---|
| Customer đăng ký start, OTP verify, resend | POST `/auth/register/start`, `/register/verify`, `/otp/resend` | [register.js:71,162,198](../frontend/assets/js/pages/register.js); gửi đúng `ho_ten,so_dien_thoai,email,mat_khau,nhap_lai_mat_khau,email,otp`; đọc email mask/timer, OTP | **NỐI ĐƯỢC** | — |
| Customer login/logout/me | POST `/auth/login`, POST `/auth/logout`, GET `/auth/me` | [login.js:14,33](../frontend/assets/js/pages/login.js), [account.js:101,127](../frontend/assets/js/pages/account.js), [header.js:66,89](../frontend/assets/js/components/header.js); fields/`data.user` tương thích | **NỐI ĐƯỢC** | — |
| Quên mật khẩu 3 bước | POST start/verify-otp/reset; resend | [forgot.js:211,234,323,372](../frontend/assets/js/pages/forgot.js); gửi `email,otp,reset_ticket,mat_khau,nhap_lai_mat_khau`; đọc ticket và thời hạn. Start response data null được xử lý bằng thời hạn mặc định | **NỐI ĐƯỢC** | — |
| Admin login, OTP, resend, logout, `/admin/me`, phiên 30 phút | API admin auth tách riêng; OTP bắt buộc | [admin-login.js:78,123,159](../frontend/assets/js/admin/admin-login.js), [admin-layout.js:138](../frontend/assets/js/admin/admin-layout.js), [guard.js:14](../frontend/assets/js/core/guard.js); `requires_otp` khớp backend | **NỐI ĐƯỢC** | — |
| Đổi tên/thông tin/mật khẩu Admin | `origin/main` chỉ có GET `/admin/me` | `HEAD` chỉ xem; working tree chưa commit đang gọi PUT `/admin/me` và PATCH `/admin/me/password` từ [account.js:26,57](../frontend/assets/js/admin/account.js) | **BACKEND CHƯA CÓ** | Backend cần công bố endpoint có xác thực Admin + CSRF; sau đó commit frontend. Local route/controller thay đổi chưa được push. |
| Danh mục công khai | GET `/categories` | [catalog.js:5](../frontend/assets/js/core/catalog.js); adapter đọc `data.categories`, nhưng `USE_MOCK=true` nên response đến từ mock | **CHƯA NỐI** | Frontend cần bật live cho catalog sau khi xác nhận contract. |
| Danh sách/chi tiết sản phẩm công khai | GET `/products`, `/products/{id}` | [catalog.js:14](../frontend/assets/js/core/catalog.js), [product-detail.js:145](../frontend/assets/js/pages/product-detail.js); map giá `gia_goc/gia_ban_hieu_luc`, ảnh `anh_thumb`, hạn `han_su_dung`; hiện mock | **CHƯA NỐI** | Frontend cần chuyển API công khai khỏi mock. |
| Cận hạn, phân trang | GET `/products?near_expiry=1` | [near-expiry.js:26-42](../frontend/assets/js/pages/near-expiry.js); phân trang theo `pagination.has_more`, đọc `han_su_dung`; hiện mock | **CHƯA NỐI** | Bật live; backend nhận `per_page=50` (tối đa 50). |
| Siêu sale public | GET `/promotions/active` | [home.js:114](../frontend/assets/js/pages/home.js), [flash-sale.js:224](../frontend/assets/js/pages/flash-sale.js); gọi đúng path nhưng mock. API backend trả `promotions[]`, không có `server_time` mà trang có đọc (hiện fallback giờ máy) | **CHƯA NỐI** | Frontend bỏ mock; thống nhất response giờ server nếu cần đồng hồ chuẩn. |
| Bán chạy | GET `/products?sort=best&per_page=12&page=...` | [best-sellers.js:47-50](../frontend/assets/js/pages/best-sellers.js); mock hiểu `best`; backend thật chỉ nhận `newest/price_asc/price_desc`, không trả `luot_ban`. GET thử thật với `sort=best` trả 422 | **BACKEND CHƯA CÓ** | Backend cần công bố sort/bảng bán chạy và `luot_ban`, hoặc frontend bỏ tính năng live; hai bên cần chốt contract. |
| Địa chỉ giao hàng và báo phí | Backend GET `/shipping/areas`, POST `/shipping/quote` | [delivery-modal.js:84,92,101](../frontend/assets/js/components/delivery-modal.js) gọi `/locations/provinces|districts|wards`; route không tồn tại (GET thử: 404), và frontend không gọi quote | **LỆCH** | **Frontend** đổi sang `/shipping/areas` + lọc danh sách phẳng; map `phuong_xa,khoang_cach_km` sang dữ liệu select đang đòi `ten,distance_km`, rồi gọi quote với `khu_vuc_id,tien_hang_sau_giam`. |
| Thông tin cửa hàng | GET `/store-info` | Frontend dùng `CONFIG.STORE_INFO`, không có call tới `/store-info`; GET thật trả 200 | **CHƯA NỐI** | Frontend lấy dữ liệu cửa hàng qua API thay vì cấu hình tĩnh. |
| Admin danh mục | GET/POST/PUT/PATCH visibility `/admin/categories` | [categories.js:97-133](../frontend/assets/js/admin/categories.js); gửi đúng `ten_danh_muc,thu_tu,trang_thai`, đọc `categories[]` và `id` | **NỐI ĐƯỢC** | — |
| Admin sản phẩm và upload ảnh | GET/POST/PUT/PATCH/DELETE `/admin/products`; POST `/{id}/image` | [products.js:211-227,260-296](../frontend/assets/js/admin/products.js); gửi `ten,danh_muc_id,gia` integer, `don_vi_tinh,mo_ta,anh`; upload multipart `image`; hợp đồng chính khớp | **NỐI ĐƯỢC** | — |
| Admin khuyến mãi Thứ 6 | Backend `/admin/promotions/{id}` và `/random-products` | [promotions.js:47,62,67](../frontend/assets/js/admin/promotions.js) dùng mock `/admin/promotions/friday`, `/friday/random`, body `enabled/productIds`; khác path/body backend. Phần `/admin/products` đang lấy thật nhưng đọc `items/categories` | **CHƯA NỐI** | Frontend phải dùng ID và field backend (`ma_khuyen_mai`, `san_pham_ids`, `trang_thai`...); không thể chỉ tắt mock. |
| Nhập kho, lịch sử, cảnh báo | Backend có stock-receipts, batches, stock-history; không có dashboard route | [inventory.js:87-90](../frontend/assets/js/admin/inventory.js); nút nhập/điều chỉnh chưa ghi dữ liệu; GET `/admin/products` thật trả `products`, frontend đọc `items` và `categories` | **LỆCH** | **Frontend** đổi sang `products`, chuẩn hóa `ten` và tải danh mục riêng; nối API receipts/history. |
| Admin khu vực giao hàng | GET/POST/PUT/PATCH `/admin/delivery-areas` | Không thấy module frontend nào gọi endpoint hoặc màn hình quản lý tương ứng | **CHƯA NỐI** | Frontend cần màn hình và tích hợp CRUD/tắt mở. |
| Admin dashboard | Có `DashboardController` nhưng `origin/main` không đăng ký `/admin/dashboard` | [dashboard.js:84](../frontend/assets/js/admin/dashboard.js), [inventory.js:87](../frontend/assets/js/admin/inventory.js); path bị mock | **BACKEND CHƯA CÓ** | Backend cần đăng ký route và response dashboard hoặc chốt đường dẫn khác. |
| Giỏ hàng, checkout, khách xem đơn hàng | Không có route cart/checkout/orders trong customer routes | [cart.js:121,147,174,185](../frontend/assets/js/pages/cart.js), [orders.js:57](../frontend/assets/js/pages/orders.js), [product-card.js:115](../frontend/assets/js/components/product-card.js); mock | **BACKEND CHƯA CÓ** | Backend cần API giỏ, quote/checkout, tạo đơn và lịch sử đơn. |
| Admin đơn hàng/chi tiết | Không có route `/admin/orders*` | [orders.js:65](../frontend/assets/js/admin/orders.js), [order-detail.js:72,87,109,120](../frontend/assets/js/admin/order-detail.js), [admin-layout.js:128](../frontend/assets/js/admin/admin-layout.js); mock | **BACKEND CHƯA CÓ** | Backend cần danh sách/chi tiết/cập nhật trạng thái/hủy/điều chỉnh ship. |
| Admin khách hàng | Không có route `/admin/customers*` | [customers.js:43](../frontend/assets/js/admin/customers.js) lấy đơn mock để tổng hợp khách | **BACKEND CHƯA CÓ** | Backend cần API danh sách/chi tiết/trạng thái khách nếu tiếp tục tính năng. |
| Báo cáo thống kê | Có `StatisticsController`, không có route báo cáo/dashboard | [statistics.js:51](../frontend/assets/js/admin/statistics.js) lấy `/admin/dashboard` mock | **BACKEND CHƯA CÓ** | Backend cần route báo cáo và thống nhất dữ liệu KPI/time-series. |
| API tổng hợp `/home` | Không có route `/api/home`; trang đang ghép categories/products/promotion | [home.js:114](../frontend/assets/js/pages/home.js) | **BACKEND CHƯA CÓ** | Không cần API riêng nếu frontend ghép từ endpoint công khai đã nối; nếu yêu cầu `/home`, backend cần triển khai. |

### Các lệch/không khớp đáng chú ý

1. **Vận chuyển:** frontend hỏi `/locations/provinces|districts|wards` và `fillSelect` đòi `ten,distance_km`; backend công bố `/shipping/areas` (danh sách phẳng `tinh,quan_huyen,phuong_xa,khoang_cach_km`) và `/shipping/quote`. GET thật xác nhận `/locations/provinces` là 404. Thuộc **Frontend** theo contract backend.
2. **Kho và trang khuyến mãi Admin:** backend `GET /admin/products` trả `data.products` + `pagination`, item dùng `ten`; màn kho/khuyến mãi đọc `inventory.items`, `inventory.categories`, `ten_san_pham`. Màn kho gọi endpoint thật nên lỗi shape có thể phát sinh ngay; sửa frontend hoặc bổ sung adapter. Nguồn: `ProductAdminController` (index/mapProduct) và `inventory.js:89-91`, `promotions.js:67-69`.
3. **Siêu sale Admin:** frontend `/admin/promotions/friday` và `/friday/random` cùng `enabled/productIds` không khớp với ID số và request fields API Admin. Hiện mock che lỗi; khi bỏ mock sẽ không thể tích hợp nếu không đổi frontend.
4. **Bán chạy:** frontend `sort=best`; backend validator chỉ nhận `newest`, `price_asc`, `price_desc`, response public không có `luot_ban`. GET thử thật nhận 422. Backend API docs và code thống nhất; tính năng cần được hai bên chốt hoặc backend bổ sung.
5. **Ảnh placeholder:** backend có thể trả `anh_thumb="placeholder-product.svg"`; [product-detail.js](../frontend/assets/js/pages/product-detail.js#L31) đổi sang asset local, nhưng [product-card.js](../frontend/assets/js/components/product-card.js#L28) không xử lý trường hợp tên placeholder này và sẽ dùng URL tương đối sai. Ảnh `uploads/products/...` còn lại được ghép `../backend/` đúng. Đây là lỗi **Frontend** khi chuyển catalog sang live.
6. **Các field đã bỏ:** form Admin sản phẩm hiện chỉ gửi `ten,danh_muc_id,gia,don_vi_tinh,mo_ta,anh`; không gửi tồn kho/HSD, không còn các field cũ trong form. Tuy vậy [mock.js](../frontend/assets/js/core/mock.js#L78) vẫn giữ `nhom_con,huong_vi,dong_goi` trong dữ liệu mẫu; chúng không nằm trong payload thật. Admin danh mục chỉ gửi tên/thứ tự, không gửi `slug/icon/nhom_con`.

### Đối chiếu tài liệu

- Các route được mô tả trong [API.md](./API.md) nhìn chung khớp route/controller trên `origin/main` ở các phần đã đối chiếu; ví dụ sort sản phẩm chỉ nêu ba giá trị ở API.md L564–565, khớp validator.
- [FRONTEND_CHO_BACKEND.md](./FRONTEND_CHO_BACKEND.md) có nhiều nội dung cũ, **không dùng làm contract hiện hành**: còn yêu cầu `nhom_con/huong_vi/dong_goi` (L21), upload `/admin/uploads/product-image` (L40), nói chưa có public sale `/promotions/active` (L41) dù route đã có, địa giới `/locations/*` (L42), Admin `GET /admin/auth/me` (L83) thay vì `/admin/me`, và yêu cầu trang tài khoản chưa có (L103). Nên cập nhật tài liệu này theo API.md và `origin/main`.
- API.md L330–363 ghi endpoint gộp `/auth/forgot-password/verify` là deprecated; route vẫn còn để tương thích, frontend hiện dùng luồng mới `start → verify-otp → reset`.

## 6. Việc cần làm theo mức ưu tiên

### Frontend

1. **Chặn nối:** giữ auth/Admin categories/products gọi thật; bật API thật theo từng nhóm sau khi chỉnh contract, không bật toàn cục khi các route còn thiếu.
2. Đổi giao hàng từ `/locations/*` sang `/shipping/areas`; nối `POST /shipping/quote`.
3. Sửa Admin inventory và promotion để đọc `products`, dùng `ten`, lấy danh mục từ `/admin/categories`; nối POST nhập kho/lịch sử thay cho placeholder.
4. Thống nhất Admin promotions dùng ID và schema backend; không sử dụng đường `/friday` với `productIds`.
5. Fix placeholder ảnh cho product-card.
6. Xác nhận với backend về bán chạy (`sort=best`, `luot_ban`) và giờ server của sale.
7. Đổi `STORE_INFO` tĩnh sang `/store-info`; làm màn Admin delivery areas nếu vẫn cần.
8. Các thay đổi đổi tên/mật khẩu Admin trong working tree cần được kiểm thử sau khi backend publish; chúng chưa nằm trong frontend commit hiện tại.

### Backend — tin nhắn có thể gửi cho bạn backend

> Mình đã kiểm tra `origin/main` (`22f0ffd`). Nhờ bạn xác nhận/bổ sung contract cho các phần còn thiếu:  
> 1) `PUT /api/admin/me` cập nhật `ho_ten,email,so_dien_thoai` và endpoint đổi mật khẩu (đề xuất `PATCH /api/admin/me/password`, xác thực mật khẩu hiện tại + CSRF); hiện origin chỉ có GET `/admin/me`.  
> 2) Đăng ký route dashboard (`/api/admin/dashboard` hoặc thống nhất tên), orders (`/api/admin/orders*`), customers, reports nếu các màn Admin này tiếp tục dùng. Controller đã có nhưng chưa được route.  
> 3) Công bố API cart/checkout/customer orders; hiện `CartController`, `CheckoutController`, `OrderController` chưa có route trong `customer.php`.  
> 4) Nếu cần bán chạy, bổ sung query `sort=best` và `luot_ban` vào `/api/products`, hoặc thống nhất bỏ tính năng này.  
> Các mismatch `/locations/*`, `/admin/promotions/friday`, `inventory.items/categories` phía frontend sẽ được sửa theo contract hiện có.

## 7. Điểm bảo mật

- Admin đăng nhập là hai bước riêng (`POST /api/admin/auth/login` → OTP → verify); `OtpService` lưu hash OTP, hết hạn, cooldown và giới hạn lần nhập/gửi. `AdminMiddleware` yêu cầu role Admin và cờ OTP đã xác thực.
- Đăng nhập Customer kiểm tra role `Customer`; tài khoản Admin không đi qua API đăng nhập khách.
- `requireAdmin()` gọi server `/admin/me` trước khi dựng trang. Cờ mock trong storage không tự cấp quyền vào trang Admin.
- Session code đặt admin idle timeout 1800 giây; cookie session HttpOnly/SameSite=Lax theo cấu hình. CSRF bảo vệ các request ghi.
- `frontend/assets/js/core/mock.secrets.js` **không được Git theo dõi** (`git ls-files` không trả đường dẫn). Không tìm thấy `console.log` trong frontend. Không mở/đọc file secrets hay giá trị mật khẩu/khóa; do đó không kết luận về các giá trị nằm trong file cục bộ không theo dõi.
- Frontend có trang login khách và Admin riêng; backend cũng dùng hai API riêng. Response admin login trả `requires_otp=true`, không dùng chung luồng login khách.

## 8. Chưa kiểm tra được và cách tự kiểm tra

- Chưa xác minh đăng nhập, OTP, upload, thao tác CRUD, CSRF retry trong trình duyệt hoặc session hết hạn bằng tài khoản thật; các thao tác ghi/email/OTP bị loại khỏi phạm vi an toàn.
- GET đã kiểm tra chỉ chứng minh Apache, route, CSDL và các API công khai phản hồi trên máy này; không chứng minh rằng trình duyệt đang dùng backend thay vì mock.
- Để tự kiểm tra: mở `http://localhost/monsmokee-shop/frontend/`, nhấn **F12 → Network**, lọc `Fetch/XHR`, mở màn hình cần thử. Xem Request URL có `/monsmokee-shop/backend/public/api/`, response JSON có `success/data`, và không phải dữ liệu chỉ sinh từ mock. Với trang sản phẩm/Admin, kiểm tra response shape (`products` so với frontend đang đọc). Không gửi yêu cầu ghi khi chưa có dữ liệu thử/phiên an toàn.
- Các GET xác nhận 404/422 nêu trên đã kiểm tra trực tiếp; không gọi endpoint ghi, không nhập tài khoản và không chạy migration/cài đặt.
