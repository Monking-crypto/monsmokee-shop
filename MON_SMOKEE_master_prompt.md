# PROMPT TỔNG – DỰ ÁN WEBSITE TẠP HÓA MON SMOKEE (PHP thuần + MySQL + Bootstrap 5)

> **Cách dùng:** Tạo một thư mục trống (ví dụ `C:\xampp\htdocs\monsmokee`), mở bằng VS Code, mở AI Agent (Copilot Agent / Claude Code / Cursor…), dán **toàn bộ nội dung từ dòng `=== BẮT ĐẦU PROMPT ===` đến `=== HẾT PROMPT ===`**. Nếu agent bị giới hạn độ dài, bảo nó làm lần lượt từng "GIAI ĐOẠN" ở mục 14 và dừng báo cáo sau mỗi giai đoạn.

=== BẮT ĐẦU PROMPT ===

# 0. VAI TRÒ

Bạn là một **Senior Fullstack Engineer + Solution Architect** chuyên PHP/MySQL và thiết kế UI thương mại điện tử bán lẻ. Hãy **tạo trực tiếp toàn bộ dự án** trong thư mục làm việc hiện tại (tạo thư mục, tạo file, ghi code đầy đủ — không chỉ mô tả). Không hỏi lại những điều đã được quyết định trong tài liệu này; nếu gặp chỗ mơ hồ, áp dụng mục **2.2 (Quyết định cho các điểm mâu thuẫn)** hoặc chọn phương án an toàn nhất và ghi lại trong `docs/QUYET_DINH_THIET_KE.md`.

Mục tiêu: một **bộ khung dự án hoàn chỉnh, đúng nghiệp vụ**, trong đó:
- **Giai đoạn 1 (làm đầy đủ, chạy được ngay):** giao diện + chức năng **Đăng ký (OTP Email), Đăng nhập, Quên mật khẩu, Trang chủ Khách hàng, Đăng nhập Admin, Trang chủ (Dashboard) Admin**, cùng toàn bộ hạ tầng backend, CSDL, bảo mật dùng chung.
- **Các use case còn lại:** tạo **sẵn file/thư mục đúng vị trí**, có khung class/hàm/route/trang HTML, **mỗi file có comment đầu file ghi rõ use case, quy trình, các bước, các nhánh rẽ, quy tắc nghiệp vụ** để lập trình viên điền code sau. Route của phần chưa làm trả về `501 Not Implemented`; giao diện xử lý 501 bằng toast "Tính năng đang được phát triển".

---

# 1. BỐI CẢNH

- Khách hàng: **Cửa hàng tạp hóa MON SMOKEE**, hộ kinh doanh tại **TP. Đồng Hới (Quảng Bình)**. Hệ thống chỉ phục vụ **một cửa hàng** (không phải sàn đa người bán).
- Hai nhóm người dùng: **Khách hàng (Customer)** và **Quản trị viên (Admin)**.
- Thanh toán: **chỉ COD** (giao hàng thu tiền hộ) hoặc **tiền mặt tại quầy** (Click & Collect). **Không** tích hợp cổng thanh toán online.
- Giao hàng: **chỉ nội thành Đồng Hới**.
- Giao diện tham khảo **bố cục & trải nghiệm** của **Bách Hóa Xanh** (danh mục rõ ràng, tìm kiếm mạnh, thẻ sản phẩm gọn) và **WinMart/VinMart** (checkout mượt, hiển thị rõ phí ship & thời gian nhận). **Chỉ tham khảo bố cục/UX; KHÔNG sao chép logo, tên thương hiệu, hình ảnh, văn bản, mã nguồn của các trang đó.** Nhận diện riêng của MON SMOKEE (mục 10.1).
- Tài liệu học phần đi kèm (PHP căn bản STU, Lab 6: chuỗi – regex – OOP) → code phải dùng **PHP thuần có OOP**, tận dụng hàm chuỗi (`trim`, `explode/implode`, `htmlspecialchars`, `strip_tags`, `nl2br`, `substr`, `ucwords`, `number_format`, `mb_*`) và **regex `preg_match`/`preg_replace`** cho validation (mục 11.2). **Không dùng md5/sha1 cho mật khẩu** (dù Lab 6 có nhắc) — dùng `password_hash(..., PASSWORD_BCRYPT)`.

---

# 2. QUYẾT ĐỊNH KỸ THUẬT

## 2.1 Công nghệ (bắt buộc)

| Thành phần | Chọn |
|---|---|
| Backend | **PHP ≥ 8.1 thuần, OOP, không framework**, `declare(strict_types=1);`, autoload PSR-4 qua Composer (có fallback `spl_autoload_register` nếu chưa chạy composer) |
| CSDL | **MySQL 8 / MariaDB 10.4+** (XAMPP/Laragon), truy cập bằng **PDO + prepared statements** (`ERRMODE_EXCEPTION`, `EMULATE_PREPARES=false`), charset `utf8mb4` |
| Gửi OTP | **PHPMailer** (qua Composer) gửi **Email OTP** qua SMTP (Gmail App Password). Có **chế độ dev** ghi OTP ra `backend/storage/mail_outbox/*.txt` và `storage/logs/otp.log` khi `MAIL_DRIVER=log` để chạy không cần SMTP |
| Frontend | **HTML5 + CSS3 + JavaScript ES Modules (không build tool) + Bootstrap 5.3.3** (CDN) + **Bootstrap Icons** + **Chart.js 4.4.x** (CDN, dùng ở Admin). Font **Be Vietnam Pro** (Google Fonts) |
| Kiến trúc | **2 thư mục lớn tách biệt: `backend/` (REST API JSON) và `frontend/` (nhiều trang HTML tĩnh gọi API bằng `fetch`)**. Cùng origin (Apache) để dùng **PHP Session cookie** |
| Phiên đăng nhập | PHP Session (`HttpOnly`, `SameSite=Lax`, `session_regenerate_id(true)` sau đăng nhập) + **CSRF token** |
| Múi giờ | `Asia/Ho_Chi_Minh` (PHP, MySQL session, JS) |
| Công cụ | VS Code, XAMPP/Laragon, Git |

## 2.2 Quyết định cho các điểm mâu thuẫn trong đề cương (ĐÃ CHỐT – áp dụng nguyên văn)

| # | Mâu thuẫn trong tài liệu | Quyết định |
|---|---|---|
| 1 | OTP "qua SMS" (một số mục) vs "qua Email" (mục 1.1, 1.3, quy trình 5, 7) | **Email OTP.** Form đăng ký có: Họ tên, SĐT, Email, Mật khẩu, Nhập lại mật khẩu. Đăng nhập bằng **SĐT + mật khẩu**. Quên mật khẩu: nhập **Email** (hoặc SĐT → hệ thống tra email tương ứng, vẫn gửi OTP về email). Thiết kế `OtpSenderInterface` để sau này thay bằng SMS. |
| 2 | Freeship: "≥150k **hoặc** <2km" (QT8), "2–2,5km thêm 15k" (UC04), "≤2,5km" (ràng buộc 2.3.1.2) | **Theo mục Ràng buộc 2.3.1.2:** Freeship nếu `tiền hàng sau giảm ≥ 150.000` **HOẶC** `khoảng cách ≤ 2,5 km`. Phí 15.000đ nếu `50.000 ≤ tiền hàng < 150.000` **VÀ** `khoảng cách > 2,5 km` (và trong bán kính phục vụ). Mọi ngưỡng đặt trong `config/business.php`, **không hard-code** rải rác. |
| 3 | Trạng thái đơn Click & Collect: QT9 nói tạo ngay "Chờ lấy hàng", ràng buộc & UC04 nói "Chờ xử lý → Chờ lấy hàng" | **Tạo đơn = `CHO_XU_LY`.** Admin chuẩn bị hàng → `CHO_LAY_HANG` (lúc này trừ kho) → `THANH_CONG` hoặc `DA_HUY`. Cronjob chỉ quét đơn `CHO_LAY_HANG`. |
| 4 | Thời điểm trừ kho: "khi đặt" vs "khi Admin xác nhận" | **Chỉ trừ kho khi Admin xác nhận** (COD: `CHO_XU_LY→DANG_GIAO`; C&C: `CHO_XU_LY→CHO_LAY_HANG`). Đặt cờ `don_hang.da_tru_kho=1`. Khi hủy: **chỉ hoàn kho nếu `da_tru_kho=1`** (đơn khách tự hủy lúc "Chờ xử lý" chưa trừ nên không cần hoàn, nhưng luồng hủy vẫn chạy trong **Transaction** và ghi log). |
| 5 | "Quản lý giảm giá: luôn giảm 10%" (mục 1.3) vs QT13/QT8/QT14 (Thứ 6 10% cho 10 SP + cận hạn 50%) | **Theo QT13/8/14** (bỏ ý "luôn giảm 10%"). Nếu một sản phẩm đủ cả 2 điều kiện: **lấy mức giảm cao hơn, KHÔNG cộng dồn**. |
| 6 | Danh sách địa phương hành chính Quảng Bình có thể đã thay đổi theo đợt sáp nhập đơn vị hành chính | **Không hard-code tên phường/xã.** Dữ liệu nằm ở bảng `khu_vuc_giao_hang` + `database/seed_khu_vuc.sql` chứa **dữ liệu mẫu có comment "CẬP NHẬT THEO THỰC TẾ"**. Dropdown Tỉnh → Quận/Huyện → Phường/Xã đọc từ API. |
| 7 | SĐT: "10 chữ số" | Regex `^0\d{9}$` (10 chữ số, bắt đầu bằng 0). |
| 8 | "API bản đồ" tính khoảng cách | Giai đoạn này dùng **khoảng cách cấu hình sẵn theo khu vực** (`khu_vuc_giao_hang.khoang_cach_km`). `ShippingService` có hàm `distanceKm()` tách riêng để sau này thay bằng API bản đồ. Admin vẫn **chốt phí ship thực tế thủ công** (QT14). |

---

# 3. CẤU TRÚC THƯ MỤC (tạo đúng như sau)

