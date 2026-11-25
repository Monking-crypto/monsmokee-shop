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
- CSRF không hợp lệ trả `403` với `errors.code = "CSRF_INVALID"`.
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

**Lỗi:** `403` CSRF không hợp lệ (`errors.code = "CSRF_INVALID"`).

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

## 9. Xác nhận OTP quên mật khẩu — bước 2

### `POST /api/auth/forgot-password/verify-otp`

**Headers:** `Content-Type: application/json`, `X-CSRF-Token: {{csrf_token}}`, cookie session.
**Body:**

```json
{
  "email": "{{customer_email}}",
  "otp": "{{six_digit_otp_from_email}}"
}
```

OTP có 6 chữ số, hết hạn sau 300 giây và tối đa 5 lần nhập sai. OTP đúng được tiêu thụ và cấp ticket ngẫu nhiên; ticket thô chỉ trả đúng một lần, CSDL chỉ lưu SHA-256. Ticket có hiệu lực mặc định 600 giây (cấu hình `password_reset_ticket.ttl_seconds` trong `backend/config/business.php`).

**Response — 200**

```json
{
  "success": true,
  "message": "Mã xác thực hợp lệ",
  "data": {
    "reset_ticket": "{{opaque_reset_ticket}}",
    "expires_in_seconds": 600
  },
  "errors": null
}
```

**Lỗi:** `403` CSRF không hợp lệ; `422` OTP sai/hết hạn/đã dùng, email không tồn tại hoặc không thuộc Customer đang hoạt động. Các trường hợp này dùng cùng thông báo chung; chỉ OTP sai cho tài khoản Customer đang hoạt động có thể kèm `errors.remaining_attempts`. `429` vượt giới hạn 10 lần trong 15 phút theo từng IP và email.

## 10. Đặt mật khẩu mới bằng reset ticket — bước 3

### `POST /api/auth/forgot-password/reset`

**Headers:** `Content-Type: application/json`, `X-CSRF-Token: {{csrf_token}}`, cookie session.
**Body:**

```json
{
  "email": "{{customer_email}}",
  "reset_ticket": "{{opaque_reset_ticket}}",
  "mat_khau": "{{new_customer_password}}",
  "nhap_lai_mat_khau": "{{new_customer_password}}"
}
```

Mật khẩu mới cần ít nhất 8 ký tự, có chữ thường và số; hai trường mật khẩu phải khớp. Ticket phải gắn với đúng email, chưa dùng và chưa hết hạn. Trong một transaction, API khóa dòng ticket, cập nhật mật khẩu bcrypt và đánh dấu ticket đã dùng. Sau thành công session hiện tại bị hủy; khách cần đăng nhập lại.

**Response — 200**

```json
{
  "success": true,
  "message": "Đặt lại mật khẩu thành công, vui lòng đăng nhập lại",
  "data": null,
  "errors": null
}
```

**Lỗi:** `403` CSRF không hợp lệ; `422` ticket sai/hết hạn/đã dùng/không khớp email, hoặc mật khẩu mới không hợp lệ; `429` vượt giới hạn 10 lần trong 15 phút theo từng IP và email. Ticket sai luôn dùng cùng một thông báo chung.

## 11. Endpoint cũ: xác nhận OTP và đặt mật khẩu Customer mới (DEPRECATED)

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

Endpoint gộp này được giữ tương thích với frontend hiện tại. Frontend mới nên chuyển sang luồng `start` → `verify-otp` → `reset`; endpoint cũ sẽ bị xóa sau khi frontend đã chuyển sang hai API mới.

## 12. Gửi lại OTP quên mật khẩu

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

Các API `verify-otp`, `reset` và endpoint verify cũ được giới hạn tối đa 10 lần trong 15 phút theo mỗi email và IP. OTP vẫn tự vô hiệu sau 5 lần nhập sai. Ticket và OTP không được đặt trong URL.

