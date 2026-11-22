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
