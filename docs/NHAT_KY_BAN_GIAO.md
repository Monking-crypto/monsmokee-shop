# Nhật ký bàn giao frontend

## 2026-11-22 — Trang Cận hạn riêng (A5)

- **File:** `frontend/can-han.html`, `frontend/assets/js/pages/near-expiry.js`, `frontend/assets/js/components/product-card.js`, `frontend/assets/css/customer.css`, `docs/FRONTEND_CHO_BACKEND.md`.
- **API backend cần có:** `GET /products?near_expiry=1&sort=hsd&per_page=20`; mỗi sản phẩm trả `near_expiry_days`, `hsd`, `phan_tram_giam`, `so_luong_ton`. Chi tiết tại mục YC2 — Trang cận hạn trong tài liệu bàn giao.
- **Tự kiểm tra:** mở `/frontend/can-han.html`, kiểm tra 8 sản phẩm được xếp theo ngày gần nhất, chọn các chip hạn dùng, và thử ở 360px, 768px, 1280px.

## 2026-11-22 — Giỏ hàng và phí giao hàng (A7)

- **File:** `frontend/gio-hang.html`, `frontend/thanh-toan.html`, `frontend/assets/js/pages/cart.js`, `frontend/assets/js/components/delivery-modal.js`, `frontend/assets/js/core/mock.js`, `frontend/assets/css/customer.css`, `docs/FRONTEND_CHO_BACKEND.md`.
- **API backend cần có:** `GET /cart`, `PUT /cart/items/{id}`, `DELETE /cart/items/{id}`, `DELETE /cart`; địa chỉ giao hàng cần có `distance_km` hoặc API trả phí vận chuyển. Chi tiết dữ liệu tại mục YC2 — Giỏ hàng trong tài liệu bàn giao.
- **Tự kiểm tra:** mở `/frontend/gio-hang.html`; kiểm tra tăng/giảm, giới hạn tồn kho, xóa món/giỏ có xác nhận, chọn giao hàng/nhận tại cửa hàng, phí ship và điều kiện đơn tối thiểu.

## 2026-11-22 — Bảng xếp hạng bán chạy (A8)

- **File:** `frontend/ban-chay.html`, `frontend/assets/js/pages/best-sellers.js`, `frontend/assets/js/components/product-card.js`, `frontend/assets/css/customer.css`, `docs/FRONTEND_CHO_BACKEND.md`.
- **API backend cần có:** `GET /products?sort=best&per_page=20&page={n}` và tham số tùy chọn `category={slug}`; sản phẩm cần có `luot_ban`. Chi tiết tại mục YC2 — Bảng xếp hạng bán chạy.
- **Tự kiểm tra:** mở `/frontend/ban-chay.html`, đổi các chip danh mục, xem thêm kết quả, kiểm tra thứ hạng và nút Thêm ở 360px, 768px, 1280px.

## 2026-11-22 — Admin đăng nhập, layout và sản phẩm (A9 P1)

- **File:** `frontend/assets/js/admin/admin-layout.js`, `frontend/assets/js/admin/admin-login.js`, `frontend/assets/js/admin/products.js`, `frontend/assets/js/core/mock.js`, `frontend/assets/css/admin.css`, `docs/FRONTEND_CHO_BACKEND.md`.
- **API backend cần có:** luồng đăng nhập OTP admin, `GET/POST/PUT/DELETE /admin/products`, upload ảnh và xóa hàng loạt; tài khoản khách cần nhận 403. Chi tiết tại mục YC2 — Admin đăng nhập và quản lý sản phẩm.
- **Tự kiểm tra:** mở `/frontend/admin/login.html`, đăng nhập demo cục bộ qua OTP, thử trang sản phẩm, lọc/tìm, thêm/sửa/xóa/khôi phục dữ liệu mẫu và kiểm tra guard khi chưa đăng nhập.