## 13. Đăng nhập Admin — bước 1

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
    "emails_masked": [
      "ad****@example.invalid",
      "se****@example.invalid"
    ],
    "expires_in_seconds": 300,
    "resend_after_seconds": 60
  },
  "errors": null
}
```

**Lỗi:** `403` CSRF không hợp lệ, tài khoản không phải Admin hoặc Admin bị khóa; `401` SĐT/mật khẩu sai; `422` dữ liệu không hợp lệ; `429` giới hạn đăng nhập/gửi OTP; `500` lỗi gửi email.

OTP được gửi cùng một mã tới email chính của tài khoản lấy từ CSDL và tối đa hai email phụ cấu hình tùy chọn bằng `ADMIN_OTP_EXTRA_EMAILS` trong `backend/.env`. Chỉ lưu một hash OTP; response chỉ trả email đã che. Cấu hình sai định dạng hoặc quá hai email sẽ làm cấu hình mail không hợp lệ. Không lưu địa chỉ phụ trong CSDL/code/tài liệu và không ghi email/OTP vào log.

## 14. Xác thực OTP Admin — bước 2

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

## 15. Gửi lại OTP Admin

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
    "emails_masked": [
      "ad****@example.invalid",
      "se****@example.invalid"
    ],
    "expires_in_seconds": 300,
    "resend_after_seconds": 60
  },
  "errors": null
}
```

**Lỗi:** `401` không có pending/OTP chờ; `403` CSRF không hợp lệ hoặc tài khoản Admin không còn khả dụng; `429` cooldown hoặc vượt giới hạn gửi; `500` lỗi gửi email.

### `POST /api/admin/auth/logout`

Yêu cầu cookie session và `X-CSRF-Token`; không cần session Admin còn đăng nhập để gọi lại logout. Xóa session cùng cookie và trả `200` khi phiên đang hoạt động. Nếu CSRF cũ/không hợp lệ, trả `403` với `errors.code = "CSRF_INVALID"`. Nếu session Admin hết hạn do không hoạt động (mặc định 30 phút), trả `401` với `errors.code = "SESSION_EXPIRED"` và xóa cookie; frontend cần đăng nhập lại.

## 16. Thông tin Admin hiện tại

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

## 17. Danh mục công khai

### `GET /api/categories`

**Headers:** Không cần CSRF header; session cookie không bắt buộc.
**Query:** Không có.
**Body:** Không có.

Danh mục có `trang_thai = 1` mới được trả về theo `thu_tu`; danh mục bị ẩn cùng các sản phẩm thuộc danh mục đó không xuất hiện trong API công khai.

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

Response `GET /api/categories` dùng `Cache-Control: public, max-age=300`. Các API khác mặc định `Cache-Control: no-store`; riêng sản phẩm giữ `no-store` vì giá thay đổi theo thời gian. JSON được nén gzip/deflate khi client hỗ trợ.

## 18. Danh sách sản phẩm công khai

### `GET /api/products`

**Headers:** Không cần CSRF header; session cookie không bắt buộc.
**Query tùy chọn:**

- `page`: trang bắt đầu từ 1, mặc định `1`.
- `per_page`: mặc định `12`, phạm vi `1`–`50`.
- `q`: tìm theo tên sản phẩm hoặc tên không dấu, tối đa 100 ký tự.
- `category_id`: id danh mục cần lọc.
- `sort`: `newest` (mặc định), `price_asc` hoặc `price_desc`.
- `near_expiry=1`: chỉ lấy sản phẩm có lô còn hàng hết hạn trong số ngày cận hạn cấu hình; mặc định `0`.
- `now=YYYY-MM-DD`: giả lập ngày để kiểm thử khuyến mãi, chỉ được chấp nhận khi `APP_ENV=development`.

**Body:** Không có.

Chỉ sản phẩm và danh mục có `trang_thai = 1` được trả về. Danh sách chỉ gồm thông tin cho thẻ sản phẩm, không có mô tả dài hoặc tồn kho chính xác; `con_hang` là boolean. Ảnh dùng `anh_thumb`; API không trả ảnh kích thước lớn trong danh sách. `gia_goc`, `phan_tram_giam`, `gia_ban_hieu_luc` và `nhan_khuyen_mai` dùng cùng quy tắc giá hiệu lực như API chi tiết. Chỉ khi `nhan_khuyen_mai` là `CAN_HAN` mới có thêm `han_su_dung` của lô gần nhất còn hàng; sản phẩm khác không trả hạn sử dụng hoặc dữ liệu lô. Endpoint này dùng `Cache-Control: no-store`.

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
        "gia_goc": 5000,
        "phan_tram_giam": 0,
        "gia_ban_hieu_luc": 5000,
        "nhan_khuyen_mai": null,
        "anh_thumb": "placeholder-product.svg",
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
      "per_page": 12,
      "total": 1,
      "has_more": false
    }
  },
  "errors": null
}
```

**Lỗi:** `422` page/per_page/category_id/q/sort không hợp lệ; `500` lỗi truy vấn.

## 19. Chi tiết sản phẩm công khai

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
      "anh": "placeholder-product.svg",
      "anh_thumb": "placeholder-product.svg",
      "don_vi_tinh": "chai",
      "gia_ban": 5000,
      "gia_goc": 5000,
      "phan_tram_giam": 50,
      "gia_ban_hieu_luc": 2500,
      "nhan_khuyen_mai": "CAN_HAN",
      "danh_muc": {
        "id": 1,
        "ten_danh_muc": "Nước giải khát",
        "slug": "nuoc-giai-khat"
      },
      "con_hang": true,
      "han_su_dung": "2026-11-30"
    }
  },
  "errors": null
}
```

