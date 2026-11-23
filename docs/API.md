# API MON SMOKEE

Base URL khi chạy XAMPP:

```text
http://localhost/monsmokee/backend/public
```

Mọi response dùng envelope:

```json
{
  "success": true,
  "message": "Thành công",
  "data": {},
  "errors": null
}
```

Response lỗi có `success: false`, `data: null` và lỗi/chi tiết trong `errors`.
Các giá trị `{{...}}` dưới đây là placeholder, cần thay bằng dữ liệu thử cục bộ.

## Session và CSRF

- `GET /api/csrf` tạo/trả `data.csrf_token`. Với mỗi `POST`, gửi token trong header `X-CSRF-Token`.
- Giữ cookie session do server trả về xuyên suốt các request; trình duyệt cùng origin tự gửi cookie, REST Client/cURL cần bật cookie jar. Tên mặc định là `MONSMOKEESID`.
- Cookie được đặt `HttpOnly`, `SameSite=Lax`, bật `Secure` khi ứng dụng chạy HTTPS. Thời hạn session mặc định 2 giờ; timeout không hoạt động mặc định là 2 giờ cho Customer và 30 phút cho Admin.
- Logout xóa session và cookie. Sau logout, gọi lại `/api/csrf` để lấy token cho session mới.
- Các request POST bên dưới cần `Content-Type: application/json` và `X-CSRF-Token`, trừ khi có ghi chú khác.

## Quy tắc đăng ký, mật khẩu và OTP

- Đăng ký Customer có hai bước: gọi `register/start`, nhận OTP qua email, rồi gửi email và OTP tới `register/verify`. Chỉ bước verify mới tạo tài khoản và đăng nhập.
- Mật khẩu đăng ký phải có tối thiểu 8 ký tự, ít nhất một chữ thường và một chữ số. Mật khẩu đăng nhập chỉ cần không rỗng; quy tắc độ mạnh không áp dụng khi đăng nhập.
- OTP gồm 6 chữ số, hiệu lực 5 phút, dùng một lần; tối đa 5 lần nhập sai. Có thể yêu cầu gửi lại sau 60 giây; tối đa 5 lần gửi trong một giờ cho email/mục đích và IP.
- OTP không có trong response. Với `MAIL_DRIVER=log`, xem thư thử trong `backend/storage/mail_outbox/`.
- Đăng nhập Admin cũng có hai bước: `admin/auth/login` gửi OTP tới email lấy từ tài khoản trong CSDL, sau đó `admin/auth/verify-otp` hoàn tất đăng nhập. Request không nhận email Admin.

## 1. Lấy CSRF token

### `GET /api/csrf`

**Headers:** Không cần CSRF header. Cookie session được tạo/giữ tự động.
**Body:** Không có.

**Response — 200**

```json
{
  "success": true,
  "message": "CSRF token",
  "data": {"csrf_token": "{{csrf_token}}"},
  "errors": null
}
```

**Lỗi:** `500` nếu server không thể xử lý request.

## 2. Bắt đầu đăng ký Customer

### `POST /api/auth/register/start`

**Headers:** `Content-Type: application/json`, `X-CSRF-Token: {{csrf_token}}`
**Body:**

```json
{
  "ho_ten": "{{customer_name}}",
  "so_dien_thoai": "{{customer_phone}}",
  "email": "{{customer_email}}",
  "mat_khau": "{{customer_password}}",
  "nhap_lai_mat_khau": "{{customer_password}}"
}
```

**Response — 200**

```json
{
  "success": true,
  "message": "Mã xác thực đã được gửi đến email",
  "data": {
    "email_masked": "u***@example.invalid",
    "expires_in_seconds": 300,
    "expires_at": "{{iso_datetime}}",
    "resend_after_seconds": 60
  },
  "errors": null
}
```

**Lỗi:** `403` CSRF không hợp lệ; `422` dữ liệu/độ mạnh mật khẩu không hợp lệ; `409` SĐT hoặc email đã tồn tại; `429` cooldown hoặc vượt giới hạn gửi; `500` không gửi được email.

## 3. Xác nhận đăng ký Customer

### `POST /api/auth/register/verify`

**Headers:** `Content-Type: application/json`, `X-CSRF-Token: {{csrf_token}}`
**Body:**

```json
{
  "email": "{{customer_email}}",
  "otp": "{{six_digit_otp_from_email}}"
}
```

**Response — 201** (tài khoản đã tạo và Customer đã đăng nhập)

