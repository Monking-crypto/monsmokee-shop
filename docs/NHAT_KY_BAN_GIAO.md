# Nhật ký bàn giao frontend

## 2026-11-22 — Trang Cận hạn riêng (A5)

- **File:** `frontend/can-han.html`, `frontend/assets/js/pages/near-expiry.js`, `frontend/assets/js/components/product-card.js`, `frontend/assets/css/customer.css`, `docs/FRONTEND_CHO_BACKEND.md`.
- **API backend cần có:** `GET /products?near_expiry=1&sort=hsd&per_page=20`; mỗi sản phẩm trả `near_expiry_days`, `hsd`, `phan_tram_giam`, `so_luong_ton`. Chi tiết tại mục YC2 — Trang cận hạn trong tài liệu bàn giao.
- **Tự kiểm tra:** mở `/frontend/can-han.html`, kiểm tra 8 sản phẩm được xếp theo ngày gần nhất, chọn các chip hạn dùng, và thử ở 360px, 768px, 1280px.
