# Nhật ký bàn giao frontend

## 2026-11-26 — Tích hợp API và hoàn thiện các luồng A1–A11

- **API client/catalog:** chuẩn hóa mock theo envelope và schema sản phẩm mới; xử lý CSRF, phiên hết hạn, giờ server và ngày kiểm thử Siêu sale.
- **Khách hàng:** nối catalog, chi tiết sản phẩm, cận hạn, Siêu sale, thông tin cửa hàng và giao hàng với các API public. Cart/checkout vẫn mock; không gửi thao tác ghi lên các API khác.
- **Giao diện:** ảnh thẻ cận hạn giữ tỷ lệ vuông tại 360/768/1280px; trang Bán chạy được ẩn khi backend live chưa hỗ trợ `sort=best`.
- **Admin:** cập nhật kho theo `/admin/stock-receipts`, `/admin/stock-history`, `/admin/batches`; chuyển khuyến mãi sang `/admin/promotions`; thêm trang khu vực giao hàng. Ba cờ Admin liên quan vẫn tắt live do chưa có phiên Admin để xác minh.
- **Đăng nhập:** giữ trang Customer và Admin tách biệt; bổ sung liên kết chuyển trang. API login và kiểm tra quyền khác nhau, không gộp luồng.
- **Hồ sơ Admin:** frontend có xử lý lỗi mềm, nhưng `origin/main` tại `22f0ffd` chỉ có `GET /admin/me`; chưa thể xác nhận đổi tên Admin hoạt động với backend chuẩn.
- **Tài liệu:** cập nhật `docs/FRONTEND_CHO_BACKEND.md` theo API thật và giới hạn đã xác minh.

### Kiểm tra

- `node --check` thành công cho 49 file JavaScript trong `frontend/assets/js`.
- GET `/csrf`, `/products`, `/products?near_expiry=1`, `/categories`, `/store-info`, `/promotions/active`, `/shipping/areas`, `/products/{id}` đều trả 200 và `success=true`.
- `POST /shipping/quote` gửi kèm CSRF trả 200; endpoint chỉ báo phí, không ghi dữ liệu.
- Trình duyệt: trang chủ và cận hạn tải được; mô phỏng Thứ 6 cho thấy 10 sản phẩm và countdown khoảng 12 giờ. Có `401` dự kiến từ `/auth/me` do chưa đăng nhập.
- Chưa xác minh thao tác Admin thật, OTP/email, giỏ hàng/đặt hàng thật hoặc endpoint ghi dữ liệu; không dùng tài khoản thật.

### Trạng thái phiên

- Nhánh `Frontend`, `HEAD` trước bàn giao `98d8c30`; backend chuẩn `origin/main` tại `22f0ffd`.
- Thay đổi chưa commit/push tại thời điểm ghi nhật ký. Không stage backend hoặc `docs/BAO_CAO_NOI_API.md`.