```json
{
  "success": true,
  "message": "Đăng ký thành công",
  "data": {
    "user": {
      "id": 123,
      "ho_ten": "{{customer_name}}",
      "so_dien_thoai": "{{customer_phone}}",
      "email": "{{customer_email}}",
      "vai_tro": "Customer"
    }
  },
  "errors": null
}
```

**Lỗi:** `403` CSRF không hợp lệ; `422` dữ liệu/OTP sai, hết hạn, đã dùng hoặc nhập sai quá số lần; `409` tài khoản bị trùng hoặc dữ liệu đăng ký tạm không còn hợp lệ. Lỗi OTP sai có thể kèm `errors.remaining_attempts`.

## 4. Gửi lại OTP đăng ký

### `POST /api/auth/otp/resend`

**Headers:** `Content-Type: application/json`, `X-CSRF-Token: {{csrf_token}}`
**Body:**

```json
{"email": "{{customer_email}}"}
```

**Response — 200**

```json
{
  "success": true,
  "message": "Mã xác thực mới đã được gửi đến email",
  "data": {
    "email_masked": "u***@example.invalid",
    "expires_in_seconds": 300,
    "expires_at": "{{iso_datetime}}",
    "resend_after_seconds": 60
  },
  "errors": null
}
```

**Lỗi:** `403` CSRF không hợp lệ; `404` không có yêu cầu đăng ký chờ xác thực; `409` email đã đăng ký; `422` email không hợp lệ; `429` cooldown/giới hạn gửi; `500` lỗi gửi email.

## 5. Đăng nhập Customer

### `POST /api/auth/login`

**Headers:** `Content-Type: application/json`, `X-CSRF-Token: {{csrf_token}}`
**Body:**

```json
{
  "so_dien_thoai": "{{customer_phone}}",
  "mat_khau": "{{customer_password}}"
}
```

**Response — 200**

```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "user": {
      "id": 123,
      "ho_ten": "{{customer_name}}",
      "so_dien_thoai": "{{customer_phone}}",
      "email": "{{customer_email}}",
      "vai_tro": "Customer"
    }
  },
  "errors": null
}
```

**Lỗi:** `403` CSRF không hợp lệ hoặc tài khoản bị khóa; `401` SĐT/mật khẩu sai (Admin không đăng nhập qua endpoint Customer); `422` dữ liệu đăng nhập rỗng/không hợp lệ; `429` vượt giới hạn đăng nhập.

## 6. Đăng xuất

### `POST /api/auth/logout`

**Headers:** `X-CSRF-Token: {{csrf_token}}`
**Body:** Không có.

**Response — 200** (idempotent, kể cả khi chưa đăng nhập)

```json
{
  "success": true,
  "message": "Đăng xuất thành công",
  "data": null,
  "errors": null
}
```

**Lỗi:** `403` CSRF không hợp lệ.

## 7. Thông tin tài khoản hiện tại

### `GET /api/auth/me`

**Headers:** Cookie session. Không cần CSRF header.
**Body:** Không có.

**Response — 200** (thường là Customer; endpoint trả user đang đăng nhập)

```json
{
  "success": true,
  "message": "Thông tin tài khoản hiện tại",
  "data": {
    "user": {
      "id": 123,
      "ho_ten": "{{customer_name}}",
      "so_dien_thoai": "{{customer_phone}}",
      "email": "{{customer_email}}",
      "vai_tro": "Customer"
    }
  },
  "errors": null
}
```

**Lỗi:** `401` chưa đăng nhập, tài khoản không tồn tại/bị khóa hoặc session không hợp lệ.

## 8. Bắt đầu quên mật khẩu Customer

### `POST /api/auth/forgot-password/start`

**Headers:** `Content-Type: application/json`, `X-CSRF-Token: {{csrf_token}}`, cookie session.
**Body:**

```json
{"email": "{{customer_email}}"}
```

**Response — 200** — giống nhau dù email không tồn tại, thuộc Admin, hoặc không có Customer đang hoạt động:

```json
{
  "success": true,
  "message": "Nếu email tồn tại, mã xác thực đã được gửi",
  "data": null,
  "errors": null
}
```

Chỉ Customer đang hoạt động mới nhận OTP.
**Lỗi:** `403` CSRF không hợp lệ; `500` lỗi hệ thống. Việc email không tồn tại hoặc thuộc Admin không làm thay đổi response 200 chung.

## 9. Xác nhận OTP và đặt mật khẩu Customer mới

### `POST /api/auth/forgot-password/verify`

**Headers:** `Content-Type: application/json`, `X-CSRF-Token: {{csrf_token}}`, cookie session.
**Body:**

