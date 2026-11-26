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

## 2026-11-26 — Tối ưu điều hướng trang quản trị

- **Nguyên nhân:** trang admin chỉ dựng toàn bộ giao diện sau khi kiểm tra phiên hoàn tất, làm người dùng thấy khung trắng; CSS sidebar còn animation gây reflow khi đổi trạng thái.
- **Đã làm:** dựng shell và trạng thái mục đang chọn ngay trong HTML; giữ shell trong lúc xác thực và tải nội dung trang sau đó; khôi phục sidebar/nhóm Kho/scroll; thay chuyển động layout bằng `transform`; thêm preconnect CDN; thêm View Transitions lũy tiến và prefetch giới hạn tối đa hai trang khi hover/focus/touch (bỏ qua khi bật `saveData`); giữ nhãn “QUẢN TRỊ” một dòng, vùng chạm menu 44px và đóng menu bằng Escape.
- **Không làm SPA navigation (M7):** điều hướng tài liệu hiện tại vẫn an toàn với form, modal và listener của các trang; shell hiển thị sớm nên chưa có bằng chứng đủ lợi ích để chấp nhận rủi ro giữ trạng thái JavaScript giữa trang.
- **Đo sau sửa:** dùng browser với API admin giả lập, không ghi dữ liệu; 5 trang Tổng quan/Sản phẩm/Danh mục/Đơn hàng/Thống kê, mỗi trang một lượt tại 1280×900 và 390×844. Shell xuất hiện khoảng 46–60ms desktop (median 48ms), 41–53ms mobile (median 46ms). Nội dung sẵn sàng khoảng 107–164ms desktop (median 114ms), 115–188ms mobile (median 129ms). CLS ghi nhận bằng 0 trong các lượt đo. Các số này là phép đo một lượt mỗi trang, không phải benchmark thống kê; mẫu dashboard có thể dao động theo tải biểu đồ/CDN.
- **So với trước sửa:** các lượt đo ban đầu thấy shell xuất hiện khoảng 49–80ms và nội dung có lúc 100–200ms; khác biệt lớn nhất là shell không còn chờ API xác thực mới xuất hiện, không phải cam kết giảm thời gian tải dữ liệu.
- **Kiểm thử giao diện:** ở 390px, menu mở/đóng được bằng nút, scrim và Escape; nút menu và mục điều hướng có chiều cao 44px. Kiểm tra CSS xác nhận nhãn không xuống dòng, sidebar chỉ chuyển bằng `transform`, và `prefers-reduced-motion` tôn trọng cấu hình hệ thống. View Transitions được kiểm tra theo khả năng hỗ trợ của browser; trình duyệt không hỗ trợ vẫn dùng điều hướng thường.
- **Giới hạn:** API được mock trong kiểm thử, không xác minh thời gian backend thật; browser cache và CDN ảnh hưởng thời gian; không kiểm tra trên toàn bộ thiết bị/trình duyệt.
- **Các commit:** `88d8731`, `0c55a9f`, `4a96566`, `32d2e38`, `a2e783a`, `b7b5cb7`, `f269f43`. Chỉ thay đổi frontend; giữ nguyên hai file backend đang sửa sẵn và `docs/BAO_CAO_NOI_API.md`.
