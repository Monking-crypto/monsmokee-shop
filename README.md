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
   - Email OTP: để `MAIL_DRIVER=log` khi phát triển cục bộ; nếu dùng SMTP, điền `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME`.
   - Session: `SESSION_NAME`, `SESSION_LIFETIME_SECONDS`, `SESSION_IDLE_TIMEOUT_SECONDS`.
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

   Migration `001_otp_dang_nhap_admin.sql` thêm mục đích đăng nhập Admin vào enum `otp_xac_thuc.muc_dich`. Có thể chạy lại migration này an toàn. Với CSDL mới, chạy sau các file seed; với CSDL đã tồn tại, chọn database `monsmokee` trong phpMyAdmin, mở tab **SQL** và chạy nội dung migration. **Lưu ý:** `schema.sql` có lệnh xóa và tạo lại database `monsmokee`; không import vào database đang có dữ liệu cần giữ.
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

1. Bật xác minh 2 bước cho tài khoản Google.
2. Mở Google Account → Security → 2-Step Verification → App passwords.
3. Tạo App Password mới với tên `MON SMOKEE`.
4. Google sẽ hiện mật khẩu ứng dụng gồm 16 ký tự. Sao chép giá trị đó vào `backend/.env`:
   - `SMTP_USER=email-gmail-cua-ban@gmail.com`
   - `SMTP_PASS=mật-khẩu-ứng-dụng-16-ký-tự`
   - `MAIL_DRIVER=smtp`
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=587`
5. Không commit `backend/.env`. Không dùng mật khẩu Gmail thường ở `SMTP_PASS`.
6. Sau khi đổi `.env`, gọi lại API OTP; không cần chạy Composer thêm.

Không có tài khoản hoặc mật khẩu Admin mặc định; hãy dùng thông tin riêng và không tái sử dụng mật khẩu cá nhân.

## Cron
Chạy mỗi 15 phút bằng Windows Task Scheduler hoặc Linux cron:
```text
php backend/cron/auto_cancel_click_collect.php
php backend/cron/scan_expiry_discount.php
```
