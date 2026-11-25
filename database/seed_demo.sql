USE monsmokee;
SET NAMES utf8mb4;

INSERT INTO danh_muc (ten_danh_muc, slug, icon, thu_tu) VALUES
('Nước giải khát', 'nuoc-giai-khat', 'box', 1),
('Mì & thực phẩm khô', 'mi-thuc-pham-kho', 'box', 2),
('Bánh kẹo', 'banh-keo', 'box', 3),
('Sữa – Trứng – Đông lạnh', 'sua-trung-dong-lanh', 'box', 4),
('Gia vị – Dầu ăn', 'gia-vi-dau-an', 'box', 5)
ON DUPLICATE KEY UPDATE
    id = id;

INSERT INTO san_pham
    (danh_muc_id, ten_san_pham, ten_khong_dau, mo_ta, hinh_anh, don_vi_tinh,
     gia_ban, so_luong_ton, muc_ton_toi_thieu, trang_thai)
SELECT d.id, demo.ten_san_pham, demo.ten_khong_dau, demo.mo_ta,
       'placeholder-product.svg', demo.don_vi_tinh, demo.gia_ban,
       demo.so_luong_ton, demo.muc_ton_toi_thieu, 1
FROM (
    SELECT 'nuoc-giai-khat' AS slug, 'Nước suối Aquafina 500ml' AS ten_san_pham,
           'nuoc suoi aquafina 500ml' AS ten_khong_dau,
           'Nước tinh khiết đóng chai tiện mang theo.' AS mo_ta,
           'chai' AS don_vi_tinh, 6000 AS gia_ban, 80 AS so_luong_ton, 10 AS muc_ton_toi_thieu
    UNION ALL SELECT 'nuoc-giai-khat', 'Trà xanh Không Độ 455ml',
           'tra xanh khong do 455ml', 'Trà xanh đóng chai, dùng lạnh ngon hơn.',
           'chai', 10000, 60, 10
    UNION ALL SELECT 'nuoc-giai-khat', 'Coca-Cola lon 320ml',
           'coca cola lon 320ml', 'Nước giải khát có gas lon 320ml.',
           'lon', 12000, 72, 10
    UNION ALL SELECT 'nuoc-giai-khat', 'Nước cam Twister 350ml',
           'nuoc cam twister 350ml', 'Thức uống hương cam đóng chai.',
           'chai', 11000, 45, 10
    UNION ALL SELECT 'mi-thuc-pham-kho', 'Mì Hảo Hảo tôm chua cay 75g',
           'mi hao hao tom chua cay 75g', 'Mì ăn liền vị tôm chua cay.',
           'gói', 4500, 120, 20
    UNION ALL SELECT 'mi-thuc-pham-kho', 'Mì Omachi sườn hầm 80g',
           'mi omachi suon ham 80g', 'Mì khoai tây ăn liền vị sườn hầm.',
           'gói', 8000, 75, 15
    UNION ALL SELECT 'mi-thuc-pham-kho', 'Phở khô Vifon 400g',
           'pho kho vifon 400g', 'Bánh phở khô dùng cho món nước hoặc xào.',
           'gói', 22000, 35, 10
    UNION ALL SELECT 'mi-thuc-pham-kho', 'Miến dong Việt Cường 500g',
           'mien dong viet cuong 500g', 'Miến dong khô sợi dai.',
           'gói', 42000, 25, 8
    UNION ALL SELECT 'banh-keo', 'Bánh quy Cosy Marie 300g',
           'banh quy cosy marie 300g', 'Bánh quy giòn nhẹ dùng ăn sáng hoặc ăn vặt.',
           'gói', 32000, 30, 8
    UNION ALL SELECT 'banh-keo', 'Bánh Oreo socola 133g',
           'banh oreo socola 133g', 'Bánh quy kẹp kem vị socola.',
           'gói', 18000, 40, 10
    UNION ALL SELECT 'banh-keo', 'Snack Oishi tôm cay 90g',
           'snack oishi tom cay 90g', 'Snack giòn vị tôm cay.',
           'gói', 12000, 50, 10
    UNION ALL SELECT 'banh-keo', 'Kẹo Alpenliebe dâu 90g',
           'keo alpenliebe dau 90g', 'Kẹo mềm vị dâu đóng gói.',
           'gói', 15000, 28, 8
    UNION ALL SELECT 'sua-trung-dong-lanh', 'Sữa tươi Vinamilk 100% 1L',
           'sua tuoi vinamilk 100 1l', 'Sữa tươi tiệt trùng hộp 1 lít.',
           'hộp', 36000, 36, 10
    UNION ALL SELECT 'sua-trung-dong-lanh', 'Sữa đặc Ông Thọ 380g',
           'sua dac ong tho 380g', 'Sữa đặc có đường hộp 380g.',
           'hộp', 30000, 32, 8
    UNION ALL SELECT 'sua-trung-dong-lanh', 'Trứng gà ta hộp 10 quả',
           'trung ga ta hop 10 qua', 'Trứng gà ta đóng hộp 10 quả.',
           'hộp', 42000, 20, 6
    UNION ALL SELECT 'sua-trung-dong-lanh', 'Phô mai lát 100g',
           'pho mai lat 100g', 'Phô mai lát dùng ăn sáng hoặc làm bánh.',
           'gói', 34000, 18, 5
    UNION ALL SELECT 'gia-vi-dau-an', 'Dầu ăn Tường An 1L',
           'dau an tuong an 1l', 'Dầu thực vật chai 1 lít.',
           'chai', 58000, 30, 8
    UNION ALL SELECT 'gia-vi-dau-an', 'Nước mắm Nam Ngư 500ml',
           'nuoc mam nam ngu 500ml', 'Nước mắm dùng nêm nếm hằng ngày.',
           'chai', 32000, 34, 8
    UNION ALL SELECT 'gia-vi-dau-an', 'Đường Biên Hòa 1kg',
           'duong bien hoa 1kg', 'Đường tinh luyện túi 1kg.',
           'túi', 28000, 25, 8
    UNION ALL SELECT 'gia-vi-dau-an', 'Tương ớt Chinsu 250g',
           'tuong ot chinsu 250g', 'Tương ớt chai 250g.',
           'chai', 16000, 40, 10
) AS demo
JOIN danh_muc d ON d.slug = demo.slug
WHERE NOT EXISTS (
    SELECT 1
    FROM san_pham existing
    WHERE existing.danh_muc_id = d.id
      AND existing.ten_khong_dau = demo.ten_khong_dau
);
