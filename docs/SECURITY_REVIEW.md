# Báo cáo rà soát bảo mật backend

Ngày rà soát: 26/11/2026

Phạm vi: backend PHP/MySQL, chỉ đọc, không sửa file trong quá trình rà soát. Không đọc `backend/.env`.

| Mục | Kết quả | File:dòng | Mức độ | Đề xuất |
|---|---|---|---|---|
| 1. Prepared statements | Truy vấn dữ liệu động sử dụng PDO prepare/bind. | `backend/core/Database.php:24-29`; `backend/app/Controllers/Admin/StockAdminController.php:62-71,95-148` | Không phát hiện | Giữ native prepares và rà soát query mới. |
| 2. Admin middleware và CSRF | Route Admin nghiệp vụ qua AdminMiddleware; route ghi dùng CsrfMiddleware. | `backend/routes/admin.php:39-72,88-205`; `backend/app/Middleware/AdminMiddleware.php:10-25`; `backend/app/Middleware/CsrfMiddleware.php:12-21` | Không phát hiện | Giữ cả middleware ở mọi route Admin mới. |
| 3. IDOR | Chức năng đơn/giỏ/hồ sơ chưa triển khai; `/api/auth/me` lấy user_id từ session. | `backend/app/Controllers/Customer/AuthController.php:789-821,1125-1135`; `backend/routes/customer.php:106-116` | Chưa phát hiện | Kiểm tra sở hữu bằng session user_id khi triển khai. |
| 4. Session | Regenerate khi đăng nhập; cookie HttpOnly/SameSite, Secure theo HTTPS; lifetime/idle. | `backend/core/Session.php:14-46,72-85`; `backend/config/app.php:12-18` | Chưa xác minh runtime | Bật HTTPS production. |
| 5. OTP/ticket | OTP băm, brute force/giới hạn gửi, ticket hash và hash_equals. | `backend/app/Services/OtpService.php:46-116,204-262`; `backend/app/Controllers/Customer/AuthController.php:494-551` | Thấp | Không phát hành log mail ra ngoài web production. |
| 6. Liệt kê tài khoản | Đăng ký/resend trả 409 khi trùng; đăng nhập có thể phân biệt tài khoản khóa. Đã sửa đăng nhập chung ở Bước 14E. | `backend/app/Controllers/Customer/AuthController.php:71-80,840-853`; `backend/app/Services/UnifiedLoginService.php:7-145` | 🟡 MEDIUM ban đầu, đã sửa phần đăng nhập | Tiếp tục giảm thiểu đăng ký trùng bằng rate limit; đây là lựa chọn có chủ đích. |
| 7. Upload ảnh | Kích thước/MIME/decode/an toàn tên file và .htaccess chặn script. | `backend/app/Controllers/Admin/ProductAdminController.php:365-456`; `backend/uploads/.htaccess:1-8` | Không phát hiện | Bật AllowOverride All production. |
| 8. Response data | Không thấy password/hash trong response; hạn lô chỉ public cho quy tắc cận hạn. | `backend/app/Controllers/Customer/ProductController.php:150-207,224-228` | Không phát hiện | Duy trì allowlist field. |
| 9. Error leak | Production tắt display_errors và trả lỗi chung. | `backend/public/index.php:1-6,76-86` | Không phát hiện | Giữ APP_ENV=production và APP_DEBUG=false. |
| 10. Tồn kho/phiếu/promotion | Nhập/hủy kho dùng transaction và FOR UPDATE; promotion dùng transaction/khóa. | `backend/app/Controllers/Admin/StockAdminController.php:57-85,335-459`; `backend/app/Controllers/Admin/PromotionAdminController.php:200-225,325-419` | Chưa phát hiện | Rà soát lại khi checkout trừ kho FEFO. |
| 11. Múi giờ | PHP mặc định Asia/Ho_Chi_Minh; MySQL cố định +07:00. | `backend/public/index.php:58-60`; `backend/core/Database.php:29`; `backend/config/app.php:8-12` | Chưa xác minh runtime | Giữ TIMEZONE và MySQL cùng +07:00. |
| 12. Tìm kiếm không dấu | Lưu `ten_khong_dau` và tìm bằng LIKE cả tên gốc/tên không dấu. | `backend/app/Controllers/Customer/ProductController.php:78-89,112-139`; `backend/app/Controllers/Admin/ProductAdminController.php:659-667` | Chưa xác minh runtime | Chạy test `q=sua` trên dữ liệu thật. |

## Phát hiện chính

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | 🟡 MEDIUM | `backend/app/Controllers/Customer/AuthController.php` | 71-80, 840-853 | Liệt kê tài khoản bằng phản hồi trùng khi đăng ký/resend | 9/10 |
| 2 | 🟡 MEDIUM | `backend/app/Controllers/Admin/AdminAuthController.php` | 180-188 | Phân biệt tài khoản khóa/không phải Admin ở endpoint đăng nhập cũ trước Bước 14E | 8/10 |
| 3 | ⚪ LOW | `backend/storage/.htaccess` | 1 | Bảo vệ storage phụ thuộc Apache AllowOverride | 5/10 |

Phát hiện #2 đã được xử lý ở Bước 14E bằng `UnifiedLoginService`.