```
monsmokee/
├─ README.md                      # hướng dẫn cài đặt & chạy (mục 12)
├─ .gitignore                     # vendor/, storage/logs/*, storage/mail_outbox/*, .env, uploads/*
├─ database/
│  ├─ schema.sql                  # DDL đầy đủ (mục 6)
│  ├─ seed.sql                    # vai trò, danh mục, ~24 sản phẩm mẫu, khuyến mãi Thứ 6, gợi ý mua kèm, lô hàng cận hạn
│  ├─ seed_khu_vuc.sql            # khu vực giao hàng mẫu (có cảnh báo cập nhật)
│  └─ seed_admin.php              # CLI: tạo tài khoản Admin bằng password_hash (không lưu hash cứng)
├─ docs/
│  ├─ QUYET_DINH_THIET_KE.md      # ghi lại mục 2.2 + mọi quyết định thêm
│  ├─ API.md                      # bảng API (mục 7)
│  └─ MA_TRAN_USECASE.md          # UC01–UC12 ↔ quy trình 1–15 ↔ file ↔ endpoint ↔ trạng thái (DONE/STUB)
├─ backend/
│  ├─ composer.json               # phpmailer/phpmailer ; autoload psr-4 "App\\" => "app/", "Core\\" => "core/"
│  ├─ .env.example                # DB_*, APP_ENV, APP_URL, MAIL_DRIVER=log|smtp, SMTP_*, SESSION_NAME …
│  ├─ public/
│  │  ├─ index.php                # FRONT CONTROLLER duy nhất: bootstrap → Router → dispatch
│  │  └─ .htaccess                # RewriteRule ^ index.php [L] (trừ file thật)
│  ├─ config/
│  │  ├─ app.php                  # env, timezone, session, CORS (same-origin), debug
│  │  ├─ database.php
│  │  ├─ mail.php
│  │  └─ business.php             # TẤT CẢ hằng số nghiệp vụ (mục 5.1)
│  ├─ core/                       # hạ tầng dùng chung
│  │  ├─ Router.php               # đăng ký route + {param}, middleware, dispatch
│  │  ├─ Request.php              # method, path, json body, query, ip, header
│  │  ├─ Response.php             # json(), success(), error(), HTTP code, envelope
│  │  ├─ Database.php             # PDO singleton, beginTransaction helper `transaction(callable)`
│  │  ├─ Session.php              # start an toàn, flash, regenerate
│  │  ├─ Csrf.php
│  │  ├─ Validator.php            # rule-based + regex (mục 11.2)
│  │  ├─ BaseController.php
│  │  ├─ BaseModel.php
│  │  ├─ Env.php                  # đọc .env
│  │  └─ Logger.php               # ghi storage/logs/*.log
│  ├─ app/
│  │  ├─ Controllers/
│  │  │  ├─ Customer/
│  │  │  │  ├─ AuthController.php          # [GĐ1 DONE] register/start, register/verify, resend, login, logout, me, forgot, reset
│  │  │  │  ├─ HomeController.php          # [GĐ1 DONE] GET /home
│  │  │  │  ├─ CategoryController.php      # [GĐ1 DONE] list
│  │  │  │  ├─ ProductController.php       # [GĐ1 DONE list/search | STUB detail, suggestions] UC01
│  │  │  │  ├─ CartController.php          # [GĐ1 GET /cart | STUB mutations] UC02
│  │  │  │  ├─ ProfileController.php       # [STUB] UC03 cập nhật thông tin / sổ địa chỉ
│  │  │  │  ├─ CheckoutController.php      # [STUB] UC04 preview, place order COD / C&C
│  │  │  │  ├─ OrderController.php         # [STUB] UC05 list, detail, cancel
│  │  │  │  ├─ ReviewController.php        # [STUB] UC05 đánh giá
│  │  │  │  └─ LocationController.php      # [GĐ1 DONE] dropdown Tỉnh/Huyện/Xã + khoảng cách
│  │  │  └─ Admin/
│  │  │     ├─ AdminAuthController.php     # [GĐ1 DONE] QT12 login/logout/me
│  │  │     ├─ DashboardController.php     # [GĐ1 DONE] số liệu tổng quan
│  │  │     ├─ CategoryAdminController.php # [STUB] UC06
│  │  │     ├─ ProductAdminController.php  # [STUB] UC07
│  │  │     ├─ PromotionAdminController.php# [STUB] UC12 (+ QT13 khuyến mãi)
│  │  │     ├─ OrderAdminController.php    # [STUB] UC08
│  │  │     ├─ InventoryAdminController.php# [STUB] UC09
│  │  │     ├─ CustomerAdminController.php # [STUB] UC10
│  │  │     └─ StatisticsController.php    # [STUB] UC11
│  │  ├─ Models/                 # User, Role, Otp, Category, Product, Promotion, CartItem, Order, OrderItem, Review,
│  │  │                          # InventoryReceipt, InventoryReceiptItem, InventoryLog, StockBatch, DeliveryArea, RateLimit
│  │  ├─ Services/               # nghiệp vụ (controller mỏng, service dày)
│  │  │  ├─ AuthService.php          # [GĐ1 DONE]
│  │  │  ├─ OtpService.php           # [GĐ1 DONE] sinh, băm, gửi, kiểm, giới hạn
│  │  │  ├─ Mail/OtpSenderInterface.php, EmailOtpSender.php (PHPMailer), LogOtpSender.php
│  │  │  ├─ CatalogService.php       # [GĐ1 DONE] list/search/home data
│  │  │  ├─ PromotionService.php     # [GĐ1 DONE getEffectivePrice | STUB CRUD] giá hiệu lực Thứ 6 / cận hạn
│  │  │  ├─ CartService.php          # [STUB] session cart + DB cart + merge
│  │  │  ├─ ShippingService.php      # [STUB đầy đủ chữ ký + công thức] tính phí ship
│  │  │  ├─ OrderService.php         # [STUB] tạo đơn, state machine, hủy
│  │  │  ├─ InventoryService.php     # [STUB] trừ/hoàn kho trong transaction, FOR UPDATE, log
│  │  │  ├─ StatisticsService.php    # [GĐ1 DONE cho dashboard | STUB báo cáo] 
│  │  │  └─ UploadService.php        # [STUB] validate & lưu ảnh sản phẩm
│  │  ├─ Middleware/
│  │  │  ├─ AuthMiddleware.php       # 401 nếu chưa đăng nhập
│  │  │  ├─ AdminMiddleware.php      # 403 nếu role ≠ Admin
│  │  │  ├─ CsrfMiddleware.php
│  │  │  └─ RateLimitMiddleware.php
│  │  └─ Helpers/
│  │     ├─ StringHelper.php         # removeAccents(), slug(), normalizeKeyword(), maskEmail(), titleCaseName()
│  │     ├─ MoneyHelper.php          # formatVnd() dùng number_format
│  │     └─ DateHelper.php           # now(), isFriday(), nextFriday(), withinOpeningHours()
│  ├─ routes/
│  │  ├─ customer.php             # route prefix /api
│  │  └─ admin.php                # route prefix /api/admin (qua AdminMiddleware, trừ login)
│  ├─ cron/                       # CLI only (chặn chạy qua web: php_sapi_name()==='cli')
│  │  ├─ auto_cancel_click_collect.php   # [STUB đầy đủ thuật toán] QT9/QT14 nhiệm vụ 1
│  │  └─ scan_expiry_discount.php        # [STUB đầy đủ thuật toán] QT14 nhiệm vụ 2
│  ├─ storage/
│  │  ├─ logs/.gitkeep   ├─ mail_outbox/.gitkeep   └─ rate_limit/.gitkeep
│  ├─ uploads/products/.gitkeep          # ảnh sản phẩm (public qua đường dẫn /monsmokee/backend/uploads/...)
│  └─ tests/
│     └─ smoke.http                       # file REST Client (VS Code) để thử API
└─ frontend/
   ├─ index.html                  # [GĐ1 DONE] Trang chủ khách hàng
   ├─ dang-nhap.html              # [GĐ1 DONE] QT6
   ├─ dang-ky.html                # [GĐ1 DONE] QT5 (2 bước: form → OTP)
   ├─ quen-mat-khau.html          # [GĐ1 DONE] QT7 (3 bước)
   ├─ san-pham.html               # [GĐ1 list/search/lọc DONE | chi tiết STUB] danh mục + tìm kiếm  (QT1)
   ├─ chi-tiet-san-pham.html      # [STUB UI sẵn khung] QT1 + gợi ý mua kèm
   ├─ gio-hang.html              # [STUB UI khung] QT2, QT3
   ├─ thanh-toan.html            # [STUB UI khung] QT4, QT8, QT9
   ├─ dat-hang-thanh-cong.html   # [STUB]
   ├─ tai-khoan.html             # [STUB] UC03 cập nhật thông tin / sổ địa chỉ
   ├─ don-hang.html              # [STUB] QT10 lịch sử đơn
   ├─ chi-tiet-don-hang.html     # [STUB] QT10 + QT11 đánh giá
   ├─ admin/
   │  ├─ login.html              # [GĐ1 DONE] QT12 (đường dẫn /monsmokee/frontend/admin/login.html)
   │  ├─ index.html              # [GĐ1 DONE] Dashboard
   │  ├─ danh-muc.html           # [STUB] UC06
   │  ├─ san-pham.html           # [STUB] UC07
   │  ├─ khuyen-mai.html         # [STUB] UC12
   │  ├─ don-hang.html           # [STUB] UC08
   │  ├─ chi-tiet-don-hang.html  # [STUB] UC08
   │  ├─ kho-nhap-hang.html      # [STUB] UC09 phiếu nhập (có Ngày SX + HSD)
   │  ├─ kho-lich-su.html        # [STUB] UC09 audit log
   │  ├─ kho-canh-bao.html       # [STUB] UC09 sắp hết hàng + cận hạn
   │  ├─ khach-hang.html         # [STUB] UC10
   │  ├─ thong-ke.html           # [STUB] UC11
   │  └─ tai-khoan.html          # [STUB] đổi mật khẩu / thông tin admin
   └─ assets/
      ├─ css/ variables.css, base.css, components.css, customer.css, auth.css, admin.css
      ├─ js/
      │  ├─ core/    config.js (API_BASE, STORE_INFO), api.js (fetch wrapper + CSRF + 401/403/501), ui.js (toast, modal, spinner, confirm),
      │  │           format.js (formatVnd, formatDate), validators.js (regex phía client – phản chiếu server), guard.js (requireLogin/requireAdmin, redirect an toàn)
      │  ├─ components/ header.js, footer.js, bottom-nav.js, product-card.js, category-menu.js, countdown.js, otp-input.js, password-meter.js
      │  ├─ pages/   home.js, login.js, register.js, forgot.js, products.js, product-detail.js, cart.js, checkout.js, account.js, orders.js, order-detail.js
      │  └─ admin/   admin-layout.js (sidebar/topbar), admin-login.js, dashboard.js, categories.js, products.js, promotions.js, orders.js, inventory.js, customers.js, statistics.js
      └─ img/        logo.svg (logo chữ MON SMOKEE tự thiết kế), placeholder-product.svg, banner-1.svg, banner-2.svg, banner-3.svg, category icons .svg (vẽ đơn giản)
```

**Quy tắc đặt tên:** thư mục/file kebab-case (HTML, JS, CSS), class PHP PascalCase, bảng/cột CSDL snake_case tiếng Việt không dấu theo tài liệu (`nguoi_dung`, `don_hang`, `so_luong_ton`…). Tên class/method/biến trong code dùng tiếng Anh; **comment & thông báo cho người dùng bằng tiếng Việt có dấu**.

---

# 4. PHẠM VI TỪNG GIAI ĐOẠN

## 4.1 GIAI ĐOẠN 1 – LÀM ĐẦY ĐỦ, CHẠY ĐƯỢC
1. Hạ tầng backend: Router, Request/Response, PDO, Session, CSRF, Validator, Logger, Middleware, RateLimit, Env.
2. `schema.sql` đầy đủ **mọi bảng** (mục 6) + `seed.sql` + `seed_khu_vuc.sql` + `seed_admin.php`.
3. **Xác thực:** Đăng ký 2 bước + OTP Email, gửi lại OTP, Đăng nhập, Đăng xuất, `GET /me`, Quên mật khẩu 3 bước, Đăng nhập Admin (`403` với khách).
4. **Dữ liệu trang chủ:** `GET /api/home`, `GET /api/categories`, `GET /api/products` (lọc danh mục, tìm **không dấu**, phân trang, sắp xếp), `GET /api/locations/*`, `GET /api/cart` (trả giỏ rỗng/giỏ session đọc được).
5. **Frontend khách:** Trang chủ, Đăng nhập, Đăng ký, Quên mật khẩu, trang danh mục/tìm kiếm (`san-pham.html`), header/footer/bottom-nav dùng chung.
6. **Frontend admin:** Đăng nhập admin, Dashboard (số liệu thật từ DB), layout sidebar dùng chung cho các trang STUB.
7. Mọi trang STUB phải **mở được**, có đủ layout (header/sidebar), khối nội dung hiển thị tiêu đề use case + "Đang phát triển" + danh sách các bước của use case lấy từ comment.

## 4.2 CÁC GIAI ĐOẠN SAU (chỉ dựng khung – mục 9 liệt kê nội dung cần ghi vào từng file)
UC01 (chi tiết SP + gợi ý), UC02, UC03 (cập nhật thông tin), UC04, UC05, UC06, UC07, UC08, UC09, UC10, UC11, UC12, 2 cronjob.

