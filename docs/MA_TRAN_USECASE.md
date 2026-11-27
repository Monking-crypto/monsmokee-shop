# Ma trận use case

Trạng thái bên dưới phản ánh phạm vi backend hiện tại; giao diện frontend chưa được đánh dấu hoàn thành.

| Use case | File chính | API | Backend |
|---|---|---|---|
| Đăng ký Customer qua email OTP | `Customer/AuthController.php`, `OtpService.php` | `/api/auth/register/start`, `/api/auth/register/verify`, `/api/auth/otp/resend` | Hoàn thành |
| Đăng nhập chung Customer/Admin, đăng xuất và xem phiên Customer | `Customer/AuthController.php`, `UnifiedLoginService.php`, `AuthMiddleware.php` | `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` | Hoàn thành |
| Quên mật khẩu Customer qua OTP email và reset ticket | `Customer/AuthController.php`, `OtpService.php` | `/api/auth/forgot-password/start`, `/api/auth/forgot-password/verify-otp`, `/api/auth/forgot-password/reset`, `/api/auth/forgot-password/resend`; `/verify` deprecated | Hoàn thành backend |
| Đăng nhập/đăng xuất Admin hai bước và xem phiên Admin | `Admin/AdminAuthController.php`, `UnifiedLoginService.php`, `AdminMiddleware.php` | `/api/admin/auth/login` (DEPRECATED), `/api/admin/auth/verify-otp`, `/api/admin/auth/otp/resend`, `/api/admin/auth/logout`, `/api/admin/me` | Hoàn thành |
| Session, CSRF và validation dùng chung | `Session.php`, `Csrf.php`, `Validator.php` | `/api/csrf` | Hoàn thành |
| Đọc danh mục công khai | `CategoryController.php` | `/api/categories` | Hoàn thành backend |
| Bước 13B / UC01/QT1 — lọc giá hiệu lực, chi tiết và gợi ý mua kèm | `ProductController.php`, `san-pham.html` | `/api/products`, `/api/products/{id}`, `/api/products/{id}/suggestions` | Hoàn thành backend |
| UC12/QT13 — quản lý khuyến mãi và giá hiệu lực | `PromotionAdminController.php`, `PromotionController.php`, `PromotionService.php` | `/api/admin/promotions*`, `/api/promotions/active` | Hoàn thành backend |
| Bước 15 — khu vực giao hàng, phí ship và thông tin cửa hàng | `DeliveryAreaAdminController.php`, `LocationController.php`, `ShippingService.php` | `/api/shipping/areas`, `/api/shipping/quote`, `/api/store-info`, `/api/admin/delivery-areas*` | Hoàn thành backend |
| Bước 16A / UC02/QT2-3 — giỏ hàng Customer/guest, giá hiệu lực và gộp sau đăng nhập | `CartController.php`, `CartService.php`, `PromotionService.php` | `GET /api/cart`, `/api/cart/items*` | Hoàn thành backend |
| Bước 14F / UC03/QT6 — hồ sơ và đổi mật khẩu Customer/Admin | `Customer/ProfileController.php`, `Admin/AdminProfileController.php`, `ProfileService.php`, `PasswordChangeService.php` | `GET /api/auth/me`, `PUT /api/profile`, `PATCH /api/profile/password`, `GET/PUT /api/admin/me`, `PATCH /api/admin/me/password` | Hoàn thành backend |
| UC04/QT8-9 — thanh toán | `CheckoutController.php`, `thanh-toan.html` | `/api/checkout/*` | Chưa làm |
| UC05/QT10-11 — đơn hàng/đánh giá | `OrderController.php`, `ReviewController.php` | `/api/orders*` | Chưa làm |
| UC06/QT13 — quản lý danh mục | `CategoryAdminController.php` | `/api/admin/categories`, `DELETE /api/admin/categories/{id}` | Hoàn thành backend; chỉ xóa danh mục rỗng, danh mục còn sản phẩm trả 409 |
| UC07/QT13 — quản lý sản phẩm, ngưỡng tồn, mua kèm và xóa an toàn | `ProductAdminController.php` | `/api/admin/products`, `/api/admin/products/{id}/cross-sell`, `DELETE /api/admin/products/{id}` | Hoàn thành backend; xóa cứng khi chưa có lịch sử, có lịch sử trả 409 và có thể ẩn riêng |
| UC08/QT14 — quản lý đơn hàng | `OrderAdminController.php` | `/api/admin/orders` | Chưa làm |
| Bước 11C / UC09/QT14-15 — nhập kho có ngày sản xuất, điều chỉnh FEFO, cảnh báo tồn và hạn | `StockAdminController.php`, `ProductAdminController.php` | `/api/admin/stock-receipts*`, `/api/admin/inventory/adjust`, `/api/admin/inventory/low-stock`, `/api/admin/inventory/expiring`, `/api/admin/batches`, `/api/admin/stock-history` | Hoàn thành backend |
| UC10 — quản lý khách hàng | `CustomerAdminController.php` | `/api/admin/customers` | Chưa làm |
| UC11/QT15 — thống kê | `StatisticsController.php` | `/api/admin/statistics` | Chưa làm |

