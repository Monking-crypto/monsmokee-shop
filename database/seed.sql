USE monsmokee;
SET NAMES utf8mb4;

INSERT INTO vai_tro (ten_vai_tro) VALUES ('Admin'), ('Customer');

INSERT INTO danh_muc (ten_danh_muc, slug, icon, thu_tu) VALUES
('Nước giải khát','nuoc-giai-khat','droplet',1),
('Mì & thực phẩm khô','mi-thuc-pham-kho','box',2),
('Bánh kẹo','banh-keo','cookie',3),
('Sữa – Trứng – Đông lạnh','sua-trung-dong-lanh','egg-fried',4),
('Gia vị – Dầu ăn','gia-vi-dau-an','basket',5),
('Đồ dùng sinh hoạt','do-dung-sinh-hoat','house',6);

INSERT INTO san_pham (danh_muc_id, ten_san_pham, ten_khong_dau, mo_ta, hinh_anh, don_vi_tinh, gia_ban, so_luong_ton, muc_ton_toi_thieu, luot_ban) VALUES
(1,'Nước suối 500ml','nuoc suoi 500ml','Nước uống đóng chai tiện lợi','placeholder-product.svg','chai',5000,100,10,34),
(1,'Trà xanh chai','tra xanh chai','Trà vị thanh mát','placeholder-product.svg','chai',10000,80,10,28),
(1,'Nước ngọt lon','nuoc ngot lon','Nước ngọt lon giải khát','placeholder-product.svg','lon',12000,60,10,26),
(1,'Sữa đậu nành 300ml','sua dau nanh 300ml','Sữa đậu nành tiện dụng','placeholder-product.svg','hộp',9000,45,10,19),
(2,'Mì tôm gói','mi tom goi','Mì ăn liền tiện lợi','placeholder-product.svg','gói',4000,150,20,90),
(2,'Mì trộn gói','mi tron goi','Mì trộn vị đậm đà','placeholder-product.svg','gói',6500,90,15,55),
(2,'Bún khô','bun kho','Bún khô dùng cho nhiều món','placeholder-product.svg','gói',18000,50,10,20),
(2,'Hủ tiếu khô','hu tieu kho','Hủ tiếu ăn nhanh','placeholder-product.svg','gói',19000,30,10,16),
(3,'Bánh quy bơ','banh quy bo','Bánh quy giòn','placeholder-product.svg','gói',24000,40,10,30),
(3,'Bánh gạo','banh gao','Bánh gạo giòn nhẹ','placeholder-product.svg','gói',18000,35,10,22),
(3,'Kẹo socola','keo socola','Kẹo socola vị cacao','placeholder-product.svg','gói',35000,25,8,18),
(3,'Snack khoai tây','snack khoai tay','Snack giòn rụm','placeholder-product.svg','gói',15000,55,10,42),
(4,'Sữa tươi 1 lít','sua tuoi 1 lit','Sữa tươi hộp 1 lít','placeholder-product.svg','hộp',32000,48,10,40),
(4,'Trứng gà 10 quả','trung ga 10 qua','Trứng gà tươi','placeholder-product.svg','vỉ',35000,25,8,38),
(4,'Thịt heo đông lạnh','thit heo dong lanh','Thịt đông lạnh tiện chế biến','placeholder-product.svg','gói',65000,18,5,15),
(4,'Xúc xích','xuc xich','Xúc xích chế biến sẵn','placeholder-product.svg','gói',42000,35,8,25),
(5,'Dầu ăn 1 lít','dau an 1 lit','Dầu ăn nấu đa dụng','placeholder-product.svg','chai',55000,60,10,45),
(5,'Nước mắm','nuoc mam','Nước mắm gia vị','placeholder-product.svg','chai',38000,40,10,23),
(5,'Muối iốt','muoi iot','Muối iốt nhà bếp','placeholder-product.svg','gói',8000,100,15,27),
(5,'Tương ớt','tuong ot','Tương ớt cay nhẹ','placeholder-product.svg','chai',28000,45,10,21),
(6,'Xà phòng tắm','xa phong tam','Xà phòng tắm hằng ngày','placeholder-product.svg','cái',22000,70,10,33),
(6,'Dầu gội','dau goi','Dầu gội sạch tóc','placeholder-product.svg','chai',48000,50,10,29),
(6,'Giấy vệ sinh','giay ve sinh','Giấy vệ sinh mềm','placeholder-product.svg','cuộn',18000,6,10,20),
(6,'Nước lau nhà','nuoc lau nha','Nước lau nhà hương thơm','placeholder-product.svg','chai',45000,0,8,12);

INSERT INTO khuyen_mai (ma_khuyen_mai, ten_chuong_trinh, loai, phan_tram_giam, che_do_chon_sp, so_san_pham, lich_chay_thu, ngay_bat_dau, ngay_ket_thuc, trang_thai)
VALUES ('FRIDAY10','Siêu Sale Thứ 6','THU_SAU',10,'THU_CONG',10,5,'2026-01-01 00:00:00','2030-12-31 23:59:59',1);

INSERT INTO khuyen_mai_san_pham (khuyen_mai_id, san_pham_id)
SELECT 1, id FROM san_pham WHERE id BETWEEN 1 AND 10;

INSERT INTO san_pham_mua_kem (san_pham_id, san_pham_goi_y_id) VALUES
(5,14),(5,16),(17,21),(22,21),(13,14),(11,12);

-- Lô cận hạn cho kiểm thử cron và trang khuyến mãi
INSERT INTO lo_hang (san_pham_id, chi_tiet_phieu_nhap_id, ngay_san_xuat, han_su_dung, so_luong_nhap, so_luong_con)
SELECT id, NULL, DATE_SUB(CURRENT_DATE, INTERVAL 60 DAY), DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY), 20, 20
FROM san_pham WHERE id IN (13,14,16);

UPDATE san_pham
SET giam_can_han=1, phan_tram_giam_can_han=50
WHERE id IN (13,14,16);