**Định dạng khung của mỗi file STUB (bắt buộc):**
```php
<?php
declare(strict_types=1);
/**
 * [UC08 – Quản lý đơn hàng (Admin)]  |  Quy trình 14  |  TRẠNG THÁI: CHƯA CODE (STUB)
 * Endpoint: PATCH /api/admin/orders/{id}/status
 * Actor: Quản trị viên (Role=Admin)   Tiền điều kiện: đã đăng nhập Admin
 * LUỒNG CHÍNH: 1. … 2. … (chép đúng các bước ở mục 9)
 * RẼ NHÁNH:    4.1 … 
 * QUY TẮC:     (liệt kê ràng buộc liên quan)
 * TODO: [ ] validate  [ ] transaction  [ ] ghi lich_su_kho  [ ] trả JSON
 */
public function updateStatus(Request $req, array $params): void
{
    Response::notImplemented('UC08 – Cập nhật trạng thái đơn hàng');
}
```
Với JS/HTML STUB: comment đầu file tương tự (`/* … */`, `<!-- … -->`), và hàm khởi tạo trang gọi `ui.notImplemented('…')`.

---

# 5. QUY TẮC NGHIỆP VỤ (nguồn chân lý – phải được code đúng)

## 5.1 Hằng số `backend/config/business.php`
```php
return [
  'store' => ['name'=>'MON SMOKEE','address'=>'(cập nhật) Đồng Hới, Quảng Bình','phone'=>'(cập nhật)',
              'lat'=>null,'lng'=>null,'open_time'=>'07:00','close_time'=>'21:30'],   // giờ mở cửa dùng cho Click & Collect
  'otp' => ['length'=>6,'ttl_seconds'=>180,'max_wrong_attempts'=>5,'resend_cooldown_seconds'=>60,'max_sends_per_hour'=>5],
  'password' => ['min_length'=>8],
  'login' => ['max_fail'=>5,'lock_minutes'=>15],
  'shipping' => ['cod_min_order'=>50000,'free_ship_min_order'=>150000,'free_ship_max_km'=>2.5,
                 'fee_default'=>15000,'max_service_km'=>6.0,'fee_manual_max'=>100000],
  'click_collect' => ['auto_cancel_hours'=>48],
  'promotion' => ['friday_percent'=>10,'friday_product_count'=>10,'near_expiry_days'=>10,'near_expiry_percent'=>50,'friday_iso_weekday'=>5],
  'stock' => ['low_stock_threshold_default'=>10],
  'cart' => ['max_qty_per_line'=>99],
  'service_area' => ['province'=>'Quảng Bình','district'=>'TP. Đồng Hới'],
];
```

## 5.2 Tài khoản & OTP
- Mật khẩu: ≥ 8 ký tự, có **chữ hoa, chữ thường, chữ số, ký tự đặc biệt**; băm **bcrypt**.
- SĐT: `^0\d{9}$`, **duy nhất**; Email hợp lệ, **duy nhất**.
- OTP 6 chữ số sinh bằng `random_int`; **lưu dạng băm** (`password_hash` hoặc `hash_hmac`), **hiệu lực 3 phút**, sai tối đa 5 lần thì vô hiệu, mỗi OTP dùng 1 lần; gửi lại cách nhau ≥ 60 giây, tối đa 5 lần/giờ/email (và theo IP).
- Đăng ký: bước 1 chỉ **lưu dữ liệu tạm** (mật khẩu đã băm) vào `otp_xac_thuc.du_lieu_tam`; **chỉ khi xác thực OTP đúng mới INSERT `nguoi_dung`** (vai trò Customer) rồi **tự đăng nhập**.
- Đăng nhập sai: thông báo chung *"Số điện thoại hoặc mật khẩu không đúng"* (không nêu cụ thể). Tài khoản `trang_thai=0` → *"Tài khoản đã bị khóa"* (chỉ báo khi mật khẩu đúng). Giới hạn 5 lần sai / 15 phút theo (SĐT+IP).
- Quên mật khẩu: **luôn trả** *"Nếu thông tin hợp lệ, mã OTP đã được gửi"* dù tài khoản không tồn tại (chống dò tài khoản). Đặt lại: kiểm OTP + kiểm độ mạnh mật khẩu mới + băm + cập nhật + **vô hiệu mọi phiên cũ**.
- Chuyển hướng sau đăng nhập/đăng ký: tham số `?redirect=` **chỉ chấp nhận đường dẫn tương đối nằm trong whitelist** (chống open redirect). Mặc định `thanh-toan.html` nếu đến từ nút "Tiến hành thanh toán", ngược lại `index.html`.

## 5.3 Giỏ hàng
- Khách chưa đăng nhập: giỏ **lưu `$_SESSION['cart']`**; đã đăng nhập: bảng `gio_hang`. Mọi endpoint giỏ hoạt động cho cả hai.
- Thêm/sửa: số lượng nguyên ≥ 1, ≤ tồn kho, ≤ `max_qty_per_line`; vượt → lỗi *"Không đủ hàng"*.
- **Đồng bộ khi đăng nhập/đăng ký thành công:** gộp giỏ session vào giỏ tài khoản (**cộng dồn** số lượng nếu trùng, **kẹp theo tồn kho**, báo mục bị điều chỉnh), xóa giỏ session, rồi chuyển về trang thanh toán nếu có `redirect`. Đăng nhập thất bại → giữ nguyên giỏ session.
- Giá luôn **tính lại ở server**; client chỉ gửi `san_pham_id` + `so_luong`.

