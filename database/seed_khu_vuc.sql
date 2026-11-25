USE monsmokee;
SET NAMES utf8mb4;

-- Khoảng cách dưới đây là giả định để dựng giao diện.
-- CẬP NHẬT THEO THỰC TẾ sau sáp nhập đơn vị hành chính và trước khi tính phí.
INSERT IGNORE INTO khu_vuc_giao_hang
  (tinh, quan_huyen, phuong_xa, khoang_cach_km, ho_tro)
VALUES
  ('Quảng Bình', 'TP. Đồng Hới', 'Phường Bắc Lý', 4.5, 1),
  ('Quảng Bình', 'TP. Đồng Hới', 'Phường Đồng Hải', 3.2, 1),
  ('Quảng Bình', 'TP. Đồng Hới', 'Phường Đồng Mỹ', 2.5, 1),
  ('Quảng Bình', 'TP. Đồng Hới', 'Phường Đồng Phú', 2.0, 1),
  ('Quảng Bình', 'TP. Đồng Hới', 'Phường Đức Ninh', 5.5, 1),
  ('Quảng Bình', 'TP. Đồng Hới', 'Phường Hải Thành', 3.8, 1),
  ('Quảng Bình', 'TP. Đồng Hới', 'Phường Nam Lý', 1.8, 1),
  ('Quảng Bình', 'TP. Đồng Hới', 'Phường Phú Hải', 4.0, 1),
  ('Quảng Bình', 'TP. Đồng Hới', 'Phường Quang Phú', 5.2, 1),
  ('Quảng Bình', 'TP. Đồng Hới', 'Xã Bảo Ninh', 4.8, 1),
  ('Quảng Bình', 'TP. Đồng Hới', 'Xã Đức Ninh', 5.8, 1),
  ('Quảng Bình', 'TP. Đồng Hới', 'Xã Lộc Ninh', 6.0, 1),
  ('Quảng Bình', 'TP. Đồng Hới', 'Xã Nghĩa Ninh', 6.0, 1),
  ('Quảng Bình', 'TP. Đồng Hới', 'Xã Quang Phú', 6.0, 1),
  ('Quảng Bình', 'TP. Đồng Hới', 'Xã Thuận Đức', 6.0, 1);
