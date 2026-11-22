# MON SMOKEE

Website tạp hóa MON SMOKEE xây dựng bằng PHP thuần, MySQL và Bootstrap 5.

## Yêu cầu
- PHP 8.1+
- MySQL 8 hoặc MariaDB 10.4+
- XAMPP/Laragon
- Composer
- Apache bật `mod_rewrite`

## Cài đặt
1. Đặt thư mục dự án tại `htdocs/monsmokee`.
2. Import `database/schema.sql`, sau đó `database/seed.sql`, `database/seed_khu_vuc.sql`.
3. Chạy `cd backend && composer install`.
4. Sao chép `backend/.env.example` thành `backend/.env`.
5. Tạo Admin bằng thông tin riêng của bạn:
   `php database/seed_admin.php <số-điện-thoại> <email> <mật-khẩu-mạnh>`.
   Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.
6. Truy cập `http://localhost/monsmokee/frontend/`.
7. Admin: `http://localhost/monsmokee/frontend/admin/login.html`.

Mặc định OTP dùng `MAIL_DRIVER=log`, mã OTP nằm trong `backend/storage/mail_outbox/*.txt` và `backend/storage/logs/otp.log`.

Không có tài khoản hoặc mật khẩu Admin mặc định; hãy dùng thông tin riêng và không tái sử dụng mật khẩu cá nhân.

## Cron
Chạy mỗi 15 phút bằng Windows Task Scheduler hoặc Linux cron:
```text
php backend/cron/auto_cancel_click_collect.php
php backend/cron/scan_expiry_discount.php
```