## 5.4 Đặt hàng & vận chuyển
- Form thanh toán tự điền **Họ tên (khóa, không cho sửa)** và SĐT; cho phép đổi **SĐT người nhận**. Chọn **ngày/giờ nhận hàng mong muốn**.
- Địa chỉ: dropdown Tỉnh → Quận/Huyện → Phường/Xã (từ API). Nếu không thuộc **TP. Đồng Hới (Quảng Bình)** → **vô hiệu nút đặt hàng giao tận nơi** + thông báo từ chối.
- **COD:** chỉ khi `tiền hàng (sau giảm) ≥ 50.000`; ngược lại **disable tùy chọn COD**, bắt buộc Click & Collect. Phí ship (mục 2.2 #2): `0` nếu `≥150k` hoặc `km ≤ 2,5`; `15.000` nếu `50k ≤ tiền < 150k` và `km > 2,5` (và `km ≤ max_service_km`). Phí này là **tạm tính**; Admin **chốt phí thực tế** (`phi_van_chuyen`, cờ `phi_ship_da_chot`) và gửi thời gian giao dự kiến.
- **Click & Collect:** áp dụng mọi đơn (bắt buộc với đơn < 50k), không phí ship, thanh toán tiền mặt tại quầy. Giờ hẹn phải **ở tương lai** và **trong giờ mở cửa** (`open_time..close_time`). Hiển thị nhắc: *"Vui lòng đến lấy hàng đúng hẹn. Đơn hàng sẽ tự động hủy nếu quá 2 ngày kể từ thời gian hẹn trước đó."*
- Đơn lưu **giá chốt** từng dòng (`gia_goc`, `phan_tram_giam`, `gia_chot`) – sau này đổi giá không ảnh hưởng đơn cũ.
- Kiểm tra lại tồn kho khi đặt; có SP hết → báo và quay về giỏ.

## 5.5 Khuyến mãi (QT8, QT13, QT14)
- **Khuyến mãi Thứ 6:** Admin tạo chương trình giảm **10%**, chọn **10 sản phẩm thủ công** *hoặc* để hệ thống **chọn ngẫu nhiên 10** (`che_do_chon_sp`), đặt **Lịch chạy: Thứ 6 hàng tuần**. Ngày khác giá vẫn là giá gốc.
- **Cận hạn:** cronjob quét `lo_hang` còn tồn và `han_su_dung ≤ hôm nay + 10 ngày` → bật `san_pham.giam_can_han=1` (giảm **50%**) và đẩy lên mục "Cận hạn – Giảm 50%" ở trang chủ.
- **Giá hiệu lực** do `PromotionService::getEffectivePrice(array $product, DateTimeImmutable $now): array{gia_goc, phan_tram_giam, gia_ban_hieu_luc, nguon: 'THU_SAU'|'CAN_HAN'|null, khuyen_mai_id}`: nếu `now` là Thứ 6 (giờ VN) và SP thuộc chương trình `THU_SAU` đang `trang_thai=1` trong khoảng ngày → 10%; nếu `giam_can_han=1` → 50%; đủ cả hai → lấy cao hơn. Mọi API trả sản phẩm **đều dùng hàm này** (gạch giá gốc + giá giảm + nhãn %).
- Khi checkout: lưu `don_hang.so_tien_duoc_giam` (tổng), `khuyen_mai_id` (nếu có chương trình Thứ 6).
- **Hạn sử dụng chỉ hiển thị ở Admin.** API khách **tuyệt đối không trả** trường lô hàng/HSD, **trừ** sản phẩm đang bị ép giảm cận hạn (khi đó mới được trả `han_su_dung` gần nhất).

## 5.6 Tồn kho
- `so_luong_ton` **không bao giờ âm**: ràng buộc `CHECK (so_luong_ton >= 0)` **và** kiểm tra trong code.
- Mọi trừ/hoàn kho chạy trong **Transaction** với `SELECT … FOR UPDATE` trên hàng sản phẩm (chống tranh chấp, không bán âm kho), ghi `lich_su_kho` (loại giao dịch, số lượng +/-, tồn sau).
- Admin có thể **điều chỉnh thủ công** số lượng khi kiểm kho thực tế (`loai_giao_dich='DIEU_CHINH'`, bắt buộc ghi lý do).
- Phiếu nhập bắt buộc **Ngày sản xuất + Hạn sử dụng** cho từng lô (`HSD > NSX`); tạo `lo_hang` tương ứng; trừ kho theo nguyên tắc **FEFO** (lô hết hạn sớm trước) – ghi chú TODO trong `InventoryService`.
- Cảnh báo sắp hết: `so_luong_ton ≤ muc_ton_toi_thieu`.

## 5.7 Máy trạng thái đơn hàng
```
COD:            CHO_XU_LY ──(Admin: chốt ship + xác nhận, TRỪ KHO)──▶ DANG_GIAO ──▶ THANH_CONG
CLICK_COLLECT:  CHO_XU_LY ──(Admin: chuẩn bị hàng, TRỪ KHO)───────▶ CHO_LAY_HANG ─▶ THANH_CONG
Hủy:  khách: chỉ khi CHO_XU_LY │ Admin: mọi trạng thái trừ THANH_CONG │ Cron: CHO_LAY_HANG quá hạn
      → DA_HUY (+ ly_do_huy) → nếu da_tru_kho=1 thì HOÀN KHO (transaction) + ghi lich_su_kho 'HUY_DON'
Đơn DANG_GIAO: khách KHÔNG được hủy (ẩn nút Hủy). Đơn C&C không được chuyển sang DANG_GIAO; đơn COD không được chuyển sang CHO_LAY_HANG.
Doanh thu = SUM(tong_thanh_toan) của đơn THANH_CONG (ghi ngay_hoan_thanh).
```
Nhãn & màu UI: Chờ xử lý (vàng), Đang giao (xanh dương), Chờ lấy hàng (cam), Thành công (xanh lá), Đã hủy (xám/đỏ).

## 5.8 Cronjob (CLI, chạy mỗi 15 phút; lock tránh chạy chồng; ghi `nhat_ky_cron`)
1. **auto_cancel_click_collect.php:** tìm `don_hang` có `phuong_thuc_nhan='CLICK_COLLECT' AND trang_thai='CHO_LAY_HANG' AND gio_hen_lay < NOW() - INTERVAL 48 HOUR`, xử lý **từng đơn trong transaction riêng** (`FOR UPDATE`, kiểm lại trạng thái – idempotent) → `DA_HUY`, `ly_do_huy='Quá hạn lấy hàng'`, hoàn kho, ghi log. Xử lý theo lô (LIMIT 100) để nhẹ server.
2. **scan_expiry_discount.php:** bật `giam_can_han=1, phan_tram_giam_can_han=50` cho SP có lô còn tồn và HSD trong 10 ngày tới; **tắt cờ** cho SP không còn lô cận hạn; ghi danh sách SP đã **quá hạn** vào log/cảnh báo Admin.

---

# 6. CƠ SỞ DỮ LIỆU (`database/schema.sql` – tạo đúng như sau, có `DROP/CREATE DATABASE monsmokee`, `utf8mb4_unicode_ci`, InnoDB)

```sql
CREATE TABLE vai_tro (id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, ten_vai_tro VARCHAR(20) NOT NULL UNIQUE);          -- 'Admin','Customer'

CREATE TABLE nguoi_dung (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, vai_tro_id TINYINT UNSIGNED NOT NULL,
  ho_ten VARCHAR(100) NOT NULL, so_dien_thoai CHAR(10) NOT NULL UNIQUE, email VARCHAR(150) NOT NULL UNIQUE,
  mat_khau VARCHAR(255) NOT NULL, trang_thai TINYINT(1) NOT NULL DEFAULT 1,        -- 1 hoạt động, 0 bị khóa
  ngay_tao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, ngay_cap_nhat DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (vai_tro_id) REFERENCES vai_tro(id));

CREATE TABLE otp_xac_thuc (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, muc_dich ENUM('DANG_KY','QUEN_MAT_KHAU') NOT NULL,
  email VARCHAR(150) NOT NULL, ma_otp_hash VARCHAR(255) NOT NULL, du_lieu_tam JSON NULL,   -- dữ liệu đăng ký chờ xác thực (mật khẩu đã băm)
  het_han_luc DATETIME NOT NULL, so_lan_nhap_sai TINYINT UNSIGNED NOT NULL DEFAULT 0, da_su_dung TINYINT(1) NOT NULL DEFAULT 0,
  ip VARCHAR(45) NULL, ngay_tao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_otp (email, muc_dich, ngay_tao));

CREATE TABLE rate_limit (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, khoa VARCHAR(190) NOT NULL UNIQUE,
  so_lan INT UNSIGNED NOT NULL DEFAULT 0, bat_dau DATETIME NOT NULL, khoa_den DATETIME NULL);

CREATE TABLE danh_muc (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, ten_danh_muc VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(120) NOT NULL UNIQUE, icon VARCHAR(100) NULL, thu_tu INT NOT NULL DEFAULT 0);

CREATE TABLE san_pham (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, danh_muc_id INT UNSIGNED NOT NULL,
  ten_san_pham VARCHAR(200) NOT NULL, ten_khong_dau VARCHAR(200) NOT NULL,           -- dùng tìm kiếm không dấu
  mo_ta TEXT NULL, hinh_anh VARCHAR(255) NULL, don_vi_tinh VARCHAR(30) NULL,
  gia_ban DECIMAL(12,0) NOT NULL CHECK (gia_ban > 0),
  so_luong_ton INT NOT NULL DEFAULT 0 CHECK (so_luong_ton >= 0),
  muc_ton_toi_thieu INT NOT NULL DEFAULT 10, trang_thai TINYINT(1) NOT NULL DEFAULT 1,   -- 1 hiện, 0 ẩn
  giam_can_han TINYINT(1) NOT NULL DEFAULT 0, phan_tram_giam_can_han TINYINT UNSIGNED NOT NULL DEFAULT 0,
  luot_ban INT UNSIGNED NOT NULL DEFAULT 0, ngay_tao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (danh_muc_id) REFERENCES danh_muc(id), INDEX idx_sp_ten (ten_khong_dau), INDEX idx_sp_dm (danh_muc_id, trang_thai));

CREATE TABLE san_pham_mua_kem (san_pham_id INT UNSIGNED NOT NULL, san_pham_goi_y_id INT UNSIGNED NOT NULL,   -- cross-sell
  PRIMARY KEY (san_pham_id, san_pham_goi_y_id), FOREIGN KEY (san_pham_id) REFERENCES san_pham(id), FOREIGN KEY (san_pham_goi_y_id) REFERENCES san_pham(id));

CREATE TABLE khuyen_mai (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, ma_khuyen_mai VARCHAR(30) NOT NULL UNIQUE, ten_chuong_trinh VARCHAR(150) NOT NULL,
  loai ENUM('THU_SAU','CAN_HAN','KHAC') NOT NULL DEFAULT 'THU_SAU',
  phan_tram_giam TINYINT UNSIGNED NOT NULL CHECK (phan_tram_giam BETWEEN 1 AND 100), so_tien_giam_toi_da DECIMAL(12,0) NULL,
  che_do_chon_sp ENUM('THU_CONG','NGAU_NHIEN') NOT NULL DEFAULT 'THU_CONG', so_san_pham INT NOT NULL DEFAULT 10,
  lich_chay_thu TINYINT NULL COMMENT 'ISO 1=Thứ 2 … 5=Thứ 6 … 7=CN; NULL=mọi ngày',
  ngay_bat_dau DATETIME NOT NULL, ngay_ket_thuc DATETIME NOT NULL, trang_thai TINYINT(1) NOT NULL DEFAULT 1,
  CHECK (ngay_ket_thuc >= ngay_bat_dau));

CREATE TABLE khuyen_mai_san_pham (khuyen_mai_id INT UNSIGNED NOT NULL, san_pham_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (khuyen_mai_id, san_pham_id), FOREIGN KEY (khuyen_mai_id) REFERENCES khuyen_mai(id) ON DELETE CASCADE, FOREIGN KEY (san_pham_id) REFERENCES san_pham(id));

CREATE TABLE khu_vuc_giao_hang (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, tinh VARCHAR(80) NOT NULL, quan_huyen VARCHAR(80) NOT NULL,
  phuong_xa VARCHAR(80) NOT NULL, khoang_cach_km DECIMAL(4,1) NOT NULL, ho_tro TINYINT(1) NOT NULL DEFAULT 1);

CREATE TABLE gio_hang (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id INT UNSIGNED NOT NULL, san_pham_id INT UNSIGNED NOT NULL,
  so_luong INT NOT NULL CHECK (so_luong > 0), ngay_cap_nhat DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_gio (user_id, san_pham_id), FOREIGN KEY (user_id) REFERENCES nguoi_dung(id), FOREIGN KEY (san_pham_id) REFERENCES san_pham(id));

CREATE TABLE don_hang (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, ma_don VARCHAR(20) NOT NULL UNIQUE, user_id INT UNSIGNED NOT NULL,
  ten_nguoi_nhan VARCHAR(100) NOT NULL, sdt_nguoi_nhan CHAR(10) NOT NULL,
  phuong_thuc_nhan ENUM('COD','CLICK_COLLECT') NOT NULL,
  trang_thai ENUM('CHO_XU_LY','DANG_GIAO','CHO_LAY_HANG','THANH_CONG','DA_HUY') NOT NULL DEFAULT 'CHO_XU_LY',
  dia_chi_chi_tiet VARCHAR(255) NULL, khu_vuc_id INT UNSIGNED NULL, khoang_cach_km DECIMAL(4,1) NULL,
  gio_mong_muon_nhan DATETIME NULL, gio_hen_lay DATETIME NULL, thoi_gian_giao_du_kien VARCHAR(100) NULL,
  tong_tien_hang DECIMAL(12,0) NOT NULL, so_tien_duoc_giam DECIMAL(12,0) NOT NULL DEFAULT 0, khuyen_mai_id INT UNSIGNED NULL,
  phi_ship_tam_tinh DECIMAL(12,0) NOT NULL DEFAULT 0, phi_van_chuyen DECIMAL(12,0) NOT NULL DEFAULT 0, phi_ship_da_chot TINYINT(1) NOT NULL DEFAULT 0,
  tong_thanh_toan DECIMAL(12,0) NOT NULL, da_tru_kho TINYINT(1) NOT NULL DEFAULT 0, ly_do_huy VARCHAR(255) NULL, ghi_chu VARCHAR(500) NULL,
  ngay_tao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, ngay_cap_nhat DATETIME NULL ON UPDATE CURRENT_TIMESTAMP, ngay_hoan_thanh DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES nguoi_dung(id), FOREIGN KEY (khuyen_mai_id) REFERENCES khuyen_mai(id), FOREIGN KEY (khu_vuc_id) REFERENCES khu_vuc_giao_hang(id),
  INDEX idx_dh_user (user_id, ngay_tao), INDEX idx_dh_cron (phuong_thuc_nhan, trang_thai, gio_hen_lay), INDEX idx_dh_tt (trang_thai, ngay_tao));

CREATE TABLE chi_tiet_don_hang (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, don_hang_id INT UNSIGNED NOT NULL, san_pham_id INT UNSIGNED NOT NULL,
  ten_san_pham_luc_dat VARCHAR(200) NOT NULL, so_luong INT NOT NULL CHECK (so_luong > 0),
  gia_goc DECIMAL(12,0) NOT NULL, phan_tram_giam TINYINT UNSIGNED NOT NULL DEFAULT 0, gia_chot DECIMAL(12,0) NOT NULL,
  FOREIGN KEY (don_hang_id) REFERENCES don_hang(id) ON DELETE CASCADE, FOREIGN KEY (san_pham_id) REFERENCES san_pham(id));

CREATE TABLE danh_gia (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id INT UNSIGNED NOT NULL, san_pham_id INT UNSIGNED NOT NULL, don_hang_id INT UNSIGNED NOT NULL,
  so_sao TINYINT UNSIGNED NOT NULL CHECK (so_sao BETWEEN 1 AND 5), binh_luan VARCHAR(1000) NULL, ngay_tao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dg (user_id, san_pham_id, don_hang_id),                      -- chống spam: 1 đánh giá / SP / đơn
  FOREIGN KEY (user_id) REFERENCES nguoi_dung(id), FOREIGN KEY (san_pham_id) REFERENCES san_pham(id), FOREIGN KEY (don_hang_id) REFERENCES don_hang(id));

CREATE TABLE phieu_nhap_kho (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, ma_phieu VARCHAR(20) NOT NULL UNIQUE, admin_id INT UNSIGNED NOT NULL,
  ngay_nhap DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, tong_tien_nhap DECIMAL(14,0) NOT NULL DEFAULT 0, ghi_chu VARCHAR(255) NULL, FOREIGN KEY (admin_id) REFERENCES nguoi_dung(id));

CREATE TABLE chi_tiet_phieu_nhap (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, phieu_nhap_id INT UNSIGNED NOT NULL, san_pham_id INT UNSIGNED NOT NULL,
  so_luong_nhap INT NOT NULL CHECK (so_luong_nhap > 0), gia_nhap DECIMAL(12,0) NOT NULL CHECK (gia_nhap >= 0),
  ngay_san_xuat DATE NOT NULL, han_su_dung DATE NOT NULL, CHECK (han_su_dung > ngay_san_xuat),
  FOREIGN KEY (phieu_nhap_id) REFERENCES phieu_nhap_kho(id) ON DELETE CASCADE, FOREIGN KEY (san_pham_id) REFERENCES san_pham(id));

CREATE TABLE lo_hang (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, san_pham_id INT UNSIGNED NOT NULL, chi_tiet_phieu_nhap_id INT UNSIGNED NULL,
  ngay_san_xuat DATE NOT NULL, han_su_dung DATE NOT NULL, so_luong_nhap INT NOT NULL, so_luong_con INT NOT NULL CHECK (so_luong_con >= 0),
  FOREIGN KEY (san_pham_id) REFERENCES san_pham(id), FOREIGN KEY (chi_tiet_phieu_nhap_id) REFERENCES chi_tiet_phieu_nhap(id), INDEX idx_lo_hsd (han_su_dung, so_luong_con));

CREATE TABLE lich_su_kho (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, san_pham_id INT UNSIGNED NOT NULL,
  loai_giao_dich ENUM('NHAP_KHO','BAN_HANG','HUY_DON','DIEU_CHINH') NOT NULL, so_luong_thay_doi INT NOT NULL, ton_sau_giao_dich INT NOT NULL,
  tham_chieu_loai VARCHAR(30) NULL, tham_chieu_id INT UNSIGNED NULL, nguoi_thuc_hien_id INT UNSIGNED NULL, ghi_chu VARCHAR(255) NULL,
  ngay_tao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (san_pham_id) REFERENCES san_pham(id), INDEX idx_lsk (san_pham_id, ngay_tao));

CREATE TABLE nhat_ky_cron (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, ten_job VARCHAR(60) NOT NULL, so_ban_ghi_xu_ly INT NOT NULL DEFAULT 0,
  ket_qua VARCHAR(500) NULL, ngay_chay DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
```
**Seed:** `vai_tro` (Admin, Customer); 6 danh mục (Nước giải khát, Mì & thực phẩm khô, Bánh kẹo, Sữa – Trứng – Đông lạnh, Gia vị – Dầu ăn, Đồ dùng sinh hoạt); ~24 sản phẩm mẫu (tên tự đặt, **không dùng thương hiệu thật gây hiểu nhầm nếu không cần**, ảnh dùng `placeholder-product.svg`), trong đó: 10 SP gắn chương trình **"Siêu Sale Thứ 6"** (`lich_chay_thu=5`, 10%); 3–4 SP có `lo_hang` HSD trong 10 ngày tới và `giam_can_han=1`; vài cặp **mua kèm** (mì ↔ trứng/xúc xích; dầu gội ↔ sữa tắm); 2 SP `so_luong_ton` thấp; 1 SP hết hàng. `seed_admin.php` yêu cầu SĐT/email/mật khẩu mạnh qua tham số CLI, không đặt thông tin đăng nhập mặc định và không ghi mật khẩu vào mã nguồn hay tài liệu.

---

# 7. API (envelope JSON thống nhất)

`{ "success": true|false, "message": "…", "data": {…}|null, "errors": {"field":"msg"}|null }`
HTTP: 200, 201, 400, 401, 403, 404, 409, 422 (validation), 429 (rate limit), 501 (stub), 500 (không lộ chi tiết lỗi khi `APP_ENV=production`).
Tất cả request thay đổi dữ liệu (POST/PUT/PATCH/DELETE) yêu cầu header `X-CSRF-Token` (lấy từ `GET /api/csrf`).
Base URL dev: `http://localhost/monsmokee/backend/public/api` (khai báo duy nhất ở `frontend/assets/js/core/config.js`).

| Method & Path | Auth | UC/QT | Trạng thái |
|---|---|---|---|
| GET `/csrf` | – | – | DONE |
| POST `/auth/register/start` {ho_ten, so_dien_thoai, email, mat_khau, nhap_lai_mat_khau} | – | QT5 | DONE |
| POST `/auth/register/verify` {email, otp} | – | QT5 | DONE |
| POST `/auth/otp/resend` {email, muc_dich} | – | QT5/7 | DONE |
| POST `/auth/login` {so_dien_thoai, mat_khau, redirect?} (→ merge giỏ) | – | QT6 | DONE |
| POST `/auth/logout` | user | UC03 | DONE |
| GET `/auth/me` | – | – | DONE (trả `user:null` nếu chưa đăng nhập) |
| POST `/auth/forgot` {email_hoac_sdt} | – | QT7 | DONE |
| POST `/auth/reset` {email, otp, mat_khau_moi, nhap_lai} | – | QT7 | DONE |
| PUT `/auth/profile` | user | UC03 | STUB |
| GET `/home` → {banners, categories, friday_sale{active,next_start,products}, near_expiry[], best_sellers[], suggested[], sections[]} | – | QT1/13 | DONE |
| GET `/categories` | – | UC01 | DONE |
| GET `/products?q=&category=&min_price=&max_price=&sort=&page=&per_page=` (tìm không dấu) | – | QT1 | DONE |
| GET `/products/{id}` (+ `suggestions` mua kèm/cùng danh mục, `reviews`) | – | QT1/11 | STUB |
| GET `/locations/provinces`, `/locations/districts?province=`, `/locations/wards?district=` | – | QT8 | DONE |
| GET `/cart` | – | QT2/3 | DONE (đọc) |
| POST `/cart/items`, PUT `/cart/items/{productId}`, DELETE `/cart/items/{productId}`, POST `/cart/merge` | – | QT2/3/4 | STUB |
| POST `/checkout/preview` (tính giá hiệu lực, giảm giá, ship tạm tính, kiểm điều kiện) | user | QT4/8/9 | STUB |
| POST `/orders` (COD hoặc CLICK_COLLECT) | user | QT8/9 | STUB |
| GET `/orders`, GET `/orders/{id}` (kiểm tra **chủ sở hữu**), POST `/orders/{id}/cancel` | user | QT10 | STUB |
| POST `/orders/{id}/reviews` {san_pham_id, so_sao, binh_luan} | user | QT11 | STUB |
| POST `/admin/auth/login`, POST `/admin/auth/logout`, GET `/admin/auth/me` | – / admin | QT12 | DONE |
| GET `/admin/dashboard` | admin | QT12/15 | DONE |
| CRUD `/admin/categories` | admin | UC06/QT13 | STUB |
| CRUD `/admin/products`, PATCH `/admin/products/{id}/price`, PATCH `/admin/products/{id}/stock`, PATCH `/admin/products/{id}/visibility`, POST `/admin/uploads/product-image` | admin | UC07/QT13 | STUB |
| GET/POST/PUT/DELETE `/admin/promotions`, PATCH `/admin/promotions/{id}/toggle`, POST `/admin/promotions/{id}/random-products` | admin | UC12/QT13 | STUB |
| GET `/admin/orders?status=&method=&q=&page=`, GET `/admin/orders/{id}`, PATCH `/admin/orders/{id}/shipping`, PATCH `/admin/orders/{id}/status`, POST `/admin/orders/{id}/cancel` | admin | UC08/QT14 | STUB |
| POST `/admin/inventory/receipts`, GET `/admin/inventory/receipts`, GET `/admin/inventory/history`, GET `/admin/inventory/low-stock`, GET `/admin/inventory/expiring`, POST `/admin/inventory/adjust` | admin | UC09/QT14/15 | STUB |
| GET `/admin/customers?q=`, PATCH `/admin/customers/{id}/lock` | admin | UC10 | STUB |
| GET `/admin/statistics/revenue?group=day|month&from=&to=`, GET `/admin/statistics/top-products?from=&to=` | admin | UC11/QT15 | STUB |

---

# 8. BẢO MẬT BẮT BUỘC (áp dụng ngay từ Giai đoạn 1)
1. 100% truy vấn SQL dùng **prepared statements**; cấm nối chuỗi từ input.
2. Output: backend trả JSON thuần; frontend **dùng `textContent`** hoặc hàm `escapeHtml()` khi chèn dữ liệu (chống XSS). Dữ liệu text nhập vào qua `trim` + `strip_tags` (mô tả, bình luận) trước khi lưu.
3. **CSRF token** cho mọi request ghi; cookie session `HttpOnly`, `SameSite=Lax`, `Secure` khi HTTPS; `session_regenerate_id(true)` sau đăng nhập; hết hạn không hoạt động 2 giờ.
4. **Phân quyền:** `AuthMiddleware` (401), `AdminMiddleware` (403). Mọi truy vấn dữ liệu của khách **luôn kèm `user_id` của phiên** → chống **IDOR** (xem trộm/hủy đơn người khác trả `404`).
5. **Không tin giá từ client**; giá, giảm giá, phí ship, tổng tiền **luôn tính ở server**.
6. Rate limit: đăng nhập, gửi OTP, nhập OTP, quên mật khẩu (bảng `rate_limit`).
7. Header: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`; không hiển thị lỗi PHP ra client; log vào `storage/logs`.
8. Upload ảnh (sau này): kiểm MIME thật bằng `finfo`, whitelist jpg/png/webp, ≤ 2MB, đổi tên ngẫu nhiên, không thực thi trong thư mục uploads (`.htaccess` `php_flag engine off`).
9. Thư mục `config/`, `core/`, `app/`, `storage/` **không** truy cập được từ web (chỉ `public/` và `uploads/`): thêm `.htaccess` `Require all denied` cho các thư mục đó.
10. Chuẩn bị tài liệu **tự kiểm thử bảo mật** `docs/SECURITY_TEST.md` (khung: mô phỏng IDOR, sửa giá từ client, SQLi, XSS, brute-force OTP; mỗi mục: kịch bản – kết quả trước vá – cách vá – kiểm thử hồi quy).

---

# 9. BẢN ĐỒ NGHIỆP VỤ → FILE (nội dung phải được chép vào comment đầu file STUB / hoặc làm đúng ở GĐ1)

## UC01 – Mua sắm (Khách) | QT1
Files: `ProductController`, `CatalogService`, `CategoryController`, `frontend/san-pham.html`, `chi-tiet-san-pham.html`, `pages/products.js`, `pages/product-detail.js`.
- **Tìm kiếm (không dấu):** 1 nhập từ khóa → 2 bấm tìm → 3 kiểm tra từ khóa → 4 **chuẩn hóa (bỏ dấu, ký tự đặc biệt, về chữ thường)** rồi tìm trên `ten_khong_dau` → 5 hiển thị danh sách. *Nhánh:* 3.1 từ khóa rỗng → yêu cầu nhập; 5.1 không có kết quả → "Không tìm thấy sản phẩm". Hỗ trợ **bộ lọc danh mục, khoảng giá**.
- **Xem danh mục:** menu danh mục → chọn → lấy SP theo danh mục → hiển thị. *Nhánh:* danh mục rỗng → thông báo.
- **Xem chi tiết:** chọn SP → lấy thông tin → **Include "Xem giá & tồn kho"** (hiển thị giá hiệu lực + "Còn hàng"; tồn = 0 → "Hết hàng" + vô hiệu nút thêm giỏ) → hiển thị (tên, ảnh, mô tả, giá, tồn kho, đánh giá). *Nhánh:* SP không tồn tại/đã ẩn → thông báo và quay về danh sách.
- **Gợi ý cho bạn (cross-sell):** khi xem chi tiết, truy vấn `san_pham_mua_kem`, bổ sung bằng cùng danh mục (loại trừ SP đang xem, còn hàng, tối đa 8). Ví dụ: dầu gội → sữa tắm; mì tôm → trứng, xúc xích.

## UC02 – Quản lý giỏ hàng | QT2, QT3
Files: `CartController`, `CartService`, `gio-hang.html`, `pages/cart.js`, header badge.
- **Thêm vào giỏ:** 1 bấm "Thêm vào giỏ" → 2 chọn số lượng → 3 **Include Kiểm tra tồn kho** → 4 thêm (giỏ session nếu chưa đăng nhập) → 5 thông báo + cập nhật tổng tạm tính & số lượng trên icon giỏ. *Nhánh:* 3.1 vượt tồn → báo lỗi, quay lại bước 2.
- **Cập nhật/Xóa:** 1 mở giỏ → 2 hiển thị DS (SP, SL, đơn giá) → 3 đổi SL / xóa → 4 kiểm tra lại tồn kho → 5 cập nhật, tính lại tổng → 6 render lại. *Nhánh:* 4.1 SL không hợp lệ/vượt tồn → báo, quay bước 3; 3.1 xóa → sang bước 5.
- **Đồng bộ giỏ (merge):** 1 khách có giỏ tạm đăng nhập → 2 Include Đăng nhập → 3 lấy giỏ tạm + giỏ tài khoản → 4 gộp (cộng dồn nếu trùng) → 5 kiểm tồn kho & điều chỉnh → 6 lưu vào tài khoản, xóa giỏ tạm → 7 hiển thị. *Nhánh:* 2.1 đăng nhập thất bại → giữ giỏ tạm.
- **Include Kiểm tra tồn kho:** lấy tồn hiện tại → so sánh với SL yêu cầu → hợp lệ; *Nhánh:* SL > tồn → lỗi "Không đủ hàng".
- Giỏ hàng đóng trang vẫn được lưu.

## UC03 – Quản lý tài khoản (Khách & Admin) | QT5, QT6, QT7  ← **GĐ1 làm đầy đủ (trừ cập nhật thông tin)**
Files: `AuthController`, `AuthService`, `OtpService`, `ProfileController` (STUB), `dang-ky.html`, `dang-nhap.html`, `quen-mat-khau.html`, `tai-khoan.html` (STUB).
- **Đăng ký (OTP):** 1 chọn đăng ký → 2 hiện form → 3 nhập (họ tên, SĐT, email, mật khẩu) → 4 bấm đăng ký → 5 kiểm tra hợp lệ → 6 kiểm tra SĐT/Email chưa tồn tại → 7 **Include Xác thực OTP** → 8 lưu tài khoản (role Customer) & **tự đăng nhập** → 9 thông báo thành công, **điều hướng về trang Thanh toán nếu đến từ checkout**. *Nhánh:* 5.1 không hợp lệ → quay bước 3; 6.1 SĐT/Email đã tồn tại → quay bước 3.
- **Đăng nhập:** 1 vào trang → 2 hiện form → 3 nhập SĐT + mật khẩu → 4 bấm → 5 kiểm tra hợp lệ → 6 kiểm tra thông tin (so sánh hash) → 7 thông báo thành công, **tạo Session, merge giỏ, chuyển trang**. *Nhánh:* 5.1 không hợp lệ → bước 3; 6.1 sai thông tin → thông báo chung; 6.2 tài khoản bị khóa → thông báo và kết thúc.
- **Quên mật khẩu:** 1 chọn quên mật khẩu → 2 nhập Email/SĐT → 3 kiểm tra → 4 **Include Xác thực OTP** → 5 hiện form đặt lại → 6 nhập mật khẩu mới → 7 bấm đặt lại → 8 kiểm tra (độ mạnh) → 9 băm & cập nhật CSDL → 10 thông báo. *Nhánh:* 3.1 không hợp lệ/chưa đăng ký → **vẫn báo chung** để chống dò tài khoản; 8.1 không hợp lệ → quay bước 6.
- **Cập nhật thông tin cá nhân (STUB):** chọn → (đăng nhập nếu chưa) → hiện thông tin → chỉnh sửa → lưu → kiểm tra → cập nhật → thông báo. *Nhánh:* 6.1 không hợp lệ → quay bước 4. **Họ tên không được sửa ở form giao hàng** (có thể sửa ở trang tài khoản theo quy định cửa hàng – ghi TODO). Gồm **sổ địa chỉ**.
- **Include Xác thực OTP:** 1 tạo & gửi OTP → 2 nhập mã → 3 kiểm mã + hạn → 4 thành công. *Nhánh:* 3.1 sai/hết hạn → cho nhập lại hoặc gửi lại, quay bước 2.
- Đăng xuất → về trang chủ.

## UC04 – Đặt hàng & thanh toán | QT4, QT8, QT9
Files: `CheckoutController`, `OrderService`, `ShippingService`, `PromotionService`, `InventoryService`, `thanh-toan.html`, `dat-hang-thanh-cong.html`, `pages/checkout.js`.
- **QT4 Checkout:** bấm "Tiến hành thanh toán" ở giỏ → kiểm tra đăng nhập: **chưa** → thông báo + chuyển tới Đăng ký/Đăng nhập (kèm `redirect=thanh-toan.html`); **đã** → merge giỏ rồi vào trang Điền thông tin giao hàng.
- **Include Nhập thông tin giao nhận:** form tự điền họ tên (khóa) & SĐT → chỉnh SĐT người nhận/địa chỉ → kiểm tra. *Nhánh:* thiếu/không hợp lệ → quay lại.
- **COD (≥ 50k, nội thành Đồng Hới):** 1 chọn COD → 2 kiểm tra ≥ 50.000đ & địa chỉ nội thành → 3 **Include Tính phí ship tự động** → 4 hiển thị tổng (tiền hàng − giảm + ship) → 5 xác nhận → 6 kiểm tồn kho → 7 tạo đơn `CHO_XU_LY` → 8 thông báo. *Nhánh:* 2.1 < 50k hoặc ngoài nội thành → báo không hỗ trợ COD, gợi ý Click & Collect; 6.1 có SP hết hàng → báo, quay giỏ.
- **Include Tính phí ship:** xác định khoảng cách → freeship nếu ≥150k hoặc km ≤ 2,5 → ngược lại (50k ≤ tiền < 150k và km > 2,5) 15.000đ → trả phí tạm tính. Hiển thị rõ phí & thời gian nhận dự kiến.
- **QT8 bổ sung – khuyến mãi theo thời gian thực:** khi đặt, nếu hôm nay là **Thứ 6** → quét giỏ, SP thuộc "Khuyến mãi Thứ 6" (10 SP) hoặc "Cận hạn" (<10 ngày) → **gạch giá gốc, trừ 10%/50%** vào tổng; không phải Thứ 6 → chỉ áp dụng cận hạn.
- **Click & Collect:** 1 chọn "Đến lấy tại cửa hàng" → 2 **Include Chọn thời gian đến lấy** (hiện khung giờ → chọn ngày/giờ → kiểm: tương lai & trong giờ mở cửa; *nhánh:* không hợp lệ → chọn lại) → 3 hiển thị tổng (không ship) → 4 xác nhận → 5 kiểm tồn kho → 6 tạo đơn `CHO_XU_LY` (lưu `gio_hen_lay`) → 7 thông báo + nhắc "quá 2 ngày kể từ giờ hẹn sẽ tự hủy". *Nhánh:* 5.1 hết hàng → báo, quay giỏ.
- Hủy đặt hàng → về giỏ, giữ nguyên giỏ. Tạo đơn trong **1 transaction** (đơn + chi tiết + xóa giỏ), mã đơn dạng `MS20261122-0001`.

## UC05 – Quản lý đơn hàng (Khách) | QT10, QT11
Files: `OrderController`, `ReviewController`, `don-hang.html`, `chi-tiet-don-hang.html`, `pages/orders.js`, `pages/order-detail.js`.
- **Xem lịch sử & trạng thái:** chọn "Đơn hàng của tôi" → lấy DS **theo `user_id` phiên** → hiển thị kèm **màu trạng thái** → chọn đơn xem chi tiết. *Nhánh:* chưa có đơn → "Bạn chưa có đơn hàng".
- **Hủy đơn (chỉ "Chờ xử lý"):** chọn đơn → bấm hủy → kiểm trạng thái = `CHO_XU_LY` → yêu cầu xác nhận → xác nhận → **Transaction:** cập nhật `DA_HUY` + (hoàn kho nếu `da_tru_kho=1`) → thông báo. *Nhánh:* 3.1 không phải Chờ xử lý → không thể hủy (đơn Đang giao ẩn nút Hủy); 5.1 không xác nhận → giữ nguyên.
- **Đánh giá (đơn Thành công):** chọn đơn thành công → hiển thị DS món → chọn SP → bấm "Đánh giá", chọn **1–5 sao** + bình luận → kiểm hợp lệ & **chưa đánh giá SP này trong đơn này** → lưu `danh_gia` → hiển thị ở trang chi tiết SP. *Nhánh:* 1.1 đơn chưa Thành công → chưa thể đánh giá; 5.1 không hợp lệ → quay bước 3.
- Truy cập đơn không thuộc về mình → `404` (chống IDOR).

## UC06 – Quản lý danh mục (Admin) | QT13
Files: `CategoryAdminController`, `admin/danh-muc.html`, `admin/categories.js`.
- **Thêm:** chọn thêm → form → nhập tên → lưu → kiểm hợp lệ → kiểm **tên chưa tồn tại** → INSERT → thông báo. *Nhánh:* 5.1 không hợp lệ; 6.1 trùng tên → quay bước 3.
- **Sửa:** chọn danh mục → form có dữ liệu → sửa tên → lưu → kiểm → UPDATE. *Nhánh:* không hợp lệ/trùng tên.
- **Xóa:** chọn → xác nhận → kiểm có thể xóa → DELETE → thông báo. *Nhánh:* 3.1 không xác nhận → quay lại; 4.1 **danh mục đang có sản phẩm → không thể xóa**.

## UC07 – Quản lý sản phẩm (Admin) | QT13
Files: `ProductAdminController`, `UploadService`, `admin/san-pham.html`, `admin/products.js`.
- **Thêm/Sửa/Ẩn:** chọn thêm/sửa → form (tên, danh mục, mô tả, **upload ảnh**) → lưu → kiểm hợp lệ (**giá là số dương, ảnh đúng định dạng**) → INSERT/UPDATE (đồng thời tạo `ten_khong_dau`) → thông báo → render lại bảng. *Nhánh:* 5.1 không hợp lệ; 1.1 **Ẩn** → đổi trạng thái ẩn (không hiển thị cho khách) → bước 7.
- **Cập nhật giá bán:** chọn SP → hiện giá → nhập giá mới → lưu → kiểm (số, > 0) → UPDATE. *Nhánh:* giá không hợp lệ.
- **Cập nhật tồn kho:** chọn SP → hiện tồn → nhập tồn mới → kiểm (số nguyên ≥ 0) → UPDATE + ghi `lich_su_kho` 'DIEU_CHINH'. *Nhánh:* không hợp lệ.

## UC08 – Quản lý đơn hàng (Admin) | QT14
Files: `OrderAdminController`, `OrderService`, `InventoryService`, `admin/don-hang.html`, `chi-tiet-don-hang.html`, `admin/orders.js`.
- **Include Tiếp nhận & xem chi tiết:** vào DS đơn → hiển thị đơn "Chờ xử lý" (thấy khách hàng, địa chỉ, **loại hình nhận**) → chọn → xem chi tiết (khách, SP, hình thức nhận, tổng tiền) → xác nhận tiếp nhận. *Nhánh:* không có đơn → "danh sách trống".
- **Chốt phí ship thực tế (COD):** chọn đơn COD → hiện phí tạm tính (dùng **công cụ bản đồ** để kiểm khoảng cách – đặt nút "Mở Google Maps" tới địa chỉ) → nhập phí thực tế → xác nhận → kiểm hợp lệ → cập nhật phí & tổng tiền, nhập **thời gian giao dự kiến** → thông báo. *Nhánh:* phí không hợp lệ → quay bước 3.
- **Cập nhật trạng thái:** chọn đơn → chọn trạng thái mới (Đang giao / Chờ lấy hàng / Thành công) → xác nhận → **kiểm trạng thái phù hợp hình thức nhận** (mục 5.7) → cập nhật; **chuyển sang Đang giao/Chờ lấy hàng thì TRỪ KHO (transaction + FOR UPDATE)**; Thành công → ghi doanh thu (`ngay_hoan_thanh`) → thông báo. *Nhánh:* 4.1 trạng thái không hợp lệ → quay bước 2.
- **Hủy đơn & hoàn kho:** chọn đơn → hủy → xác nhận → `DA_HUY` (+lý do) → **cộng lại kho + ghi lịch sử** → thông báo. *Nhánh:* 2.1 đơn đã Thành công → không thể hủy; 4.1 không xác nhận.
- **Tự động hủy C&C quá hạn (Cronjob):** chạy định kỳ → tìm đơn C&C chưa lấy quá 2 ngày → Include Hủy đơn & hoàn kho từng đơn → ghi nhật ký. *Nhánh:* không có đơn quá hạn → kết thúc lượt chạy.
- Admin được **nhập lệnh thủ công điều chỉnh số lượng kho** theo kho thực tế (liên kết UC09).

## UC09 – Quản lý kho (Admin) | QT15
Files: `InventoryAdminController`, `InventoryService`, `admin/kho-*.html`, `admin/inventory.js`.
- **Tạo phiếu nhập kho:** chọn tạo → form phiếu → chọn SP + số lượng nhập + giá nhập + **Ngày SX + HSD (bắt buộc từng lô)** → lưu → kiểm hợp lệ → **Transaction:** lưu phiếu + chi tiết + tạo `lo_hang` + **cộng tồn kho** + ghi `lich_su_kho` 'NHAP_KHO' → thông báo. *Nhánh:* SL ≤ 0 / HSD ≤ NSX → quay bước 3.
- **Lịch sử biến động (Audit Log):** lấy log → hiển thị (thời gian, SP, loại biến động, số lượng, tồn sau). *Nhánh:* trống → thông báo.
- **Cảnh báo sắp hết hàng:** so tồn với mức tối thiểu → danh sách; **kèm danh sách lô cận hạn (≤10 ngày) & đã quá hạn**. *Nhánh:* không có → "Chưa có sản phẩm sắp hết hàng".
- **HSD chỉ hiển thị trang Admin**, tuyệt đối không lộ ra API khách (mục 5.5).

## UC10 – Quản lý khách hàng (Admin)
Files: `CustomerAdminController`, `admin/khach-hang.html`, `admin/customers.js`.
- **Xem DS:** lấy DS → hiển thị (họ tên, SĐT, trạng thái) → **tìm theo tên/SĐT** + xem lịch sử mua hàng. *Nhánh:* trống; không tìm thấy.
- **Khóa/Mở khóa (xử lý bom hàng):** chọn khách → khóa/mở → xác nhận → cập nhật `trang_thai` → thông báo. Tài khoản bị khóa **không đăng nhập được** (và nên vô hiệu phiên hiện tại). *Nhánh:* không xác nhận → giữ nguyên.

## UC11 – Thống kê & báo cáo (Admin) | QT15
Files: `StatisticsController`, `StatisticsService`, `admin/thong-ke.html`, `admin/statistics.js` (Chart.js).
- **Doanh thu ngày/tháng:** chọn → chọn theo ngày/tháng + khoảng thời gian → xem → kiểm khoảng hợp lệ → **SQL Aggregate `SUM/COUNT` trên đơn `THANH_CONG`** (`GROUP BY DATE(ngay_hoan_thanh)` / `DATE_FORMAT(..,'%Y-%m')`) → hiển thị biểu đồ + bảng. *Nhánh:* khoảng không hợp lệ → quay bước 2; không có dữ liệu → thông báo.
- **Sản phẩm bán chạy:** chọn khoảng thời gian → tổng hợp SL bán từng SP (`GROUP BY san_pham_id`) → sắp giảm dần → hiển thị top. *Nhánh:* không có dữ liệu.

## UC12 – Quản lý khuyến mãi (Admin) | QT13  (use case bổ sung)
Files: `PromotionAdminController`, `PromotionService`, `admin/khuyen-mai.html`, `admin/promotions.js`.
- Luồng: chọn "Quản lý khuyến mãi" → hiển thị DS (**mã, tên, mức giảm, thời hạn, trạng thái**) → chọn thao tác: **Thêm** (nhập → Lưu) / **Sửa** / **Xóa** (xác nhận) / **Kích hoạt–Tạm dừng** → Validation → INSERT/UPDATE/DELETE → thông báo & làm mới.
- Với chương trình **Thứ 6:** giảm 10%, **chọn 10 SP thủ công hoặc "Chọn ngẫu nhiên 10 sản phẩm"**, lịch chạy "Thứ 6 hàng tuần"; ngày khác giá gốc.
- *Ngoại lệ:* tài khoản không phải Admin → `403`; **mã KM trùng** → báo lỗi; **ngày kết thúc < ngày bắt đầu** → không lưu; **mức giảm không hợp lệ (âm/0/trống)** → không lưu; **KM đã được dùng trong đơn hàng → không cho xóa, chỉ cho tạm dừng**; Admin hủy thao tác → không đổi dữ liệu.

## QT12 – Đăng nhập Admin  ← **GĐ1 làm đầy đủ**
Admin vào `/frontend/admin/login.html`, nhập SĐT + mật khẩu → xác thực + kiểm `Role='Admin'` (khách → **403 Forbidden**, thông báo "Bạn không có quyền truy cập") → tạo session Admin → chuyển **Dashboard**. Có rate limit. Các trang admin dùng `guard.requireAdmin()` (gọi `/admin/auth/me`, chưa đăng nhập → về login).

## QT13/14/15 – Điểm đã gộp vào các UC trên
QT13 (danh mục/sản phẩm/khuyến mãi) → UC06, UC07, UC12 · QT14 (xử lý đơn + cron 2 nhiệm vụ) → UC08, mục 5.8 · QT15 (nhập kho, thống kê, Ngày SX/HSD chỉ Admin thấy) → UC09, UC11.

---

# 10. THIẾT KẾ GIAO DIỆN

## 10.1 Nhận diện & design tokens (`variables.css`)
```css
:root{
  --ms-green:#1E9E4A; --ms-green-dark:#147A38; --ms-green-soft:#E8F6EC;
  --ms-orange:#FF8A00; --ms-red:#E5322D; --ms-yellow:#FFC83D;
  --ms-bg:#F4F6F4; --ms-surface:#FFFFFF; --ms-text:#1F2A24; --ms-muted:#6B7A72; --ms-border:#E3E8E4;
  --ms-radius:12px; --ms-radius-sm:8px; --ms-shadow:0 2px 10px rgba(20,40,28,.08);
  --ms-font:'Be Vietnam Pro',system-ui,sans-serif;
  --admin-sidebar:#17231C; --admin-accent:#2FBF6A;
}
```
Logo chữ **MON SMOKEE** (SVG tự tạo, chữ xanh + biểu tượng giỏ/lá đơn giản). Tông xanh lá chủ đạo như ngành tạp hóa/siêu thị; màu cam cho nút hành động chính & nhãn khuyến mãi; đỏ cho nhãn giảm giá/"Hết hàng". Responsive **mobile-first**, kiểm tra 360px / 768px / 1280px. Không có cuộn ngang ngoài ý muốn. Focus ring rõ, `alt` cho ảnh, tương phản đủ.

## 10.2 Trang chủ khách hàng (`index.html`) – bố cục kiểu siêu thị trực tuyến
**Header (component dùng chung, sticky):**
1. *Thanh trên cùng (ẩn trên mobile):* "Giao hàng nội thành Đồng Hới – Miễn phí đơn từ 150.000đ", giờ mở cửa, hotline.
2. *Header chính:* logo · **ô tìm kiếm lớn** (placeholder "Tìm sản phẩm… (gõ không dấu cũng được)", gợi ý nhanh debounce 300ms gọi `/products?q=`) · nút **Đăng nhập / Đăng ký** (khi đã đăng nhập: avatar chữ cái + menu *Tài khoản, Đơn hàng của tôi, Đăng xuất*) · **nút Giỏ hàng có badge số lượng** (đọc `/cart`).
3. *Thanh danh mục:* nút "Danh mục" mở **menu danh mục** (dropdown/offcanvas trên mobile) + các link nhanh: "Siêu sale Thứ 6", "Cận hạn giảm 50%", "Bán chạy".

**Nội dung trang chủ (thứ tự):**
1. **Hero:** Bootstrap Carousel 3 banner SVG (tự tạo: "Siêu Sale Thứ 6 giảm 10%", "Đến lấy tại cửa hàng – không phí ship", "Giao nhanh nội thành Đồng Hới") + 2 banner nhỏ bên phải (ẩn trên mobile).
2. **Dải chính sách (4 ô icon):** *Giao hàng đơn từ 50.000đ* · *Freeship đơn từ 150.000đ hoặc ≤ 2,5km* · *Click & Collect nhận tại cửa hàng* · *Thanh toán khi nhận hàng (COD)*.
3. **Lưới danh mục** (icon tròn, cuộn ngang trên mobile).
4. **"Siêu sale Thứ 6"**: nếu hôm nay là Thứ 6 → hiển thị **đồng hồ đếm ngược tới 23:59:59** + 10 SP có nhãn `-10%`, gạch giá gốc; nếu không → khối "Thứ 6 này giảm 10% cho 10 sản phẩm" kèm **đếm ngược tới Thứ 6 kế tiếp** và vẫn xem trước các SP (giá gốc, nhãn "Sắp diễn ra").
5. **"Cận hạn – Giảm 50%"** (nền cam nhạt, nhãn `-50%`, hiển thị "HSD: dd/mm/yyyy" **chỉ ở mục này**).
6. **"Gợi ý cho bạn / Bán chạy"** (lưới SP).
7. **Các khối theo danh mục** (tiêu đề + "Xem tất cả" + hàng SP cuộn ngang trên mobile).
8. **Footer:** thông tin cửa hàng (tên, địa chỉ, giờ mở cửa, hotline – lấy từ `STORE_INFO`), chính sách giao hàng/Click & Collect/đổi trả, liên kết nhanh, bản quyền.
9. **Bottom navigation (mobile, kiểu WinMart/app):** Trang chủ · Danh mục · Giỏ hàng (badge) · Tài khoản.

**Thẻ sản phẩm (`product-card.js`):** ảnh vuông (lazy), nhãn giảm giá góc trên, tên 2 dòng (line-clamp), **giá hiệu lực** (đậm, đỏ/xanh) + **giá gốc gạch ngang**, đơn vị tính, nút **"Thêm"** (đổi thành bộ chỉnh số lượng `− 1 +` sau khi thêm), lớp phủ **"Hết hàng"** + disabled khi tồn = 0, click vào thẻ → `chi-tiet-san-pham.html?id=`. Nút Thêm gọi `POST /cart/items`; hiện STUB trả 501 → toast "Tính năng giỏ hàng đang được phát triển" (không báo lỗi đỏ). Có **skeleton loading** và **trạng thái rỗng/lỗi** cho mọi danh sách.

## 10.3 Trang Đăng ký (`dang-ky.html`) – 2 bước, bố cục 2 cột (cột trái minh họa/ưu đãi, ẩn trên mobile)
- **Bước 1 – Form:** Họ tên · SĐT (10 số) · Email · Mật khẩu (nút hiện/ẩn, **thanh đo độ mạnh + checklist 4 tiêu chí: ≥8 ký tự, hoa, thường, số, ký tự đặc biệt** tick xanh realtime) · Nhập lại mật khẩu · checkbox đồng ý điều khoản · nút **Đăng ký**. Validation **realtime + khi submit**, thông báo lỗi dưới từng ô (tiếng Việt), chỉ báo trạng thái hợp lệ.
- **Bước 2 – OTP:** thông báo "Mã đã gửi tới `ab***@gmail.com`", **6 ô nhập OTP** (tự nhảy ô, dán được cả mã, hỗ trợ bàn phím số trên mobile, `autocomplete="one-time-code"`), **đồng hồ đếm ngược 03:00**, nút **Gửi lại mã** bị khóa 60 giây, đếm số lần sai, nút "Sửa thông tin".
- Thành công → toast "Đăng ký thành công", tự đăng nhập, **merge giỏ**, điều hướng theo `redirect` (mặc định `index.html`).
- Link "Đã có tài khoản? Đăng nhập".

## 10.4 Trang Đăng nhập (`dang-nhap.html`)
SĐT + mật khẩu (hiện/ẩn), "Quên mật khẩu?", nút Đăng nhập (spinner, chống bấm đúp), link "Chưa có tài khoản? Đăng ký", hiển thị đúng 3 loại lỗi theo mục 5.2 (sai thông tin chung / tài khoản bị khóa / quá nhiều lần thử – hiện thời gian chờ). Nếu có `?redirect=` hiển thị thông báo "Vui lòng đăng nhập để tiếp tục thanh toán". Đã đăng nhập mà vào trang này → tự chuyển về trang chủ.

## 10.5 Trang Quên mật khẩu (`quen-mat-khau.html`) – 3 bước có thanh tiến trình
1) Nhập Email/SĐT → 2) Nhập OTP (đồng hồ 3 phút, gửi lại) → 3) Mật khẩu mới + nhập lại (đo độ mạnh) → thành công → về trang đăng nhập.

## 10.6 Admin – Đăng nhập (`admin/login.html`)
Giao diện riêng, tối giản, tối/xanh đậm, logo + "Khu vực quản trị", SĐT + mật khẩu, thông báo 403 rõ ràng khi dùng tài khoản khách. Không có link đăng ký.

## 10.7 Admin – Dashboard (`admin/index.html`) + layout dùng chung
- **Sidebar** (thu gọn được; offcanvas trên mobile) với nhóm: *Tổng quan* · *Danh mục* · *Sản phẩm* · *Khuyến mãi* · *Đơn hàng* (badge số đơn chờ) · *Kho* (Nhập hàng / Lịch sử / Cảnh báo) · *Khách hàng* · *Thống kê* · *Tài khoản*. Mục nào chưa làm vẫn điều hướng được tới trang STUB.
- **Topbar:** tiêu đề trang, ô tìm nhanh, chuông cảnh báo (số SP sắp hết + cận hạn), menu admin (Đổi mật khẩu, Đăng xuất).
- **Dashboard** (dữ liệu thật từ `/admin/dashboard`, trả 0 nếu chưa có dữ liệu):
  - 6 thẻ KPI: *Doanh thu hôm nay* · *Doanh thu tháng* · *Đơn chờ xử lý* · *Đơn chờ lấy hàng* · *Sản phẩm sắp hết hàng* · *Sản phẩm cận hạn (≤10 ngày)*.
  - **Biểu đồ đường doanh thu 7 ngày gần nhất** (Chart.js) + **biểu đồ cột Top 5 sản phẩm bán chạy**.
  - Bảng **10 đơn mới nhất** (mã, khách, hình thức nhận, tổng tiền, trạng thái có màu, giờ hẹn nếu C&C) + liên kết "Xem tất cả".
  - Khối **Cảnh báo kho** (SP sắp hết, lô cận hạn – **HSD hiển thị ở đây vì là trang admin**) và **Khuyến mãi đang chạy hôm nay** (Thứ 6 hay không).
  - Trạng thái trống/lỗi/loading cho từng khối.
- Mỗi trang STUB admin: tiêu đề use case, breadcrumb, khối "Đang phát triển" liệt kê các bước từ comment, để dev biết cần làm gì.

---

# 11. QUY ƯỚC MÃ NGUỒN

## 11.1 Backend
- `index.php` → nạp `Env`, `config`, autoload, set timezone, bắt mọi `Throwable` → trả JSON lỗi chuẩn (ghi log, không lộ stack khi production).
- Controller **mỏng** (đọc request → validate → gọi Service → trả Response). Nghiệp vụ nằm ở Service; truy vấn nằm ở Model. Hàm công khai có docblock tiếng Việt.
- Mọi thao tác nhiều bước dùng `Database::transaction(fn() => …)` (commit/rollback tự động).
- Không `echo` lẻ tẻ, không `die()`; luôn qua `Response`.

## 11.2 Validation (`Validator`, phản chiếu ở `validators.js`)
```php
const RE_PHONE    = '/^0\d{9}$/';
const RE_PASSWORD = '/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/';
const RE_NAME     = '/^\p{L}+(?:[\s\p{L}]+)+$/u';          // ≥ 2 từ, chỉ chữ & khoảng trắng (Lab 6: "họ tên ít nhất 2 từ")
const RE_OTP      = '/^\d{6}$/';
// email: filter_var(FILTER_VALIDATE_EMAIL) + độ dài ≤150
```
`StringHelper::titleCaseName()` dùng `mb_convert_case(..., MB_CASE_TITLE)`; `removeAccents()` dùng bảng ánh xạ/`strtr` hoặc `iconv`/`Normalizer` + `preg_replace('/[^a-z0-9\s]/','',...)`, xử lý riêng `đ/Đ`; `normalizeKeyword()` = `trim` → bỏ dấu → `strtolower` → gộp khoảng trắng.

## 11.3 Frontend
- ES Modules, không thư viện ngoài Bootstrap/Chart.js. Mỗi trang: `<script type="module" src="assets/js/pages/xxx.js">`.
- `api.js`: `get/post/put/patch/del`, tự lấy & gắn CSRF, `credentials:'same-origin'`, parse envelope, **401 → về đăng nhập kèm redirect**, **403 → thông báo không đủ quyền**, **429 → thông báo chờ**, **501 → `ui.notImplemented()`**, lỗi mạng → toast thân thiện.
- Tuyệt đối không nối chuỗi dữ liệu người dùng vào `innerHTML` (dùng `textContent`/`escapeHtml`).
- Định dạng tiền `12.000đ` bằng `Intl.NumberFormat('vi-VN')`; ngày `dd/MM/yyyy HH:mm`.

---

# 12. FILE ĐI KÈM BẮT BUỘC
- `backend/tests/smoke.http` (REST Client): CSRF → đăng ký start/verify → login → me → home → products?q=mi%20tom → admin login → dashboard → 1 ví dụ endpoint STUB (kỳ vọng 501).
- `.env.example`, `.gitignore`, `README.md`, 3 file trong `docs/`.
- `README.md` phải có: yêu cầu (XAMPP/Laragon PHP ≥ 8.1, Composer), **các bước cài** (đặt thư mục vào `htdocs`, import `schema.sql` → `seed.sql` → `seed_khu_vuc.sql`, `composer install`, copy `.env`, tạo Admin bằng `php database/seed_admin.php <số-điện-thoại> <email> <mật-khẩu-mạnh>`, bật `mod_rewrite`/`AllowOverride All`), URL truy cập (`http://localhost/monsmokee/frontend/`, admin `.../frontend/admin/login.html`), cách cấu hình SMTP Gmail App Password hoặc dùng `MAIL_DRIVER=log` (đọc OTP trong `storage/mail_outbox`), **cách đặt cronjob** (Windows Task Scheduler mỗi 15 phút chạy `php backend/cron/auto_cancel_click_collect.php` và `scan_expiry_discount.php`; Linux crontab tương đương), lưu ý không có tài khoản/mật khẩu mặc định, danh sách việc cần làm tiếp (đọc từ `MA_TRAN_USECASE.md`).

---

# 13. TIÊU CHÍ NGHIỆM THU GIAI ĐOẠN 1 (tự kiểm tra trước khi báo hoàn thành)
- [ ] Import SQL không lỗi; `seed_admin.php` tạo được Admin.
- [ ] Mở `frontend/index.html`: header, hero, dải chính sách, danh mục, Siêu sale Thứ 6, Cận hạn, Bán chạy, footer hiển thị dữ liệu từ DB; đúng trên **360px/768px/1280px**.
- [ ] Tìm "mi tom" (không dấu) ra "Mì tôm …".
- [ ] Đăng ký: form validate realtime → OTP về `mail_outbox` (hoặc email) → nhập đúng → tạo tài khoản + tự đăng nhập; OTP quá 3 phút / sai 5 lần / gửi lại < 60s → bị chặn đúng thông báo; SĐT/Email trùng → báo lỗi.
- [ ] Đăng nhập: đúng/sai/bị khóa/quá nhiều lần → đúng thông báo; mật khẩu trong DB là bcrypt (`$2y$`).
- [ ] Quên mật khẩu: tài khoản không tồn tại vẫn nhận thông báo chung; đặt lại thành công, đăng nhập bằng mật khẩu mới.
- [ ] Admin: đăng nhập OK → Dashboard có số liệu; đăng nhập bằng tài khoản khách → **403**; truy cập `admin/*.html` khi chưa đăng nhập → về login.
- [ ] Gọi API `PATCH /admin/orders/1/status` (STUB) → **501**; UI STUB hiển thị khung + danh sách bước.
- [ ] Không có chuỗi SQL nối từ input; mọi POST đều cần CSRF (thử bỏ header → 403/419-tương-đương); không lộ HSD/lô hàng trong API khách trừ SP cận hạn.
- [ ] Không có lỗi trong Console trình duyệt và `storage/logs`.
- [ ] `docs/MA_TRAN_USECASE.md` liệt kê đủ UC01–UC12, QT1–QT15, trạng thái DONE/STUB.

---

# 14. QUY TRÌNH LÀM VIỆC CỦA BẠN (AGENT)
Thực hiện **tuần tự**, sau mỗi giai đoạn tóm tắt ngắn (đã tạo file gì, chạy được gì) rồi làm tiếp (không cần chờ xác nhận trừ khi bị chặn):
1. **Khung dự án:** tạo toàn bộ cây thư mục & file rỗng/khung theo mục 3 (kể cả STUB có comment đầy đủ từ mục 9).
2. **CSDL:** `schema.sql`, `seed.sql`, `seed_khu_vuc.sql`, `seed_admin.php`.
3. **Backend core + bảo mật:** `core/*`, `config/*`, middleware, `public/index.php`, `.htaccess`.
4. **Auth + OTP** (Service, Controller, route, `smoke.http`) → tự kiểm bằng gọi thử.
5. **Catalog + Home + Locations + Cart (đọc) + Admin dashboard API.**
6. **Frontend nền:** `variables/base/components.css`, `core/*.js`, components dùng chung (header, footer, bottom-nav, product-card…).
7. **Trang khách GĐ1:** `index`, `dang-nhap`, `dang-ky`, `quen-mat-khau`, `san-pham`.
8. **Admin GĐ1:** layout, `login`, `index` (dashboard) + các trang STUB.
9. **Docs + README + nghiệm thu mục 13**, sửa lỗi phát hiện.
Cuối cùng in: (a) cây thư mục thực tế, (b) lệnh chạy nhanh, (c) danh sách các điểm bạn đã tự quyết định thêm, (d) danh sách việc tiếp theo theo thứ tự ưu tiên khuyến nghị: **UC02 Giỏ → UC01 Chi tiết → UC04 Đặt hàng → UC08 Xử lý đơn → UC05 → UC07/06 → UC09 → UC12 → UC11 → UC10 → Cron**.

**Nguyên tắc cuối:** không bỏ sót use case/quy trình nào ở mục 9; không dùng dữ liệu/ảnh/logo của thương hiệu thật; không hard-code ngưỡng nghiệp vụ; code sạch, có comment tiếng Việt, đặt tên nhất quán; ưu tiên **đúng nghiệp vụ & an toàn** hơn là nhiều tính năng phụ.

=== HẾT PROMPT ===
