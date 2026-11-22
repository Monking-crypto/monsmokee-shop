# API MON SMOKEE

Envelope JSON thống nhất:
```json
{"success":true,"message":"","data":{},"errors":null}
```

Các API thay đổi dữ liệu bắt buộc header `X-CSRF-Token`.
Frontend phải lấy token bằng `GET /api/csrf` rồi gửi lại token đó trong mọi request thay đổi dữ liệu.
Session cookie dùng cho frontend cùng origin.

## Quy tắc mật khẩu
Mật khẩu đăng ký/đặt lại mật khẩu backend dùng đúng regex:

```regex
/^(?=.*[a-z])(?=.*\d).{8,}$/
```

Mật khẩu hợp lệ khi có ít nhất 8 ký tự, ít nhất 1 chữ thường và ít nhất 1 chữ số.
Chữ hoa và ký tự đặc biệt không bắt buộc.
Khi đăng nhập, backend chỉ so sánh mật khẩu gửi lên với mật khẩu đã băm; không chạy regex độ mạnh.
Mật khẩu lưu trong CSDL được tạo bằng `password_hash(..., PASSWORD_BCRYPT)`.

| Method | Path | Trạng thái |
|---|---|---|
| GET | /api/csrf | DONE — trả `data.csrf_token` |
| POST | /api/auth/register/start | DONE |
| POST | /api/auth/register/verify | DONE |
| POST | /api/auth/otp/resend | DONE |
| POST | /api/auth/login | DONE |
| POST | /api/auth/logout | DONE |
| GET | /api/auth/me | DONE |
| POST | /api/auth/forgot | DONE |
| POST | /api/auth/reset | DONE |
| GET | /api/home | DONE |
| GET | /api/categories | DONE |
| GET | /api/products | DONE |
| GET | /api/locations/provinces | DONE |
| GET | /api/admin/dashboard | DONE |
| PATCH | /api/admin/orders/{id}/status | STUB/501 |
