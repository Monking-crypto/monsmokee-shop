# API MON SMOKEE

Envelope JSON thống nhất:
```json
{"success":true,"message":"","data":{},"errors":null}
```

Các API thay đổi dữ liệu bắt buộc header `X-CSRF-Token`.

| Method | Path | Trạng thái |
|---|---|---|
| GET | /api/csrf | DONE |
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
