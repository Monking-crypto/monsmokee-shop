# Tiến độ dự án MON SMOKEE

Cập nhật: 27/11/2026

## Đã hoàn thành

- Backend Auth: đăng ký, đăng nhập, đăng xuất, xem phiên Customer/Admin và xác thực Admin hai bước.
- Quên mật khẩu hai bước: OTP email, reset ticket và giới hạn gửi/nhập sai.
- Quản lý danh mục.
- Quản lý sản phẩm công khai và Admin.
- Nhập kho, lô hàng, lịch sử kho, hủy phiếu nhập và kiểm tra tồn kho.
- Khuyến mãi Thứ 6, cận hạn và tính giá hiệu lực bằng dịch vụ server.
- Khu vực giao hàng, báo phí ship và thông tin cửa hàng.
- Chuẩn hóa ảnh sản phẩm và thumbnail.
- Chặn lộ file, đường dẫn nội bộ, cấu hình và tài liệu nhạy cảm.
- Bước 14E: đăng nhập chung Customer/Admin bằng `/api/auth/login`; Admin chỉ tạo session chờ OTP, endpoint Admin cũ được giữ DEPRECATED; đồng nhất lỗi sai thông tin, tài khoản khóa và rate limit.
- Bước 16A: giỏ session cho guest, giỏ CSDL cho Customer, kiểm tra tồn/giới hạn, tính giá bằng PromotionService và gộp giỏ sau đăng nhập/đăng ký.
- Bước 13B: lọc sản phẩm theo khoảng giá hiệu lực, gợi ý mua kèm ưu tiên cấu hình Admin rồi bổ sung cùng danh mục; quản trị danh sách mua kèm.
- Bước 11C: nhập kho bắt buộc ngày sản xuất từng dòng; lô cũ cho phép ngày null; điều chỉnh tồn trong transaction với khóa lô, FEFO khi giảm và tạo lô khi tăng; ngưỡng tồn tối thiểu cùng API cảnh báo tồn thấp/lô sắp hết hạn.
- Bước 14F: hồ sơ Customer/Admin chỉ sửa họ tên; đổi mật khẩu qua dịch vụ dùng chung, yêu cầu mật khẩu hiện tại, giới hạn sai theo tài khoản, tái tạo session và vô hiệu hóa reset ticket/OTP còn hiệu lực.
- Bước 14G: script CLI khôi phục tài khoản Admin để đặt lại mật khẩu, đổi email/SĐT, mở khóa và liệt kê; có xác thực đầu vào và audit log không chứa mật khẩu.
- Bước 14H: xóa danh mục chỉ khi không còn sản phẩm; rà soát xóa sản phẩm theo lô/đơn hàng/giỏ hàng/lịch sử kho, trả 409 khi còn tham chiếu lịch sử và giữ chức năng ẩn riêng.

## Còn lại

- Rà soát bảo mật toàn bộ API và bộ lọc truy cập.
- Tạo lệnh cài đặt CSDL một lần: database/install.php.
- Đặt hàng: Checkout, COD/Click & Collect, địa chỉ, phí ship và chốt giá.
- Admin xử lý đơn: xác nhận, giao hàng, hoàn thành, hủy và trừ kho.
- Cron: tự hủy Click & Collect quá hạn và quét giảm cận hạn.
- Thống kê: doanh thu, đơn hàng, tồn kho và sản phẩm bán chạy.
- Đánh giá sản phẩm sau đơn hàng.
- Quản lý khách hàng cho Admin.
