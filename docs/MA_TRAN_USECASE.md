# Ma trận use case

Trạng thái bên dưới phản ánh phạm vi backend hiện tại; giao diện frontend chưa được đánh dấu hoàn thành.

| Use case | File chính | API | Backend |
|---|---|---|---|
| Đăng ký Customer qua email OTP | `Customer/AuthController.php`, `OtpService.php` | `/api/auth/register/start`, `/api/auth/register/verify`, `/api/auth/otp/resend` | Hoàn thành |
| Đăng nhập, đăng xuất và xem phiên Customer | `Customer/AuthController.php`, `AuthMiddleware.php` | `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` | Hoàn thành |
| Quên mật khẩu Customer qua OTP email | `Customer/AuthController.php`, `OtpService.php` | `/api/auth/forgot-password/start`, `/api/auth/forgot-password/verify`, `/api/auth/forgot-password/resend` | Hoàn thành |
| Đăng nhập Admin hai bước và xem phiên Admin | `Admin/AdminAuthController.php`, `AdminMiddleware.php` | `/api/admin/auth/login`, `/api/admin/auth/verify-otp`, `/api/admin/auth/otp/resend`, `/api/admin/me` | Hoàn thành |
| Session, CSRF và validation dùng chung | `Session.php`, `Csrf.php`, `Validator.php` | `/api/csrf` | Hoàn thành |
| UC01/QT1 — sản phẩm | `ProductController.php`, `san-pham.html` | `/api/products` | Chưa làm |
| UC02/QT2-3 — giỏ hàng | `CartController.php`, `gio-hang.html` | `/api/cart*` | Chưa làm |
| UC03/QT6 — hồ sơ | `ProfileController.php`, `tai-khoan.html` | `/api/auth/profile` | Chưa làm |
| UC04/QT8-9 — thanh toán | `CheckoutController.php`, `thanh-toan.html` | `/api/checkout/*` | Chưa làm |
| UC05/QT10-11 — đơn hàng/đánh giá | `OrderController.php`, `ReviewController.php` | `/api/orders*` | Chưa làm |
| UC06/QT13 — quản lý danh mục | `CategoryAdminController.php` | `/api/admin/categories` | Chưa làm |
| UC07/QT13 — quản lý sản phẩm | `ProductAdminController.php` | `/api/admin/products` | Chưa làm |
| UC08/QT14 — quản lý đơn hàng | `OrderAdminController.php` | `/api/admin/orders` | Chưa làm |
| UC09/QT14-15 — tồn kho | `InventoryAdminController.php` | `/api/admin/inventory` | Chưa làm |
| UC10 — quản lý khách hàng | `CustomerAdminController.php` | `/api/admin/customers` | Chưa làm |
| UC11/QT15 — thống kê | `StatisticsController.php` | `/api/admin/statistics` | Chưa làm |
| UC12/QT13 — khuyến mãi | `PromotionAdminController.php` | `/api/admin/promotions` | Chưa làm |