```json
{
  "email": "{{customer_email}}",
  "otp": "{{six_digit_otp_from_email}}",
  "mat_khau": "{{new_customer_password}}",
  "nhap_lai_mat_khau": "{{new_customer_password}}"
}
```

Mật khẩu mới cần ít nhất 8 ký tự, có chữ thường và số; hai trường mật khẩu phải khớp.

**Response — 200** — OTP đã được tiêu thụ, session hiện tại bị hủy; khách cần đăng nhập lại:

```json
{
  "success": true,
  "message": "Đặt lại mật khẩu thành công, vui lòng đăng nhập lại",
  "data": null,
  "errors": null
}
```

**Lỗi:** `403` CSRF không hợp lệ; `422` dữ liệu/mật khẩu không hợp lệ, OTP sai/hết hạn/đã dùng, hoặc không còn Customer hoạt động; OTP sai có thể kèm `errors.remaining_attempts`. `429` vượt giới hạn verify theo email/IP. Khi lỗi, mật khẩu không bị đổi.

## 10. Gửi lại OTP quên mật khẩu

### `POST /api/auth/forgot-password/resend`

**Headers:** `Content-Type: application/json`, `X-CSRF-Token: {{csrf_token}}`, cookie session.
**Body:**

```json
{"email": "{{customer_email}}"}
```

**Response — 200** — thông báo chung như API bắt đầu; không tiết lộ email có tài khoản hay không:

```json
{
  "success": true,
  "message": "Nếu email tồn tại, mã xác thực đã được gửi",
  "data": null,
  "errors": null
}
```

**Lỗi:** `403` CSRF không hợp lệ; `429` cooldown (60 giây) hoặc vượt giới hạn gửi (tối đa 5 lần/giờ theo email và IP); `500` lỗi hệ thống.

Các request verify cũng được giới hạn tối đa 10 lần trong 15 phút theo email và IP; OTP vẫn tự vô hiệu sau 5 lần nhập sai.

## 11. Đăng nhập Admin — bước 1

### `POST /api/admin/auth/login`

**Headers:** `Content-Type: application/json`, `X-CSRF-Token: {{csrf_token}}`
**Body:** Không gửi email.

```json
{
  "so_dien_thoai": "{{adminPhone}}",
  "mat_khau": "{{adminPassword}}"
}
```

**Response — 200** (chưa phải phiên đăng nhập Admin; chỉ tạo trạng thái chờ OTP)

```json
{
  "success": true,
  "message": "Mã OTP đăng nhập Admin đã được gửi qua email",
  "data": {
    "requires_otp": true,
    "email_masked": "ad****@example.invalid",
    "expires_in_seconds": 300,
    "resend_after_seconds": 60
  },
  "errors": null
}
```

**Lỗi:** `403` CSRF không hợp lệ, tài khoản không phải Admin hoặc Admin bị khóa; `401` SĐT/mật khẩu sai; `422` dữ liệu không hợp lệ; `429` giới hạn đăng nhập/gửi OTP; `500` lỗi gửi email.

## 12. Xác thực OTP Admin — bước 2

### `POST /api/admin/auth/verify-otp`

**Headers:** `Content-Type: application/json`, cookie session pending và `X-CSRF-Token: {{csrf_token}}`
**Body:**

```json
{"otp": "{{adminOtp}}"}
```

**Response — 200** (OTP đã được tiêu thụ; session được nâng cấp thành Admin đã xác thực OTP)

```json
{
  "success": true,
  "message": "Đăng nhập Admin thành công",
  "data": {
    "user": {
      "id": 123,
      "ho_ten": "{{admin_name}}",
      "so_dien_thoai": "{{admin_phone}}",
      "email": "{{admin_email}}",
      "vai_tro": "Admin"
    }
  },
  "errors": null
}
```

**Lỗi:** `401` không có trạng thái chờ OTP hoặc pending đã hết hạn; `403` tài khoản Admin không còn khả dụng/CSRF không hợp lệ; `422` OTP sai, hết hạn hoặc đã dùng. OTP sai kèm `errors.remaining_attempts`; lần sai thứ 5 làm mất hiệu lực OTP và xóa pending.

## 13. Gửi lại OTP Admin

### `POST /api/admin/auth/otp/resend`

**Headers:** `Content-Type: application/json`, cookie session pending và `X-CSRF-Token: {{csrf_token}}`
**Body:** Không nhận email; có thể gửi `{}`.

**Response — 200**

```json
{
  "success": true,
  "message": "Đã gửi lại mã OTP đăng nhập Admin",
  "data": {
    "email_masked": "ad****@example.invalid",
    "expires_in_seconds": 300,
    "resend_after_seconds": 60
  },
  "errors": null
}
```