Chỉ sản phẩm đang bán được trả về. Response không chứa số lượng tồn chính xác. Chỉ sản phẩm có `nhan_khuyen_mai = "CAN_HAN"` mới có trường `han_su_dung`, chỉ chứa hạn của lô gần nhất còn hàng; mọi sản phẩm khác không trả trường này hay thông tin lô. API Admin mới trả đủ hạn và lô.
**Lỗi:** `404` id không hợp lệ, sản phẩm không tồn tại hoặc đã ẩn; `500` lỗi truy vấn.

Ngoại lệ: sản phẩm đang giảm cận hạn (`nhan_khuyen_mai = "CAN_HAN"`) được trả `han_su_dung` gần nhất còn hàng để giải thích ưu đãi; không trả số lượng hoặc các dữ liệu lô khác. Sản phẩm giảm theo `THU_SAU` hoặc không giảm tuyệt đối không có trường hạn sử dụng. `?now=YYYY-MM-DD` chỉ hoạt động khi `APP_ENV=development`; môi trường khác trả `422`.

## 20. Khuyến mãi hiệu lực công khai

Giá khuyến mãi được tính theo giờ Việt Nam. Thứ Sáu chỉ giảm cho các sản phẩm đã được lưu trong chương trình `THU_SAU` đang hoạt động và còn trong thời hạn. Lô còn hàng có hạn sử dụng không muộn hơn hôm nay cộng số ngày cấu hình được áp dụng mức giảm cận hạn. Nếu đồng thời thỏa hai điều kiện, chỉ áp dụng mức giảm cao hơn, không cộng dồn. Chỉ sản phẩm có nhãn hiệu lực `CAN_HAN` mới trả hạn sử dụng của lô gần nhất còn hàng; sản phẩm khác không trả thông tin lô/hạn.

### `GET /api/products` và `GET /api/products/{id}`

Ngoài `gia_ban` (giá gốc để tương thích), mỗi sản phẩm có:

- `gia_goc`: giá niêm yết VND.
- `phan_tram_giam`: mức giảm hiệu lực, không cộng dồn.
- `gia_ban_hieu_luc`: giá VND sau khi làm tròn, không âm.
- `nhan_khuyen_mai`: `THU_SAU`, `CAN_HAN` hoặc `null`.
- Chỉ khi `nhan_khuyen_mai` là `CAN_HAN`, response có thêm `han_su_dung` của lô gần nhất còn hàng; nhãn khác không trả hạn hoặc dữ liệu lô.

Danh sách hỗ trợ `near_expiry=1` để chỉ lọc sản phẩm có lô cận hạn còn hàng. Tham số `now=YYYY-MM-DD` chỉ được dùng trong `APP_ENV=development`; gửi tham số này ở môi trường khác hoặc sai định dạng trả `422`.

### `GET /api/promotions/active`

Không cần CSRF hoặc đăng nhập. Trả các chương trình đang bật và trong thời hạn hôm nay, kèm sản phẩm đang hiển thị, danh mục đang hiển thị và còn hàng. Với chương trình `THU_SAU`, chỉ trả vào đúng thứ trong cấu hình (mặc định Thứ Sáu). Sản phẩm đã ẩn/hết hàng vẫn giữ trong danh sách Admin nhưng không xuất hiện công khai.

**Response — 200:** `data.promotions[]` gồm `id`, `ma_khuyen_mai`, `ten_chuong_trinh`, `loai`, `phan_tram_giam`, thời hạn và `products[]`. Sản phẩm kèm giá hiệu lực, nhãn khuyến mãi, `anh_thumb` và `con_hang`; không kèm lô hay hạn sử dụng. `?now=YYYY-MM-DD` chỉ dùng trong development.

## 21. Quản lý khuyến mãi Admin

Tất cả API dưới đây yêu cầu session Admin đã xác thực OTP. Mọi `POST`, `PUT`, `PATCH`, `DELETE` cần cookie session, `X-CSRF-Token` và `Content-Type: application/json`.

### `GET /api/admin/promotions`

