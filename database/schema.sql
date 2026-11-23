-- MON SMOKEE - Toàn bộ cấu trúc CSDL
DROP DATABASE IF EXISTS monsmokee;
CREATE DATABASE monsmokee CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE monsmokee;
SET NAMES utf8mb4;
SET time_zone = '+07:00';

CREATE TABLE vai_tro (
  id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ten_vai_tro VARCHAR(20) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE nguoi_dung (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vai_tro_id TINYINT UNSIGNED NOT NULL,
  ho_ten VARCHAR(100) NOT NULL,
  so_dien_thoai CHAR(10) NOT NULL UNIQUE,
  email VARCHAR(150) NOT NULL UNIQUE,
  mat_khau VARCHAR(255) NOT NULL,
  trang_thai TINYINT(1) NOT NULL DEFAULT 1,
  ngay_tao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (vai_tro_id) REFERENCES vai_tro(id)
) ENGINE=InnoDB;

CREATE TABLE otp_xac_thuc (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  muc_dich ENUM('DANG_KY','QUEN_MAT_KHAU','DANG_NHAP_ADMIN') NOT NULL,
  email VARCHAR(150) NOT NULL,
  ma_otp_hash VARCHAR(255) NOT NULL,
  du_lieu_tam JSON NULL,
  het_han_luc DATETIME NOT NULL,
  so_lan_nhap_sai TINYINT UNSIGNED NOT NULL DEFAULT 0,
  da_su_dung TINYINT(1) NOT NULL DEFAULT 0,
  ip VARCHAR(45) NULL,
  ngay_tao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_otp (email, muc_dich, ngay_tao)
) ENGINE=InnoDB;

CREATE TABLE rate_limit (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  khoa VARCHAR(190) NOT NULL UNIQUE,
  so_lan INT UNSIGNED NOT NULL DEFAULT 0,
  bat_dau DATETIME NOT NULL,
  khoa_den DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE danh_muc (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ten_danh_muc VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(120) NOT NULL UNIQUE,
  icon VARCHAR(100) NULL,
  thu_tu INT NOT NULL DEFAULT 0,
  trang_thai TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE san_pham (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  danh_muc_id INT UNSIGNED NOT NULL,
  ten_san_pham VARCHAR(200) NOT NULL,
  ten_khong_dau VARCHAR(200) NOT NULL,
  mo_ta TEXT NULL,
  hinh_anh VARCHAR(255) NULL,
  don_vi_tinh VARCHAR(30) NULL,
  gia_ban DECIMAL(12,0) NOT NULL CHECK (gia_ban > 0),
  so_luong_ton INT NOT NULL DEFAULT 0 CHECK (so_luong_ton >= 0),
  muc_ton_toi_thieu INT NOT NULL DEFAULT 10,
  trang_thai TINYINT(1) NOT NULL DEFAULT 1,
  giam_can_han TINYINT(1) NOT NULL DEFAULT 0,
  phan_tram_giam_can_han TINYINT UNSIGNED NOT NULL DEFAULT 0,
  luot_ban INT UNSIGNED NOT NULL DEFAULT 0,
  ngay_tao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (danh_muc_id) REFERENCES danh_muc(id),
  INDEX idx_sp_ten (ten_khong_dau),
  INDEX idx_sp_dm (danh_muc_id, trang_thai)
) ENGINE=InnoDB;

CREATE TABLE san_pham_mua_kem (
  san_pham_id INT UNSIGNED NOT NULL,
  san_pham_goi_y_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (san_pham_id, san_pham_goi_y_id),
  FOREIGN KEY (san_pham_id) REFERENCES san_pham(id),
  FOREIGN KEY (san_pham_goi_y_id) REFERENCES san_pham(id)
) ENGINE=InnoDB;

CREATE TABLE khuyen_mai (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ma_khuyen_mai VARCHAR(30) NOT NULL UNIQUE,
  ten_chuong_trinh VARCHAR(150) NOT NULL,
  loai ENUM('THU_SAU','CAN_HAN','KHAC') NOT NULL DEFAULT 'THU_SAU',
  phan_tram_giam TINYINT UNSIGNED NOT NULL CHECK (phan_tram_giam BETWEEN 1 AND 100),
  so_tien_giam_toi_da DECIMAL(12,0) NULL,
  che_do_chon_sp ENUM('THU_CONG','NGAU_NHIEN') NOT NULL DEFAULT 'THU_CONG',
  so_san_pham INT NOT NULL DEFAULT 10,
  lich_chay_thu TINYINT NULL COMMENT '1=Thứ 2 ... 5=Thứ 6 ... 7=CN',
  ngay_bat_dau DATETIME NOT NULL,
  ngay_ket_thuc DATETIME NOT NULL,
  trang_thai TINYINT(1) NOT NULL DEFAULT 1,
  CHECK (ngay_ket_thuc >= ngay_bat_dau)
) ENGINE=InnoDB;

CREATE TABLE khuyen_mai_san_pham (
  khuyen_mai_id INT UNSIGNED NOT NULL,
  san_pham_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (khuyen_mai_id, san_pham_id),
  FOREIGN KEY (khuyen_mai_id) REFERENCES khuyen_mai(id) ON DELETE CASCADE,
  FOREIGN KEY (san_pham_id) REFERENCES san_pham(id)
) ENGINE=InnoDB;

CREATE TABLE khu_vuc_giao_hang (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tinh VARCHAR(80) NOT NULL,
  quan_huyen VARCHAR(80) NOT NULL,
  phuong_xa VARCHAR(80) NOT NULL,
  khoang_cach_km DECIMAL(4,1) NOT NULL,
  ho_tro TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE gio_hang (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  san_pham_id INT UNSIGNED NOT NULL,
  so_luong INT NOT NULL CHECK (so_luong > 0),
  ngay_cap_nhat DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_gio (user_id, san_pham_id),
  FOREIGN KEY (user_id) REFERENCES nguoi_dung(id),
  FOREIGN KEY (san_pham_id) REFERENCES san_pham(id)
) ENGINE=InnoDB;

CREATE TABLE don_hang (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ma_don VARCHAR(20) NOT NULL UNIQUE,
  user_id INT UNSIGNED NOT NULL,
  ten_nguoi_nhan VARCHAR(100) NOT NULL,
  sdt_nguoi_nhan CHAR(10) NOT NULL,
  phuong_thuc_nhan ENUM('COD','CLICK_COLLECT') NOT NULL,
  trang_thai ENUM('CHO_XU_LY','DANG_GIAO','CHO_LAY_HANG','THANH_CONG','DA_HUY') NOT NULL DEFAULT 'CHO_XU_LY',
  dia_chi_chi_tiet VARCHAR(255) NULL,
  khu_vuc_id INT UNSIGNED NULL,
  khoang_cach_km DECIMAL(4,1) NULL,
  gio_mong_muon_nhan DATETIME NULL,
  gio_hen_lay DATETIME NULL,
  thoi_gian_giao_du_kien VARCHAR(100) NULL,
  tong_tien_hang DECIMAL(12,0) NOT NULL,
  so_tien_duoc_giam DECIMAL(12,0) NOT NULL DEFAULT 0,
  khuyen_mai_id INT UNSIGNED NULL,
  phi_ship_tam_tinh DECIMAL(12,0) NOT NULL DEFAULT 0,
  phi_van_chuyen DECIMAL(12,0) NOT NULL DEFAULT 0,
  phi_ship_da_chot TINYINT(1) NOT NULL DEFAULT 0,
  tong_thanh_toan DECIMAL(12,0) NOT NULL,
  da_tru_kho TINYINT(1) NOT NULL DEFAULT 0,
  ly_do_huy VARCHAR(255) NULL,
  ghi_chu VARCHAR(500) NULL,
  ngay_tao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  ngay_hoan_thanh DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES nguoi_dung(id),
  FOREIGN KEY (khuyen_mai_id) REFERENCES khuyen_mai(id),
  FOREIGN KEY (khu_vuc_id) REFERENCES khu_vuc_giao_hang(id),
  INDEX idx_dh_user (user_id, ngay_tao),
  INDEX idx_dh_cron (phuong_thuc_nhan, trang_thai, gio_hen_lay),
  INDEX idx_dh_tt (trang_thai, ngay_tao)
) ENGINE=InnoDB;

CREATE TABLE chi_tiet_don_hang (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  don_hang_id INT UNSIGNED NOT NULL,
  san_pham_id INT UNSIGNED NOT NULL,
  ten_san_pham_luc_dat VARCHAR(200) NOT NULL,
  so_luong INT NOT NULL CHECK (so_luong > 0),
  gia_goc DECIMAL(12,0) NOT NULL,
  phan_tram_giam TINYINT UNSIGNED NOT NULL DEFAULT 0,
  gia_chot DECIMAL(12,0) NOT NULL,
  FOREIGN KEY (don_hang_id) REFERENCES don_hang(id) ON DELETE CASCADE,
  FOREIGN KEY (san_pham_id) REFERENCES san_pham(id)
) ENGINE=InnoDB;

CREATE TABLE danh_gia (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  san_pham_id INT UNSIGNED NOT NULL,
  don_hang_id INT UNSIGNED NOT NULL,
  so_sao TINYINT UNSIGNED NOT NULL CHECK (so_sao BETWEEN 1 AND 5),
  binh_luan VARCHAR(1000) NULL,
  ngay_tao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dg (user_id, san_pham_id, don_hang_id),
  FOREIGN KEY (user_id) REFERENCES nguoi_dung(id),
  FOREIGN KEY (san_pham_id) REFERENCES san_pham(id),
  FOREIGN KEY (don_hang_id) REFERENCES don_hang(id)
) ENGINE=InnoDB;

CREATE TABLE phieu_nhap_kho (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ma_phieu VARCHAR(20) NOT NULL UNIQUE,
  admin_id INT UNSIGNED NOT NULL,
  ngay_nhap DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tong_tien_nhap DECIMAL(14,0) NOT NULL DEFAULT 0,
  ghi_chu VARCHAR(255) NULL,
  FOREIGN KEY (admin_id) REFERENCES nguoi_dung(id)
) ENGINE=InnoDB;

CREATE TABLE chi_tiet_phieu_nhap (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  phieu_nhap_id INT UNSIGNED NOT NULL,
  san_pham_id INT UNSIGNED NOT NULL,
  so_luong_nhap INT NOT NULL CHECK (so_luong_nhap > 0),
  gia_nhap DECIMAL(12,0) NOT NULL CHECK (gia_nhap >= 0),
  ngay_san_xuat DATE NOT NULL,
  han_su_dung DATE NOT NULL,
  CHECK (han_su_dung > ngay_san_xuat),
  FOREIGN KEY (phieu_nhap_id) REFERENCES phieu_nhap_kho(id) ON DELETE CASCADE,
  FOREIGN KEY (san_pham_id) REFERENCES san_pham(id)
) ENGINE=InnoDB;

CREATE TABLE lo_hang (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  san_pham_id INT UNSIGNED NOT NULL,
  chi_tiet_phieu_nhap_id INT UNSIGNED NULL,
  ngay_san_xuat DATE NOT NULL,
  han_su_dung DATE NOT NULL,
  so_luong_nhap INT NOT NULL,
  so_luong_con INT NOT NULL CHECK (so_luong_con >= 0),
  FOREIGN KEY (san_pham_id) REFERENCES san_pham(id),
  FOREIGN KEY (chi_tiet_phieu_nhap_id) REFERENCES chi_tiet_phieu_nhap(id),
  INDEX idx_lo_hsd (han_su_dung, so_luong_con)
) ENGINE=InnoDB;

CREATE TABLE lich_su_kho (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  san_pham_id INT UNSIGNED NOT NULL,
  loai_giao_dich ENUM('NHAP_KHO','BAN_HANG','HUY_DON','DIEU_CHINH') NOT NULL,
  so_luong_thay_doi INT NOT NULL,
  ton_sau_giao_dich INT NOT NULL,
  tham_chieu_loai VARCHAR(30) NULL,
  tham_chieu_id INT UNSIGNED NULL,
  nguoi_thuc_hien_id INT UNSIGNED NULL,
  ghi_chu VARCHAR(255) NULL,
  ngay_tao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (san_pham_id) REFERENCES san_pham(id),
  INDEX idx_lsk (san_pham_id, ngay_tao)
) ENGINE=InnoDB;

CREATE TABLE nhat_ky_cron (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ten_job VARCHAR(60) NOT NULL,
  so_ban_ghi_xu_ly INT NOT NULL DEFAULT 0,
  ket_qua VARCHAR(500) NULL,
  ngay_chay DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