Giỏ hàng, thanh toán, đơn hàng, đánh giá, quản lý đơn và thống kê vẫn chưa làm; giao diện frontend vẫn là phạm vi riêng.

Hồ sơ dùng schema hiện có và chỉ cho đổi họ tên; SĐT/email chưa đổi được vì cần luồng OTP riêng. Đổi mật khẩu dùng chung dịch vụ cho Customer/Admin, yêu cầu mật khẩu hiện tại, mật khẩu mới tối thiểu 8 ký tự có chữ thường và số, giới hạn 5 lần sai trong 15 phút theo tài khoản, tái tạo session và vô hiệu hóa reset ticket/OTP quên mật khẩu còn hiệu lực. Admin cần hoàn tất OTP; thao tác ghi yêu cầu CSRF.

Danh mục hỗ trợ tạo/sửa/ẩn/hiện và chỉ xóa cứng khi hoàn toàn không có sản phẩm; sản phẩm hỗ trợ quản lý, ẩn/hiện và xóa cứng có kiểm tra lịch sử (lô, phiếu/đơn hàng, giỏ hàng, lịch sử kho), tải ảnh, ngưỡng tồn tối thiểu và danh sách mua kèm. Danh mục/sản phẩm có tham chiếu hoặc lịch sử không bị xóa; API trả `409` với mã lỗi và hướng dẫn dùng chức năng Ẩn. Nhập kho bắt buộc ngày sản xuất cho mỗi dòng; ngày sản xuất/hạn sử dụng chỉ hiển thị trong API Admin, ngoại trừ hạn của sản phẩm đang giảm cận hạn. Điều chỉnh tồn dùng transaction và khóa sản phẩm/lô, trừ FEFO khi giảm và tạo lô khi tăng; có API cảnh báo tồn thấp và lô sắp hết hạn.

Lọc `min_price`/`max_price` của UC01 dựa trên `gia_ban_hieu_luc` sau khuyến mãi server. Gợi ý mua kèm ưu tiên cấu hình Admin trong `san_pham_mua_kem`, sau đó bổ sung sản phẩm cùng danh mục; chỉ trả sản phẩm đang bán và còn hàng, tối đa 8.

OTP Admin được gửi cùng một mã tới email chính của tài khoản và tối đa hai địa chỉ phụ tùy chọn từ cấu hình môi trường; response chỉ trả email đã che. Chỉ API công khai của sản phẩm đang giảm cận hạn mới có trường `han_su_dung` của lô gần nhất còn hàng; sản phẩm khác không lộ hạn hoặc thông tin lô. API Admin danh mục tự tạo slug và dùng icon mặc định; API sản phẩm chỉ nhận `ten`, `danh_muc_id`, `gia` (JSON integer dương), `don_vi_tinh`, `mo_ta`, `anh`, không nhận các trường nhóm con/hương vị/đóng gói.