Query tùy chọn: `page`, `per_page` (tối đa 50), `q` (mã/tên), `loai` (`THU_SAU`, `CAN_HAN`, `KHAC`), `trang_thai` (`0`/`1`). Trả mã, tên, mức giảm, thời hạn, trạng thái và số sản phẩm đã chọn.

### `GET /api/admin/promotions/{id}`

Trả thông tin chương trình, danh sách sản phẩm kèm `la_chon_thu_cong`/`hop_le`, `che_do_chon_sp` suy ra từ danh sách ghim, và cảnh báo số lượng/sản phẩm cần thay nếu chương trình Thứ Sáu có dưới 10 sản phẩm hợp lệ.

### `POST /api/admin/promotions` và `PUT /api/admin/promotions/{id}`

**Body mẫu:**

```json
{
  "ma_khuyen_mai": "FRIDAY-SAMPLE",
  "ten_chuong_trinh": "Ưu đãi Thứ Sáu",
  "loai": "THU_SAU",
  "phan_tram_giam": 10,
  "so_san_pham": 10,
  "san_pham_ids": [1, 2],
  "ngay_bat_dau": "2026-01-01 00:00:00",
  "ngay_ket_thuc": "2026-12-31 23:59:59",
  "trang_thai": 0
}
```

`san_pham_ids` là danh sách ghim, có thể bỏ qua khi sửa để giữ ghim hiện có. Thứ Sáu yêu cầu đúng 10 sản phẩm; hệ thống lưu ngay các ghim và bốc ngẫu nhiên phần còn lại từ sản phẩm đang bán, còn hàng, thuộc danh mục đang hiển thị. Việc chọn/lưu chạy trong một transaction và không random lại khi khách đọc API. Có thể lưu nháp nếu chưa đủ sản phẩm; kích hoạt khi chưa đủ 10 sản phẩm hợp lệ trả `422` kèm số lượng hiện có. `lich_chay_thu` của `THU_SAU` luôn là `5`. Với loại khác, danh sách gửi lên được lưu thủ công. Ngày có thể là `YYYY-MM-DD` hoặc `YYYY-MM-DD HH:MM:SS`.

**Response:** `201` khi tạo, `200` khi sửa. Mã trùng trả `409`; sản phẩm không tồn tại, ngày/mức giảm/trạng thái không hợp lệ trả `422`.

### `PATCH /api/admin/promotions/{id}/status`

Body `{"trang_thai": 1}` để kích hoạt hoặc `{"trang_thai": 0}` để tạm dừng. Kích hoạt chương trình Thứ Sáu kiểm tra và bốc bù ngẫu nhiên trong transaction; không đủ 10 sản phẩm hợp lệ trả `422`.

### `POST /api/admin/promotions/{id}/random-products`

Bốc lại phần ngẫu nhiên và giữ nguyên mọi sản phẩm Admin đã ghim. Kết quả được lưu; không bốc lại ở request khách hàng. Chương trình Thứ Sáu đang bật chỉ được cập nhật nếu vẫn đủ 10 sản phẩm hợp lệ.

### `DELETE /api/admin/promotions/{id}`

Xóa chương trình chưa được dùng trong đơn hàng (`200`). Nếu đã dùng, trả `409` và chỉ cho phép tạm dừng.

**Lỗi chung:** `401` chưa đăng nhập; `403` sai vai trò, chưa xác thực OTP hoặc CSRF sai; `404` không tồn tại; `409` mã trùng/chương trình đã gắn đơn hàng; `422` tham số hoặc dữ liệu không hợp lệ, hoặc không đủ sản phẩm để kích hoạt; `500` lỗi hệ thống. Thao tác Admin được ghi log với Admin ID, hành động và ID chương trình, không ghi payload nhạy cảm.

## 22. Quản lý danh mục Admin

Tất cả API trong mục này yêu cầu cookie session Admin đã đăng nhập và xác thực OTP. Mọi request ghi dữ liệu phải gửi `X-CSRF-Token` lấy từ `GET /api/csrf`, cookie session và `Content-Type: application/json`.

### `GET /api/admin/categories`

