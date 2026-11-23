# MON SMOKEE

Website tạp hóa MON SMOKEE xây dựng bằng PHP thuần, MySQL và Bootstrap 5.

## Yêu cầu
- PHP 8.1+
- MySQL 8 hoặc MariaDB 10.4+
- XAMPP/Laragon
- Composer
- Apache bật `mod_rewrite`

## Cài đặt cho thành viên mới

1. Cài XAMPP và Composer. Bảo đảm Composer dùng PHP của XAMPP; kiểm tra bằng `composer --version` và `C:\xampp\php\php.exe -v`.
2. Clone/đặt dự án vào `C:\xampp\htdocs\monsmokee`.
3. Sao chép `backend/.env.example` thành `backend/.env`, rồi điền cấu hình:
   - Ứng dụng: `APP_ENV`, `APP_URL`, `APP_DEBUG`, `TIMEZONE`.
   - MySQL: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`.
   - Tài khoản Admin: `ADMIN_PHONE`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`.
   - Email OTP: để `MAIL_DRIVER=log` khi phát triển cục bộ; nếu dùng Gmail SMTP, cấu hình `MAIL_DRIVER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_ENCRYPTION`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`, `MAIL_FROM_NAME` theo mục bên dưới.
   - Session: `SESSION_NAME`, `SESSION_LIFETIME_SECONDS`, `SESSION_IDLE_TIMEOUT_SECONDS` (mặc định 2 giờ), `ADMIN_SESSION_IDLE_TIMEOUT_SECONDS` (mặc định 30 phút).
   Không commit `backend/.env`; file này chứa thông tin riêng.
4. Mở PowerShell/CMD tại thư mục dự án và cài dependency trong đúng thư mục backend:
   ```text
   cd backend
   composer install
   cd ..
   ```
5. Mở XAMPP Control Panel và bật Apache cùng MySQL. Mở phpMyAdmin rồi import theo thứ tự:
   1. `database/schema.sql`
   2. `database/seed.sql`
   3. `database/seed_khu_vuc.sql`
   4. Các file trong `database/migrations/`, sắp theo tên tăng dần (ví dụ `001_...sql`, `002_...sql`) và chạy lần lượt.

   Migration `001_otp_dang_nhap_admin.sql` thêm mục đích đăng nhập Admin vào enum `otp_xac_thuc.muc_dich`; migration `002_danh_muc_trang_thai.sql` thêm cờ ẩn/hiện danh mục. Cả hai migration có thể chạy lại an toàn. Với CSDL mới, chạy sau các file seed; với CSDL đã tồn tại, chọn database `monsmokee` trong phpMyAdmin, mở tab **SQL** và chạy lần lượt theo tên. **Lưu ý:** `schema.sql` có lệnh xóa và tạo lại database `monsmokee`; không import vào database đang có dữ liệu cần giữ.
6. Từ thư mục gốc dự án, chạy `php database/seed_admin.php`. Script tạo/cập nhật Admin từ `ADMIN_*` trong `backend/.env`; mật khẩu được băm bcrypt trước khi lưu.
7. Kiểm tra API bằng trình duyệt hoặc lệnh:
   ```text
   http://localhost/monsmokee/backend/public/api/csrf
   ```
   Kết quả thành công có HTTP 200 và JSON chứa `success: true` cùng `data.csrf_token`.
8. Mở website: `http://localhost/monsmokee/frontend/`.
9. Trang Admin: `http://localhost/monsmokee/frontend/admin/login.html`.

Mặc định OTP dùng `MAIL_DRIVER=log`, mã OTP nằm trong `backend/storage/mail_outbox/*.txt` và `backend/storage/logs/otp.log`.

## Gửi OTP thật bằng Gmail SMTP

1. Bật **Xác minh 2 bước** cho tài khoản Google.
2. Trong Google Account, mở **Security → 2-Step Verification → App passwords** và tạo App Password.
3. Sao chép App Password 16 ký tự (bỏ khoảng trắng) vào `backend/.env`. Không dùng mật khẩu Gmail thông thường.
4. Đặt cấu hình sau trong `backend/.env`, thay các giá trị giả bằng thông tin tài khoản Gmail bạn kiểm soát:
   ```dotenv
   MAIL_DRIVER=smtp
   MAIL_HOST=smtp.gmail.com
   MAIL_PORT=587
   MAIL_ENCRYPTION=tls
   MAIL_USERNAME=your-gmail-address@gmail.com
   MAIL_PASSWORD=your-16-character-app-password
   MAIL_FROM=your-gmail-address@gmail.com
   MAIL_FROM_NAME=MON SMOKEE
   ```
   `MAIL_FROM` nên là chính tài khoản Gmail đó hoặc một địa chỉ gửi thay mặt đã được Google cho phép.
5. Từ thư mục gốc dự án, gửi thư kiểm tra tới một hộp thư bạn có quyền truy cập:
   ```text
   php backend/scripts/test_email.php recipient@example.com
   ```
6. Không commit `backend/.env`, không chia sẻ App Password qua chat và không đưa mật khẩu vào lệnh hoặc tài liệu. Các giá trị trong `backend/.env.example` đều là placeholder giả.

Lệnh kiểm tra gửi thư chỉ xác nhận cấu hình SMTP; nó không tạo tài khoản hay OTP trong CSDL.

Không có tài khoản hoặc mật khẩu Admin mặc định; hãy dùng thông tin riêng và không tái sử dụng mật khẩu cá nhân.

## Cron
Chạy mỗi 15 phút bằng Windows Task Scheduler hoặc Linux cron:
```text
php backend/cron/auto_cancel_click_collect.php
php backend/cron/scan_expiry_discount.php
```
