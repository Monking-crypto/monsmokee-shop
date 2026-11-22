# Quyết định thiết kế

1. OTP: Email, thiết kế `OtpSenderInterface` để thay bằng SMS sau này.
2. Freeship: tiền hàng sau giảm ≥ 150.000đ hoặc khoảng cách ≤ 2,5km.
3. Khoảng cách cấu hình theo khu vực; không dùng API bản đồ ở giai đoạn hiện tại.
4. Đơn Click & Collect bắt đầu ở `CHO_XU_LY`, sau đó `CHO_LAY_HANG` và trừ kho.
5. Kho chỉ trừ khi Admin chuyển đơn sang `DANG_GIAO` hoặc `CHO_LAY_HANG`.
6. Cần mức giảm cao hơn nếu Thứ 6 và cận hạn trùng nhau, không cộng dồn.
7. Danh mục hành chính lấy từ CSDL và không hard-code tên phường/xã.
8. Mật khẩu dùng `PASSWORD_BCRYPT`; số điện thoại regex `^0\d{9}$`.
9. HSD chỉ Admin thấy trừ khi SP đang giảm cận hạn.