Trả tất cả danh mục, gồm cả danh mục ẩn, với `id`, `ten_danh_muc`, `slug`, `icon`, `thu_tu`, `trang_thai`.

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
        "thu_tu": 1,
        "trang_thai": 1
      }
    ]
  },
  "errors": null
}
```

### `POST /api/admin/categories`

**Body:** Chỉ nhận `ten_danh_muc` và `thu_tu`; slug được tự tạo duy nhất, icon đặt mặc định `box`.

```json
{"ten_danh_muc": "Đồ khô", "thu_tu": 6}
```

Tên là bắt buộc và không trùng; slug tự tạo từ tên, bỏ dấu, chữ thường, gạch ngang; nếu trùng slug, thêm hậu tố số. `thu_tu` tùy chọn. API không nhận `slug`, `icon` hoặc `nhom_con`.
**Response — 201:** `{"success":true,"message":"Đã tạo danh mục","data":{"id":12},"errors":null}`

### `PUT /api/admin/categories/{id}`

**Body:** giống API tạo danh mục. Tên mới không được trùng; slug được cập nhật tự động và duy nhất.
**Response — 200:** `{"success":true,"message":"Đã cập nhật danh mục","data":{"id":12},"errors":null}`

### `PATCH /api/admin/categories/{id}/visibility`

**Body:** `{"trang_thai": 0}` để ẩn, `{"trang_thai": 1}` để hiện. Không có API xóa danh mục; danh mục có sản phẩm chỉ được ẩn.
**Response — 200:** `{"success":true,"message":"Đã cập nhật trạng thái danh mục","data":{"id":12,"trang_thai":0},"errors":null}`

## 23. Quản lý sản phẩm Admin

Các API yêu cầu Admin đã xác thực OTP, cookie session và CSRF cho `POST`, `PUT`, `PATCH`, `DELETE`; mọi response API Admin dùng `Cache-Control: no-store`. Contract sản phẩm chỉ dùng `ten`, `danh_muc_id`, `gia`, `don_vi_tinh`, `mo_ta`, `anh`. `gia` phải là JSON number nguyên dương (không nhận chuỗi hay số thập phân), tối đa `999999999` VND; response trả số nguyên để frontend tự định dạng. Response ảnh có `anh` (800×800) và `anh_thumb` (400×400). Nội dung HTML bị loại bỏ trước khi lưu. Trường tồn kho, hạn sử dụng và trạng thái không nhận từ payload cập nhật; sản phẩm mới bắt đầu với tồn kho `0`. API từ chối các trường cũ `ten_san_pham`, `gia_ban`, `hinh_anh`, `nhom_con`, `huong_vi`, `dong_goi`; nếu các cột nhóm con/hương vị/đóng gói tồn tại trong CSDL thì không dùng/xóa dữ liệu đó.

### `GET /api/admin/products`

**Query tùy chọn:** `page` (mặc định 1), `per_page` (mặc định 20, tối đa 50), `q`, `category_id`, `trang_thai` (`0` hoặc `1`). Không lọc trạng thái thì trả cả sản phẩm đang bán và đang ẩn.
**Response — 200:** `data.products` kèm `data.pagination`; mỗi sản phẩm có `id`, `danh_muc_id`, `ten_danh_muc`, `ten`, `gia` (JSON integer), `don_vi_tinh`, `mo_ta`, `anh`, `anh_thumb` (có thể `null` nếu ảnh được lưu nguyên bản khi GD chưa bật), `so_luong_ton`, `muc_ton_toi_thieu`, `trang_thai`. Chi tiết Admin bổ sung lô và hạn sử dụng.

### `GET /api/admin/products/{id}`

Trả các trường sản phẩm như danh sách, cùng `tong_ton_kho`, `han_su_dung_gan_nhat` và danh sách `lo_hang` còn tồn có số lượng từng lô; `404` nếu không tồn tại.

### `POST /api/admin/products`

**Body:**

```json
{
  "ten": "Bánh quy mẫu",
  "danh_muc_id": 1,
  "gia": 25000,
  "don_vi_tinh": "gói",
  "mo_ta": "Mô tả sản phẩm",
  "anh": null
}
```

**Response — 201:** `{"success":true,"message":"Đã tạo sản phẩm","data":{"id":25},"errors":null}`

### `PUT /api/admin/products/{id}`

Nhận các trường dữ liệu giống API tạo sản phẩm; không thay đổi tồn kho hoặc hạn sử dụng.
**Response — 200:** `{"success":true,"message":"Đã cập nhật sản phẩm","data":{"id":25},"errors":null}`

### `PATCH /api/admin/products/{id}/visibility`

**Body:** `{"trang_thai": 0}` để ẩn, `{"trang_thai": 1}` để hiện.
**Response — 200:** `{"success":true,"message":"Đã cập nhật trạng thái sản phẩm","data":{"id":25,"trang_thai":0},"errors":null}`

### `DELETE /api/admin/products/{id}`

Nếu sản phẩm xuất hiện trong chi tiết đơn hàng hoặc phiếu nhập, sản phẩm được ẩn và response `200` có `data.deleted = false`. Nếu chưa có giao dịch đó, sản phẩm được xóa thật và response `200` có `data.deleted = true`. Nếu còn liên kết dữ liệu khác khiến xóa không an toàn, trả `409`.

### `POST /api/admin/products/{id}/image`

Gửi `multipart/form-data` với trường tệp `image`, cookie Admin và `X-CSRF-Token` (không tự đặt `Content-Type` để client tạo multipart boundary). Chỉ nhận JPEG, PNG hoặc WebP; kích thước tối đa 2 MB. MIME được kiểm bằng `finfo`; GD giải mã rồi tạo ảnh vuông 800×800 và thumbnail 400×400 trên nền trắng, giữ trọn ảnh theo tỉ lệ (không crop), chất lượng khoảng 82. Ảnh được mã hóa lại nên EXIF bị loại bỏ. Ưu tiên WebP nếu encoder GD khả dụng, nếu không thì JPEG. Tên file ngẫu nhiên trong `backend/uploads/products/`; ảnh cũ chỉ bị xóa sau khi các file mới được lưu và cập nhật CSDL thành công. Nếu GD chưa bật, vẫn trả `200`, lưu ảnh gốc theo MIME đã kiểm tra và trả cảnh báo cùng `anh_thumb: null`.

**Response — 200:**

```json
{
  "success": true,
  "message": "Đã cập nhật ảnh sản phẩm",
  "data": {
    "id": 25,
    "anh": "uploads/products/0123456789abcdef0123456789abcdef.webp",
    "anh_thumb": "uploads/products/0123456789abcdef0123456789abcdef_thumb.webp",
    "url": "http://localhost/monsmokee/backend/uploads/products/0123456789abcdef0123456789abcdef.webp",
    "thumb_url": "http://localhost/monsmokee/backend/uploads/products/0123456789abcdef0123456789abcdef_thumb.webp"
  },
  "errors": null
}
```

**Lỗi chung:** `401` chưa đăng nhập; `403` không phải Admin/OTP chưa xác thực hoặc CSRF sai; `404` danh mục/sản phẩm không tồn tại; `409` tên danh mục trùng hoặc xóa sản phẩm bị cản bởi liên kết; `413` tệp vượt giới hạn cấu hình PHP; `422` dữ liệu không hợp lệ hoặc ảnh sai loại/kích thước; `500` lỗi hệ thống.

Mọi thao tác ghi thành công được ghi vào `backend/storage/logs/admin_audit.log` dưới dạng thời gian, Admin ID, hành động, loại bản ghi và ID; không ghi payload, mật khẩu hay OTP.

Ảnh tĩnh trong `backend/uploads/products/` được cache `public, max-age=31536000, immutable` vì tên file ngẫu nhiên, và thư mục uploads chặn thực thi PHP. Nếu GD chưa bật, ảnh vẫn được lưu nguyên bản sau khi kiểm tra MIME thật; response có `warning`, `anh_thumb` và `thumb_url` là `null`, đồng thời ghi cảnh báo vào log. Khi GD đã bật, chạy `php backend/scripts/regenerate_images.php` từ thư mục gốc để chuẩn hóa ảnh cũ; script chỉ xóa ảnh cũ sau khi đã ghi xong cả hai biến thể và cập nhật các bản ghi CSDL.

## 24. Phiếu nhập kho, lô hàng và lịch sử kho Admin

Tất cả API dưới đây yêu cầu Admin đã đăng nhập và xác thực OTP. Mọi `POST` cần cookie session, `Content-Type: application/json` và `X-CSRF-Token` lấy từ `GET /api/csrf`.

### `POST /api/admin/stock-receipts`

Tạo phiếu nhập, chi tiết, lô, cập nhật tồn kho và ghi lịch sử trong một transaction. Ngày nhập dùng `YYYY-MM-DD` và không được ở tương lai; hạn sử dụng phải sau ngày nhập và chưa hết hạn. Ngày sản xuất được ghi nhận bằng ngày nhập vì request chưa có trường ngày sản xuất.

**Body:**

```json
{
  "nha_cung_cap": "Nhà cung cấp mẫu",
  "ngay_nhap": "2026-11-23",
  "ghi_chu": "Nhập hàng",
  "chi_tiet": [
    {
      "san_pham_id": 1,
      "so_luong": 12,
      "gia_nhap": 8000,
      "han_su_dung": "2027-11-23",
      "so_lo": "LOT-2026-11"
    }
  ]
}
```

Mỗi phiếu nhận 1–100 dòng; số lượng là số nguyên dương, giá nhập là số nguyên không âm. Sản phẩm phải tồn tại và đang hiển thị. Nếu bất kỳ dòng nào không hợp lệ, không ghi dữ liệu nào.

**Response — 201:**

```json
{
  "success": true,
  "message": "Đã tạo phiếu nhập kho",
  "data": {"id": 15, "ma_phieu": "PN2611230123456789AB", "tong_tien_nhap": 96000},
  "errors": null
}
```

### `GET /api/admin/stock-receipts`

Query tùy chọn `page`, `per_page` (tối đa 50), `from_date`, `to_date` theo `YYYY-MM-DD`. Trả phiếu đã hoàn thành và đã hủy cùng tổng số dòng, nhà cung cấp, ngày nhập, ghi chú, trạng thái và tổng tiền.

### `GET /api/admin/stock-receipts/{id}`

Trả phiếu cùng các dòng hàng, số lô, hạn sử dụng và số lượng lô còn lại; `404` nếu không tồn tại.

### `POST /api/admin/stock-receipts/{id}/cancel`

Hủy trong transaction sau khi khóa phiếu, chi tiết, lô và sản phẩm. Chỉ hủy nếu mỗi lô còn nguyên số lượng nhập và tồn sản phẩm đủ để trừ; nếu đã xuất hàng, thiếu lô, phiếu đã hủy hoặc tồn kho không đủ thì trả `409`, kèm `errors.reason`. Hủy thành công đặt số lượng còn trong lô về 0, trừ tồn sản phẩm, ghi lịch sử và đánh dấu phiếu `DA_HUY`.

### `GET /api/admin/batches`

Trả lô còn hàng, sắp theo hạn sử dụng gần nhất. Query tùy chọn `product_id`, `expiring_within_days` (1–3650) hoặc `expired=1`; không kết hợp hai bộ lọc hạn cùng lúc. Đây là API tra cứu lô/hạn sử dụng chỉ dành cho Admin.

### `GET /api/admin/stock-history`

Query tùy chọn `product_id`, `page`, `per_page` (tối đa 50). Trả loại giao dịch, số lượng thay đổi có dấu, tồn sau giao dịch, tham chiếu, người thực hiện và thời gian.

### Chi tiết sản phẩm Admin

`GET /api/admin/products/{id}` trả thêm `tong_ton_kho`, `lo_hang` còn tồn và `han_su_dung_gan_nhat`. API công khai chỉ trả `han_su_dung` cho sản phẩm đang giảm cận hạn; đầy đủ lô, số lượng và hạn chi tiết chỉ xuất hiện ở API Admin.

**Lỗi chung:** `401` chưa đăng nhập; `403` sai vai trò, chưa xác thực OTP hoặc CSRF sai; `404` không tìm thấy phiếu/sản phẩm; `409` không thể hủy phiếu; `422` dữ liệu dòng nhập, ngày, số lượng, giá hoặc bộ lọc không hợp lệ; `500` lỗi hệ thống.

Mọi thao tác tạo/hủy phiếu nhập được ghi vào `backend/storage/logs/admin_audit.log`, chỉ gồm Admin ID, hành động và ID phiếu. Khi triển khai bán hàng, hệ thống phải xuất lô có hạn sử dụng gần nhất trước (FEFO) trong cùng transaction với việc giảm tồn; cập nhật kho có điều kiện và khóa hàng để tồn không âm.

## 25. Khu vực giao hàng, báo phí ship và thông tin cửa hàng

### `GET /api/shipping/areas`

Trả danh sách khu vực đang hỗ trợ giao hàng dưới dạng danh sách phẳng có `tinh`, `quan_huyen`, `phuong_xa`, `id` và `khoang_cach_km`. Dropdown có thể lấy danh sách tỉnh duy nhất, sau đó lọc bằng `?tinh=...` và `?tinh=...&quan_huyen=...`.

**Response — 200:**

```json
{
  "success": true,
  "message": "Danh sách khu vực giao hàng",
  "data": {
    "areas": [
      {
        "id": 1,
        "tinh": "Quảng Bình",
        "quan_huyen": "TP. Đồng Hới",
        "phuong_xa": "Phường Bắc Lý",
        "khoang_cach_km": 4.5
      }
    ]
  },
  "errors": null
}
```

### `POST /api/shipping/quote`

**Headers:** `Content-Type: application/json`, cookie session, `X-CSRF-Token`.
**Body:**

```json
{"khu_vuc_id": 1, "tien_hang_sau_giam": 50000}
```

**Response — 200:**

```json
{
  "success": true,
  "message": "Báo phí giao hàng tạm tính",
  "data": {
    "phi_ship_tam_tinh": 15000,
    "mien_phi": false,
    "ly_do": "Phí vận chuyển tạm tính theo khu vực",
    "cho_phep_cod": true,
    "ly_do_khong_cod": null,
    "khoang_cach_km": 4.5,
    "giao_duoc": true
  },
  "errors": null
}
```

Các ngưỡng được đọc từ `backend/config/business.php`: miễn phí nếu tiền hàng sau giảm đạt `free_ship_min_order` hoặc khoảng cách không vượt `free_ship_max_km`; ngoài hai điều kiện đó, phí chuẩn `fee_default` áp dụng từ `delivery_min_order` trở lên trong bán kính `max_service_km`. Đơn dưới ngưỡng giao tối thiểu và ở ngoài bán kính miễn phí chỉ hỗ trợ Click & Collect. Ngoài bán kính phục vụ hoặc khu vực tắt thì `giao_duoc=false`. COD chỉ được bật khi đạt `cod_min_order` và khu vực thuộc `service_area`; trường hợp khác trả lý do và gợi ý Click & Collect. Phí trả về chỉ là tạm tính, Admin chốt phí thực tế ở bước đơn hàng.

**Lỗi:** `403` CSRF không hợp lệ; `422` ID khu vực hoặc tiền hàng không hợp lệ; `500` lỗi hệ thống.

### `GET /api/store-info`

Trả `ten_cua_hang`, `dia_chi`, `hotline`, `gio_mo_cua` và `gio_dong_cua` từ cấu hình `store` trong `backend/config/business.php`. Response thành công là `200`; lỗi hệ thống là `500`.

```json
{
  "success": true,
  "message": "Thông tin cửa hàng",
  "data": {
    "ten_cua_hang": "MON SMOKEE",
    "dia_chi": "(cập nhật) Đồng Hới, Quảng Bình",
    "hotline": "(cập nhật)",
    "gio_mo_cua": "07:00",
    "gio_dong_cua": "21:30"
  },
  "errors": null
}
```

## 26. Admin quản lý khu vực giao hàng

Tất cả API yêu cầu Admin đã đăng nhập và xác thực OTP; mọi thao tác ghi cần cookie session và `X-CSRF-Token`. Địa chỉ khu vực không được trùng tổ hợp tỉnh/quận-huyện/phường-xã; khoảng cách là số không âm, tối đa một chữ số thập phân. Không có API xóa cứng; khu vực đã dùng trong đơn có thể được tắt bằng trạng thái `ho_tro=0`.

### `GET /api/admin/delivery-areas`

Trả `200` và tất cả khu vực, gồm khu vực đang tắt:

```json
{
  "success": true,
  "message": "Danh sách khu vực giao hàng",
  "data": {
    "areas": [
      {
        "id": 1,
        "tinh": "Quảng Bình",
        "quan_huyen": "TP. Đồng Hới",
        "phuong_xa": "Phường Bắc Lý",
        "khoang_cach_km": 4.5,
        "ho_tro": 1
      }
    ]
  },
  "errors": null
}
```

### `POST /api/admin/delivery-areas`

**Body:**

```json
{
  "tinh": "Quảng Bình",
  "quan_huyen": "TP. Đồng Hới",
  "phuong_xa": "Khu vực mẫu",
  "khoang_cach_km": 3.2,
  "ho_tro": 1
}
```

Trả `201` và ID mới. `409` nếu địa chỉ đã tồn tại; `422` nếu tên, khoảng cách hoặc trạng thái không hợp lệ.

### `PUT /api/admin/delivery-areas/{id}`

Nhận các trường giống POST để cập nhật đầy đủ khu vực. Trả `200`; `404` nếu không tồn tại; `409` nếu trùng; `422` nếu dữ liệu sai.

### `PATCH /api/admin/delivery-areas/{id}/status`

Body `{"ho_tro": 0}` để tắt hoặc `{"ho_tro": 1}` để bật khu vực. Trả `200`; `404` nếu ID không tồn tại; `422` nếu trạng thái không phải 0/1.

Thao tác tạo, sửa và bật/tắt được ghi vào `backend/storage/logs/admin_audit.log` với Admin ID, hành động và ID khu vực.
Lỗi chung: `401` chưa đăng nhập; `403` sai vai trò, chưa xác thực OTP hoặc CSRF sai; `404` không tìm thấy khu vực; `409` địa chỉ trùng; `422` dữ liệu không hợp lệ; `500` lỗi hệ thống.