**Lỗi:** `401` không có pending/OTP chờ; `403` CSRF không hợp lệ hoặc tài khoản Admin không còn khả dụng; `429` cooldown hoặc vượt giới hạn gửi; `500` lỗi gửi email.

## 14. Thông tin Admin hiện tại

### `GET /api/admin/me`

**Headers:** Cookie session Admin đã xác thực OTP. Không cần CSRF header.
**Body:** Không có.

**Response — 200**

```json
{
  "success": true,
  "message": "Thông tin tài khoản Admin hiện tại",
  "data": {
    "user": {
      "id": 123,
      "ho_ten": "{{admin_name}}",
      "so_dien_thoai": "{{admin_phone}}",
      "email": "{{admin_email}}",
      "vai_tro": "Admin"
    }
  },
  "errors": null
}
```

**Lỗi:** `401` chưa đăng nhập, session không hợp lệ hoặc tài khoản bị khóa; `403` sai vai trò hoặc session thiếu cờ xác thực OTP. Pending OTP không được xem là đăng nhập.

## 15. Danh mục công khai

### `GET /api/categories`

**Headers:** Không cần CSRF header; session cookie không bắt buộc.
**Query:** Không có.
**Body:** Không có.

`danh_muc` hiện không có cột trạng thái hiển thị, vì vậy tất cả danh mục trong bảng được trả về theo `thu_tu`.

**Response — 200**

```json
{
  "success": true,
  "message": "Danh sách danh mục",
  "data": {
    "categories": [
      {
        "id": 1,
        "ten_danh_muc": "Nước giải khát",
        "slug": "nuoc-giai-khat",
        "icon": "droplet",
        "thu_tu": 1
      }
    ]
  },
  "errors": null
}
```

**Lỗi:** `500` nếu server không thể truy vấn danh mục.

## 16. Danh sách sản phẩm công khai

### `GET /api/products`

**Headers:** Không cần CSRF header; session cookie không bắt buộc.
**Query tùy chọn:**

- `page`: trang bắt đầu từ 1, mặc định `1`.
- `per_page`: mặc định `20`, phạm vi `1`–`50`.
- `q`: tìm theo tên sản phẩm hoặc tên không dấu, tối đa 100 ký tự.
- `category_id`: id danh mục cần lọc.
- `sort`: `newest` (mặc định), `price_asc` hoặc `price_desc`.

**Body:** Không có.

Chỉ sản phẩm có `trang_thai = 1` được trả về. `con_hang` là boolean; API không trả số lượng tồn chính xác.

**Response — 200**

```json
{
  "success": true,
  "message": "Danh sách sản phẩm",
  "data": {
    "products": [
      {
        "id": 1,
        "ten_san_pham": "Nước suối 500ml",
        "gia_ban": 5000,
        "hinh_anh": "placeholder-product.svg",
        "danh_muc": {
          "id": 1,
          "ten_danh_muc": "Nước giải khát",
          "slug": "nuoc-giai-khat"
        },
        "con_hang": true
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 1,
      "total_pages": 1
    }
  },
  "errors": null
}
```

**Lỗi:** `422` page/per_page/category_id/q/sort không hợp lệ; `500` lỗi truy vấn.

## 17. Chi tiết sản phẩm công khai

### `GET /api/products/{id}`

**Headers:** Không cần CSRF header; session cookie không bắt buộc.
**Path:** `id` là id sản phẩm dương.
**Body:** Không có.

**Response — 200**

```json
{
  "success": true,
  "message": "Chi tiết sản phẩm",
  "data": {
    "product": {
      "id": 1,
      "ten_san_pham": "Nước suối 500ml",
      "mo_ta": "Nước uống đóng chai tiện lợi",
      "hinh_anh": "placeholder-product.svg",
      "don_vi_tinh": "chai",
      "gia_ban": 5000,
      "danh_muc": {
        "id": 1,
        "ten_danh_muc": "Nước giải khát",
        "slug": "nuoc-giai-khat"
      },
      "con_hang": true
    }
  },
  "errors": null
}
```

Chỉ sản phẩm đang bán được trả về. Response không chứa số lượng tồn chính xác hoặc hạn sử dụng.
**Lỗi:** `404` id không hợp lệ, sản phẩm không tồn tại hoặc đã ẩn; `500` lỗi truy vấn.

Khuyến mãi, giỏ hàng và đơn hàng chưa nằm trong phạm vi API công khai ở bước này.
