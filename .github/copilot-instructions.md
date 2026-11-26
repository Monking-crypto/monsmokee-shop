# Hướng dẫn làm việc cố định - MON SMOKEE

## Phạm vi thay đổi

- Chỉ sửa backend và tài liệu dự án khi yêu cầu; không sửa frontend/.
- Không đọc, in, sao chép hoặc sửa backend/.env. Không đọc backend/.env.example vào bối cảnh nếu nội dung chứa thông tin nhạy cảm.
- Không ghi số điện thoại, mật khẩu, email Admin hoặc thông tin đăng nhập vào code, tài liệu, log hoặc smoke.http.
- Không thay đổi composer.json và composer.lock ở thư mục gốc. Dependency backend chỉ đặt trong backend/.
- Không commit dữ liệu thật, OTP thật, App Password hoặc dữ liệu khách hàng thật.

## API và bảo mật

- Mọi response JSON dùng cấu trúc `{ "success": ..., "message": ..., "data": ..., "errors": ... }`.
- Mọi thao tác ghi cần CSRF token hợp lệ.
- Route Admin phải được bảo vệ bằng AdminMiddleware.
- Tất cả truy vấn động dùng prepared statements.
- Không lộ secret, lỗi CSDL chi tiết, stack trace hoặc dữ liệu nhạy cảm qua API.
- Không ghi payload nhạy cảm vào log.

## Kho, giao dịch và giá

- Thao tác kho phải dùng transaction và `SELECT ... FOR UPDATE`.
- Không cho tồn kho xuống âm.
- Nhập/xuất kho và hủy phiếu nhập phải kiểm tra tính nhất quán của lô, phiếu và sản phẩm.
- Hạn sử dụng không công khai cho Customer trừ sản phẩm cận hạn.
- Khi bán hàng, áp dụng FEFO khi tính năng đơn hàng được triển khai.
- Giá bán luôn được tính ở server bằng PromotionService; không tin giá gửi lên từ client.
- Ngưỡng và tỷ lệ nghiệp vụ nằm trong backend/config/business.php, không hard-code rải rác trong controller hoặc dịch vụ.
- Múi giờ hoạt động mặc định là Asia/Ho_Chi_Minh.

## Khuyến mãi

- COD chỉ được chọn khi tiền hàng sau giảm ít nhất 50.000 VND.
- Freeship khi tiền hàng sau giảm ít nhất 150.000 VND hoặc khoảng cách giao hàng không quá 2,5 km.
- Trường hợp không đủ điều kiện freeship, phí ship mặc định là 15.000 VND.
- Click & Collect tự hủy sau 2 ngày kể từ giờ hẹn.
- Chỉ trừ kho sau khi Admin xác nhận đơn hàng.
- Ngày Thứ 6, khuyến mãi 10% áp dụng đúng 10 sản phẩm theo quy tắc chương trình.
- Sản phẩm cận hạn được giảm 50% khi hạn còn không quá 10 ngày.
- Nếu đủ điều kiện cả hai khuyến mãi, áp dụng mức giảm cao hơn.

## CSDL và migration

- Migration đặt trong database/migrations và đánh số tăng dần.
- Migration phải chạy lại được.
- Khi thay đổi cấu trúc CSDL, cập nhật database/schema.sql tương ứng.
- Khi tạo CSDL mới, chạy schema và seed theo tài liệu triển khai; không import schema.sql vào CSDL đang chứa dữ liệu cần giữ.
- Với thay đổi có seed/migration, cung cấp lệnh kiểm tra cài đặt rõ ràng.

## Testing

- Chỉ dùng tài khoản, SĐT, email và dữ liệu giả trong test.
- Dùng `MAIL_DRIVER=log` khi test OTP hoặc email cục bộ.
- Không ghi nội dung thư hoặc OTP thật vào tài liệu.
- Xóa dữ liệu test sau khi kiểm tra.
- Khi thay đổi API, kiểm tra đủ happy path, validation, CSRF, quyền Admin và rollback giao dịch.

## Quy trình làm việc mỗi bước

Trước khi kết thúc mỗi bước, dừng lại và báo:

1. File đã sửa.
2. Kết quả mong đợi.
3. Cách tự kiểm tra.
4. Lỗi thường gặp.

Luôn cập nhật đồng bộ:

- docs/API.md: hợp đồng endpoint, request, response và lỗi.
- docs/MA_TRAN_USECASE.md: trạng thái use case và backend.
- smoke.http: ví dụ request với biến để trống, không chứa bí mật.

