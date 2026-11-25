# Ma trận use case

Trạng thái bên dưới phản ánh phạm vi backend hiện tại; giao diện frontend chưa được đánh dấu hoàn thành.

| Use case | File chính | API | Backend |
|---|---|---|---|
| Đăng ký Customer qua email OTP | `Customer/AuthController.php`, `OtpService.php` | `/api/auth/register/start`, `/api/auth/register/verify`, `/api/auth/otp/resend` | Hoàn thành |
| Đăng nhập, đăng xuất và xem phiên Customer | `Customer/AuthController.php`, `AuthMiddleware.php` | `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` | Hoàn thành |
| Quên mật khẩu Customer qua OTP email và reset ticket | `Customer/AuthController.php`, `OtpService.php` | `/api/auth/forgot-password/start`, `/api/auth/forgot-password/verify-otp`, `/api/auth/forgot-password/reset`, `/api/auth/forgot-password/resend`; `/verify` deprecated | Hoàn thành backend |
| Đăng nhập/đăng xuất Admin hai bước và xem phiên Admin | `Admin/AdminAuthController.php`, `AdminMiddleware.php` | `/api/admin/auth/login`, `/api/admin/auth/verify-otp`, `/api/admin/auth/otp/resend`, `/api/admin/auth/logout`, `/api/admin/me` | Hoàn thành |
| Session, CSRF và validation dùng chung | `Session.php`, `Csrf.php`, `Validator.php` | `/api/csrf` | Hoàn thành |
| Đọc danh mục công khai | `CategoryController.php` | `/api/categories` | Hoàn thành backend |
| UC01/QT1 — đọc sản phẩm công khai | `ProductController.php`, `san-pham.html` | `/api/products`, `/api/products/{id}` | Hoàn thành backend |
| UC12/QT13 — quản lý khuyến mãi và giá hiệu lực | `PromotionAdminController.php`, `PromotionController.php`, `PromotionService.php` | `/api/admin/promotions*`, `/api/promotions/active` | Hoàn thành backend |
| Bước 15 — khu vực giao hàng, phí ship và thông tin cửa hàng | `DeliveryAreaAdminController.php`, `LocationController.php`, `ShippingService.php` | `/api/shipping/areas`, `/api/shipping/quote`, `/api/store-info`, `/api/admin/delivery-areas*` | Hoàn thành backend |
| UC02/QT2-3 — giỏ hàng | `CartController.php`, `gio-hang.html` | `/api/cart*` | Chưa làm |
| UC03/QT6 — hồ sơ | `ProfileController.php`, `tai-khoan.html` | `/api/auth/profile` | Chưa làm |
| UC04/QT8-9 — thanh toán | `CheckoutController.php`, `thanh-toan.html` | `/api/checkout/*` | Chưa làm |
| UC05/QT10-11 — đơn hàng/đánh giá | `OrderController.php`, `ReviewController.php` | `/api/orders*` | Chưa làm |
| UC06/QT13 — quản lý danh mục | `CategoryAdminController.php` | `/api/admin/categories` | Hoàn thành backend |
| UC07/QT13 — quản lý sản phẩm | `ProductAdminController.php` | `/api/admin/products` | Hoàn thành backend |
| UC08/QT14 — quản lý đơn hàng | `OrderAdminController.php` | `/api/admin/orders` | Chưa làm |
| UC09/QT14-15 — nhập kho, lô hàng và lịch sử kho | `StockAdminController.php`, `ProductAdminController.php` | `/api/admin/stock-receipts*`, `/api/admin/batches`, `/api/admin/stock-history` | Hoàn thành backend (nhập/hủy phiếu, tra cứu lô và lịch sử) |
| UC10 — quản lý khách hàng | `CustomerAdminController.php` | `/api/admin/customers` | Chưa làm |
| UC11/QT15 — thống kê | `StatisticsController.php` | `/api/admin/statistics` | Chưa làm |

Giỏ hàng, thanh toán, đơn hàng, đánh giá, quản lý đơn và thống kê vẫn chưa làm; giao diện frontend vẫn là phạm vi riêng.

Danh mục hỗ trợ tạo/sửa/ẩn/hiện; sản phẩm hỗ trợ quản lý, ẩn/hiện, xóa mềm theo lịch sử giao dịch và tải ảnh. Tồn kho và hạn sử dụng được cập nhật qua phiếu nhập kho; khi triển khai bán hàng, cần xuất từ lô có hạn sử dụng gần nhất trước (FEFO).

OTP Admin được gửi cùng một mã tới email chính của tài khoản và tối đa hai địa chỉ phụ tùy chọn từ cấu hình môi trường; response chỉ trả email đã che. Chỉ API công khai của sản phẩm đang giảm cận hạn mới có trường `han_su_dung` của lô gần nhất còn hàng; sản phẩm khác không lộ hạn hoặc thông tin lô. API Admin danh mục tự tạo slug và dùng icon mặc định; API sản phẩm chỉ nhận `ten`, `danh_muc_id`, `gia` (JSON integer dương), `don_vi_tinh`, `mo_ta`, `anh`, không nhận các trường nhóm con/hương vị/đóng gói.
